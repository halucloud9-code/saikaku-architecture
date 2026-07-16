import { Timestamp } from 'firebase-admin/firestore';

export const UAAM_PEER_INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
export const UAAM_PEER_DEFAULT_SUBMISSION_CAP = 30;

const INVITE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ANSWER_IDS = Array.from({ length: 64 }, (_value, index) => String(index + 1));

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function timestampMillis(value) {
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value?._seconds === 'number') return value._seconds * 1_000;
  if (typeof value?.seconds === 'number') return value.seconds * 1_000;
  if (value instanceof Date) return value.getTime();
  return Number.NaN;
}

export function timestampIso(value) {
  const millis = timestampMillis(value);
  return Number.isFinite(millis) ? new Date(millis).toISOString() : null;
}

export function isUaamPeerInviteId(value) {
  return typeof value === 'string' && INVITE_ID_RE.test(value);
}

export async function wasUaamPeerInviteDeleted(db, inviteId) {
  if (!isUaamPeerInviteId(inviteId)) return false;
  const snapshot = await db
    .collection('uaam_peer_deletions')
    .where('inviteIds', 'array-contains', inviteId)
    .limit(1)
    .get();
  return !snapshot.empty;
}

export function isUaamPeerInviteActive(data, nowMs = Date.now()) {
  return isPlainObject(data)
    && data.revoked === false
    && typeof data.subjectUid === 'string'
    && Number.isFinite(timestampMillis(data.expiresAt))
    && timestampMillis(data.expiresAt) > nowMs;
}

export function setUaamPeerNoStoreHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
}

export function uaamPeerRequestOrigin(req) {
  const configured = process.env.UAAM_PEER_ORIGIN?.trim()
    || process.env.COMPAT_SHARE_ORIGIN?.trim();
  if (configured) {
    const url = new URL(configured);
    if (!['http:', 'https:'].includes(url.protocol)
      || url.username
      || url.password
      || url.pathname !== '/'
      || url.search
      || url.hash) {
      throw new Error('UAAM peer origin is invalid');
    }
    return url.origin;
  }

  const originHeader = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin;
  if (originHeader) {
    const url = new URL(originHeader);
    if (['http:', 'https:'].includes(url.protocol)
      && !url.username
      && !url.password
      && url.pathname === '/'
      && !url.search
      && !url.hash) {
      return url.origin;
    }
  }

  const forwardedHost = req.headers['x-forwarded-host'];
  const rawHost = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost)?.split(',')[0].trim()
    || req.headers.host;
  if (typeof rawHost !== 'string' || !/^[a-z0-9.-]+(?::\d{1,5})?$/iu.test(rawHost)) {
    throw new Error('request host is invalid');
  }

  const forwardedProto = req.headers['x-forwarded-proto'];
  const rawProto = (Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto)?.split(',')[0].trim();
  const protocol = rawProto === 'http' || rawProto === 'https'
    ? rawProto
    : (rawHost.startsWith('localhost') || rawHost.startsWith('127.0.0.1') ? 'http' : 'https');
  return `${protocol}://${rawHost}`;
}

export function buildUaamPeerInviteUrl(req, inviteId) {
  return `${uaamPeerRequestOrigin(req)}/peer/${inviteId}`;
}

export function validateUaamPeerAnswers(answers) {
  if (!isPlainObject(answers)) return false;
  const keys = Object.keys(answers);
  if (keys.length !== ANSWER_IDS.length) return false;

  const answerIdSet = new Set(ANSWER_IDS);
  if (keys.some((key) => !answerIdSet.has(key))) return false;

  return ANSWER_IDS.every((id) => {
    const value = answers[id];
    return Number.isInteger(value) && value >= 1 && value <= 5;
  });
}

export function getUaamPeerSubmissionCap() {
  const raw = process.env.UAAM_PEER_SUBMISSION_CAP;
  if (raw === undefined || raw === '') return UAAM_PEER_DEFAULT_SUBMISSION_CAP;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? parsed
    : UAAM_PEER_DEFAULT_SUBMISSION_CAP;
}

function roundedMean(values) {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.round(mean * 100) / 100;
}

export function aggregateUaamPeerScores(scoresList) {
  const axes = ['mindset', 'literacy', 'competency', 'impact'];
  return Object.fromEntries(axes.map((axis) => {
    const axisScores = scoresList.map((scores) => scores?.[axis]);
    const subKeys = Object.keys(axisScores[0]?.subs ?? {});
    return [axis, {
      total: roundedMean(axisScores.map((score) => score.total)),
      max: axisScores[0].max,
      percentage: roundedMean(axisScores.map((score) => score.percentage)),
      subs: Object.fromEntries(subKeys.map((sub) => [
        sub,
        roundedMean(axisScores.map((score) => score.subs[sub])),
      ])),
    }];
  }));
}

export function makeInviteExpiry(nowMs = Date.now()) {
  return Timestamp.fromMillis(nowMs + UAAM_PEER_INVITE_TTL_MS);
}
