import { describe, expect, it } from 'vitest';
import { buildCompatMessage, parseCompatJsonResponse } from '../../api/lib/compatPrompt.js';

describe('compat prompt response parsing', () => {
  it('states the exact root, lens, claim, and enum contract with a bounded output', () => {
    const params = buildCompatMessage({ mode: 'team', goal: '共通目的', promptEvidence: [], dataSufficiency: {} });
    expect(params.max_tokens).toBe(4_096);
    expect(params.system).toContain('rootのキーはこの順序で dataSufficiency, lenses, unmetFunctionCandidate の3つだけ');
    expect(params.system).toContain('id, status, summary, claims の4つだけ');
    expect(params.system).toContain('text, kind, evidenceIds, verificationQuestion の4つだけ');
    expect(params.system).toContain('英字の値を日本語へ翻訳しません');
    expect(params.system).toContain('"evidenceIds":["E-001"]');
    expect(params.system).toContain('中立な別解を識別できる問い');
    expect(params.system).toContain('「欠員」という語は禁止');
    expect(params.messages[0].content).toContain('目的あり: 証拠が十分な場合だけ最大1件');
  });

  it('extracts a fenced JSON object surrounded by prose', () => {
    const response = {
      content: [{
        type: 'text',
        text: '結果です。\n```json\n{"dataSufficiency":{"summary":"範囲内です。","limitations":[]},"lenses":[]}\n```\n以上です。',
      }],
    };
    expect(parseCompatJsonResponse(response)).toEqual({
      dataSufficiency: { summary: '範囲内です。', limitations: [] },
      lenses: [],
    });
  });

  it('does not include invalid model text in parse errors', () => {
    const response = { content: [{ type: 'text', text: 'RAW-MEMBER-DATA is not JSON' }] };
    expect(() => parseCompatJsonResponse(response)).toThrow('LLM response is not valid JSON');
    try {
      parseCompatJsonResponse(response);
    } catch (error) {
      expect(error.message).not.toContain('RAW-MEMBER-DATA');
    }
  });

  it('fails closed when Anthropic reports token truncation', () => {
    const response = {
      stop_reason: 'max_tokens',
      content: [{ type: 'text', text: '{"apparently":"valid"}' }],
    };
    expect(() => parseCompatJsonResponse(response)).toThrow('truncated');
  });
});
