import { useMemo, useState } from 'react';
import { getZone, UAAM_ZONE_THRESHOLDS } from '../lib/uaamZones';

export const COMPAT_MATRIX_AXES = [
  { key: 'meaning', label: '基軸力', group: '志', groupIndex: 0 },
  { key: 'mindfulness', label: '認知力', group: '志', groupIndex: 0 },
  { key: 'mindshift', label: '転換力', group: '志', groupIndex: 0 },
  { key: 'mastery', label: '熟達力', group: '志', groupIndex: 0 },
  { key: 'learning', label: '謙学力', group: '知', groupIndex: 1 },
  { key: 'logical', label: '論理力', group: '知', groupIndex: 1 },
  { key: 'life', label: '活用力', group: '知', groupIndex: 1 },
  { key: 'leadership', label: '統率力', group: '知', groupIndex: 1 },
  { key: 'critical', label: '本質力', group: '技', groupIndex: 2 },
  { key: 'creativity', label: '創造力', group: '技', groupIndex: 2 },
  { key: 'communication', label: '伝達力', group: '技', groupIndex: 2 },
  { key: 'collaboration', label: '協働力', group: '技', groupIndex: 2 },
  { key: 'idea', label: '構想力', group: '衝', groupIndex: 3 },
  { key: 'innovation', label: '変革力', group: '衝', groupIndex: 3 },
  { key: 'implementation', label: '実装力', group: '衝', groupIndex: 3 },
  { key: 'influence', label: '影響力', group: '衝', groupIndex: 3 },
];

const ZONE_ORDER = ['natural', 'pro', 'active', 'potential', 'dormant'];
const ZONE_RANK = Object.fromEntries(ZONE_ORDER.map((zone, index) => [zone, ZONE_ORDER.length - index]));
const ZONE_META = {
  natural: { label: '自然に表れる', short: '自然', color: '#7A31B5' },
  pro: { label: '高い水準', short: '高水準', color: '#175FAE' },
  active: { label: '発動している', short: '発動', color: '#58891E' },
  potential: { label: '発動の可能性', short: '可能性', color: '#B25418' },
  dormant: { label: '担い手が見つからない', short: '見つからない', color: '#526B78' },
  'no-data': { label: 'データなし', short: 'データなし', color: '#817B72' },
};
const GROUP_COLORS = ['#2C5F8A', '#1E7A4A', '#A07A18', '#8B3A28'];

function validScore(value) {
  return Number.isInteger(value) && value >= 0 && value <= UAAM_ZONE_THRESHOLDS.scoreMax;
}

function unique(values) {
  return [...new Set(values)];
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
  const measured = details.filter((detail) => detail.zone);
  if (measured.length === 0) {
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
      strongestSum: null,
      details,
    };
  }
  const zone = measured.reduce((best, detail) => (
    ZONE_RANK[detail.zone] > ZONE_RANK[best] ? detail.zone : best
  ), measured[0].zone);
  const zoneHolders = measured.filter((detail) => detail.zone === zone);
  const carrierAliases = zone === 'dormant' ? [] : zoneHolders.map((detail) => detail.alias);
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
    strongestSum: Math.max(...zoneHolders.map((detail) => detail.scoreA + detail.scoreB)),
    details,
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
  const pairs = cells.flatMap((row, rowIndex) => row.filter((cell) => cell.colIndex > rowIndex));
  const topPairs = pairs
    .filter((pair) => pair.dataStatus === 'measured' && pair.zone !== 'dormant')
    .sort((left, right) => (
      ZONE_RANK[right.zone] - ZONE_RANK[left.zone]
      || right.strongestSum - left.strongestSum
      || left.rowIndex - right.rowIndex
      || left.colIndex - right.colIndex
    ))
    .slice(0, 5);
  const dormantPairs = pairs.filter((pair) => pair.zone === 'dormant');
  const noDataPairs = pairs.filter((pair) => pair.dataStatus === 'no-data');
  const noDataAxes = diagonal.filter((cell) => cell.dataStatus === 'no-data').map((cell) => cell.axis);
  const groupCoverage = ['志', '知', '技', '衝'].map((group, groupIndex) => {
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
  });

  return {
    aliases,
    dataAliases,
    scoresByAlias,
    diagonal,
    cells,
    topPairs,
    dormantPairs,
    noDataPairs,
    noDataAxes,
    groupCoverage,
  };
}

function initialFor(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) return '?';
  const words = normalized.split(/\s+/u).filter(Boolean);
  if (words.length > 1 && words.every((word) => /^[A-Za-z]/u.test(word))) {
    return words.slice(0, 2).map((word) => word[0].toUpperCase()).join('');
  }
  return Array.from(normalized)[0];
}

function pairName(pair) {
  return `${pair.axisA.label} × ${pair.axisB.label}`;
}

export default function CompatMatrix({ uaamMatrix, members = [], memberLabels = [] }) {
  const memberAliases = members.map((member) => member.alias).filter(Boolean);
  const model = useMemo(
    () => buildCompatMatrixModel(uaamMatrix, memberAliases),
    [uaamMatrix, memberAliases.join('|')],
  );
  const [activeZones, setActiveZones] = useState(() => new Set([...ZONE_ORDER, 'no-data']));
  const memberNames = useMemo(() => Object.fromEntries(model.aliases.map((alias) => {
    const memberIndex = memberAliases.indexOf(alias);
    const label = memberIndex >= 0 ? memberLabels[memberIndex]?.trim() : '';
    return [alias, label || alias];
  })), [model.aliases, memberAliases.join('|'), memberLabels.join('|')]);
  const missingMembers = memberAliases.filter((alias) => !model.dataAliases.includes(alias));

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
      const details = cell.details.map((detail) => (
        `${memberNames[detail.alias]}: ${validScore(detail.score) ? `${detail.score}点` : 'データなし'}`
      ));
      return [`${cell.axis.label}のチーム最高値: ${cell.highestScore ?? 'データなし'}`, ...details].join('\n');
    }
    const details = cell.details.map((detail) => {
      const left = validScore(detail.scoreA) ? `${detail.scoreA}点` : 'データなし';
      const right = validScore(detail.scoreB) ? `${detail.scoreB}点` : 'データなし';
      const zone = detail.zone ? ZONE_META[detail.zone].label : '判定できません';
      return `${memberNames[detail.alias]}: ${cell.axisA.label} ${left} / ${cell.axisB.label} ${right} / ${zone}`;
    });
    const summary = cell.dataStatus === 'no-data'
      ? '2軸がそろったメンバーはいません'
      : `チーム内の最大ゾーン: ${ZONE_META[cell.zone].label}、担い手 ${cell.carrierCount}人`;
    return [`${pairName(cell)} — ${summary}`, ...details].join('\n');
  };

  const renderCell = (cell, rowIndex, colIndex) => {
    const filterKey = cell.kind === 'diagonal'
      ? (cell.dataStatus === 'no-data' ? 'no-data' : null)
      : (cell.dataStatus === 'no-data' ? 'no-data' : cell.zone);
    const filtered = filterKey && !activeZones.has(filterKey);
    const cellTitle = titleFor(cell);
    if (cell.kind === 'diagonal') {
      const accessibleLabel = `${cell.axis.label} × ${cell.axis.label}・${
        cell.dataStatus === 'no-data' ? ZONE_META['no-data'].label : '単軸のチーム最高値'
      }・担い手${cell.carrierAliases.length}人。${cellTitle.replaceAll('\n', '。')}`;
      return (
        <div
          role="img"
          className={`compat-matrix-cell diagonal ${cell.dataStatus === 'no-data' ? 'no-data' : ''} ${filtered ? 'filtered' : ''}`}
          style={{ '--matrix-group-color': GROUP_COLORS[cell.axis.groupIndex] }}
          title={cellTitle}
          aria-label={accessibleLabel}
          aria-hidden={filtered ? 'true' : undefined}
        >
          <strong>{cell.highestScore ?? '—'}</strong>
          {cell.carrierAliases.length > 0 ? (
            <span className="compat-matrix-initials" aria-hidden="true">
              {cell.carrierAliases.slice(0, 3).map((alias) => (
                <i key={alias}>{initialFor(memberNames[alias])}</i>
              ))}
              {cell.carrierAliases.length > 3 ? <i>+{cell.carrierAliases.length - 3}</i> : null}
            </span>
          ) : null}
        </div>
      );
    }
    const zoneKey = cell.dataStatus === 'no-data' ? 'no-data' : cell.zone;
    const accessibleLabel = `${cell.axisA.label} × ${cell.axisB.label}・${ZONE_META[zoneKey].label}・担い手${cell.carrierCount}人。${cellTitle.replaceAll('\n', '。')}`;
    return (
      <div
        role="img"
        className={`compat-matrix-cell pair ${zoneKey} ${filtered ? 'filtered' : ''}`}
        style={{ '--matrix-zone-color': ZONE_META[zoneKey].color }}
        title={cellTitle}
        aria-label={accessibleLabel}
        aria-hidden={filtered ? 'true' : undefined}
        data-row={rowIndex}
        data-column={colIndex}
        data-zone={zoneKey}
      >
        {cell.dataStatus === 'no-data' ? <span aria-hidden="true">—</span> : (
          <span className="compat-matrix-carriers" aria-hidden="true">{cell.carrierCount}</span>
        )}
      </div>
    );
  };

  return (
    <section className="compat-matrix" aria-labelledby="compat-matrix-title">
      <header className="compat-matrix-heading">
        <p className="compat-kicker">UAAM / SELF-REPORTED MAP</p>
        <h2 id="compat-matrix-title">チームの中にある力の地図</h2>
        <p>本人の自己回答を、個人の結果画面と同じ絶対的な目安で見ています。全体の中での位置を比べるパーセンタイルとは別の図です。</p>
      </header>

      <div className="compat-matrix-filters" aria-label="表示するゾーン">
        {[...ZONE_ORDER, 'no-data'].map((zone) => (
          <button
            type="button"
            key={zone}
            aria-pressed={activeZones.has(zone)}
            onClick={() => toggleZone(zone)}
            style={{ '--matrix-zone-color': ZONE_META[zone].color }}
          >
            <span aria-hidden="true" />
            {ZONE_META[zone].short}
          </button>
        ))}
        <small>数字は、その組み合わせを同じ人の中に持つ担い手の人数です。</small>
      </div>

      <div className="compat-matrix-scroll">
        <table aria-label="UAAM 16軸のチーム力マップ">
          <thead>
            <tr>
              <th aria-hidden="true" />
              {COMPAT_MATRIX_AXES.map((axis) => (
                <th key={axis.key} scope="col" title={`${axis.group}・${axis.label}`} aria-label={`${axis.group}・${axis.label}`}>
                  <span>{axis.group}</span>{axis.label.slice(0, 2)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPAT_MATRIX_AXES.map((axis, rowIndex) => (
              <tr key={axis.key}>
                <th scope="row" title={`${axis.group}・${axis.label}`}><span>{axis.group}</span>{axis.label}</th>
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

      <div className="compat-matrix-legend">
        <p><strong>読み方：</strong>色は、各メンバーを一人ずつ判定したときの最も高いゾーンです。別々の人の点数を組み合わせてはいません。</p>
        <p><strong>大切な注意：</strong>高い人が1人いる＝チームでいつでも発揮できる、ではありません。</p>
        <p><strong>データなし：</strong>斜線のセルは、その2軸のデータが同じ人にそろっていない状態です。0点や待機状態としては扱いません。</p>
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
          <h3>厚い組み合わせ TOP 5</h3>
          <p>ゾーン、同じ人の2軸合計、表の順で並べています。</p>
          {model.topPairs.length > 0 ? (
            <ol className="compat-matrix-top-pairs">
              {model.topPairs.map((pair) => (
                <li key={`${pair.axisA.key}-${pair.axisB.key}`}>
                  <div>
                    <strong>{pairName(pair)}</strong>
                    <span style={{ '--matrix-zone-color': ZONE_META[pair.zone].color }}>{ZONE_META[pair.zone].label}</span>
                  </div>
                  <small>担い手：{pair.carrierAliases.map((alias) => memberNames[alias]).join('、')}</small>
                </li>
              ))}
            </ol>
          ) : <p className="compat-empty-state">今回のデータでは、発動の目安に届く組み合わせは見つかりませんでした。</p>}
        </section>

        <section>
          <h3>今回のデータでは担い手が見つからない組み合わせ</h3>
          {model.dormantPairs.length > 0 ? (
            <details>
              <summary>{model.dormantPairs.length}組あります</summary>
              <div className="compat-matrix-dormant-list">
                {model.dormantPairs.map((pair) => <span key={`${pair.axisA.key}-${pair.axisB.key}`}>{pairName(pair)}</span>)}
              </div>
            </details>
          ) : <p>該当する組み合わせはありません。</p>}
          {model.noDataPairs.length > 0 ? <p className="compat-matrix-data-note">このほか、判定できないデータなしの組み合わせが{model.noDataPairs.length}組あります。</p> : null}
        </section>
      </div>

      <section className="compat-matrix-coverage" aria-label="4グループのカバレッジ">
        <h3>志・知・技・衝のカバレッジ</h3>
        <p>各グループの4軸のうち、チーム内に12点以上の担い手がいる軸の割合です。</p>
        <div>
          {model.groupCoverage.map((coverage) => (
            <article key={coverage.group} style={{ '--matrix-group-color': GROUP_COLORS[coverage.groupIndex] }}>
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
    </section>
  );
}
