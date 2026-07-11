const CATEGORY_KEYS = ['talent', 'value', 'passion'];
const PUBLIC_CATEGORY_KEYS = { talent: 'talent', value: 'values', passion: 'passion' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PUBLIC_ORIGIN = 'https://app.saikaku-architecture.com';
const PUBLIC_SCHEMA_VERSION = 1;

function cleanString(value, max = 160) {
  if (typeof value !== 'string') return '';
  return value.normalize('NFKC').trim().slice(0, max);
}

export function splitUserTop5(value) {
  if (typeof value !== 'string') return [];
  return [...new Set(value
    .split(/[\n\r,、]+/u)
    .map((item) => cleanString(item, 80))
    .filter(Boolean))];
}

function axesFromInternal(resultCategory) {
  if (!resultCategory || typeof resultCategory !== 'object') return [];
  return Object.entries(resultCategory)
    .filter(([key, value]) => /^axis\d+$/.test(key) && value && typeof value === 'object')
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([, axis]) => ({
      name: cleanString(axis.name),
      tokens: [...new Set([
        cleanString(axis.name, 80),
        ...(Array.isArray(axis.top5) ? axis.top5.map((item) => cleanString(item, 80)) : []),
        ...(Array.isArray(axis.items) ? axis.items.map((item) => cleanString(item, 80)) : []),
      ].filter(Boolean))],
    }))
    .filter((axis) => axis.name || axis.tokens.length > 0);
}

function axesFromPublic(axes) {
  return axes.map((axis) => ({
    name: cleanString(axis.name),
    tokens: [...new Set([cleanString(axis.name, 80), ...axis.items.map((item) => cleanString(item, 80))].filter(Boolean))],
  }));
}

function timestampVersion(data) {
  const candidate = data?.updatedAt || data?.createdAt;
  if (typeof candidate === 'string') return candidate;
  if (typeof candidate?.toDate === 'function') return candidate.toDate().toISOString();
  if (typeof candidate?._seconds === 'number') return new Date(candidate._seconds * 1000).toISOString();
  if (typeof candidate?.seconds === 'number') return new Date(candidate.seconds * 1000).toISOString();
  return 'legacy';
}

function normalizeUaamScores(data) {
  const scores = data?.scores;
  if (!scores || typeof scores !== 'object') return null;
  const normalized = {};
  for (const axis of ['mindset', 'literacy', 'competency', 'impact']) {
    const subs = scores[axis]?.subs;
    if (!subs || typeof subs !== 'object') continue;
    for (const [key, raw] of Object.entries(subs)) {
      const value = Number(raw);
      if (Number.isFinite(value) && value >= 0 && value <= 20) normalized[key] = value;
    }
  }
  return Object.keys(normalized).length > 0 ? normalized : null;
}

export function normalizeInternalProfile(id, resultData, uaamData = null) {
  const categories = {};
  for (const category of CATEGORY_KEYS) {
    const top5Field = `input${category[0].toUpperCase()}${category.slice(1)}Top5`;
    categories[category] = {
      user_top5: splitUserTop5(resultData?.[top5Field]),
      generated_axis: axesFromInternal(resultData?.result?.[category]),
    };
  }

  return {
    id,
    source: 'internal',
    profileVersion: timestampVersion(resultData),
    displayName: cleanString(resultData?.name, 80) || '名前未設定',
    identifiers: [id, resultData?.uid, resultData?.name, resultData?.email].filter((value) => typeof value === 'string' && value),
    categories,
    uaam: normalizeUaamScores(uaamData),
  };
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validateAxis(axis) {
  if (!isPlainObject(axis)) return false;
  const exactKeys = ['description', 'english', 'items', 'name', 'percentage'];
  if (Object.keys(axis).sort().join('|') !== exactKeys.join('|')) return false;
  return typeof axis.name === 'string'
    && axis.name.length > 0
    && axis.name.length <= 160
    && typeof axis.english === 'string'
    && axis.english.length <= 160
    && typeof axis.description === 'string'
    && axis.description.length <= 2_000
    && Array.isArray(axis.items)
    && axis.items.length <= 20
    && axis.items.every((item) => typeof item === 'string' && item.length <= 300)
    && Number.isFinite(axis.percentage)
    && axis.percentage >= 0
    && axis.percentage <= 100;
}

export function validatePublicImportResponse(raw, expectedSessionId) {
  if (!isPlainObject(raw)
    || Object.keys(raw).sort().join('|') !== ['profile', 'profileVersion', 'schemaVersion'].join('|')
    || raw.schemaVersion !== PUBLIC_SCHEMA_VERSION
    || typeof raw.profileVersion !== 'string'
    || raw.profileVersion.length < 1
    || raw.profileVersion.length > 160
    || !isPlainObject(raw.profile)) {
    return { ok: false, code: 'PUBLIC_PROFILE_SCHEMA_UNSUPPORTED' };
  }

  const profile = raw.profile;
  const exactProfileKeys = ['axes', 'complete', 'locale', 'sessionId'];
  if (Object.keys(profile).sort().join('|') !== exactProfileKeys.join('|')
    || profile.sessionId !== expectedSessionId
    || profile.complete !== true
    || !['ja', 'en'].includes(profile.locale)
    || !isPlainObject(profile.axes)
    || Object.keys(profile.axes).sort().join('|') !== ['passion', 'talent', 'values'].join('|')) {
    return { ok: false, code: 'PUBLIC_PROFILE_SCHEMA_UNSUPPORTED' };
  }

  for (const key of ['values', 'talent', 'passion']) {
    const axes = profile.axes[key];
    if (!Array.isArray(axes) || axes.length < 1 || axes.length > 5 || !axes.every(validateAxis)) {
      return { ok: false, code: 'PUBLIC_PROFILE_SCHEMA_UNSUPPORTED' };
    }
  }

  return { ok: true, value: raw };
}

export function normalizePublicProfile(raw) {
  const categories = {};
  for (const category of CATEGORY_KEYS) {
    categories[category] = {
      user_top5: [],
      generated_axis: axesFromPublic(raw.profile.axes[PUBLIC_CATEGORY_KEYS[category]]),
    };
  }

  return {
    id: raw.profile.sessionId,
    source: 'public',
    profileVersion: raw.profileVersion,
    displayName: `公開プロフィール ${raw.profile.sessionId.slice(0, 8)}`,
    identifiers: [raw.profile.sessionId],
    categories,
    uaam: null,
  };
}

export function parsePublicShareUrl(value) {
  if (typeof value !== 'string' || value.length > 500) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.origin !== PUBLIC_ORIGIN || url.username || url.password || url.search || url.hash) return null;
  const match = /^\/share\/([^/]+)$/.exec(url.pathname);
  if (!match || !UUID_RE.test(match[1])) return null;
  return match[1];
}

export function publicImportApiUrl(sessionId) {
  if (!UUID_RE.test(sessionId)) throw new Error('invalid public session id');
  return `${PUBLIC_ORIGIN}/api/compat-import/${encodeURIComponent(sessionId)}`;
}

export function profileAvailability(profile) {
  const categories = {};
  for (const category of CATEGORY_KEYS) {
    categories[category] = {
      userTop5: profile.categories[category].user_top5.length > 0,
      generatedAxes: profile.categories[category].generated_axis.length > 0,
    };
  }
  return { categories, uaam: !!profile.uaam };
}

export const COMPAT_CATEGORIES = CATEGORY_KEYS;
