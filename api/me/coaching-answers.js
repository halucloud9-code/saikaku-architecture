import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../lib/firebaseAdmin.js';
import { makeCoachingAnswerKey } from '../lib/coachingAnswerKey.js';
import { serializeTimestamps } from '../lib/serialize.js';
import { authenticateMeRequest, withMeHandler } from './_auth.js';

const MAX_ITEMS = 10;
const MAX_QUESTION_TEXT_LENGTH = 500;
const MAX_ANSWER_LENGTH = 2000;

function readCoachingAnswers(data) {
  const answers = data?.coaching_answers;
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return {};
  return answers;
}

function validateItems(body) {
  const items = body?.items;
  if (!Array.isArray(items)) return { error: 'items must be an array' };
  if (items.length === 0) return { error: 'items is empty' };
  if (items.length > MAX_ITEMS) return { error: 'too many items (max 10)' };

  const normalizedItems = [];

  for (const item of items) {
    if (typeof item?.questionText !== 'string') {
      return { error: 'questionText must be a string' };
    }

    const questionText = item.questionText.trim();
    if (questionText.length === 0) {
      return { error: 'questionText is empty' };
    }
    if (questionText.length > MAX_QUESTION_TEXT_LENGTH) {
      return { error: 'questionText is too long (max 500)' };
    }

    if (typeof item?.answer !== 'string') {
      return { error: 'answer must be a string' };
    }

    const answer = item.answer.trim();
    if (answer.length === 0) {
      return { error: 'answer is empty' };
    }
    if (answer.length > MAX_ANSWER_LENGTH) {
      return { error: 'answer is too long (max 2000)' };
    }

    normalizedItems.push({ questionText, answer });
  }

  return { items: normalizedItems };
}

async function getAnswers(uid) {
  const snapshot = await db.collection('uaam_results').doc(uid).get();
  const answers = snapshot.exists ? readCoachingAnswers(snapshot.data() || {}) : {};
  return serializeTimestamps({ answers });
}

async function saveAnswers(uid, items) {
  const docRef = db.collection('uaam_results').doc(uid);
  const before = await docRef.get();
  const existingAnswers = before.exists ? readCoachingAnswers(before.data() || {}) : {};
  const coachingAnswers = {};

  for (const item of items) {
    const qid = makeCoachingAnswerKey(item.questionText);
    const nextAnswer = {
      answer: item.answer,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (!existingAnswers[qid]) {
      nextAnswer.questionText = item.questionText;
      nextAnswer.answeredAt = FieldValue.serverTimestamp();
    }

    coachingAnswers[qid] = {
      ...(coachingAnswers[qid] || {}),
      ...nextAnswer,
    };
  }

  await docRef.set({ coaching_answers: coachingAnswers }, { merge: true });

  const after = await docRef.get();
  const answers = after.exists ? readCoachingAnswers(after.data() || {}) : {};
  return serializeTimestamps({ answers });
}

export default withMeHandler(async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();

  const decoded = await authenticateMeRequest(req, res);
  if (!decoded) return undefined;

  if (req.method === 'GET') {
    return res.status(200).json(await getAnswers(decoded.uid));
  }

  const validation = validateItems(req.body);
  if (validation.error) return res.status(400).json({ error: validation.error });

  return res.status(200).json(await saveAnswers(decoded.uid, validation.items));
});
