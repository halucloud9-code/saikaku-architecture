// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CompatMatrix, {
  buildCompatMatrixModel,
  buildSharedCompatMatrixModel,
} from '../../src/compat/CompatMatrix.jsx';
import { buildCompatSharedMatrix } from '../../api/lib/compatShare.js';

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
  it('shows real names, pair definitions, zones, and admin-only member scores in its rich tooltip', () => {
    render(
      <CompatMatrix
        uaamMatrix={{ memberScores: { M1: { meaning: 16, mindfulness: 16 } } }}
        members={[{ alias: 'M1' }, { alias: 'M2' }]}
        memberLabels={['つかさ', '野田健一']}
      />,
    );

    expect(screen.getByRole('heading', { name: 'チーム発動領域Matrix' })).toBeInTheDocument();
    expect(screen.getByText(/この図に入っていない人/).closest('p')).toHaveTextContent('野田健一');
    expect(screen.getByText(/データなしの軸/).closest('p')).toHaveTextContent('転換力');
    const pairCell = document.querySelector('[data-row="0"][data-column="1"]');
    expect(pairCell).toHaveTextContent('');
    fireEvent.mouseEnter(pairCell, { clientX: 100, clientY: 100 });
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('基認力');
    expect(tooltip).toHaveTextContent('軸が定まっているから、どんな価値観も受け入れられる力');
    expect(tooltip).toHaveTextContent('PRO');
    expect(tooltip).toHaveTextContent('担い手つかさ');
    expect(tooltip).toHaveTextContent('つかさ基軸力 16点 / 認知力 16点PRO');
    expect(tooltip).toHaveTextContent('野田健一基軸力 データなし / 認知力 データなし判定できません');
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
    expect(pairCell).toHaveAccessibleName(expect.stringContaining('基軸力 × 認知力。高い水準。担い手 つかさ'));
    expect(screen.getByRole('columnheader', { name: '志・基軸力' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'PRO' }));
    expect(pairCell).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img', { name: /基軸力 × 認知力。高い水準。担い手 つかさ/u })).toBeNull();
  });

  it('uses one roving tab stop, shows details on focus, skips filtered cells, and toggles with Enter or tap', () => {
    const { container } = render(
      <CompatMatrix
        uaamMatrix={{
          memberScores: {
            M1: { meaning: 20, mindfulness: 20, mindshift: 16 },
          },
        }}
        members={[{ alias: 'M1' }]}
        memberLabels={['つかさ']}
      />,
    );

    const firstCell = container.querySelector('[data-row="0"][data-column="0"]');
    const naturalCell = container.querySelector('[data-row="0"][data-column="1"]');
    const proCell = container.querySelector('[data-row="0"][data-column="2"]');
    const allCells = [...container.querySelectorAll('.compat-matrix-cell')];
    expect(allCells.filter((cell) => cell.tabIndex === 0)).toEqual([firstCell]);

    fireEvent.click(screen.getByRole('button', { name: /NATURAL/u }));
    expect(naturalCell).toHaveAttribute('aria-hidden', 'true');
    fireEvent.focus(firstCell);
    expect(screen.getByRole('tooltip')).toHaveTextContent('基軸力');

    fireEvent.keyDown(firstCell, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(proCell);
    expect(naturalCell.tabIndex).toBe(-1);
    expect(proCell.tabIndex).toBe(0);
    expect(allCells.filter((cell) => cell.tabIndex === 0)).toEqual([proCell]);
    expect(screen.getByRole('tooltip')).toHaveTextContent('基転力');

    fireEvent.keyDown(proCell, { key: 'Enter' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.keyDown(proCell, { key: 'Enter' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('基転力');

    fireEvent.blur(proCell);
    fireEvent.pointerDown(firstCell, { pointerType: 'touch' });
    fireEvent.focus(firstCell);
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.click(firstCell);
    expect(screen.getByRole('tooltip')).toHaveTextContent('基軸力');
    fireEvent.click(firstCell);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('uses shared topPairs in their stored ranking order and omits TOP 5 for old matrices', () => {
    const sharedMatrix = buildCompatSharedMatrix({
      memberScores: {
        M1: {
          meaning: 16,
          mindfulness: 16,
          mindshift: 20,
          mastery: 20,
        },
      },
    }, ['M1']);
    const rankedModel = buildSharedCompatMatrixModel(sharedMatrix, ['M1']);

    expect(rankedModel.hasTopPairs).toBe(true);
    expect(rankedModel.topPairs.map((cell) => ({
      rowKey: cell.axisA.key,
      colKey: cell.axisB.key,
    }))).toEqual(sharedMatrix.topPairs);

    const legacyMatrix = structuredClone(sharedMatrix);
    delete legacyMatrix.topPairs;
    const legacyModel = buildSharedCompatMatrixModel(legacyMatrix, ['M1']);
    expect(legacyModel.hasTopPairs).toBe(false);
    expect(legacyModel.topPairs).toEqual([]);
  });

  it('renders shared derived data with carrier names but no score details or diagonal carriers', () => {
    const sharedMatrix = buildCompatSharedMatrix({
      memberScores: {
        M1: { meaning: 16, mindfulness: 16 },
        M2: { meaning: 12, mindfulness: 12 },
      },
    }, ['M1', 'M2']);
    const { container } = render(
      <CompatMatrix
        mode="share"
        sharedMatrix={sharedMatrix}
        members={[{ alias: 'M1' }, { alias: 'M2' }]}
        memberLabels={['つかさ', '野田健一']}
      />,
    );

    const pairCell = container.querySelector('[data-row="0"][data-column="1"]');
    expect(pairCell).toHaveTextContent('');
    expect(pairCell).toHaveAccessibleName(expect.stringContaining('担い手 つかさ'));
    expect(pairCell.getAttribute('aria-label')).not.toMatch(/\d+点/u);
    fireEvent.mouseEnter(pairCell, { clientX: 100, clientY: 100 });
    expect(screen.getByRole('tooltip')).toHaveTextContent('担い手つかさ');
    expect(screen.getByRole('tooltip')).not.toHaveTextContent(/16点|12点/u);

    fireEvent.mouseLeave(pairCell);
    const diagonal = container.querySelector('[data-row="0"][data-column="0"]');
    expect(diagonal).toHaveAccessibleName('基軸力・データあり・共有版では対角の担い手なし');
    fireEvent.mouseEnter(diagonal, { clientX: 100, clientY: 100 });
    expect(screen.getByRole('tooltip')).toHaveTextContent('共有版では点数と対角の担い手を表示しません');
    expect(screen.getByRole('tooltip')).not.toHaveTextContent('つかさ');
  });
});
