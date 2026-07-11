import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('FIRESTORE_EMULATOR_HOST が未設定です。本番への誤投入を防ぐため停止します。');
  process.exit(1);
}

const inputPath = resolve(process.argv[2] || 'firestore_export.json');
const projectId = process.env.FIREBASE_PROJECT_ID || 'demo-saikaku';
if (!getApps().length) initializeApp({ projectId });
const db = getFirestore();

function revive(value, key = '') {
  if (Array.isArray(value)) return value.map((item) => revive(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([childKey]) => childKey !== '_subcollections')
      .map(([childKey, child]) => [childKey, revive(child, childKey)]));
  }
  if (typeof value === 'string' && /At$/.test(key) && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return Timestamp.fromDate(date);
  }
  return value;
}

async function seedCollection(name, records) {
  const entries = Object.entries(records || {});
  let batch = db.batch();
  let pending = 0;
  let written = 0;
  for (const [id, raw] of entries) {
    batch.set(db.collection(name).doc(id), revive(raw));
    pending += 1;
    written += 1;
    if (pending === 400) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
  if (pending > 0) await batch.commit();
  return written;
}

const parsed = JSON.parse(await readFile(inputPath, 'utf8'));
const results = await seedCollection('results', parsed.results);
const uaam = await seedCollection('uaam_results', parsed.uaam_results);
console.log(`emulator seed complete: results=${results}, uaam_results=${uaam}`);

