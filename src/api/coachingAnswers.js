import { auth } from '../firebase';

const TIMEOUT_MS = 30000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getIdToken() {
  if (!auth.currentUser) return null;
  return auth.currentUser.getIdToken();
}

export async function loadCoachingAnswers() {
  try {
    const idToken = await getIdToken();
    if (!idToken) return {};
    const res = await fetchWithTimeout('/api/me/coaching-answers', {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data?.answers || {};
  } catch (e) {
    console.warn('[coachingAnswers] load failed:', e);
    return {};
  }
}

export async function saveCoachingAnswers(items) {
  const idToken = await getIdToken();
  if (!idToken) throw new Error('ログインが必要です');

  const trimmedItems = (items || [])
    .map((it) => ({
      questionText: typeof it?.questionText === 'string' ? it.questionText.trim() : '',
      answer: typeof it?.answer === 'string' ? it.answer.trim() : '',
    }))
    .filter((it) => it.questionText.length > 0 && it.answer.length > 0);

  if (trimmedItems.length === 0) {
    throw new Error('保存する回答がありません');
  }

  const res = await fetchWithTimeout('/api/me/coaching-answers', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ items: trimmedItems }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `保存に失敗しました (${res.status})`);
  }
  return data?.answers || {};
}
