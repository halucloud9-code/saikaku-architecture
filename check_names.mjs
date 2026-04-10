import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

const db = getFirestore();

const snap = await db.collection('results').get();
const keywords = ['saia', 'yamana', '山名', '秋葉', 'akiba', 'hayato', 'はやと'];

console.log('=== 該当ユーザー検索 ===\n');
snap.forEach(doc => {
  const d = doc.data();
  const name = (d.name || d.displayName || '').toLowerCase();
  const email = (d.email || '').toLowerCase();
  const hit = keywords.some(k => name.includes(k.toLowerCase()) || email.includes(k.toLowerCase()));
  if (hit) {
    console.log(`DB名: ${d.name || d.displayName || '—'}`);
    console.log(`Email: ${d.email || '—'}`);
    console.log(`才覚領域: ${d.selectedKakuchiiki || d.result?.kakuchiiki || '—'}`);
    console.log('---');
  }
});
