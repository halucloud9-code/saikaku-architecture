import { describe, expect, it } from 'vitest';
import {
  Timestamp,
  api,
  legacySaikakuParent,
  seedAttempt,
  seedParent,
} from './_helpers.js';

function authBase() {
  const host = process.env.FIREBASE_AUTH_EMULATOR_HOST || 'localhost:9099';
  const origin = host.startsWith('http') ? host : `http://${host}`;
  return `${origin}/identitytoolkit.googleapis.com/v1`;
}

async function createToken(label) {
  const response = await fetch(`${authBase()}/accounts:signUp?key=fake-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `history-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      password: 'password',
      returnSecureToken: true,
    }),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`auth signUp failed: ${JSON.stringify(body)}`);
  return { uid: body.localId, idToken: body.idToken };
}

function historyRequest(idToken, query = '') {
  return api
    .get(`/api/history${query}`)
    .set('Authorization', `Bearer ${idToken}`);
}

describe('API /api/history', () => {
  it('returns 401 if no token is provided', async () => {
    const response = await api.get('/api/history');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('認証が必要です');
  });

  it('returns 401 if token is invalid', async () => {
    const response = await historyRequest('invalid-token');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('認証に失敗しました');
  });

  it('returns empty details for a new user', async () => {
    const { idToken } = await createToken('empty');
    const response = await historyRequest(idToken);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      committedAttempts: [],
      pendingAttempt: null,
      summary: {
        committedCount: 0,
        attemptCount: 0,
        hasPending: false,
      },
    });
  });

  it('returns one committed attempt', async () => {
    const { uid, idToken } = await createToken('committed');
    const createdAt = Timestamp.fromMillis(1700000000000);
    await seedParent('results', uid, { attemptCount: 1, pendingAttemptId: null });
    await seedAttempt('results', uid, 'attempt-1', {
      status: 'committed',
      createdAt,
      summary: { kakuchiiki: '問いに火を灯す人', createdAt },
      full: { result: { kakuchiiki: '問いに火を灯す人' }, selectedKakuchiiki: '問いに火を灯す人' },
      raw: { input: {} },
    });

    const response = await historyRequest(idToken);

    expect(response.status).toBe(200);
    expect(response.body.committedAttempts).toHaveLength(1);
    expect(response.body.committedAttempts[0]).toMatchObject({
      id: 'attempt-1',
      createdAt: { _seconds: 1700000000, _nanoseconds: 0 },
    });
    expect(response.body.summary.committedCount).toBe(1);
  });

  it('returns pending-only state', async () => {
    const { uid, idToken } = await createToken('pending');
    const createdAt = Timestamp.fromMillis(1700001000000);
    await seedParent('results', uid, { attemptCount: 1, pendingAttemptId: 'pending-1' });
    await seedAttempt('results', uid, 'pending-1', {
      status: 'pending',
      createdAt,
      summary: { createdAt },
      full: null,
      raw: { input: {} },
    });

    const response = await historyRequest(idToken);

    expect(response.status).toBe(200);
    expect(response.body.committedAttempts).toEqual([]);
    expect(response.body.pendingAttempt).toMatchObject({
      id: 'pending-1',
      createdAt: { _seconds: 1700001000, _nanoseconds: 0 },
    });
    expect(response.body.summary.hasPending).toBe(true);
  });

  it('returns legacy fallback when parent has result and no attempts', async () => {
    const { uid, idToken } = await createToken('legacy');
    await seedParent('results', uid, legacySaikakuParent());

    const response = await historyRequest(idToken);

    expect(response.status).toBe(200);
    expect(response.body.committedAttempts).toHaveLength(1);
    expect(response.body.committedAttempts[0]).toMatchObject({
      id: 'legacy-fallback',
      isLegacy: true,
      status: 'committed',
      createdAt: { _seconds: expect.any(Number), _nanoseconds: expect.any(Number) },
    });
    expect(response.body.summary.committedCount).toBe(1);
  });

  it('reads uaam history from uaam_results', async () => {
    const { uid, idToken } = await createToken('uaam');
    const createdAt = Timestamp.fromMillis(1700002000000);
    await seedParent('results', uid, { attemptCount: 1, pendingAttemptId: null });
    await seedAttempt('results', uid, 'saikaku-attempt', {
      status: 'committed',
      createdAt,
    });
    await seedParent('uaam_results', uid, { attemptCount: 1, pendingAttemptId: null });
    await seedAttempt('uaam_results', uid, 'uaam-attempt', {
      status: 'committed',
      createdAt,
      summary: { typeName: '実装する案内人', createdAt },
      full: { analysis: { type_name: '実装する案内人' }, scores: { mindset: { total: 60 } } },
      raw: { input: { answers: {}, vAnswers: {} } },
    });

    const response = await historyRequest(idToken, '?kind=uaam');

    expect(response.status).toBe(200);
    expect(response.body.committedAttempts).toHaveLength(1);
    expect(response.body.committedAttempts[0]).toMatchObject({
      id: 'uaam-attempt',
      summary: { typeName: '実装する案内人' },
    });
    expect(response.body.summary.committedCount).toBe(1);
  });
});
