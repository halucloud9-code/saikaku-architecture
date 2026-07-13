import { describe, expect, it } from 'vitest';
import { isCompatShareActive, isCompatShareId, validateCompatShareReport } from '../../api/lib/compatShare.js';

describe('compat share expiry', () => {
  const now = 1_800_000_000_000;
  const active = (expiresAt, overrides = {}) => ({
    consentConfirmed: true,
    revoked: false,
    expiresAt: { toMillis: () => expiresAt },
    ...overrides,
  });

  it('accepts only UUID v4 share IDs', () => {
    expect(isCompatShareId('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(isCompatShareId('11111111-1111-1111-8111-111111111111')).toBe(false);
    expect(isCompatShareId('not-a-uuid')).toBe(false);
  });

  it('is active only before the deadline with consent and no revocation', () => {
    expect(isCompatShareActive(active(now + 1), now)).toBe(true);
    expect(isCompatShareActive(active(now), now)).toBe(false);
    expect(isCompatShareActive(active(now - 1), now)).toBe(false);
    expect(isCompatShareActive(active(now + 1, { revoked: true }), now)).toBe(false);
    expect(isCompatShareActive(active(now + 1, { consentConfirmed: false }), now)).toBe(false);
  });

  it('rejects malformed evidence without throwing', () => {
    const validation = validateCompatShareReport({
      dataSufficiency: {
        summary: '範囲',
        memberAvailability: [],
        limitations: [],
        uaam: {},
      },
      lenses: [],
      evidence: [null],
      ethicsNotice: '本結果は相互理解のための対話素材です。人事評価・採用評価には流用しません。',
      model: 'claude-sonnet-4-6',
    });
    expect(validation.ok).toBe(false);
    expect(validation.errors).toEqual(expect.arrayContaining([expect.stringContaining('report.evidence[0]')]));
  });
});
