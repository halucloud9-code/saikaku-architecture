// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import ActivationMatrix from '../ActivationMatrix';

const COMPONENT_SOURCE = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../ActivationMatrix.jsx'),
  'utf8',
);
const PCT_FONT_SIZE = 'clamp(15px, 3.6vw, 22px)';
const RAW_FONT_SIZE = 'clamp(10px, 2vw, 12px)';
const GROUP_PCT_FONT_SIZE = 22;
const GROUP_RAW_FONT_SIZE = 10;

const SUBS_BY_AXIS = {
  mindset: ['meaning', 'mindfulness', 'mindshift', 'mastery'],
  literacy: ['learning', 'logical', 'life', 'leadership'],
  competency: ['critical', 'creativity', 'communication', 'collaboration'],
  impact: ['idea', 'innovation', 'implementation', 'influence'],
};

function axisScore(axis, value) {
  return {
    subs: Object.fromEntries(SUBS_BY_AXIS[axis].map(key => [key, value])),
  };
}

function compact(value) {
  return value.replace(/\s+/g, '');
}

function styleOf(element) {
  return compact(element.getAttribute('style') ?? '');
}

function clampParts(value) {
  const match = value.match(/clamp\((\d+)px,\s*([\d.]+)vw,\s*(\d+)px\)/);
  expect(match).not.toBeNull();
  return {
    min: Number(match[1]),
    vw: Number(match[2]),
    max: Number(match[3]),
  };
}

function expectColor(element, rgb, alpha) {
  expect(styleOf(element)).toContain(`color:rgba(${rgb},${alpha})`);
}

function sourceBetween(start, end) {
  const startIndex = COMPONENT_SOURCE.indexOf(start);
  const endIndex = COMPONENT_SOURCE.indexOf(end, startIndex);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return COMPONENT_SOURCE.slice(startIndex, endIndex);
}

function closestStyledAncestor(element, predicate) {
  let node = element;
  while (node && node !== document.body) {
    if (predicate(styleOf(node))) return node;
    node = node.parentElement;
  }
  return null;
}

function getGroupCard(en) {
  const isGroupCard = style => style.includes('border-radius:14px') && style.includes('padding:12px14px');
  const label = screen.getAllByText(en).find(element => closestStyledAncestor(element, isGroupCard));
  expect(label).toBeDefined();
  const card = closestStyledAncestor(label, isGroupCard);
  expect(card).not.toBeNull();
  return card;
}

describe('ActivationMatrix CornerBadge', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders percentage primary and raw score secondary for all four corner badges', () => {
    render(
      <ActivationMatrix
        maxSub={20}
        scores={{
          mindset: axisScore('mindset', 16),
          literacy: axisScore('literacy', 10),
          competency: axisScore('competency', 13),
          impact: axisScore('impact', 18),
        }}
      />,
    );

    expect(COMPONENT_SOURCE).toContain(`fontSize: '${PCT_FONT_SIZE}'`);
    expect(COMPONENT_SOURCE).toContain(`fontSize: '${RAW_FONT_SIZE}'`);
    const pctSize = clampParts(PCT_FONT_SIZE);
    const rawSize = clampParts(RAW_FONT_SIZE);
    expect(pctSize.min / rawSize.min).toBeGreaterThanOrEqual(1.4);
    expect(pctSize.vw / rawSize.vw).toBeGreaterThanOrEqual(1.4);
    expect(pctSize.max / rawSize.max).toBeGreaterThanOrEqual(1.4);

    [
      { en: 'ACT', pct: '90%', raw: '72/80', rgb: '168,68,50' },
      { en: 'WHY', pct: '80%', raw: '64/80', rgb: '74,111,165' },
      { en: 'HOW', pct: '65%', raw: '52/80', rgb: '196,146,42' },
      { en: 'THINK', pct: '50%', raw: '40/80', rgb: '46,139,87' },
    ].forEach(({ en, pct, raw, rgb }) => {
      const badge = screen.getAllByText(en)[0].parentElement;
      expect(badge).toHaveStyle('position: absolute');
      expect(badge).toHaveTextContent(pct);
      expect(badge).toHaveTextContent(raw);

      const scoreBlock = badge.children[2];
      const pctLine = scoreBlock.children[0];
      const rawLine = scoreBlock.children[1];
      const percentSymbol = pctLine.querySelector('span');
      const rawMax = rawLine.querySelector('span');

      expect(pctLine).toHaveTextContent(pct);
      expect(rawLine).toHaveTextContent(raw);
      expect(styleOf(pctLine)).toContain('font-weight:700');
      expect(styleOf(rawLine)).toContain('font-weight:400');
      expectColor(pctLine, rgb, '0.9');
      expectColor(rawLine, rgb, '0.45');
      expect(styleOf(percentSymbol)).toContain('font-size:0.55em');
      expect(styleOf(percentSymbol)).toContain('font-weight:400');
      expectColor(percentSymbol, rgb, '0.55');
      expect(styleOf(rawMax)).toContain('font-size:1em');
      expect(styleOf(rawMax)).toContain('font-weight:400');
      expectColor(rawMax, rgb, '0.45');
    });
  });

  it('renders percentage primary and raw score secondary for all four group cards', () => {
    render(
      <ActivationMatrix
        maxSub={20}
        scores={{
          mindset: axisScore('mindset', 17),
          literacy: axisScore('literacy', 14),
          competency: axisScore('competency', 11),
          impact: axisScore('impact', 19),
        }}
      />,
    );

    const groupCardSource = sourceBetween('/* ── 4グループカード', '{/* ▼ 開閉インジケーター */}');
    expect(groupCardSource).toContain("flexDirection: 'column'");
    expect(groupCardSource).toContain('fontSize: 22, fontWeight: 800');
    expect(groupCardSource).toContain("fontSize: '0.55em', fontWeight: 400");
    expect(groupCardSource).toContain('fontSize: 10, fontWeight: 400');
    expect(groupCardSource).toContain("fontSize: '1em', fontWeight: 400");
    expect(groupCardSource).toContain('width: `${g.pct}%`');
    expect(groupCardSource).not.toContain('>{g.pct}%</div>');
    expect(GROUP_PCT_FONT_SIZE / GROUP_RAW_FONT_SIZE).toBeGreaterThanOrEqual(1.4);

    [
      { en: 'ACT', pct: '95%', raw: '76/80', rgb: '168,68,50' },
      { en: 'WHY', pct: '85%', raw: '68/80', rgb: '74,111,165' },
      { en: 'THINK', pct: '70%', raw: '56/80', rgb: '46,139,87' },
      { en: 'HOW', pct: '55%', raw: '44/80', rgb: '196,146,42' },
    ].forEach(({ en, pct, raw, rgb }) => {
      const card = getGroupCard(en);
      expect(card).toHaveTextContent(pct);
      expect(card).toHaveTextContent(raw);
      expect(card.children.length).toBe(2);

      const scoreBlock = card.children[0].children[1];
      const pctLine = scoreBlock.children[0];
      const rawLine = scoreBlock.children[1];
      const percentSymbol = pctLine.querySelector('span');
      const rawMax = rawLine.querySelector('span');
      const progressFill = card.children[1].children[0];

      expect(styleOf(scoreBlock)).toContain('flex-direction:column');
      expect(styleOf(scoreBlock)).toContain('align-items:flex-end');
      expect(pctLine).toHaveTextContent(pct);
      expect(rawLine).toHaveTextContent(raw);
      expect(styleOf(pctLine)).toContain(`font-size:${GROUP_PCT_FONT_SIZE}px`);
      expect(styleOf(pctLine)).toContain('font-weight:800');
      expectColor(pctLine, rgb, '0.9');
      expect(styleOf(rawLine)).toContain(`font-size:${GROUP_RAW_FONT_SIZE}px`);
      expect(styleOf(rawLine)).toContain('font-weight:400');
      expectColor(rawLine, rgb, '0.45');
      expect(styleOf(percentSymbol)).toContain('font-size:0.55em');
      expect(styleOf(percentSymbol)).toContain('font-weight:400');
      expectColor(percentSymbol, rgb, '0.55');
      expect(styleOf(rawMax)).toContain('font-size:1em');
      expect(styleOf(rawMax)).toContain('font-weight:400');
      expectColor(rawMax, rgb, '0.45');
      expect(styleOf(progressFill)).toContain(`width:${pct}`);
    });
  });
});
