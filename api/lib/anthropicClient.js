import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const isMock = process.env.MOCK_ANTHROPIC === '1';

let realClient = null;
function getReal() {
  if (!realClient) realClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return realClient;
}

function loadFixture(name) {
  const p = resolve(process.cwd(), 'tests/fixtures/anthropic', name);
  const raw = readFileSync(p, 'utf-8');
  return {
    content: [{ type: 'text', text: raw }],
  };
}

const callCounter = { saikaku: 0, uaam: 0, compat: 0 };
const mockRequests = { saikaku: [], uaam: [], compat: [] };

export function getMockCallCount(key) {
  return callCounter[key] ?? 0;
}

export function resetMockCallCount() {
  callCounter.saikaku = 0;
  callCounter.uaam = 0;
  callCounter.compat = 0;
  mockRequests.saikaku = [];
  mockRequests.uaam = [];
  mockRequests.compat = [];
}

export function getMockRequests(key) {
  return [...(mockRequests[key] || [])];
}

export async function createMessage({ fixtureKey, ...params }) {
  if (isMock) {
    if (process.env.MOCK_ANTHROPIC_FAIL === '1') {
      throw new Error('mock LLM failure');
    }
    callCounter[fixtureKey] = (callCounter[fixtureKey] ?? 0) + 1;
    (mockRequests[fixtureKey] ||= []).push(params);
    const delay = Number(process.env.MOCK_ANTHROPIC_DELAY_MS || 0);
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    let file;
    if (fixtureKey === 'compat') {
      const sequence = (process.env.MOCK_COMPAT_FIXTURES || 'compat-valid.json')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      file = sequence[Math.min(callCounter.compat - 1, sequence.length - 1)];
    } else {
      file = fixtureKey === 'uaam' ? 'uaam-1.json' : 'saikaku-1.json';
    }
    return loadFixture(file);
  }

  return getReal().messages.create(params);
}

export const isMockMode = () => isMock;
