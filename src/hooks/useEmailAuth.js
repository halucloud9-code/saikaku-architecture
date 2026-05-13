import { useEffect, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  db,
  sendVerificationEmail,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  signUpWithEmail,
} from '../firebase';

export const AUTH_ERROR_MESSAGES = {
  'auth/email-already-in-use': 'このメールアドレスはすでに登録されています。「ログイン」タブからサインインしてください。',
  'auth/invalid-email': 'メールアドレスの形式が正しくありません',
  'auth/weak-password': 'パスワードは6文字以上で設定してください',
  'auth/user-not-found': 'メールアドレスが見つかりません',
  'auth/wrong-password': 'パスワードが正しくありません',
  'auth/invalid-credential': 'メールアドレスまたはパスワードが正しくありません',
};

export const saveConsent = async (user) => {
  const docRef = doc(db, 'results', user.uid);
  const snap = await getDoc(docRef);
  if (!snap.data()?.consentAt) {
    await setDoc(docRef, { consentAt: serverTimestamp() }, { merge: true });
  }
};

const buildVerificationRequestBody = (email, uid, continueUrl) => {
  const body = { email, uid };
  if (typeof continueUrl === 'string' && continueUrl.trim()) {
    body.continueUrl = continueUrl;
  }
  return body;
};

export function useEmailAuth({ onLogin, continueUrl } = {}) {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [authMode, setAuthMode] = useState('google'); // 'google' | 'email'
  const [emailMode, setEmailMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [verificationSent, setVerificationSent] = useState(false); // 確認メール送信済み
  const [fromEmail, setFromEmail] = useState('noreply@saikaku-architecture.com'); // 表示用送信元アドレス
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0); // 再送クールダウン秒数

  // 再送クールダウンタイマー
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const requestVerificationEmail = async (targetEmail, uid) => {
    const res = await fetch('/api/send-verification-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildVerificationRequestBody(targetEmail, uid, continueUrl)),
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  };

  const requestVerificationEmailWithFallback = async (targetEmail, user) => {
    try {
      const { res, data } = await requestVerificationEmail(targetEmail, user.uid);
      // 送信元アドレスを保存（UI表示用）
      if (data.from_email) setFromEmail(data.from_email);
      // カスタム API 未設定またはエラー → Firebase デフォルトで送信
      if (!res.ok || data.method === 'firebase_default') {
        try { await sendVerificationEmail(user); } catch (_) {}
      }
    } catch (_) {
      // フォールバック: Firebase デフォルト（こちらも失敗を許容）
      try { await sendVerificationEmail(user); } catch (_) {}
    }
  };

  const handleLogin = async () => {
    if (!agreed) return;
    setLoading(true);
    setError('');
    try {
      const result = await signInWithGoogle();
      if (result && result.user) {
        await saveConsent(result.user);
        onLogin(result.user);
      }
    } catch (e) {
      if (e.code !== 'auth/popup-closed-by-user') {
        setError('ログインに失敗しました。再度お試しください。');
      }
      setLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    if (!agreed) return;
    setError('');
    if (emailMode === 'signup' && !displayName) { setError('お名前を入力してください'); return; }
    if (!email) { setError('メールアドレスを入力してください'); return; }
    if (!password) { setError('パスワードを入力してください'); return; }
    if (emailMode === 'signup') {
      if (!passwordConfirm) { setError('確認用のパスワードをもう一度入力してください'); return; }
      if (password !== passwordConfirm) { setError('パスワードが一致しません。再度ご確認ください。'); return; }
    }
    setLoading(true);
    try {
      let result;
      if (emailMode === 'signup') {
        result = await signUpWithEmail(email, password, displayName);
        // 確認メール送信（失敗してもアカウント作成は成功として扱う）
        await requestVerificationEmailWithFallback(email, result.user);
        await signOutUser();
        setVerificationSent(true);
        setResendCooldown(60);
        setLoading(false);
        return;
      } else {
        result = await signInWithEmail(email, password);
        // メールアドレス未確認 → 確認メールを再送して確認画面へ
        if (!result.user.emailVerified) {
          await requestVerificationEmailWithFallback(email, result.user);
          await signOutUser();
          setVerificationSent(true);
          setResendCooldown(60);
          setLoading(false);
          return;
        }
      }
      await saveConsent(result.user);
      onLogin(result.user);
    } catch (e) {
      // 未確認ユーザーの再登録を救済: サインインして確認メールを再送
      if (e.code === 'auth/email-already-in-use' && emailMode === 'signup') {
        try {
          const existing = await signInWithEmail(email, password);
          if (!existing.user.emailVerified) {
            // 未確認 → 確認メールを再送
            await requestVerificationEmailWithFallback(email, existing.user);
            await signOutUser();
            setVerificationSent(true);
            setResendCooldown(60);
            setLoading(false);
            return;
          }
          // 確認済み → ログインを案内
          await signOutUser();
          setError('このメールアドレスはすでに登録・確認済みです。「ログイン」タブからサインインしてください。');
          setLoading(false);
          return;
        } catch (_) {
          // パスワード不一致 → 通常のエラーメッセージへ
        }
      }
      setError(AUTH_ERROR_MESSAGES[e.code] || 'エラーが発生しました。再度お試しください。');
      setLoading(false);
    }
  };

  // 確認メール再送信
  const handleResendVerification = async () => {
    if (!email) {
      setResendMsg('❌ メールアドレスが取得できません。一度ログイン画面に戻って再登録してください。');
      return;
    }
    setResendLoading(true);
    setResendMsg('');
    try {
      const { res, data } = await requestVerificationEmail(email, '_resend_');
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      // カスタム API 未設定 → Firebase デフォルトで送信
      if (data.method === 'firebase_default' && password) {
        const result = await signInWithEmail(email, password);
        await sendVerificationEmail(result.user);
        await signOutUser();
      }
      if (data.from_email) setFromEmail(data.from_email);
      setResendMsg('✅ 確認メールを再送しました。最新のメールのリンクを使ってください');
      setResendCooldown(60);
    } catch (e) {
      console.error('[resend]', e);
      const msg = (e.message?.includes('TOO_MANY') || e.message?.includes('送信回数'))
        ? '⏳ 送信回数の制限に達しました。数分後にもう一度お試しください。'
        : `❌ 再送信に失敗しました：${e.message}`;
      setResendMsg(msg);
    }
    setResendLoading(false);
  };

  return {
    state: {
      agreed,
      loading,
      error,
      authMode,
      emailMode,
      email,
      password,
      passwordConfirm,
      displayName,
      verificationSent,
      fromEmail,
      resendLoading,
      resendMsg,
      resendCooldown,
    },
    handlers: {
      setAgreed,
      setError,
      setAuthMode,
      setEmailMode,
      setEmail,
      setPassword,
      setPasswordConfirm,
      setDisplayName,
      setVerificationSent,
      handleLogin,
      handleEmailAuth,
      handleResendVerification,
    },
  };
}
