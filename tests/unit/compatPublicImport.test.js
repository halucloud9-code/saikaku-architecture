import { describe, expect, it } from 'vitest';
import { parsePublicShareUrl, validatePublicImportResponse } from '../../api/lib/compatProfiles.js';

const id = '11111111-1111-4111-8111-111111111111';
const axis = { name: '構造化', english: 'structure', description: '説明', items: ['整理'], percentage: 60 };

function response() {
  return {
    schemaVersion: 1,
    profileVersion: 'v1',
    profile: { sessionId: id, locale: 'ja', complete: true, axes: { values: [axis], talent: [axis], passion: [axis] } },
  };
}

describe('public compat import contract', () => {
  it('accepts only the fixed production share origin and UUID path', () => {
    expect(parsePublicShareUrl(`https://app.saikaku-architecture.com/share/${id}`)).toBe(id);
    for (const value of [
      `http://app.saikaku-architecture.com/share/${id}`,
      `https://evil.example/share/${id}`,
      `https://app.saikaku-architecture.com.evil.example/share/${id}`,
      `https://app.saikaku-architecture.com/share/${id}?next=https://evil.example`,
      'https://app.saikaku-architecture.com/share/not-a-uuid',
    ]) expect(parsePublicShareUrl(value)).toBeNull();
  });

  it('rejects unsupported or widened upstream schemas', () => {
    expect(validatePublicImportResponse(response(), id).ok).toBe(true);
    const extra = response();
    extra.profile.name = 'PII';
    expect(validatePublicImportResponse(extra, id)).toEqual({ ok: false, code: 'PUBLIC_PROFILE_SCHEMA_UNSUPPORTED' });
    const unsupported = response();
    unsupported.schemaVersion = 2;
    expect(validatePublicImportResponse(unsupported, id)).toEqual({ ok: false, code: 'PUBLIC_PROFILE_SCHEMA_UNSUPPORTED' });
    const topLevelExtra = response();
    topLevelExtra.email = 'leak@example.com';
    expect(validatePublicImportResponse(topLevelExtra, id)).toEqual({ ok: false, code: 'PUBLIC_PROFILE_SCHEMA_UNSUPPORTED' });
  });
});
