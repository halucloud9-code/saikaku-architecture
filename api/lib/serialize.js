function timestampToIso(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value.toMillis === 'function') return new Date(value.toMillis()).toISOString();
  if (typeof value._seconds === 'number') {
    const nanos = typeof value._nanoseconds === 'number' ? value._nanoseconds : 0;
    return new Date(value._seconds * 1000 + Math.floor(nanos / 1000000)).toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return null;
}

function isTimestampLike(value) {
  return !!value
    && typeof value === 'object'
    && (
      typeof value.toDate === 'function'
      || typeof value.toMillis === 'function'
      || typeof value._seconds === 'number'
      || value instanceof Date
    );
}

export function serializeTimestamps(value) {
  if (isTimestampLike(value)) return timestampToIso(value);
  if (Array.isArray(value)) return value.map((item) => serializeTimestamps(item));
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, serializeTimestamps(item)])
  );
}
