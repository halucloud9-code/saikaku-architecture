import { describe, expect, it } from 'vitest';
import { buildCsv } from '../../src/utils/exportCsv.js';
import {
  buildIntegrationsRows,
  INTEGRATIONS_EXPORT_FIELD_DEFS,
} from '../../src/utils/integrationsExport.js';

function makeIntegration(overrides = {}) {
  return {
    userName: 'Integration User',
    userEmail: 'integration@example.com',
    pairKey: 'saikaku-1__uaam-1',
    saikakuAttemptId: 'saikaku-1',
    uaamAttemptId: 'uaam-1',
    source: {
      saikakuLabel: 'Saikaku Label',
      uaamLabel: 'UAAM Label',
    },
    regenerationCount: 2,
    integration: {
      integration_score: 75,
    },
    status: 'active',
    staleSaikaku: false,
    staleUaam: false,
    model: 'claude-sonnet-4-20250514',
    isLegacyFallback: false,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-02T00:00:00.000Z',
    ...overrides,
  };
}

function csvCell(csv, rowIndex, columnIndex) {
  return csv.split('\r\n')[rowIndex].split(',')[columnIndex];
}

describe('integration export field extraction', () => {
  it('extracts nested source labels and falls back to empty strings when source is null', () => {
    const rows = buildIntegrationsRows([
      makeIntegration(),
      makeIntegration({ source: null }),
    ]);

    expect(rows[0].saikakuLabel).toBe('Saikaku Label');
    expect(rows[0].uaamLabel).toBe('UAAM Label');
    expect(rows[1].saikakuLabel).toBe('');
    expect(rows[1].uaamLabel).toBe('');
  });

  it('exports isLegacyFallback true as true', () => {
    const rows = buildIntegrationsRows([makeIntegration({ isLegacyFallback: true })]);

    expect(rows[0].isLegacyFallback).toBe('true');
  });

  it('exports stale false and undefined values as false', () => {
    const rows = buildIntegrationsRows([
      makeIntegration({ staleSaikaku: false, staleUaam: undefined }),
    ]);

    expect(rows[0].staleSaikaku).toBe('false');
    expect(rows[0].staleUaam).toBe('false');
  });

  it('preserves a falsy regenerationCount 0 as the CSV cell value', () => {
    const rows = buildIntegrationsRows([makeIntegration({ regenerationCount: 0 })]);
    const csv = buildCsv(rows, INTEGRATIONS_EXPORT_FIELD_DEFS);

    expect(csvCell(csv, 1, 7)).toBe('0');
  });

  it('exports integration_score and falls back to empty when integration is missing', () => {
    const rows = buildIntegrationsRows([
      makeIntegration({ integration: { integration_score: 75 } }),
      makeIntegration({ integration: undefined }),
    ]);
    const csv = buildCsv(rows, INTEGRATIONS_EXPORT_FIELD_DEFS);

    expect(csvCell(csv, 1, 8)).toBe('75');
    expect(csvCell(csv, 2, 8)).toBe('');
  });

  it('does not leak sensitive integration or coaching fields into the CSV', () => {
    const rows = buildIntegrationsRows([
      makeIntegration({
        coachingAnswers: { q1: 'secret-a' },
        integration: {
          integration_score: 88,
          summary: 'secret-summary',
          recommendations: 'secret-recs',
        },
      }),
    ]);
    const csv = buildCsv(rows, INTEGRATIONS_EXPORT_FIELD_DEFS);

    expect(csv).not.toContain('secret-a');
    expect(csv).not.toContain('secret-summary');
    expect(csv).not.toContain('secret-recs');
    expect(csv).not.toContain('coachingAnswers');
    expect(csv).not.toContain('summary');
    expect(csv).not.toContain('recommendations');
  });
});
