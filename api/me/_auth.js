import { randomUUID } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';

const TEST_UID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

export function withMeHandler(innerHandler) {
  return async function handler(req, res) {
    try {
      return await innerHandler(req, res);
    } catch (e) {
      const requestId = randomUUID();
      console.error('[api/me] internal error:', {
        requestId,
        message: e?.message ?? String(e),
        stack: e?.stack,
      });
      if (res.headersSent) return undefined;
      return res.status(500).json({ code: 'internal_error', requestId });
    }
  };
}

export async function authenticateMeRequest(req, res) {
  const idToken = req.headers.authorization?.replace('Bearer ', '');
  const isProductionEnv = process.env.VERCEL || process.env.NODE_ENV === 'production';
  const bypass =
    !isProductionEnv
    && process.env.TEST_BYPASS_AUTH === '1'
    && process.env.NODE_ENV === 'test'
    && !!process.env.FIRESTORE_EMULATOR_HOST;

  if (bypass) {
    const testUid = req.headers['x-test-uid'];
    if (testUid !== undefined && (typeof testUid !== 'string' || !TEST_UID_RE.test(testUid))) {
      res.status(401).json({ error: '認証に失敗しました', code: 'unauthorized' });
      return null;
    }

    if (!testUid && !idToken) {
      res.status(401).json({ error: '認証が必要です', code: 'unauthorized' });
      return null;
    }

    return {
      uid: testUid || 'test-user',
      email: 'test@example.com',
      name: 'Test',
      picture: '',
    };
  }

  if (!idToken) {
    res.status(401).json({ error: '認証が必要です', code: 'unauthorized' });
    return null;
  }

  try {
    return await getAuth().verifyIdToken(idToken);
  } catch {
    res.status(401).json({ error: '認証に失敗しました', code: 'unauthorized' });
    return null;
  }
}
