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

describe('compat output validator', () => {
  it('accepts the strict claim contract', () => {
    expect(validateCompatOutput(validOutput(), evidence).ok).toBe(true);
  });

  it('rejects unknown evidence IDs', () => {
    const output = validOutput();
    output.lenses[0].claims[0].evidenceIds = ['E-999'];
    expect(validateCompatOutput(output, evidence).errors.join(' ')).toContain('未知の証拠ID');
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
});

