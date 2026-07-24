import { useEffect, useMemo, useRef, useState } from 'react';
import {
  compareCompatTeamAverageStrength,
  getCompatTeamAverageScores,
  getCompatTeamAverageZone,
  isCompatCarrierZone,
} from '../lib/compatTeamZones';
import { getZone, UAAM_ZONE_THRESHOLDS, zAlpha } from '../lib/uaamZones';
import {
  AXIS_HEX,
  AXIS_LIGHT,
  BLOCKS,
  getBlock,
  pairDef,
  pairShort,
  SUB_JP,
  toRgba,
  ZONE_HEX,
  ZONE_LABEL,
} from '../screens/uaam/AllPairsTriangle';

const GROUP_LABELS = ['志', '知', '技', '衝'];

export const COMPAT_MATRIX_AXES = Object.entries(SUB_JP).map(([key, label], index) => ({
  key,
  label,
  group: GROUP_LABELS[Math.floor(index / 4)],
  groupIndex: Math.floor(index / 4),
}));

const ZONE_ORDER = ['natural', 'pro', 'active', 'potential', 'dormant'];
const ZONE_RANK = Object.fromEntries(ZONE_ORDER.map((zone, index) => [zone, ZONE_ORDER.length - index]));
const ZONE_JP = {
  natural: '完全に発動',
  pro: '高い水準',
  active: '発動している',
  potential: '発動の可能性',
  dormant: 'チーム平均が目安未満',
  'no-data': 'データなし',
};
const ZONE_FILTER_LABEL = {
  ...ZONE_LABEL,
  'no-data': 'NO DATA',
};
const ZONE_COLOR = {
  ...ZONE_HEX,
  'no-data': '#6F685E',
};

function validScore(value) {
  return Number.isInteger(value) && value >= 0 && value <= UAAM_ZONE_THRESHOLDS.scoreMax;
}

function unique(values) {
  return [...new Set(values)];
}

function filterKeyForCell(cell) {
  if (cell.kind === 'diagonal') {
    return cell.dataStatus === 'no-data' ? 'no-data' : null;
  }
  return cell.dataStatus === 'no-data' ? 'no-data' : cell.zone;
}

function buildDiagonal(axis, aliases, scoresByAlias) {
  const details = aliases.map((alias) => ({
    alias,
    score: scoresByAlias[alias]?.[axis.key],
  }));
  const measured = details.filter((detail) => validScore(detail.score));
  if (measured.length === 0) {
    return {
      kind: 'diagonal',
      axis,
      dataStatus: 'no-data',
      highestScore: null,
      carrierAliases: [],
      details,
    };
  }
  const highestScore = Math.max(...measured.map((detail) => detail.score));
  return {
    kind: 'diagonal',
    axis,
    dataStatus: 'measured',
    highestScore,
    carrierAliases: measured.filter((detail) => detail.score === highestScore).map((detail) => detail.alias),
    details,
  };
}

function buildPair(axisA, axisB, rowIndex, colIndex, aliases, scoresByAlias) {
  const details = aliases.map((alias) => {
    const scoreA = scoresByAlias[alias]?.[axisA.key];
    const scoreB = scoresByAlias[alias]?.[axisB.key];
    return {
      alias,
      scoreA,
      scoreB,
      zone: validScore(scoreA) && validScore(scoreB) ? getZone(scoreA, scoreB) : null,
    };
  });
  const measuredA = details.filter((detail) => validScore(detail.scoreA));
  const measuredB = details.filter((detail) => validScore(detail.scoreB));
  if (measuredA.length === 0 || measuredB.length === 0) {
    return {
      kind: 'pair',
      axisA,
      axisB,
      rowIndex,
      colIndex,
      dataStatus: 'no-data',
      zone: null,
      carrierAliases: [],
      carrierCount: 0,
      averageScoreA: null,
      averageScoreB: null,
      teamAggregate: null,
      alpha: null,
      details,
    };
  }
  const teamAggregate = {
    sumA: measuredA.reduce((sum, detail) => sum + detail.scoreA, 0),
    countA: measuredA.length,
    sumB: measuredB.reduce((sum, detail) => sum + detail.scoreB, 0),
    countB: measuredB.length,
  };
  const relevantDetails = details.filter((detail) => (
    validScore(detail.scoreA) || validScore(detail.scoreB)
  ));
  const allMembersNatural = relevantDetails.length > 0 && relevantDetails.every((detail) => (
    detail.scoreA === UAAM_ZONE_THRESHOLDS.scoreMax
    && detail.scoreB === UAAM_ZONE_THRESHOLDS.scoreMax
  ));
  const zone = getCompatTeamAverageZone({ ...teamAggregate, allMembersNatural });
  const averages = getCompatTeamAverageScores(teamAggregate);
  const carrierAliases = details
    .filter((detail) => isCompatCarrierZone(detail.zone))
    .map((detail) => detail.alias);
  return {
    kind: 'pair',
    axisA,
    axisB,
    rowIndex,
    colIndex,
    dataStatus: 'measured',
    zone,
    carrierAliases,
    carrierCount: carrierAliases.length,
    averageScoreA: averages.scoreA,
    averageScoreB: averages.scoreB,
    teamAggregate,
    alpha: zAlpha(zone, averages.scoreA, averages.scoreB),
    details,
  };
}

function summarizeMatrix(cells, diagonal, { includeCoverage }) {
  const pairs = cells.flatMap((row, rowIndex) => row.filter((cell) => (
    cell.kind === 'pair' && cell.colIndex > rowIndex
  )));
  const topPairs = pairs
    .filter((pair) => pair.dataStatus === 'measured' && pair.zone !== 'dormant')
    .sort((left, right) => (
      ZONE_RANK[right.zone] - ZONE_RANK[left.zone]
      || (
        right.teamAggregate && left.teamAggregate
          ? compareCompatTeamAverageStrength(right.teamAggregate, left.teamAggregate)
          : 0
      )
      || left.rowIndex - right.rowIndex
      || left.colIndex - right.colIndex
    ))
    .slice(0, 5);
  const groupCoverage = includeCoverage
    ? GROUP_LABELS.map((group, groupIndex) => {
      const groupDiagonal = diagonal.filter((cell) => cell.axis.groupIndex === groupIndex);
      const coveredAxes = groupDiagonal.filter((cell) => (
        cell.highestScore !== null && cell.highestScore >= UAAM_ZONE_THRESHOLDS.activeAxisMin
      ));
      const measuredAxes = groupDiagonal.filter((cell) => cell.highestScore !== null);
      return {
        group,
        groupIndex,
        coveredCount: coveredAxes.length,
        measuredCount: measuredAxes.length,
        totalCount: groupDiagonal.length,
        percentage: (coveredAxes.length / groupDiagonal.length) * 100,
      };
    })
    : [];
  return {
    topPairs,
    dormantPairs: pairs.filter((pair) => pair.zone === 'dormant'),
    noDataPairs: pairs.filter((pair) => pair.dataStatus === 'no-data'),
    noDataAxes: diagonal.filter((cell) => cell.dataStatus === 'no-data').map((cell) => cell.axis),
    groupCoverage,
  };
}

export function buildCompatMatrixModel(uaamMatrix, preferredAliasOrder = []) {
  const rawScores = uaamMatrix?.memberScores && typeof uaamMatrix.memberScores === 'object'
    ? uaamMatrix.memberScores
    : {};
  const aliases = unique([
    ...preferredAliasOrder.filter((alias) => typeof alias === 'string' && alias),
    ...Object.keys(rawScores),
  ]);
  const scoresByAlias = Object.fromEntries(aliases.map((alias) => {
    const raw = rawScores[alias];
    const scores = {};
    if (raw && typeof raw === 'object') {
      for (const axis of COMPAT_MATRIX_AXES) {
        if (validScore(raw[axis.key])) scores[axis.key] = raw[axis.key];
      }
    }
    return [alias, scores];
  }));
  const dataAliases = aliases.filter((alias) => Object.keys(scoresByAlias[alias]).length > 0);
  const diagonal = COMPAT_MATRIX_AXES.map((axis) => buildDiagonal(axis, aliases, scoresByAlias));
  const cells = COMPAT_MATRIX_AXES.map((axisA, rowIndex) => (
    COMPAT_MATRIX_AXES.map((axisB, colIndex) => (
      rowIndex === colIndex
        ? diagonal[rowIndex]
        : buildPair(axisA, axisB, rowIndex, colIndex, aliases, scoresByAlias)
    ))
  ));

  return {
    aliases,
    dataAliases,
    scoresByAlias,
    diagonal,
    cells,
    hasTopPairs: true,
    ...summarizeMatrix(cells, diagonal, { includeCoverage: true }),
  };
}

export function buildSharedCompatMatrixModel(sharedMatrix, preferredAliasOrder = []) {
  const axisStatus = new Map((sharedMatrix?.axes || []).map((axis) => [axis.key, axis.dataStatus]));
  const pairCells = new Map((sharedMatrix?.cells || []).map((cell) => (
    [`${cell.rowKey}|${cell.colKey}`, cell]
  )));
  const diagonal = COMPAT_MATRIX_AXES.map((axis) => ({
    kind: 'diagonal',
    axis,
    dataStatus: axisStatus.get(axis.key) === 'measured' ? 'measured' : 'no-data',
    highestScore: null,
    carrierAliases: [],
    details: [],
  }));
  const cells = COMPAT_MATRIX_AXES.map((axisA, rowIndex) => (
    COMPAT_MATRIX_AXES.map((axisB, colIndex) => {
      if (rowIndex === colIndex) return diagonal[rowIndex];
      const rowKey = rowIndex < colIndex ? axisA.key : axisB.key;
      const colKey = rowIndex < colIndex ? axisB.key : axisA.key;
      const source = pairCells.get(`${rowKey}|${colKey}`);
      const zone = source?.zone || 'no-data';
      const canonicalAxisA = COMPAT_MATRIX_AXES[Math.min(rowIndex, colIndex)];
      const canonicalAxisB = COMPAT_MATRIX_AXES[Math.max(rowIndex, colIndex)];
      return {
        kind: 'pair',
        axisA: canonicalAxisA,
        axisB: canonicalAxisB,
        rowIndex,
        colIndex,
        dataStatus: zone === 'no-data' ? 'no-data' : 'measured',
        zone: zone === 'no-data' ? null : zone,
        carrierAliases: Array.isArray(source?.carrierAliases) ? source.carrierAliases : [],
        carrierCount: Array.isArray(source?.carrierAliases) ? source.carrierAliases.length : 0,
        averageScoreA: null,
        averageScoreB: null,
        teamAggregate: null,
        alpha: null,
        details: [],
      };
    })
  ));
  const summary = summarizeMatrix(cells, diagonal, { includeCoverage: false });
  const axisIndex = new Map(COMPAT_MATRIX_AXES.map((axis, index) => [axis.key, index]));
  const topPairs = Array.isArray(sharedMatrix?.topPairs)
    ? sharedMatrix.topPairs.flatMap(({ rowKey, colKey }) => {
      const rowIndex = axisIndex.get(rowKey);
      const colIndex = axisIndex.get(colKey);
      const cell = cells[rowIndex]?.[colIndex];
      return cell?.kind === 'pair' ? [cell] : [];
    })
    : [];

  return {
    aliases: preferredAliasOrder,
    dataAliases: [],
    scoresByAlias: {},
    diagonal,
    cells,
    ...summary,
    hasTopPairs: Array.isArray(sharedMatrix?.topPairs),
    topPairs,
  };
}

function pairName(pair) {
  return pairShort(pair.axisA.key, pair.axisB.key)
    || `${pair.axisA.label} × ${pair.axisB.label}`;
}

function memberNameMap(aliases, memberAliases, memberLabels) {
  return Object.fromEntries(aliases.map((alias) => {
    const memberIndex = memberAliases.indexOf(alias);
    const label = memberIndex >= 0 ? memberLabels[memberIndex]?.trim() : '';
    return [alias, label || alias];
  }));
}

function scoreText(value) {
  return validScore(value) ? `${value}点` : 'データなし';
}

function MatrixTooltip({ tip, mode, memberNames, tooltipRef, onEscape }) {
  if (!tip) return null;
  const { cell } = tip;
  const style = {
    '--matrix-tip-x': `${tip.x + 16}px`,
    '--matrix-tip-y': `${Math.max(8, tip.y - 48)}px`,
  };
  const interactionProps = {
    ref: tooltipRef,
    tabIndex: tip.pinned ? -1 : undefined,
    onKeyDown: (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onEscape();
    },
  };
  if (cell.kind === 'diagonal') {
    return (
      <aside
        {...interactionProps}
        role="tooltip"
        className={`compat-matrix-tooltip diagonal ${tip.pinned ? 'pinned' : ''}`}
        style={{ ...style, '--matrix-group-color': AXIS_HEX[cell.axis.groupIndex] }}
      >
        <h3>{cell.axis.label}</h3>
        <span className="compat-matrix-axis-pill">{cell.axis.group} / {BLOCKS[cell.axis.groupIndex]?.name}</span>
        {mode === 'share' ? (
          <p>
            {cell.dataStatus === 'measured' ? 'この軸の自己回答データがあります。' : 'この軸の自己回答データはありません。'}
            共有版では点数と対角の担い手を表示しません。
          </p>
        ) : (
          <ul className="compat-matrix-member-details">
            {cell.details.map((detail) => (
              <li key={detail.alias}>
                <strong>{memberNames[detail.alias]}</strong>
                <span>{scoreText(detail.score)}</span>
              </li>
            ))}
          </ul>
        )}
      </aside>
    );
  }

  const zoneKey = cell.dataStatus === 'no-data' ? 'no-data' : cell.zone;
  const definition = pairDef(cell.axisA.key, cell.axisB.key);
  const block = getBlock(cell.axisA.key, cell.axisB.key);
  return (
    <aside
      {...interactionProps}
      role="tooltip"
      className={`compat-matrix-tooltip pair ${tip.pinned ? 'pinned' : ''}`}
      style={{ ...style, '--matrix-zone-color': ZONE_COLOR[zoneKey] }}
    >
      <h3>{pairName(cell)}</h3>
      <p className="compat-matrix-tooltip-axes">{cell.axisA.label} × {cell.axisB.label}</p>
      <div className="compat-matrix-tooltip-meta">
        <span className="compat-matrix-zone-pill">{ZONE_FILTER_LABEL[zoneKey]}</span>
        {block ? <span>{block.name} / {block.jp}</span> : null}
      </div>
      {definition ? (
        <div className="compat-matrix-pair-definition">
          <p>{definition.d1}</p>
          <p>{definition.d2}</p>
          <p>「{definition.d3}」</p>
        </div>
      ) : null}
      <div className="compat-matrix-carrier-list">
        <strong>担い手</strong>
        <span>
          {cell.carrierAliases.length > 0
            ? cell.carrierAliases.map((alias) => memberNames[alias]).join('、')
            : '今回のデータでは見つかりません'}
        </span>
      </div>
      {mode === 'admin' ? (
        <ul className="compat-matrix-member-details">
          {cell.details.map((detail) => (
            <li key={detail.alias}>
              <strong>{memberNames[detail.alias]}</strong>
              <span>{cell.axisA.label} {scoreText(detail.scoreA)} / {cell.axisB.label} {scoreText(detail.scoreB)}</span>
              <em>{detail.zone ? ZONE_FILTER_LABEL[detail.zone] : '判定できません'}</em>
            </li>
          ))}
        </ul>
      ) : null}
    </aside>
  );
}

function PairWindows({ pairs, memberNames }) {
  const byZone = ZONE_ORDER.reduce((groups, zone) => {
    const zonePairs = pairs.filter((pair) => pair.zone === zone);
    if (zonePairs.length > 0) groups.push([zone, zonePairs]);
    return groups;
  }, []);
  return (
    <div className="compat-matrix-zone-windows">
      {byZone.map(([zone, zonePairs]) => (
        <details key={zone} style={{ '--matrix-zone-color': ZONE_COLOR[zone] }}>
          <summary>
            <span>{ZONE_FILTER_LABEL[zone]}</span>
            <b>{zonePairs.length}</b>
          </summary>
          <div>
            {zonePairs.map((pair) => (
              <article key={`${pair.axisA.key}-${pair.axisB.key}`}>
                <strong>{pairName(pair)}</strong>
                <small>{pair.axisA.label} × {pair.axisB.label}</small>
                <p>
                  担い手：
                  {pair.carrierAliases.length > 0
                    ? pair.carrierAliases.map((alias) => memberNames[alias]).join('、')
                    : '今回のデータでは見つかりません'}
                </p>
              </article>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

export default function CompatMatrix({
  mode = 'admin',
  uaamMatrix = null,
  sharedMatrix = null,
  members = [],
  memberLabels = [],
}) {
  const memberAliases = members.map((member) => member.alias).filter(Boolean);
  const model = useMemo(
    () => (
      mode === 'share'
        ? buildSharedCompatMatrixModel(sharedMatrix, memberAliases)
        : buildCompatMatrixModel(uaamMatrix, memberAliases)
    ),
    [mode, uaamMatrix, sharedMatrix, memberAliases.join('|')],
  );
  const [activeZones, setActiveZones] = useState(() => new Set([...ZONE_ORDER, 'no-data']));
  const [tip, setTip] = useState(null);
  const [activeCell, setActiveCell] = useState({ rowIndex: 0, colIndex: 0 });
  const matrixRef = useRef(null);
  const tooltipRef = useRef(null);
  const pointerTypeRef = useRef(null);
  const suppressNextFocusTooltipRef = useRef(false);
  const memberNames = useMemo(
    () => memberNameMap(model.aliases, memberAliases, memberLabels),
    [model.aliases, memberAliases.join('|'), memberLabels.join('|')],
  );
  const missingMembers = mode === 'admin'
    ? memberAliases.filter((alias) => !model.dataAliases.includes(alias))
    : [];

  const isFiltered = (cell) => {
    const filterKey = filterKeyForCell(cell);
    return !!filterKey && !activeZones.has(filterKey);
  };

  useEffect(() => {
    const currentCell = model.cells[activeCell.rowIndex]?.[activeCell.colIndex];
    if (currentCell && !isFiltered(currentCell)) return;

    const nextCell = model.cells.flatMap((row, rowIndex) => (
      row.map((cell, colIndex) => ({ cell, rowIndex, colIndex }))
    )).find(({ cell }) => !isFiltered(cell));
    if (!nextCell) return;

    const activeElement = document.activeElement;
    const hadCellFocus = matrixRef.current?.contains(activeElement)
      && activeElement?.classList?.contains('compat-matrix-cell');
    setActiveCell({ rowIndex: nextCell.rowIndex, colIndex: nextCell.colIndex });
    if (hadCellFocus) {
      matrixRef.current
        ?.querySelector(`[data-row="${nextCell.rowIndex}"][data-column="${nextCell.colIndex}"]`)
        ?.focus();
    }
  }, [activeZones, model, activeCell.rowIndex, activeCell.colIndex]);

  useEffect(() => {
    if (tip?.pinned) {
      tooltipRef.current?.focus({ preventScroll: true });
    }
  }, [tip]);

  const toggleZone = (zone) => {
    setActiveZones((current) => {
      const next = new Set(current);
      if (next.has(zone)) next.delete(zone);
      else next.add(zone);
      return next;
    });
  };

  const titleFor = (cell) => {
    if (cell.kind === 'diagonal') {
      if (mode === 'share') {
        return `${cell.axis.label}・${cell.dataStatus === 'measured' ? 'データあり' : 'データなし'}・共有版では対角の担い手なし`;
      }
      return [
        `${cell.axis.label}・${cell.dataStatus === 'measured' ? 'データあり' : 'データなし'}`,
        ...cell.details.map((detail) => `${memberNames[detail.alias]} ${scoreText(detail.score)}`),
      ].join('。');
    }
    const zoneKey = cell.dataStatus === 'no-data' ? 'no-data' : cell.zone;
    const carriers = cell.carrierAliases.length > 0
      ? cell.carrierAliases.map((alias) => memberNames[alias]).join('、')
      : 'なし';
    const definition = pairDef(cell.axisA.key, cell.axisB.key);
    const adminDetails = mode === 'admin'
      ? cell.details.map((detail) => (
        `${memberNames[detail.alias]} ${cell.axisA.label}${scoreText(detail.scoreA)} ${cell.axisB.label}${scoreText(detail.scoreB)} ${detail.zone ? ZONE_FILTER_LABEL[detail.zone] : '判定不可'}`
      )).join('。')
      : '';
    return [
      pairName(cell),
      `${cell.axisA.label} × ${cell.axisB.label}`,
      ZONE_JP[zoneKey],
      `担い手 ${carriers}`,
      definition?.d1,
      adminDetails,
    ].filter(Boolean).join('。');
  };

  const tooltipFor = (cell, cellKey, element, event, pinned = false) => {
    const rect = element.getBoundingClientRect();
    const hasPointerPosition = Number.isFinite(event?.clientX) && Number.isFinite(event?.clientY);
    return {
      cell,
      cellKey,
      pinned,
      x: hasPointerPosition ? event.clientX : rect.left + (rect.width / 2),
      y: hasPointerPosition ? event.clientY : rect.top + (rect.height / 2),
    };
  };

  const showTooltip = (cell, cellKey, element, event) => {
    setTip((current) => (
      current?.pinned
        ? current
        : tooltipFor(cell, cellKey, element, event)
    ));
  };

  const openPinnedTooltip = (cell, cellKey, element, event) => {
    setTip(tooltipFor(cell, cellKey, element, event, true));
  };

  const togglePinnedTooltip = (cell, cellKey, element, event) => {
    setTip((current) => (
      current?.cellKey === cellKey && current.pinned
        ? null
        : tooltipFor(cell, cellKey, element, event, true)
    ));
  };

  const closeTooltip = (restoreCellKey = null) => {
    setTip(null);
    if (!restoreCellKey) return;

    const [rowIndex, colIndex] = restoreCellKey.split('-');
    const target = matrixRef.current
      ?.querySelector(`[data-row="${rowIndex}"][data-column="${colIndex}"]`);
    if (!target || target === document.activeElement) return;
    suppressNextFocusTooltipRef.current = true;
    target.focus();
  };

  const focusCell = (rowIndex, colIndex) => {
    const target = matrixRef.current
      ?.querySelector(`[data-row="${rowIndex}"][data-column="${colIndex}"]`);
    if (!target) return;
    setActiveCell({ rowIndex, colIndex });
    target.focus();
  };

  const handleCellKeyDown = (event, cell, rowIndex, colIndex) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeTooltip();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      togglePinnedTooltip(cell, `${rowIndex}-${colIndex}`, event.currentTarget, event);
      return;
    }
    const direction = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    }[event.key];
    if (!direction) return;

    event.preventDefault();
    let nextRow = rowIndex + direction[0];
    let nextCol = colIndex + direction[1];
    while (
      nextRow >= 0
      && nextRow < COMPAT_MATRIX_AXES.length
      && nextCol >= 0
      && nextCol < COMPAT_MATRIX_AXES.length
    ) {
      if (!isFiltered(model.cells[nextRow][nextCol])) {
        focusCell(nextRow, nextCol);
        return;
      }
      nextRow += direction[0];
      nextCol += direction[1];
    }

    const readingIndex = (rowIndex * COMPAT_MATRIX_AXES.length) + colIndex;
    const visibleCells = model.cells.flatMap((row, visibleRowIndex) => (
      row.flatMap((visibleCell, visibleColIndex) => (
        isFiltered(visibleCell)
          ? []
          : [{
            rowIndex: visibleRowIndex,
            colIndex: visibleColIndex,
            readingIndex: (visibleRowIndex * COMPAT_MATRIX_AXES.length) + visibleColIndex,
          }]
      ))
    ));
    const searchForward = direction[0] > 0 || direction[1] > 0;
    const fallback = searchForward
      ? visibleCells.find((candidate) => candidate.readingIndex > readingIndex)
      : [...visibleCells].reverse().find((candidate) => candidate.readingIndex < readingIndex);
    if (fallback) {
      focusCell(fallback.rowIndex, fallback.colIndex);
    }
  };

  const renderCell = (cell, rowIndex, colIndex) => {
    const filtered = isFiltered(cell);
    const zoneKey = cell.kind === 'pair'
      ? (cell.dataStatus === 'no-data' ? 'no-data' : cell.zone)
      : null;
    const cellKey = `${rowIndex}-${colIndex}`;
    const commonProps = {
      role: 'img',
      'aria-label': titleFor(cell),
      'aria-hidden': filtered ? 'true' : undefined,
      tabIndex: !filtered
        && activeCell.rowIndex === rowIndex
        && activeCell.colIndex === colIndex
        ? 0
        : -1,
      onFocus: (event) => {
        setActiveCell({ rowIndex, colIndex });
        if (suppressNextFocusTooltipRef.current) {
          suppressNextFocusTooltipRef.current = false;
          return;
        }
        if (!pointerTypeRef.current) {
          showTooltip(cell, cellKey, event.currentTarget, event);
        }
      },
      onBlur: () => setTip((current) => (
        current?.cellKey === cellKey && !current.pinned ? null : current
      )),
      onKeyDown: (event) => handleCellKeyDown(event, cell, rowIndex, colIndex),
      onPointerDown: (event) => {
        pointerTypeRef.current = event.pointerType || 'unknown';
      },
      onPointerCancel: () => {
        pointerTypeRef.current = null;
      },
      onClick: (event) => {
        const pointerType = pointerTypeRef.current;
        pointerTypeRef.current = null;
        if (pointerType === 'touch' || pointerType === 'pen' || pointerType === 'unknown') {
          openPinnedTooltip(cell, cellKey, event.currentTarget, event);
        } else {
          togglePinnedTooltip(cell, cellKey, event.currentTarget, event);
        }
      },
      onMouseEnter: (event) => {
        if (pointerTypeRef.current === 'touch' || pointerTypeRef.current === 'pen') return;
        showTooltip(cell, cellKey, event.currentTarget, event);
      },
      onMouseMove: (event) => {
        if (pointerTypeRef.current === 'touch' || pointerTypeRef.current === 'pen') return;
        showTooltip(cell, cellKey, event.currentTarget, event);
      },
      onMouseLeave: (event) => {
        if (document.activeElement !== event.currentTarget) {
          setTip((current) => (
            current?.cellKey === cellKey && !current.pinned ? null : current
          ));
        }
      },
    };

    if (cell.kind === 'diagonal') {
      const strength = mode === 'admin' && validScore(cell.highestScore)
        ? Math.max(0.35, cell.highestScore / UAAM_ZONE_THRESHOLDS.scoreMax)
        : 0.72;
      return (
        <div
          {...commonProps}
          className={`compat-matrix-cell diagonal ${cell.dataStatus === 'no-data' ? 'no-data' : ''} ${filtered ? 'filtered' : ''}`}
          style={{
            '--matrix-group-color': AXIS_HEX[cell.axis.groupIndex],
            '--matrix-axis-light': AXIS_LIGHT[cell.axis.groupIndex],
            '--matrix-axis-border': `${1 + strength * 2}px`,
          }}
          data-row={rowIndex}
          data-column={colIndex}
          data-kind="diagonal"
        >
          <span aria-hidden="true">{SUB_JP[cell.axis.key].slice(0, 3)}</span>
        </div>
      );
    }
    return (
      <div
        {...commonProps}
        className={`compat-matrix-cell pair ${zoneKey} ${filtered ? 'filtered' : ''}`}
        style={{
          '--matrix-zone-color': ZONE_COLOR[zoneKey],
          ...(mode === 'admin' && Number.isFinite(cell.alpha)
            ? { background: toRgba(ZONE_COLOR[zoneKey], cell.alpha) }
            : {}),
        }}
        data-row={rowIndex}
        data-column={colIndex}
        data-zone={zoneKey}
      />
    );
  };

  return (
    <section className="compat-matrix uaam-chart" aria-labelledby={`compat-matrix-title-${mode}`} data-mode={mode}>
      <header className="compat-matrix-heading">
        <p className="compat-kicker">ACTIVATION MATRIX / 16 × 16</p>
        <h2 id={`compat-matrix-title-${mode}`}>チーム発動領域Matrix</h2>
        <span className="compat-heading-rule" aria-hidden="true" />
        <p>
          {mode === 'share'
            ? '各軸のチーム平均から判定した発動ゾーンと、個人判定でACTIVE以上の担い手を表示しています。点数そのものと、対角セルの担い手は共有されません。'
            : '色は、各軸のデータがあるメンバーのチーム平均から判定しています。セルに触れると各メンバーの2軸スコアと個人ゾーンを確認できます。'}
        </p>
      </header>

      <div className="compat-matrix-filters" aria-label="表示するゾーン">
        {[...ZONE_ORDER, 'no-data'].map((zone) => {
          const active = activeZones.has(zone);
          return (
            <button
              type="button"
              key={zone}
              aria-pressed={active}
              onClick={() => toggleZone(zone)}
              style={{ '--matrix-zone-color': ZONE_COLOR[zone] }}
            >
              <span aria-hidden="true">{active ? '✓' : ''}</span>
              {ZONE_FILTER_LABEL[zone]}
            </button>
          );
        })}
        <small>— マウス・タッチ、または矢印キーでセル移動／Enterで詳細</small>
      </div>

      <div className="compat-matrix-scroll" ref={matrixRef}>
        <table aria-label="UAAM 16軸のチーム発動領域マップ">
          <thead>
            <tr>
              <th aria-hidden="true" />
              {COMPAT_MATRIX_AXES.map((axis) => (
                <th key={axis.key} scope="col" aria-label={`${axis.group}・${axis.label}`}>
                  {SUB_JP[axis.key].slice(0, 2)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPAT_MATRIX_AXES.map((axis, rowIndex) => (
              <tr key={axis.key}>
                <th scope="row" title={`${axis.group}・${axis.label}`}>{SUB_JP[axis.key].slice(0, 3)}</th>
                {model.cells[rowIndex].map((cell, colIndex) => (
                  <td key={COMPAT_MATRIX_AXES[colIndex].key}>
                    {renderCell(cell, rowIndex, colIndex)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <MatrixTooltip
        tip={tip}
        mode={mode}
        memberNames={memberNames}
        tooltipRef={tooltipRef}
        onEscape={() => closeTooltip(tip?.cellKey)}
      />

      <div className="compat-matrix-legend">
        <p><strong>読み方：</strong>色はチーム平均での判定です。各軸について、その軸のデータがあるメンバーだけで平均し、2軸の平均をゾーン基準に当てはめています。</p>
        <p><strong>大切な注意：</strong>平均はチーム全体の水準を見る目安です。個人差や役割分担を表すものではないため、担い手は各メンバーの個人判定がACTIVE以上の場合に別表示します。</p>
        <p><strong>データなし：</strong>斜線のセルは、どちらかの軸にデータ保有メンバーがいない状態です。欠けたデータを0点や待機状態としては扱いません。</p>
      </div>

      {missingMembers.length > 0 ? (
        <p className="compat-matrix-missing-members">
          <strong>この図に入っていない人：</strong>
          {missingMembers.map((alias) => memberNames[alias]).join('、')}（UAAMデータがありません）
        </p>
      ) : null}
      {model.noDataAxes.length > 0 ? (
        <p className="compat-matrix-no-data-axes">
          <strong>データなしの軸：</strong>{model.noDataAxes.map((axis) => axis.label).join('、')}
        </p>
      ) : null}

      <div className="compat-matrix-summary-grid">
        <section>
          <p className="compat-kicker">GRIFFON CODE</p>
          <h3>{model.hasTopPairs ? '厚い組み合わせ TOP 5' : '厚い組み合わせ'}</h3>
          {!model.hasTopPairs ? (
            <p className="compat-empty-state">この共有結果には、TOP 5の順序データが含まれていません。</p>
          ) : model.topPairs.length > 0 ? (
            <PairWindows pairs={model.topPairs} memberNames={memberNames} />
          ) : <p className="compat-empty-state">今回のデータでは、発動の目安に届く組み合わせは見つかりませんでした。</p>}
        </section>

        <section>
          <p className="compat-kicker">DORMANT WINDOW</p>
          <h3>チーム平均が発動の目安に届かない組み合わせ</h3>
          {model.dormantPairs.length > 0 ? (
            <details className="compat-matrix-dormant-window" style={{ '--matrix-zone-color': ZONE_COLOR.dormant }}>
              <summary><span>{ZONE_LABEL.dormant}</span><b>{model.dormantPairs.length}</b></summary>
              <div className="compat-matrix-dormant-list">
                {model.dormantPairs.map((pair) => <span key={`${pair.axisA.key}-${pair.axisB.key}`}>{pairName(pair)}</span>)}
              </div>
            </details>
          ) : <p>該当する組み合わせはありません。</p>}
          {model.noDataPairs.length > 0 ? <p className="compat-matrix-data-note">このほか、判定できないデータなしの組み合わせが{model.noDataPairs.length}組あります。</p> : null}
        </section>
      </div>

      {mode === 'admin' ? (
        <section className="compat-matrix-coverage" aria-label="4グループのカバレッジ">
          <h3>志・知・技・衝のカバレッジ</h3>
          <p>各グループの4軸のうち、チーム内に12点以上の担い手がいる軸の割合です。</p>
          <div>
            {model.groupCoverage.map((coverage) => (
              <article key={coverage.group} style={{ '--matrix-group-color': AXIS_HEX[coverage.groupIndex] }}>
                <header>
                  <strong>{coverage.group}</strong>
                  <span>{coverage.coveredCount} / {coverage.totalCount}軸</span>
                </header>
                <div className="compat-matrix-coverage-track" aria-label={`${coverage.group}は${coverage.totalCount}軸中${coverage.coveredCount}軸`}>
                  <span style={{ width: `${coverage.percentage}%` }} />
                </div>
                {coverage.measuredCount < coverage.totalCount ? <small>データなし {coverage.totalCount - coverage.measuredCount}軸</small> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
