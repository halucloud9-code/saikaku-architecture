// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CompatMatrix, {
  buildCompatMatrixModel,
  buildSharedCompatMatrixModel,
  COMPAT_MATRIX_AXES,
} from '../../src/compat/CompatMatrix.jsx';
import { buildCompatSharedMatrix } from '../../api/lib/compatShare.js';
import { zAlpha } from '../../src/lib/uaamZones.js';

function pair(model, axisA, axisB) {
  return model.cells.find((_row, index) => model.diagonal[index].axis.key === axisA)
    .find((cell) => cell.kind === 'pair' && cell.axisB.key === axisB);
}

describe('compat UAAM matrix model', () => {
  it('uses the team average for the cell while keeping personal ACTIVE-or-higher carriers', () => {
    const model = buildCompatMatrixModel({
      memberScores: {
        M1: { meaning: 20, mindfulness: 20 },
        M2: { meaning: 20, mindfulness: 20 },
        M3: { meaning: 16, mindfulness: 16 },
      },
    });
    const cell = pair(model, 'meaning', 'mindfulness');

    expect(cell.zone).toBe('pro');
    expect(cell.carrierAliases).toEqual(['M1', 'M2', 'M3']);
    expect(cell.carrierCount).toBe(3);
    expect(cell.details.map((detail) => detail.zone)).toEqual(['natural', 'natural', 'pro']);
    expect(cell.averageScoreA).toBeCloseTo(56 / 3);
    expect(cell.averageScoreB).toBeCloseTo(56 / 3);
    expect(cell.alpha).toBe(zAlpha('pro', 56 / 3, 56 / 3));
  });

  it('averages axes independently without inventing a personal carrier', () => {
    const model = buildCompatMatrixModel({
      memberScores: {
        M1: { meaning: 20 },
        M2: { mindfulness: 20 },
      },
    });
    const cell = pair(model, 'meaning', 'mindfulness');

    expect(cell.dataStatus).toBe('measured');
    expect(cell.zone).toBe('pro');
    expect(cell.averageScoreA).toBe(20);
    expect(cell.averageScoreB).toBe(20);
    expect(cell.carrierCount).toBe(0);
    expect(model.topPairs).toContain(cell);
  });

  it('uses each axis data-holder count without filling missing scores with zero', () => {
    const model = buildCompatMatrixModel({
      memberScores: {
        M1: { meaning: 20, mindfulness: 12 },
        M2: { meaning: 12 },
        M3: { mindfulness: 16 },
      },
    }, ['M1', 'M2', 'M3']);
    const cell = pair(model, 'meaning', 'mindfulness');

    expect(cell.dataStatus).toBe('measured');
    expect(cell.zone).toBe('active');
    expect(cell.averageScoreA).toBe(16);
    expect(cell.averageScoreB).toBe(14);
    expect(model.diagonal.find((item) => item.axis.key === 'meaning')).toMatchObject({
      dataStatus: 'measured',
      highestScore: 20,
      carrierAliases: ['M1'],
    });
    expect(model.diagonal.find((item) => item.axis.key === 'mindfulness')).toMatchObject({
      dataStatus: 'measured',
      highestScore: 16,
      carrierAliases: ['M3'],
    });
    expect(model.noDataAxes.map((axis) => axis.key)).toContain('mindshift');
    expect(model.dataAliases).toEqual(['M1', 'M2', 'M3']);
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

  it('requires every relevant member to have both axes at 20 for a NATURAL cell', () => {
    const natural = buildCompatMatrixModel({
      memberScores: {
        M1: { meaning: 20, mindfulness: 20 },
        M2: { meaning: 20, mindfulness: 20 },
      },
    });
    const partial = buildCompatMatrixModel({
      memberScores: {
        M1: { meaning: 20, mindfulness: 20 },
        M2: { meaning: 20 },
      },
    });

    expect(pair(natural, 'meaning', 'mindfulness').zone).toBe('natural');
    expect(pair(partial, 'meaning', 'mindfulness').zone).toBe('pro');
  });

  it('ranks TOP 5 by team-average strength within the average-based zone', () => {
    const model = buildCompatMatrixModel({
      memberScores: {
        M1: { meaning: 20, mindfulness: 20, mindshift: 16 },
        M2: { meaning: 12, mindfulness: 12, mindshift: 20 },
      },
    });

    expect(model.topPairs.map((cell) => [cell.axisA.key, cell.axisB.key])).toEqual([
      ['meaning', 'mindshift'],
      ['mindfulness', 'mindshift'],
      ['meaning', 'mindfulness'],
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
    expect(screen.getByText(/色はチーム平均での判定です/u)).toBeInTheDocument();
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

  it('uses one roving tab stop, shows details on focus, skips filtered cells, and pins details with Enter', () => {
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
    const pinnedTooltip = screen.getByRole('tooltip');
    expect(pinnedTooltip).toHaveTextContent('基転力');
    expect(pinnedTooltip).toHaveClass('pinned');
    expect(pinnedTooltip).toHaveAttribute('tabindex', '-1');
    expect(document.activeElement).toBe(pinnedTooltip);

    fireEvent.keyDown(pinnedTooltip, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(document.activeElement).toBe(proCell);
  });

  it('keeps a touch tooltip pinned through synthesized mouse events and closes it on a second tap', () => {
    const { container } = render(
      <CompatMatrix
        uaamMatrix={{ memberScores: { M1: { meaning: 20, mindfulness: 20 } } }}
        members={[{ alias: 'M1' }]}
        memberLabels={['つかさ']}
      />,
    );
    const firstCell = container.querySelector('[data-row="0"][data-column="0"]');

    fireEvent.pointerDown(firstCell, { pointerType: 'touch' });
    fireEvent.mouseEnter(firstCell, { clientX: 80, clientY: 80 });
    fireEvent.mouseMove(firstCell, { clientX: 90, clientY: 90 });
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.click(firstCell, { clientX: 90, clientY: 90 });
    expect(screen.getByRole('tooltip')).toHaveTextContent('基軸力');
    expect(screen.getByRole('tooltip')).toHaveClass('pinned');

    fireEvent.pointerDown(firstCell, { pointerType: 'touch' });
    fireEvent.click(firstCell, { clientX: 90, clientY: 90 });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('closes a pinned touch tooltip on an outside tap', () => {
    const { container } = render(
      <>
        <button type="button">マトリックス外</button>
        <CompatMatrix
          uaamMatrix={{ memberScores: { M1: { meaning: 20, mindfulness: 20 } } }}
          members={[{ alias: 'M1' }]}
          memberLabels={['つかさ']}
        />
      </>,
    );
    const firstCell = container.querySelector('[data-row="0"][data-column="0"]');

    fireEvent.pointerDown(firstCell, { pointerType: 'touch' });
    fireEvent.click(firstCell);
    expect(screen.getByRole('tooltip')).toHaveClass('pinned');

    const outside = screen.getByRole('button', { name: 'マトリックス外' });
    fireEvent.pointerDown(outside, { pointerType: 'touch' });
    fireEvent.click(outside);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('provides a 44px close control on pinned tooltips and restores the cell focus', () => {
    const { container } = render(
      <CompatMatrix
        uaamMatrix={{ memberScores: { M1: { meaning: 20, mindfulness: 20 } } }}
        members={[{ alias: 'M1' }]}
        memberLabels={['つかさ']}
      />,
    );
    const firstCell = container.querySelector('[data-row="0"][data-column="0"]');

    fireEvent.pointerDown(firstCell, { pointerType: 'touch' });
    fireEvent.click(firstCell);
    const closeButton = screen.getByRole('button', { name: 'ツールチップを閉じる' });
    expect(closeButton).toHaveClass('compat-matrix-tooltip-close');

    fireEvent.pointerDown(closeButton, { pointerType: 'touch' });
    fireEvent.click(closeButton);
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(document.activeElement).toBe(firstCell);
  });

  it('makes only pinned tooltips focusable and interactive until Escape closes them', () => {
    const { container } = render(
      <CompatMatrix
        uaamMatrix={{ memberScores: { M1: { meaning: 16, mindfulness: 16 } } }}
        members={[{ alias: 'M1' }]}
        memberLabels={['つかさ']}
      />,
    );
    const pairCell = container.querySelector('[data-row="0"][data-column="1"]');

    fireEvent.mouseEnter(pairCell, { clientX: 100, clientY: 100 });
    const transientTooltip = screen.getByRole('tooltip');
    expect(transientTooltip).not.toHaveClass('pinned');
    expect(transientTooltip).not.toHaveAttribute('tabindex');

    fireEvent.click(pairCell, { clientX: 100, clientY: 100 });
    const pinnedTooltip = screen.getByRole('tooltip');
    expect(pinnedTooltip).toHaveClass('pinned');
    expect(pinnedTooltip).toHaveAttribute('tabindex', '-1');
    expect(document.activeElement).toBe(pinnedTooltip);
    fireEvent.wheel(pinnedTooltip, { deltaY: 100 });
    fireEvent.touchStart(pinnedTooltip, { touches: [{ clientY: 100 }] });
    fireEvent.keyDown(pinnedTooltip, { key: 'ArrowDown' });
    expect(screen.getByRole('tooltip')).toBe(pinnedTooltip);

    fireEvent.keyDown(pinnedTooltip, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(document.activeElement).toBe(pairCell);
  });

  it('falls back to the nearest visible cell in row-major order when filters isolate the diagonal', () => {
    const measuredScores = Object.fromEntries(
      COMPAT_MATRIX_AXES.map((axis) => [axis.key, 20]),
    );
    const { container } = render(
      <CompatMatrix
        uaamMatrix={{ memberScores: { M1: measuredScores } }}
        members={[{ alias: 'M1' }]}
        memberLabels={['つかさ']}
      />,
    );

    for (const zone of ['NATURAL', 'PRO', 'ACTIVE', 'POTENTIAL', 'DORMANT', 'NO DATA']) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${zone}`, 'u') }));
    }

    const visibleCells = [...container.querySelectorAll('.compat-matrix-cell')]
      .filter((cell) => cell.getAttribute('aria-hidden') !== 'true');
    const firstDiagonal = container.querySelector('[data-row="0"][data-column="0"]');
    const secondDiagonal = container.querySelector('[data-row="1"][data-column="1"]');
    const thirdDiagonal = container.querySelector('[data-row="2"][data-column="2"]');
    expect(visibleCells).toHaveLength(COMPAT_MATRIX_AXES.length);
    expect(visibleCells.every((cell) => cell.dataset.kind === 'diagonal')).toBe(true);

    fireEvent.focus(firstDiagonal);
    fireEvent.keyDown(firstDiagonal, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(secondDiagonal);
    expect(secondDiagonal.tabIndex).toBe(0);

    fireEvent.keyDown(secondDiagonal, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(thirdDiagonal);

    fireEvent.keyDown(thirdDiagonal, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(secondDiagonal);
  });

  it('uses shared topPairs in their stored ranking order and omits TOP 5 for old matrices', () => {
    const sharedMatrix = buildCompatSharedMatrix({
      memberScores: {
        M1: { meaning: 20, mindfulness: 20, mindshift: 16 },
        M2: { meaning: 12, mindfulness: 12, mindshift: 20 },
      },
    }, ['M1', 'M2']);
    const rankedModel = buildSharedCompatMatrixModel(sharedMatrix, ['M1', 'M2']);

    expect(rankedModel.hasTopPairs).toBe(true);
    expect(sharedMatrix.topPairs).toEqual([
      { rowKey: 'meaning', colKey: 'mindshift' },
      { rowKey: 'mindfulness', colKey: 'mindshift' },
      { rowKey: 'meaning', colKey: 'mindfulness' },
    ]);
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
    expect(pairCell).toHaveAccessibleName(expect.stringContaining('担い手 つかさ、野田健一'));
    expect(pairCell.getAttribute('aria-label')).not.toMatch(/\d+点/u);
    fireEvent.mouseEnter(pairCell, { clientX: 100, clientY: 100 });
    expect(screen.getByRole('tooltip')).toHaveTextContent('担い手つかさ、野田健一');
    expect(screen.getByRole('tooltip')).not.toHaveTextContent(/16点|12点/u);

    fireEvent.mouseLeave(pairCell);
    const diagonal = container.querySelector('[data-row="0"][data-column="0"]');
    expect(diagonal).toHaveAccessibleName('基軸力・データあり・共有版では対角の担い手なし');
    fireEvent.mouseEnter(diagonal, { clientX: 100, clientY: 100 });
    expect(screen.getByRole('tooltip')).toHaveTextContent('共有版では点数と対角の担い手を表示しません');
    expect(screen.getByRole('tooltip')).not.toHaveTextContent('つかさ');
  });
});
