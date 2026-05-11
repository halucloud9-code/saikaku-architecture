import { describe, expect, it } from 'vitest';
import { buildCsv } from '../../src/utils/exportCsv.js';
import { UAAM_EXPORT_FIELD_DEFS } from '../../src/utils/uaamExport.js';

describe('buildCsv', () => {
  it('writes the header row from field labels', () => {
    const csv = buildCsv([{ name: 'Alice', email: 'alice@example.com' }], [
      { key: 'name', label: '名前' },
      { key: 'email', label: 'メール' },
    ]);

    expect(csv.split('\r\n')[0]).toBe('\uFEFF名前,メール');
  });

  it('wraps comma, quote, and newline values and escapes inner quotes', () => {
    const csv = buildCsv([{ note: 'a,b"c\nd' }], [
      { key: 'note', label: 'Note' },
    ]);

    expect(csv).toBe('\uFEFFNote\r\n"a,b""c\nd"');
  });

  it('starts with a UTF-8 BOM', () => {
    const csv = buildCsv([], [{ key: 'a', label: 'A' }]);

    expect(csv.startsWith('\uFEFF')).toBe(true);
  });

  it('renders null and undefined values as empty strings', () => {
    const csv = buildCsv([{ a: null, b: undefined }], [
      { key: 'a', label: 'A' },
      { key: 'b', label: 'B' },
    ]);

    expect(csv).toBe('\uFEFFA,B\r\n,');
  });

  it('neutralizes formula-leading cells to prevent CSV injection', () => {
    const csv = buildCsv(
      [
        { name: '=cmd|"/c calc"!A1', email: '+SUM(A1)' },
        { name: '-2+3+cmd', email: '@SUM(A1)' },
        { name: '\tinjected', email: 'safe@example.com' },
      ],
      [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
      ],
    );

    const lines = csv.split('\r\n');
    expect(lines[1]).toBe('"\'=cmd|""/c calc""!A1",\'+SUM(A1)');
    expect(lines[2]).toBe("'-2+3+cmd,'@SUM(A1)");
    expect(lines[3]).toBe("'\tinjected,safe@example.com");
  });

  it('only exports allowlisted fields', () => {
    const csv = buildCsv([{ a: 1, secret: 'leaked' }], [
      { key: 'a', label: 'A' },
    ]);

    expect(csv).toBe('\uFEFFA\r\n1');
    expect(csv).not.toContain('leaked');
    expect(csv).not.toContain('secret');
  });

  it('matches the UAAM export column order snapshot', () => {
    const csv = buildCsv([
      {
        name: 'Alice',
        email: 'alice@example.com',
        mindset: 0,
        literacy: 80,
        competency: 75,
        impact: 90,
        meaning: 1,
        mindfulness: 2,
        mindshift: 3,
        mastery: 4,
        learning: 5,
        logical: 6,
        life: 7,
        leadership: 8,
        critical: 9,
        creativity: 10,
        communication: 11,
        collaboration: 12,
        idea: 13,
        innovation: 14,
        implementation: 15,
        influence: 16,
        v1: 'none',
        v2: 'warning',
        v3: 'critical',
        bias_level: 5,
        bias_message: 'needs review',
        type_name: '天地型',
        uaamUpdatedAt: '2026-05-01',
      },
      {
        name: 'Bob',
        email: 'bob@example.com',
        mindset: '',
        literacy: '',
        competency: '',
        impact: '',
        meaning: '',
        mindfulness: '',
        mindshift: '',
        mastery: '',
        learning: '',
        logical: '',
        life: '',
        leadership: '',
        critical: '',
        creativity: '',
        communication: '',
        collaboration: '',
        idea: '',
        innovation: '',
        implementation: '',
        influence: '',
        v1: 'none',
        v2: 'none',
        v3: 'none',
        bias_level: 1,
        bias_message: '',
        type_name: '未分類',
        uaamUpdatedAt: '',
      },
    ], UAAM_EXPORT_FIELD_DEFS);

    expect(csv).toMatchSnapshot();
  });
});
