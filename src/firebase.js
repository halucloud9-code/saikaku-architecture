import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  const authPort = Number(import.meta.env.VITE_FIREBASE_EMULATOR_AUTH_PORT) || 9099;
  const firestorePort = Number(import.meta.env.VITE_FIREBASE_EMULATOR_FIRESTORE_PORT) || 8090;
  connectAuthEmulator(auth, `http://localhost:${authPort}`, { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', firestorePort);
  console.log(`[firebase] connected to local emulators (auth:${authPort}, firestore:${firestorePort})`);
}

export const signInWithGoogle = async () => {
  try {
    // ポップアップを試みる（失敗したらリダイレクト）
    return await signInWithPopup(auth, googleProvider);
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/popup-closed-by-user') {
      return signInWithRedirect(auth, googleProvider);
    }
    throw e;
  }
};
export { getRedirectResult };
export const signOutUser = () => signOut(auth);

// メール+パスワード新規登録
export const signUpWithEmail = async (email, password, displayName) => {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) {
    await updateProfile(result.user, { displayName });
  }
  return result;
};

// メール+パスワードログイン
export const signInWithEmail = async (email, password) => {
  return signInWithEmailAndPassword(auth, email, password);
};

// メールアドレス確認メール送信
export const sendVerificationEmail = async (user, actionCodeSettings) => {
  return sendEmailVerification(user, actionCodeSettings);
};

// パスワードリセットメール送信
export const sendPasswordReset = async (email) => {
  return sendPasswordResetEmail(auth, email);
};
