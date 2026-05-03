import { describe, expect, it } from 'vitest';
import { buildPairKey } from '../../shared/integrationsKey.js';

describe('buildPairKey', () => {
  it('builds the legacy-v1 pair key', () => {
    expect(buildPairKey('legacy-v1', 'legacy-v1')).toBe('legacy-v1__legacy-v1');
  });

  it('builds a pair key with the double-underscore separator', () => {
    expect(buildPairKey('abc123', 'def456')).toBe('abc123__def456');
  });

  it('allows underscores that do not make the full combined key reserved', () => {
    expect(buildPairKey('_a_', '_b_')).toBe('_a____b_');
  });

  it('rejects reserved full combined keys', () => {
    expect(() => buildPairKey('__', '__')).toThrow();
    expect(() => buildPairKey('__foo', 'bar__')).toThrow();
  });

  it.each([
    ['a/b'],
    ['a.b'],
    ['..'],
    ['.'],
    ['a/'],
  ])('rejects invalid attempt id segment %s', (value) => {
    expect(() => buildPairKey(value, 'uaam')).toThrow();
  });

  it('rejects keys longer than 1500 UTF-8 bytes', () => {
    const longId = 'a'.repeat(800);
    expect(() => buildPairKey(longId, longId)).toThrow();
  });

  it.each([
    [null],
    [undefined],
    [''],
    [123],
    [{}],
  ])('rejects invalid saikakuAttemptId %#', (value) => {
    expect(() => buildPairKey(value, 'uaam')).toThrow();
  });

  it.each([
    [null],
    [undefined],
    [''],
    [123],
    [{}],
  ])('rejects invalid uaamAttemptId %#', (value) => {
    expect(() => buildPairKey('saikaku', value)).toThrow();
  });
});
