import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Firebase モック
const mockSignUpWithEmail = vi.fn();
const mockSignInWithEmail = vi.fn();
const mockSendVerificationEmail = vi.fn();
const mockSendPasswordReset = vi.fn();
const mockSignOutUser = vi.fn();

vi.mock('../src/firebase', () => ({
  signInWithGoogle: vi.fn(),
  signInWithEmail: (...args) => mockSignInWithEmail(...args),
  signUpWithEmail: (...args) => mockSignUpWithEmail(...args),
  sendVerificationEmail: (...args) => mockSendVerificationEmail(...args),
  sendPasswordReset: (...args) => mockSendPasswordReset(...args),
  signOutUser: (...args) => mockSignOutUser(...args),
  db: {},
  auth: {},
  googleProvider: {},
  getRedirectResult: vi.fn(),
}));

// Firestore モック
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(() => Promise.resolve({ data: () => ({}) })),
  serverTimestamp: vi.fn(),
}));

import LoginScreen from '../src/screens/LoginScreen';

// ヘルパー: メール認証フォームを表示してフィールドを入力し送信
async function fillAndSubmit(user, container, { email, password, displayName, mode = 'signup' }) {
  // 同意チェック
  const checkbox = screen.getByRole('checkbox');
  await user.click(checkbox);

  // 「メールで入る」タブ
  await user.click(screen.getByText('メールで入る'));

  // signup/login タブ（小さいタブボタン = 最初にマッチする方）
  if (mode === 'signup') {
    await user.click(screen.getAllByText('新規登録')[0]);
  } else {
    await user.click(screen.getAllByText('ログイン')[0]);
  }

  // フィールド入力
  if (displayName && mode === 'signup') {
    await user.type(screen.getByPlaceholderText('お名前（表示名）'), displayName);
  }
  await user.type(screen.getByPlaceholderText('メールアドレス'), email);
  await user.type(screen.getByPlaceholderText('パスワード（6文字以上）'), password);

  // login-btn-gold クラスの送信ボタンをクリック
  const submitBtn = container.querySelector('.login-btn-gold');
  await user.click(submitBtn);
}

// fetch モック: /api/send-verification-email 成功
function mockFetchSuccess() {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ method: 'resend', from_email: 'noreply@test.com' }),
    })
  );
}

// ユーザーオブジェクト
const unverifiedUser = { uid: 'test-uid', email: 'test@example.com', emailVerified: false };
const verifiedUser = { uid: 'test-uid', email: 'test@example.com', emailVerified: true };

describe('LoginScreen メール認証フロー', () => {
  const onLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchSuccess();
    mockSignOutUser.mockResolvedValue();
    mockSendVerificationEmail.mockResolvedValue();
    mockSendPasswordReset.mockResolvedValue();
  });

  // ─── 新規登録 ───

  it('正常な新規登録: 確認メール送信画面に遷移する', async () => {
    const user = userEvent.setup();
    mockSignUpWithEmail.mockResolvedValue({ user: unverifiedUser });
    const { container } = render(<LoginScreen onLogin={onLogin} />);

    await fillAndSubmit(user, container, { email: 'new@example.com', password: 'pass123', displayName: 'テスト' });

    await waitFor(() => {
      expect(screen.getByText('確認メールを送信しました')).toBeInTheDocument();
    });
    expect(mockSignUpWithEmail).toHaveBeenCalledWith('new@example.com', 'pass123', 'テスト');
    expect(mockSignOutUser).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith('/api/send-verification-email', expect.any(Object));
  });

  // ─── 再登録: 同じパスワード + 未確認 ───

  it('再登録（同じパスワード+未確認）: 確認メールを再送して確認画面へ', async () => {
    const user = userEvent.setup();
    const emailInUseError = new Error('email-already-in-use');
    emailInUseError.code = 'auth/email-already-in-use';
    mockSignUpWithEmail.mockRejectedValue(emailInUseError);
    mockSignInWithEmail.mockResolvedValue({ user: unverifiedUser });
    const { container } = render(<LoginScreen onLogin={onLogin} />);

    await fillAndSubmit(user, container, { email: 'existing@example.com', password: 'pass123', displayName: 'テスト' });

    await waitFor(() => {
      expect(screen.getByText('確認メールを送信しました')).toBeInTheDocument();
    });
    expect(mockSignInWithEmail).toHaveBeenCalledWith('existing@example.com', 'pass123');
    expect(mockSignOutUser).toHaveBeenCalled();
  });

  // ─── 再登録: 同じパスワード + 確認済み ───

  it('再登録（同じパスワード+確認済み）: ログイン案内を表示', async () => {
    const user = userEvent.setup();
    const emailInUseError = new Error('email-already-in-use');
    emailInUseError.code = 'auth/email-already-in-use';
    mockSignUpWithEmail.mockRejectedValue(emailInUseError);
    mockSignInWithEmail.mockResolvedValue({ user: verifiedUser });
    const { container } = render(<LoginScreen onLogin={onLogin} />);

    await fillAndSubmit(user, container, { email: 'existing@example.com', password: 'pass123', displayName: 'テスト' });

    await waitFor(() => {
      expect(screen.getByText(/すでに登録・確認済みです/)).toBeInTheDocument();
    });
    expect(onLogin).not.toHaveBeenCalled();
  });

  // ─── 再登録: 違うパスワード → リセット誘導 ───

  it('再登録（違うパスワード）: パスワードリセットボタンを表示', async () => {
    const user = userEvent.setup();
    const emailInUseError = new Error('email-already-in-use');
    emailInUseError.code = 'auth/email-already-in-use';
    mockSignUpWithEmail.mockRejectedValue(emailInUseError);
    const wrongPassError = new Error('wrong-password');
    wrongPassError.code = 'auth/invalid-credential';
    mockSignInWithEmail.mockRejectedValue(wrongPassError);
    const { container } = render(<LoginScreen onLogin={onLogin} />);

    await fillAndSubmit(user, container, { email: 'existing@example.com', password: 'wrongpass', displayName: 'テスト' });

    await waitFor(() => {
      expect(screen.getByText(/パスワードが異なります/)).toBeInTheDocument();
      expect(screen.getByText(/パスワードリセットメールを送信/)).toBeInTheDocument();
    });
  });

  it('パスワードリセットボタンを押すとリセットメールが送信される', async () => {
    const user = userEvent.setup();
    const emailInUseError = new Error('email-already-in-use');
    emailInUseError.code = 'auth/email-already-in-use';
    mockSignUpWithEmail.mockRejectedValue(emailInUseError);
    const wrongPassError = new Error('wrong-password');
    wrongPassError.code = 'auth/invalid-credential';
    mockSignInWithEmail.mockRejectedValue(wrongPassError);
    const { container } = render(<LoginScreen onLogin={onLogin} />);

    await fillAndSubmit(user, container, { email: 'existing@example.com', password: 'wrongpass', displayName: 'テスト' });

    await waitFor(() => {
      expect(screen.getByText(/パスワードリセットメールを送信/)).toBeInTheDocument();
    });

    // リセットボタンを押す
    await user.click(screen.getByText(/パスワードリセットメールを送信/));

    await waitFor(() => {
      expect(mockSendPasswordReset).toHaveBeenCalledWith('existing@example.com');
      expect(screen.getByText(/パスワードリセットメールを送信しました/)).toBeInTheDocument();
    });
  });

  // ─── ログイン: 未確認 → 確認メール再送 ───

  it('ログイン（未確認ユーザー）: 確認メールを再送して確認画面へ', async () => {
    const user = userEvent.setup();
    mockSignInWithEmail.mockResolvedValue({ user: unverifiedUser });
    const { container } = render(<LoginScreen onLogin={onLogin} />);

    await fillAndSubmit(user, container, { email: 'unverified@example.com', password: 'pass123', mode: 'login' });

    await waitFor(() => {
      expect(screen.getByText('確認メールを送信しました')).toBeInTheDocument();
    });
    expect(mockSignOutUser).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith('/api/send-verification-email', expect.any(Object));
    expect(onLogin).not.toHaveBeenCalled();
  });

  // ─── ログイン: 確認済み → 成功 ───

  it('ログイン（確認済みユーザー）: onLogin が呼ばれる', async () => {
    const user = userEvent.setup();
    mockSignInWithEmail.mockResolvedValue({ user: verifiedUser });
    const { container } = render(<LoginScreen onLogin={onLogin} />);

    await fillAndSubmit(user, container, { email: 'verified@example.com', password: 'pass123', mode: 'login' });

    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith(verifiedUser);
    });
  });
});
