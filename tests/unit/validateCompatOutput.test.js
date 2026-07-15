import { describe, expect, it } from 'vitest';
import { validateCompatOutput } from '../../api/lib/validateCompatOutput.js';

const evidence = [
  { id: 'E-001', lens: 'similarity' },
  { id: 'E-002', lens: 'complementarity' },
];

function validOutput() {
  return {
    dataSufficiency: { summary: '範囲内で読みます。', limitations: [] },
    lenses: [
      {
        id: 'similarity', status: 'detected', summary: '一致があります。', claims: [
          { text: '同じ分類の完全一致があります。', kind: 'observation', evidenceIds: ['E-001'], verificationQuestion: '実際に同じ意味で使っていますか？' },
        ],
      },
      { id: 'complementarity', status: 'not_detected', summary: 'この診断データでは不検出です。', claims: [] },
    ],
  };
}

function validV2Output() {
  return { ...validOutput(), unmetFunctionCandidate: null };
}

describe('compat output validator', () => {
  it('accepts the strict claim contract', () => {
    expect(validateCompatOutput(validOutput(), evidence).ok).toBe(true);
    expect(validateCompatOutput(validV2Output(), evidence, { schemaVersion: 2, goalProvided: false }).ok).toBe(true);
  });

  it('rejects unknown evidence IDs', () => {
    const output = validOutput();
    output.lenses[0].claims[0].evidenceIds = ['E-999'];
    expect(validateCompatOutput(output, evidence).errors.join(' ')).toContain('未知の証拠ID');
  });

  it('keeps rejection details free of model-supplied IDs and field names', () => {
    const unknownEvidence = validOutput();
    unknownEvidence.lenses[0].claims[0].evidenceIds = ['RAW-MEMBER-DATA'];
    const evidenceErrors = validateCompatOutput(unknownEvidence, evidence).errors.join(' ');
    expect(evidenceErrors).not.toContain('RAW-MEMBER');
    expect(evidenceErrors).toContain('未知の証拠ID');

    const unknownField = validOutput();
    unknownField.lenses[0]['RAW-MEMBER-NAME'] = '採用すべき人材です';
    const fieldErrors = validateCompatOutput(unknownField, evidence).errors.join(' ');
    expect(fieldErrors).not.toContain('RAW-MEMBER');
    expect(fieldErrors).toContain('人事・採用・査定用途の表現は禁止です');
  });

  it.each([
    ['scalar score', (output) => { output.lenses[0].summary = '相性スコア: 85点'; }],
    ['personnel language', (output) => { output.lenses[0].summary = '採用すべき人材です'; }],
    ['score key', (output) => { output.score = 85; }],
  ])('rejects %s', (_name, mutate) => {
    const output = validOutput();
    mutate(output);
    expect(validateCompatOutput(output, evidence).ok).toBe(false);
  });

  it('requires a falsifiable verification question for every hypothesis', () => {
    const output = validOutput();
    output.lenses[0].claims[0].kind = 'hypothesis';
    output.lenses[0].claims[0].verificationQuestion = '';
    expect(validateCompatOutput(output, evidence).ok).toBe(false);
  });

  it('allows at most one goal-conditional unmet function hypothesis', () => {
    const output = validV2Output();
    output.unmetFunctionCandidate = {
      text: '目的達成に必要な対外説明の機能が、この診断データでは未充足の可能性があります。',
      kind: 'hypothesis',
      evidenceIds: ['E-001'],
      verificationQuestion: '直近の発信が止まった場面では、説明役が定まらなかったことと、時間不足のどちらが主因でしたか？',
    };
    expect(validateCompatOutput(output, evidence, { schemaVersion: 2, goalProvided: true }).ok).toBe(true);
    expect(validateCompatOutput(output, evidence, { schemaVersion: 2, goalProvided: false }).errors.join(' ')).toContain('チーム目的');
  });

  it('rejects 欠員 vocabulary in every v2 output field', () => {
    const output = validV2Output();
    output.lenses[0].summary = '対外説明の欠員があります。';
    expect(validateCompatOutput(output, evidence, { schemaVersion: 2, goalProvided: false }).errors.join(' ')).toContain('「欠員」表現は禁止');
  });
});
