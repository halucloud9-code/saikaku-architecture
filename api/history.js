import { getAuth } from 'firebase-admin/auth';
import { db } from './lib/firebaseAdmin.js';
import { listFromAttempts, summarizeFromParent } from '../shared/attemptLogic.js';

function isTimestampLike(value) {
  return value
    && typeof value === 'object'
    && (typeof value.toMillis === 'function' || typeof value.toDate === 'function')
    && (typeof value.seconds === 'number' || typeof value._seconds === 'number');
}

function serializeTimestamps(value) {
  if (!value) return value;

  if (isTimestampLike(value)) {
    return {
      _seconds: value.seconds ?? value._seconds,
      _nanoseconds: value.nanoseconds ?? value._nanoseconds ?? 0,
    };
  }

  if (value instanceof Date) {
    const ms = value.getTime();
    return {
      _seconds: Math.floor(ms / 1000),
      _nanoseconds: (ms % 1000) * 1000000,
    };
  }

  if (Array.isArray(value)) {
    return value.map(serializeTimestamps);
  }

  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, serializeTimestamps(child)]),
    );
  }

  return value;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const idToken = req.headers.authorization?.replace('Bearer ', '');
  if (!idToken) return res.status(401).json({ error: '認証が必要です' });

  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(idToken);
  } catch {
    return res.status(401).json({ error: '認証に失敗しました' });
  }
  const uid = decoded.uid;

  const kind = req.query.kind === 'uaam' ? 'uaam' : 'saikaku';
  const collName = kind === 'uaam' ? 'uaam_results' : 'results';

  const parentRef = db.collection(collName).doc(uid);
  const [parentSnap, attemptsSnap] = await Promise.all([
    parentRef.get(),
    parentRef.collection('attempts').get(),
  ]);

  const parentData = parentSnap.exists ? parentSnap.data() : null;
  const attemptDocs = attemptsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const { committedAttempts, pendingAttempt } = listFromAttempts(attemptDocs, parentData, kind);
  const summary = summarizeFromParent(parentData);

  return res.status(200).json({
    committedAttempts: committedAttempts.map(serializeTimestamps),
    pendingAttempt: pendingAttempt ? serializeTimestamps(pendingAttempt) : null,
    summary: serializeTimestamps(summary),
  });
}
