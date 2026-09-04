import { createHash, timingSafeEqual } from 'node:crypto';
import { db } from '../lib/firebaseAdmin.js';
import { buildNsAcademyLookupResponse } from '../lib/nsAcademyLookup.js';

function bearerToken(req) {
  const authorization = req.headers?.authorization;
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return null;
  return authorization.slice('Bearer '.length);
}

function authorized(req) {
  const expected = process.env.NS_ACADEMY_LOOKUP_SECRET;
  const received = bearerToken(req);
  if (typeof expected !== 'string' || expected.length === 0 || received === null) return false;

  const expectedDigest = createHash('sha256').update(expected).digest();
  const receivedDigest = createHash('sha256').update(received).digest();
  return timingSafeEqual(expectedDigest, receivedDigest);
}

function normalizedEmail(value) {
  if (typeof value !== 'string') return null;

  const email = value.trim().toLowerCase();
  if (email.length === 0 || email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export default async function handler(req, res) {
  const startedAt = Date.now();
  const docCounts = { results: 0, uaamResults: 0 };
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    if (!authorized(req)) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const email = normalizedEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ error: 'invalid_email' });
    }

    const [resultsSnapshot, uaamResultsSnapshot] = await Promise.all([
      db.collection('results').where('email', '==', email).limit(2).get(),
      db.collection('uaam_results').where('email', '==', email).limit(2).get(),
    ]);
    docCounts.results = resultsSnapshot.size;
    docCounts.uaamResults = uaamResultsSnapshot.size;

    if (resultsSnapshot.size === 2 || uaamResultsSnapshot.size === 2) {
      return res.status(409).json({ error: 'ambiguous_identity' });
    }

    const resultsSource = resultsSnapshot.empty ? null : resultsSnapshot.docs[0].data();
    const uaamResultsSource = uaamResultsSnapshot.empty ? null : uaamResultsSnapshot.docs[0].data();
    return res.status(200).json(buildNsAcademyLookupResponse(resultsSource, uaamResultsSource));
  } catch {
    return res.status(500).json({ error: 'internal_error' });
  } finally {
    console.info(JSON.stringify({
      method: req.method,
      status: res.statusCode,
      duration_ms: Date.now() - startedAt,
      results_doc_count: docCounts.results,
      uaam_results_doc_count: docCounts.uaamResults,
    }));
  }
}
