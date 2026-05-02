import { db } from '../lib/firebaseAdmin.js';
import { serializeTimestamps } from '../lib/serialize.js';
import { authenticateMeRequest, withMeHandler } from './_auth.js';

export default withMeHandler(async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const decoded = await authenticateMeRequest(req, res);
  if (!decoded) return undefined;

  const snapshot = await db.collection('uaam_results').doc(decoded.uid).get();
  if (!snapshot.exists) {
    return res.status(200).json({ scores: null, analysis: null });
  }

  const data = snapshot.data() || {};
  if (!data.scores || !data.analysis) {
    return res.status(200).json({ scores: null, analysis: null });
  }

  return res.status(200).json(serializeTimestamps({
    scores: data.scores,
    analysis: data.analysis,
  }));
});
