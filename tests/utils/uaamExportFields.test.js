import { describe, expect, it } from 'vitest';
import { buildCsv } from '../../src/utils/exportCsv.js';
import { buildUaamRows, UAAM_EXPORT_FIELD_DEFS } from '../../src/utils/uaamExport.js';

function makeUser(overrides = {}) {
  return {
    name: 'User',
    email: 'user@example.com',
    scores: {
      mindset: { total: 40, max: 80, percentage: 50 },
      literacy: { total: 48, max: 80, percentage: 60 },
      competency: { total: 56, max: 80, percentage: 70 },
      impact: { total: 64, max: 80, percentage: 80 },
    },
    vAnswers: {},
    analysis: { type_name: '天地型' },
    uaamUpdatedAt: '2026-05-01T00:00:00.000Z',
    ...overrides,
  };
}

function csvCell(csv, rowIndex, columnIndex) {
  return csv.split('\r\n')[rowIndex].split(',')[columnIndex];
}

describe('UAAM export field extraction', () => {
  it('preserves a falsy 0 percentage as the CSV cell value', () => {
    const rows = buildUaamRows([
      makeUser({
        scores: {
          mindset: { total: 40, max: 80, percentage: 0 },
          literacy: { total: 48, max: 80, percentage: 60 },
          competency: { total: 56, max: 80, percentage: 70 },
          impact: { total: 64, max: 80, percentage: 80 },
        },
      }),
    ]);
    const csv = buildCsv(rows, UAAM_EXPORT_FIELD_DEFS);

    expect(csvCell(csv, 1, 2)).toBe('0');
  });

  it('falls back when percentage is null', () => {
    const rows = buildUaamRows([
      makeUser({
        scores: {
          mindset: { total: 20, max: 80, percentage: null },
          literacy: { total: 48, max: 80, percentage: 60 },
          competency: { total: 56, max: 80, percentage: 70 },
          impact: { total: 64, max: 80, percentage: 80 },
        },
      }),
    ]);

    expect(rows[0].mindset).toBe(25);
  });

  it('falls back when percentage is undefined', () => {
    const rows = buildUaamRows([
      makeUser({
        scores: {
          mindset: { total: 60, max: 80, percentage: undefined },
          literacy: { total: 48, max: 80, percentage: 60 },
          competency: { total: 56, max: 80, percentage: 70 },
          impact: { total: 64, max: 80, percentage: 80 },
        },
      }),
    ]);

    expect(rows[0].mindset).toBe(75);
  });

  it('uses max || 1 when max is 0 and percentage is absent', () => {
    const rows = buildUaamRows([
      makeUser({
        scores: {
          mindset: { total: 12, max: 0 },
          literacy: { total: 48, max: 80, percentage: 60 },
          competency: { total: 56, max: 80, percentage: 70 },
          impact: { total: 64, max: 80, percentage: 80 },
        },
      }),
    ]);

    expect(rows[0].mindset).toBe(1200);
    expect(Number.isFinite(rows[0].mindset)).toBe(true);
  });

  it('renders all four axis cells as empty strings when scores is null', () => {
    const rows = buildUaamRows([makeUser({ scores: null })]);

    expect(rows[0].mindset).toBe('');
    expect(rows[0].literacy).toBe('');
    expect(rows[0].competency).toBe('');
    expect(rows[0].impact).toBe('');
  });

  it('does not leak coaching answers into the CSV', () => {
    const rows = buildUaamRows([
      makeUser({
        coaching_answers: { q1: 'secret_answer' },
      }),
    ]);
    const csv = buildCsv(rows, UAAM_EXPORT_FIELD_DEFS);

    expect(csv).not.toContain('secret_answer');
    expect(csv).not.toContain('coaching_answers');
  });
});
