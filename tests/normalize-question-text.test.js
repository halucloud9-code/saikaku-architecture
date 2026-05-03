import { describe, expect, it } from 'vitest';
import { normalizeQuestionText } from '../src/utils/normalizeQuestionText.js';

describe('normalizeQuestionText (client-side, server normalize と等価)', () => {
  it('同一テキストは同一結果', () => {
    expect(normalizeQuestionText('問い1')).toBe(normalizeQuestionText('問い1'));
  });

  it('末尾`？` `?` `！` `!` `．` `。` `.` の有無で同一', () => {
    const base = normalizeQuestionText('問い1');
    expect(normalizeQuestionText('問い1？')).toBe(base);
    expect(normalizeQuestionText('問い1?')).toBe(base);
    expect(normalizeQuestionText('問い1！')).toBe(base);
    expect(normalizeQuestionText('問い1!')).toBe(base);
    expect(normalizeQuestionText('問い1．')).toBe(base);
    expect(normalizeQuestionText('問い1。')).toBe(base);
  });

  it('全角空白と半角空白で同一', () => {
    expect(normalizeQuestionText('問い 1')).toBe(normalizeQuestionText('問い　1'));
  });

  it('連続空白は1つに縮約', () => {
    expect(normalizeQuestionText('a  b')).toBe(normalizeQuestionText('a b'));
  });

  it('異なる質問文は異なる結果', () => {
    expect(normalizeQuestionText('問い1')).not.toBe(normalizeQuestionText('問い2'));
  });

  it('空文字 / 空白のみ / 非string は null', () => {
    expect(normalizeQuestionText('')).toBeNull();
    expect(normalizeQuestionText('   ')).toBeNull();
    expect(normalizeQuestionText(null)).toBeNull();
    expect(normalizeQuestionText(undefined)).toBeNull();
    expect(normalizeQuestionText(123)).toBeNull();
  });
});
