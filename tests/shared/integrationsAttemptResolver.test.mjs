import { describe, expect, it } from 'vitest';
import { inferIntegrationAttemptPair } from '../../shared/integrationsAttemptResolver.js';

const base = Date.parse('2026-01-01T00:00:00.000Z');
const at = (offsetMs) => new Date(base + offsetMs);

function attempt(id, offsetMs, status = 'committed') {
  return { id, createdAt: at(offsetMs), status };
}

describe('inferIntegrationAttemptPair', () => {
  it('returns the latest committed attempts before integrationUpdatedAt', () => {
    const result = inferIntegrationAttemptPair({
      uid: 'u-happy',
      integrationUpdatedAt: at(3001),
      saikakuAttempts: [
        attempt('saikaku-t1', 1000),
        attempt('saikaku-t2', 2000),
      ],
      uaamAttempts: [
        attempt('uaam-t3', 3000),
        attempt('uaam-t4', 4000),
      ],
    });

    expect(result).toEqual({
      saikakuAttemptId: 'saikaku-t2',
      uaamAttemptId: 'uaam-t3',
      source: 'inferred',
    });
  });

  it('falls back on both sides when attempt arrays are empty', () => {
    const result = inferIntegrationAttemptPair({
      uid: 'u-empty',
      integrationUpdatedAt: at(5000),
      saikakuAttempts: [],
      uaamAttempts: [],
    });

    expect(result).toEqual({
      saikakuAttemptId: null,
      uaamAttemptId: null,
      source: 'both-fallback',
    });
  });

  it('falls back on Saikaku only when UAAM has a match', () => {
    const result = inferIntegrationAttemptPair({
      uid: 'u-saikaku-fallback',
      integrationUpdatedAt: at(3000),
      saikakuAttempts: [],
      uaamAttempts: [attempt('uaam-match', 2000)],
    });

    expect(result).toEqual({
      saikakuAttemptId: null,
      uaamAttemptId: 'uaam-match',
      source: 'saikaku-fallback',
    });
  });

  it('falls back on UAAM only when Saikaku has a match', () => {
    const result = inferIntegrationAttemptPair({
      uid: 'u-uaam-fallback',
      integrationUpdatedAt: at(3000),
      saikakuAttempts: [attempt('saikaku-match', 2000)],
      uaamAttempts: [],
    });

    expect(result).toEqual({
      saikakuAttemptId: 'saikaku-match',
      uaamAttemptId: null,
      source: 'uaam-fallback',
    });
  });

  it('selects an equal createdAt attempt because integration is generated at or after attempt commit', () => {
    const result = inferIntegrationAttemptPair({
      uid: 'u-strict',
      integrationUpdatedAt: at(3000),
      saikakuAttempts: [
        attempt('saikaku-earlier', 2000),
        attempt('saikaku-equal', 3000),
      ],
      uaamAttempts: [
        attempt('uaam-earlier', 1000),
        attempt('uaam-equal', 3000),
      ],
    });

    expect(result).toEqual({
      saikakuAttemptId: 'saikaku-equal',
      uaamAttemptId: 'uaam-equal',
      source: 'inferred',
    });
  });

  it('ignores pending attempts when inferring', () => {
    const result = inferIntegrationAttemptPair({
      uid: 'u-pending',
      integrationUpdatedAt: at(5000),
      saikakuAttempts: [attempt('saikaku-pending', 1000, 'pending')],
      uaamAttempts: [attempt('uaam-pending', 2000, 'pending')],
    });

    expect(result).toEqual({
      saikakuAttemptId: null,
      uaamAttemptId: null,
      source: 'both-fallback',
    });
  });

  it.each([null, undefined])('falls back on both sides when integrationUpdatedAt is %s', (integrationUpdatedAt) => {
    const result = inferIntegrationAttemptPair({
      uid: 'u-no-timestamp',
      integrationUpdatedAt,
      saikakuAttempts: [attempt('saikaku-before', 1000)],
      uaamAttempts: [attempt('uaam-before', 1000)],
    });

    expect(result).toEqual({
      saikakuAttemptId: null,
      uaamAttemptId: null,
      source: 'both-fallback',
    });
  });

  it('sorts unsorted attempts and ignores committed attempts after integrationUpdatedAt', () => {
    const result = inferIntegrationAttemptPair({
      uid: 'u-unsorted',
      integrationUpdatedAt: at(3500),
      saikakuAttempts: [
        attempt('saikaku-after', 4000),
        attempt('saikaku-latest-before', 3000),
        attempt('saikaku-earlier', 1000),
      ],
      uaamAttempts: [
        attempt('uaam-after', 5000),
        attempt('uaam-earlier', 1000),
        attempt('uaam-latest-before', 3000),
      ],
    });

    expect(result).toEqual({
      saikakuAttemptId: 'saikaku-latest-before',
      uaamAttemptId: 'uaam-latest-before',
      source: 'inferred',
    });
  });

  it('supports Firestore-like timestamp objects', () => {
    const timestamp = (offsetMs) => ({
      seconds: Math.floor((base + offsetMs) / 1000),
      nanoseconds: ((base + offsetMs) % 1000) * 1000000,
    });

    const result = inferIntegrationAttemptPair({
      uid: 'u-firestore-shape',
      integrationUpdatedAt: timestamp(2500),
      saikakuAttempts: [{ id: 'saikaku-object', createdAt: timestamp(1000), status: 'committed' }],
      uaamAttempts: [{ id: 'uaam-object', createdAt: timestamp(2000), status: 'committed' }],
    });

    expect(result).toEqual({
      saikakuAttemptId: 'saikaku-object',
      uaamAttemptId: 'uaam-object',
      source: 'inferred',
    });
  });
});
