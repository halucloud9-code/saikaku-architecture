import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const isEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;

if (!getApps().length) {
  if (isEmulator) {
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-saikaku' });
    console.log('[firebase-admin] emulator mode: firestore=', process.env.FIRESTORE_EMULATOR_HOST, 'auth=', process.env.FIREBASE_AUTH_EMULATOR_HOST);
  } else {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
  }
}

export const db = getFirestore();

export const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);
