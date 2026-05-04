import { describe, expect, it } from 'vitest';
import { makeCoachingAnswerKey } from '../../api/lib/coachingAnswerKey.js';

describe('makeCoachingAnswerKey', () => {
  it('returns deterministic 16-hex key for same input', () => {
    const first = makeCoachingAnswerKey('問い1');
    const second = makeCoachingAnswerKey('問い1');

    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{16}$/);
  });

  it('treats trailing punctuation (？！?!．。) as equivalent', () => {
    expect(makeCoachingAnswerKey('問い1')).toBe(makeCoachingAnswerKey('問い1？'));
    expect(makeCoachingAnswerKey('問い1')).toBe(makeCoachingAnswerKey('問い1?'));
    expect(makeCoachingAnswerKey('問い1')).toBe(makeCoachingAnswerKey('問い1！'));
    expect(makeCoachingAnswerKey('問い1')).toBe(makeCoachingAnswerKey('問い1!'));
    expect(makeCoachingAnswerKey('問い1')).toBe(makeCoachingAnswerKey('問い1．'));
    expect(makeCoachingAnswerKey('問い1')).toBe(makeCoachingAnswerKey('問い1。'));
  });

  it('treats full-width and half-width spaces as equivalent', () => {
    expect(makeCoachingAnswerKey('問い 1')).toBe(makeCoachingAnswerKey('問い　1'));
  });

  it('collapses consecutive spaces', () => {
    expect(makeCoachingAnswerKey('a  b')).toBe(makeCoachingAnswerKey('a b'));
  });

  it('returns different key for different questions', () => {
    expect(makeCoachingAnswerKey('問い1')).not.toBe(makeCoachingAnswerKey('問い2'));
  });

  it('throws on empty string', () => {
    expect(() => makeCoachingAnswerKey('')).toThrow();
  });

  it('throws on whitespace-only', () => {
    expect(() => makeCoachingAnswerKey('   ')).toThrow();
  });

  it('throws on non-string input', () => {
    expect(() => makeCoachingAnswerKey(null)).toThrow();
    expect(() => makeCoachingAnswerKey(undefined)).toThrow();
    expect(() => makeCoachingAnswerKey(123)).toThrow();
  });

  it('returns 16 hex chars', () => {
    const k = makeCoachingAnswerKey('質問テキスト');
    expect(k).toMatch(/^[0-9a-f]{16}$/);
  });
});
