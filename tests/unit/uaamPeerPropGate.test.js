import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('UAAM peer assessment route prop gate', () => {
  it('enables the peer section only in UaamResultRoute, not HistoryDetailRoute', () => {
    const source = readFileSync(new URL('../../src/App.jsx', import.meta.url), 'utf8');
    const resultRoute = source.slice(
      source.indexOf('function UaamResultRoute()'),
      source.indexOf('function HistoryRoute('),
    );
    const historyDetailRoute = source.slice(
      source.indexOf('function HistoryDetailRoute('),
      source.indexOf('function AdminRoute('),
    );

    expect(resultRoute).toContain('enablePeerAssessment');
    expect(historyDetailRoute).not.toContain('enablePeerAssessment');
  });
});
