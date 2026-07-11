import { getAuth } from 'firebase-admin/auth';
import { ADMIN_EMAILS } from './firebaseAdmin.js';

function bearerToken(req) {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] || null;
}

export async function requireAdmin(req, res) {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ code: 'UNAUTHORIZED', error: '認証が必要です' });
    return null;
  }

  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(token);
  } catch {
    res.status(401).json({ code: 'UNAUTHORIZED', error: '認証に失敗しました' });
    return null;
  }

  if (decoded.email_verified !== true) {
    res.status(403).json({ code: 'EMAIL_UNVERIFIED', error: '確認済みのメールアドレスが必要です' });
    return null;
  }

  if (!decoded.email || !ADMIN_EMAILS.includes(decoded.email)) {
    res.status(403).json({ code: 'FORBIDDEN', error: '管理者権限が必要です' });
    return null;
  }

  return decoded;
}

