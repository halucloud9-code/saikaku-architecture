import { describe, expect, it } from 'vitest';
import {
  integrationSummary,
  recentIntegrationSummaries,
  recentIntegrationSummary,
} from '../../api/lib/recentIntegrationSummaries.js';
import { buildPairKey } from '../../shared/integrationsKey.js';

function integrationBody(score, activationCore) {
  return {
    integration_score: score,
    activation_core: activationCore,
    activation_equation: `${activationCore} equation`,
  };
}

function integrationDoc(overrides = {}) {
  return {
    saikakuAttemptId: 'saikaku-current',
    uaamAttemptId: 'uaam-current',
    regenerationCount: 0,
    source: {
      saikakuLabel: 'Saikaku Current',
      uaamLabel: 'UAAM Current',
    },
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    integration: integrationBody(88, 'Current Core'),
    ...overrides,
  };
}

describe('recentIntegrationSummaries builders', () => {
  it('builds the UAAM integration summary shape without changing null defaults', () => {
    const summary = integrationSummary(integrationDoc({
      integration: {
        integration_score: 'not-a-number',
        activation_core: null,
      },
      updatedAt: null,
      createdAt: '2026-05-02T00:00:00.000Z',
      regenerationCount: undefined,
      source: undefined,
    }), {
      saikakuAttemptId: 'saikaku-current',
      uaamAttemptId: 'uaam-current',
    });

    expect(summary).toEqual({
      exists: true,
      generatedAt: '2026-05-02T00:00:00.000Z',
      integrationScore: null,
      activationCore: null,
      saikakuAttemptId: 'saikaku-current',
      uaamAttemptId: 'uaam-current',
      status: 'active',
      regenerationCount: 0,
      source: null,
      integration: {
        integration_score: 'not-a-number',
        activation_core: null,
      },
    });
  });

  it('returns null when the integration body is missing', () => {
    expect(integrationSummary(integrationDoc({ integration: undefined }), {})).toBeNull();
    expect(recentIntegrationSummary(integrationDoc({ integration: undefined }), {})).toBeNull();
  });

  it('filters body-missing docs, sorts by generatedAt descending, and limits to two', () => {
    const summaries = recentIntegrationSummaries([
      integrationDoc({
        saikakuAttemptId: 'saikaku-old-a',
        uaamAttemptId: 'uaam-old-a',
        integration: integrationBody(71, 'Old Core'),
        updatedAt: '2026-05-01T00:00:00.000Z',
      }),
      integrationDoc({
        saikakuAttemptId: 'saikaku-old-b',
        uaamAttemptId: 'uaam-old-b',
        integration: integrationBody(93, 'Newest Core'),
        updatedAt: '2026-05-03T00:00:00.000Z',
      }),
      integrationDoc({
        saikakuAttemptId: 'saikaku-old-c',
        uaamAttemptId: 'uaam-old-c',
        integration: integrationBody(82, 'Middle Core'),
        updatedAt: '2026-05-02T00:00:00.000Z',
      }),
      integrationDoc({
        saikakuAttemptId: 'saikaku-old-d',
        uaamAttemptId: 'uaam-old-d',
        integration: undefined,
        updatedAt: '2026-05-04T00:00:00.000Z',
      }),
    ], {
      saikakuAttemptId: 'saikaku-current',
      uaamAttemptId: 'uaam-current',
    });

    expect(summaries.map((summary) => summary.activationCore)).toEqual([
      'Newest Core',
      'Middle Core',
    ]);
    expect(summaries).toEqual([
      expect.objectContaining({
        integrationScore: 93,
        status: 'stale',
        integration: integrationBody(93, 'Newest Core'),
      }),
      expect.objectContaining({
        integrationScore: 82,
        status: 'stale',
        integration: integrationBody(82, 'Middle Core'),
      }),
    ]);
  });

  it('breaks generatedAt ties by pairKey ascending for deterministic ordering', () => {
    const generatedAt = '2026-05-03T00:00:00.000Z';
    const summaries = recentIntegrationSummaries([
      integrationDoc({
        saikakuAttemptId: 'saikaku-b',
        uaamAttemptId: 'uaam-a',
        integration: integrationBody(71, 'Pair B'),
        updatedAt: generatedAt,
      }),
      integrationDoc({
        saikakuAttemptId: 'saikaku-a',
        uaamAttemptId: 'uaam-z',
        integration: integrationBody(93, 'Pair AZ'),
        updatedAt: generatedAt,
      }),
      integrationDoc({
        saikakuAttemptId: 'saikaku-a',
        uaamAttemptId: 'uaam-a',
        integration: integrationBody(82, 'Pair AA'),
        updatedAt: generatedAt,
      }),
    ], {
      saikakuAttemptId: 'saikaku-current',
      uaamAttemptId: 'uaam-current',
    });

    expect(summaries.map((summary) => buildPairKey(
      summary.saikakuAttemptId,
      summary.uaamAttemptId,
    ))).toEqual([
      'saikaku-a__uaam-a',
      'saikaku-a__uaam-z',
    ]);
  });

  it('preserves the legacy fallback marker on recent summaries', () => {
    expect(recentIntegrationSummary(integrationDoc({
      saikakuAttemptId: 'legacy-fallback',
      uaamAttemptId: 'legacy-fallback',
      isLegacyFallback: true,
      integration: integrationBody(77, 'Legacy Core'),
    }), {})).toEqual(expect.objectContaining({
      activationCore: 'Legacy Core',
      status: 'active',
      isLegacyFallback: true,
    }));
  });
});
