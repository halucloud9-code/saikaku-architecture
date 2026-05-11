import { describe, expect, it } from 'vitest';
import { UAAM_AXES } from '../../src/data/uaam_questions.js';
import { buildCsv } from '../../src/utils/exportCsv.js';
import { buildUaamRows, UAAM_EXPORT_FIELD_DEFS } from '../../src/utils/uaamExport.js';

const SUB_COLUMN_START = 6;
const SUB_KEYS = UAAM_AXES.flatMap((axis) => axis.subs.map((sub) => sub.key));

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

function makeSubScores(valueBySubKey) {
  return Object.fromEntries(
    UAAM_AXES.map((axis) => [
      axis.key,
      {
        total: 40,
        max: 80,
        percentage: 50,
        subs: Object.fromEntries(
          axis.subs.map((sub) => [sub.key, valueBySubKey[sub.key]]),
        ),
      },
    ]),
  );
}

function makeSequentialSubValues() {
  return Object.fromEntries(SUB_KEYS.map((key, index) => [key, index + 1]));
}

function makeFlatSubValues(defaultValue, overrides = {}) {
  return Object.fromEntries(
    SUB_KEYS.map((key) => [key, overrides[key] ?? defaultValue]),
  );
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

  it('exports all 16 sub score columns as raw values in UAAM axis order', () => {
    const rows = buildUaamRows([
      makeUser({ scores: makeSubScores(makeSequentialSubValues()) }),
    ]);
    const csv = buildCsv(rows, UAAM_EXPORT_FIELD_DEFS);

    expect(csvCell(csv, 0, SUB_COLUMN_START)).toBe('基軸力');
    expect(csvCell(csv, 0, SUB_COLUMN_START + SUB_KEYS.length - 1)).toBe('影響力');
    SUB_KEYS.forEach((key, index) => {
      expect(rows[0][key]).toBe(index + 1);
      expect(csvCell(csv, 1, SUB_COLUMN_START + index)).toBe(String(index + 1));
    });
  });

  it('renders all 16 sub score cells as empty strings when scores is null', () => {
    const rows = buildUaamRows([makeUser({ scores: null })]);

    SUB_KEYS.forEach((key) => {
      expect(rows[0][key]).toBe('');
    });
  });

  it('renders only missing axis subs as empty strings', () => {
    const scores = makeSubScores(makeFlatSubValues(5));
    scores.mindset.subs = undefined;
    const rows = buildUaamRows([makeUser({ scores })]);

    UAAM_AXES.forEach((axis) => {
      axis.subs.forEach((sub) => {
        expect(rows[0][sub.key]).toBe(axis.key === 'mindset' ? '' : 5);
      });
    });
  });

  it('preserves a sub score 0 as the CSV cell value', () => {
    const rows = buildUaamRows([
      makeUser({ scores: makeSubScores(makeFlatSubValues(5, { meaning: 0 })) }),
    ]);
    const csv = buildCsv(rows, UAAM_EXPORT_FIELD_DEFS);

    expect(csvCell(csv, 1, SUB_COLUMN_START)).toBe('0');
  });

  it('recomputes bias_message for legacy users (undefined) via calculateBiasMessage', () => {
    const rows = buildUaamRows([
      makeUser({
        bias_message: undefined,
        vAnswers: { V1: 1, V2: 2, V3: 1 },
        scores: {
          mindset: { total: 20, max: 80, percentage: 25 },
          literacy: { total: 24, max: 80, percentage: 30 },
          competency: { total: 28, max: 80, percentage: 35 },
          impact: { total: 32, max: 80, percentage: 40 },
        },
      }),
    ]);

    expect(rows[0].bias_message).not.toBe('');
    expect(typeof rows[0].bias_message).toBe('string');
  });

  it('preserves explicit null bias_message (healthy) as empty CSV cell', () => {
    const rows = buildUaamRows([makeUser({ bias_message: null })]);

    expect(rows[0].bias_message).toBe('');
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
