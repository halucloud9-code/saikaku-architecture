const SEPARATOR = '__';
const MAX_KEY_BYTES = 1500;
const RESERVED_KEY_PATTERN = /^__.*__$/;

function assertValidAttemptId(value, name) {
  if (typeof value !== 'string') {
    throw new TypeError(`${name} must be a non-empty string`);
  }

  if (value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }

  if (value.includes('/')) {
    throw new Error(`${name} must not contain "/"`);
  }

  if (value.includes('.')) {
    throw new Error(`${name} must not contain "."`);
  }
}

function utf8ByteLength(value) {
  return new TextEncoder().encode(value).length;
}

export function buildPairKey(saikakuAttemptId, uaamAttemptId) {
  assertValidAttemptId(saikakuAttemptId, 'saikakuAttemptId');
  assertValidAttemptId(uaamAttemptId, 'uaamAttemptId');

  const pairKey = `${saikakuAttemptId}${SEPARATOR}${uaamAttemptId}`;

  if (RESERVED_KEY_PATTERN.test(pairKey)) {
    throw new Error('pairKey must not match reserved pattern /^__.*__$/');
  }

  if (utf8ByteLength(pairKey) > MAX_KEY_BYTES) {
    throw new RangeError(`pairKey must be at most ${MAX_KEY_BYTES} bytes`);
  }

  return pairKey;
}

