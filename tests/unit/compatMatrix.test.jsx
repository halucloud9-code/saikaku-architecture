// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CompatMatrix, { buildCompatMatrixModel } from '../../src/compat/CompatMatrix.jsx';

function pair(model, axisA, axisB) {
  return model.cells.find((_row, index) => model.diagonal[index].axis.key === axisA)
    .find((cell) => cell.kind === 'pair' && cell.axisB.key === axisB);
}

describe('compat UAAM matrix model', () => {
  it('aggregates personal pair zones and counts only people carrying the maximum non-dormant zone', () => {
    const model = buildCompatMatrixModel({
      memberScores: {
        M1: { meaning: 20, mindfulness: 20 },
        M2: { meaning: 20, mindfulness: 20 },
        M3: { meaning: 16, mindfulness: 16 },
      },
    });
    const cell = pair(model, 'meaning', 'mindfulness');

    expect(cell.zone).toBe('natural');
    expect(cell.carrierAliases).toEqual(['M1', 'M2']);
    expect(cell.carrierCount).toBe(2);
    expect(cell.details.map((detail) => detail.zone)).toEqual(['natural', 'natural', 'pro']);
  });

  it('never combines one member score with another member score', () => {
    const model = buildCompatMatrixModel({
      memberScores: {
        M1: { meaning: 20, mindfulness: 0 },
        M2: { meaning: 0, mindfulness: 20 },
      },
    });
    const cell = pair(model, 'meaning', 'mindfulness');

    expect(cell.zone).toBe('dormant');
    expect(cell.carrierCount).toBe(0);
    expect(model.dormantPairs).toContain(cell);
  });

  it('allows partial axes and treats a pair with no same-person two-axis data as no-data', () => {
    const model = buildCompatMatrixModel({
      memberScores: {
        M1: { meaning: 16 },
        M2: { mindfulness: 16 },
      },
    }, ['M1', 'M2', 'M3']);
    const cell = pair(model, 'meaning', 'mindfulness');

    expect(cell.dataStatus).toBe('no-data');
    expect(cell.zone).toBeNull();
    expect(model.diagonal.find((item) => item.axis.key === 'meaning')).toMatchObject({
      dataStatus: 'measured',
      highestScore: 16,
      carrierAliases: ['M1'],
    });
    expect(model.diagonal.find((item) => item.axis.key === 'mindfulness')).toMatchObject({
      dataStatus: 'measured',
      highestScore: 16,
      carrierAliases: ['M2'],
    });
    expect(model.noDataAxes.map((axis) => axis.key)).toContain('mindshift');
    expect(model.dataAliases).toEqual(['M1', 'M2']);
  });

  it('keeps dormant and no-data cells separate and computes four-group coverage from measured axes', () => {
    const model = buildCompatMatrixModel({
      memberScores: {
        M1: { meaning: 12, mindfulness: 9 },
      },
    });

    expect(pair(model, 'meaning', 'mindfulness').zone).toBe('dormant');
    expect(pair(model, 'meaning', 'mindshift').dataStatus).toBe('no-data');
    expect(model.groupCoverage).toEqual([
      expect.objectContaining({ group: '志', coveredCount: 1, measuredCount: 2, totalCount: 4, percentage: 25 }),
      expect.objectContaining({ group: '知', coveredCount: 0, measuredCount: 0, totalCount: 4, percentage: 0 }),
      expect.objectContaining({ group: '技', coveredCount: 0, measuredCount: 0, totalCount: 4, percentage: 0 }),
      expect.objectContaining({ group: '衝', coveredCount: 0, measuredCount: 0, totalCount: 4, percentage: 0 }),
    ]);
  });
});

describe('CompatMatrix', () => {
  it('renders real names in cell details, missing-member notes, and distinct no-data axes', () => {
    render(
      <CompatMatrix
        uaamMatrix={{ memberScores: { M1: { meaning: 16, mindfulness: 16 } } }}
        members={[{ alias: 'M1' }, { alias: 'M2' }]}
        memberLabels={['つかさ', '野田健一']}
      />,
    );

    expect(screen.getByRole('heading', { name: 'チームの中にある力の地図' })).toBeInTheDocument();
    expect(screen.getByText(/この図に入っていない人/).closest('p')).toHaveTextContent('野田健一');
    expect(screen.getByText(/データなしの軸/).closest('p')).toHaveTextContent('転換力');
    const pairCell = document.querySelector('[data-row="0"][data-column="1"]');
    expect(pairCell).toHaveAttribute('title', expect.stringContaining('つかさ: 基軸力 16点 / 認知力 16点'));
    expect(pairCell).toHaveAttribute('title', expect.stringContaining('野田健一: 基軸力 データなし'));
  });

  it('renders all 256 data cells as non-buttons with descriptive accessible labels', () => {
    const { container } = render(
      <CompatMatrix
        uaamMatrix={{ memberScores: { M1: { meaning: 16, mindfulness: 16 } } }}
        members={[{ alias: 'M1' }]}
        memberLabels={['つかさ']}
      />,
    );

    const cells = [...container.querySelectorAll('.compat-matrix-cell')];
    expect(cells).toHaveLength(256);
    expect(cells.every((cell) => cell.tagName !== 'BUTTON')).toBe(true);
    expect(cells.every((cell) => cell.getAttribute('role') === 'img')).toBe(true);

    const pairCell = container.querySelector('[data-row="0"][data-column="1"]');
    expect(pairCell).toHaveAccessibleName(expect.stringContaining('基軸力 × 認知力・高い水準・担い手1人'));
    expect(screen.getByRole('columnheader', { name: '志・基軸力' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '高水準' }));
    expect(pairCell).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img', { name: /基軸力 × 認知力・高い水準・担い手1人/u })).toBeNull();
  });
});
