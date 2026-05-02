export {
  listFromAttempts,
  summarizeFromParent,
  timestampToMillis,
} from '../../shared/attemptLogic.js';

export async function loadAttemptDetails({ user, kind }) {
  const idToken = await user.getIdToken();
  const res = await fetch(`/api/history?kind=${encodeURIComponent(kind)}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `履歴の読み込みに失敗しました (${res.status})`);
  }

  return res.json();
}
