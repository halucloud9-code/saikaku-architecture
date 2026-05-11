const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function jstDayBoundary(now) {
  const nowJstMs = now.getTime() + JST_OFFSET_MS;
  const dayStartJstMs = Math.floor(nowJstMs / DAY_MS) * DAY_MS;
  return new Date(dayStartJstMs - JST_OFFSET_MS);
}

export function weekBoundary(now, days = 7) {
  return new Date(now.getTime() - days * DAY_MS);
}
