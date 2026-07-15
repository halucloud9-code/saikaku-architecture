import { useId } from 'react';

const CATEGORY_LABELS = { value: '価値観', talent: '才能', passion: '情熱' };
const SOURCE_LABELS = { user_top5: '本人Top5', generated_axis: '生成軸' };
const SIGNAL_LABELS = {
  similarity: '相対位置が近接',
  complementarity: '相対位置に幅あり',
  neutral: '閾値外の分布',
  insufficient: '比較データ不足',
};
const MEMBER_COLORS = Array.from({ length: 10 }, (_unused, index) => `var(--compat-member-${index + 1})`);

export function firstGrapheme(value) {
  const normalized = typeof value === 'string' ? value.normalize('NFKC').trim() : '';
  if (!normalized) return '？';
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
    return segmenter.segment(normalized)[Symbol.iterator]().next().value?.segment || '？';
  }
  return Array.from(normalized)[0] || '？';
}

export function stackUaamPoints(points, collisionGap = 4) {
  const sorted = [...points].sort((left, right) => left.percentile - right.percentile || left.alias.localeCompare(right.alias));
  const clusters = [];
  for (const point of sorted) {
    const cluster = clusters.at(-1);
    if (!cluster || point.percentile - cluster.at(-1).percentile > collisionGap) clusters.push([point]);
    else cluster.push(point);
  }
  return clusters.flatMap((cluster) => cluster.map((point, index) => ({
    ...point,
    x: point.percentile,
    lane: index - ((cluster.length - 1) / 2),
  })));
}

function labelFor(alias, members, memberLabels) {
  const index = members.findIndex((member) => member.alias === alias);
  return memberLabels[index]?.trim() || alias;
}

function truncateGraphemes(value, maxLength) {
  const segments = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? [...new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(value)].map((item) => item.segment)
    : Array.from(value);
  return segments.length > maxLength ? `${segments.slice(0, maxLength).join('')}…` : segments.join('');
}

function memberPositions(count) {
  const center = 300;
  const radius = count <= 4 ? 205 : count <= 6 ? 215 : 225;
  const nodeRadius = count <= 4 ? 57 : count <= 6 ? 48 : 40;
  return Array.from({ length: count }, (_unused, index) => {
    const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / count);
    return {
      x: center + Math.cos(angle) * radius,
      y: center + Math.sin(angle) * radius,
      radius: nodeRadius,
    };
  });
}

function combinedEdges(matches) {
  const edges = new Map();
  for (const match of matches) {
    const key = [...match.aliases].sort().join('|');
    const current = edges.get(key) || { aliases: match.aliases, count: 0 };
    current.count += match.terms.length;
    edges.set(key, current);
  }
  return [...edges.values()];
}

function NetworkMandala({ visual, memberLabels }) {
  const titleId = useId();
  const descId = useId();
  const positions = memberPositions(visual.members.length);
  const positionByAlias = new Map(visual.members.map((member, index) => [member.alias, positions[index]]));
  const edges = combinedEdges(visual.matches);
  const description = edges.length > 0
    ? edges.map((edge) => `${edge.aliases.map((alias) => labelFor(alias, visual.members, memberLabels)).join('と')}に完全一致${edge.count}件`).join('。')
    : '対象者間のNFKC完全一致は、この診断データでは不検出です。';

  return (
    <>
      <svg
        className="compat-mandala-network"
        viewBox="0 0 600 600"
        role="img"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <title id={titleId}>対象者の生成軸と完全一致の接点</title>
        <desc id={descId}>{description} 円の距離や配置に相性の強さという意味はありません。</desc>
        <circle className="compat-mandala-guide" cx="300" cy="300" r="242" />
        {edges.map((edge) => {
          const left = positionByAlias.get(edge.aliases[0]);
          const right = positionByAlias.get(edge.aliases[1]);
          if (!left || !right) return null;
          return (
            <g key={[...edge.aliases].sort().join('-')}>
              <line className="compat-mandala-edge" x1={left.x} y1={left.y} x2={right.x} y2={right.y} />
              <text className="compat-mandala-edge-label" x={(left.x + right.x) / 2} y={(left.y + right.y) / 2 - 8} textAnchor="middle">
                完全一致 {edge.count}件
              </text>
            </g>
          );
        })}
        <g className="compat-mandala-center">
          <circle cx="300" cy="300" r="66" />
          <text x="300" y="294" textAnchor="middle">相性マンダラ</text>
          <text className="compat-mandala-center-sub" x="300" y="319" textAnchor="middle">完全一致の接点</text>
        </g>
        {visual.members.map((member, index) => {
          const point = positions[index];
          const label = labelFor(member.alias, visual.members, memberLabels);
          const shortLabel = truncateGraphemes(label, 7);
          return (
            <g className="compat-mandala-node" key={member.alias}>
              <circle cx={point.x} cy={point.y} r={point.radius} style={{ '--compat-member-color': MEMBER_COLORS[index % MEMBER_COLORS.length] }} />
              <text className="compat-mandala-node-name" x={point.x} y={point.y + 6} textAnchor="middle">{shortLabel}</text>
            </g>
          );
        })}
        <text className="compat-mandala-layout-note" x="300" y="587" textAnchor="middle">配置・距離は見やすさのため。強さや優劣を示しません。</text>
      </svg>
      <div className="compat-mandala-mobile-network" aria-label="完全一致の接点">
        {edges.length > 0 ? edges.map((edge) => (
          <p key={[...edge.aliases].sort().join('-')}>
            {edge.aliases.map((alias) => labelFor(alias, visual.members, memberLabels)).join(' × ')}：NFKC完全一致 {edge.count}件
          </p>
        )) : <p>この診断データでは完全一致は不検出です。</p>}
      </div>
    </>
  );
}

function MemberCards({ visual, memberLabels }) {
  return (
    <div className="compat-mandala-members" aria-label="対象者ごとの生成軸">
      {visual.members.map((member, index) => (
        <article className="compat-mandala-member" key={member.alias} style={{ '--compat-member-color': MEMBER_COLORS[index % MEMBER_COLORS.length] }}>
          <header>
            <span className="compat-mandala-initial" aria-hidden="true">{firstGrapheme(memberLabels[index] || member.alias)}</span>
            <div>
              <h3>{memberLabels[index]?.trim() || member.alias}</h3>
              <p>生成軸</p>
            </div>
          </header>
          {Object.entries(CATEGORY_LABELS).map(([category, categoryLabel]) => (
            <div className="compat-member-axis" key={category}>
              <strong>{categoryLabel}</strong>
              <span>{member.axes[category]?.length > 0 ? member.axes[category].join(' / ') : 'この診断データでは不検出'}</span>
            </div>
          ))}
        </article>
      ))}
    </div>
  );
}

function MatchedTerms({ visual, memberLabels }) {
  const titleId = useId();
  return (
    <section className="compat-matched-terms" aria-labelledby={titleId}>
      <div className="compat-mandala-subhead">
        <p className="compat-kicker">NFKC EXACT MATCH</p>
        <h3 id={titleId}>完全一致した語</h3>
        <p>同じ表記が確認できた事実です。同じ意味・関係性の強さまでは示しません。</p>
      </div>
      {visual.matches.length > 0 ? (
        <div className="compat-match-grid">
          {visual.matches.map((match, index) => (
            <article className="compat-match-card" key={`${match.aliases.join('-')}-${match.category}-${match.sourceKind}-${index}`}>
              <p className="compat-match-pair">{match.aliases.map((alias) => labelFor(alias, visual.members, memberLabels)).join(' × ')}</p>
              <p className="compat-match-meta">{CATEGORY_LABELS[match.category]} · {SOURCE_LABELS[match.sourceKind]} · NFKC完全一致</p>
              <div className="compat-term-list">
                {match.terms.map((term) => <span key={term}>{term}</span>)}
              </div>
            </article>
          ))}
        </div>
      ) : <p className="compat-empty-state">この診断データでは完全一致した語は不検出です。</p>}
    </section>
  );
}

function UaamPlot({ axis, visual, memberLabels }) {
  const titleId = useId();
  const descId = useId();
  const width = 680;
  const padding = 34;
  const laidOut = stackUaamPoints(axis.points);
  const maxLane = Math.max(0, ...laidOut.map((point) => Math.abs(point.lane)));
  const height = Math.max(92, 92 + maxLane * 44);
  const centerY = (height - 20) / 2;
  const toX = (percentile) => padding + ((width - (padding * 2)) * percentile / 100);
  const pointDescription = laidOut.length > 0
    ? laidOut.map((point) => `${labelFor(point.alias, visual.members, memberLabels)}は第${point.percentile}パーセンタイル`).join('、')
    : '比較できる点はありません';

  return (
    <article className="compat-uaam-plot" data-signal={axis.signal}>
      <header>
        <strong>{axis.label}</strong>
        <span>{SIGNAL_LABELS[axis.signal]} · cohort n={axis.cohortSize}</span>
      </header>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={titleId} aria-describedby={descId}>
        <title id={titleId}>{axis.label}の自己申告相対位置</title>
        <desc id={descId}>{pointDescription}。横位置はpercentileそのもので、同値や近接点は横へずらさず縦に重ねています。</desc>
        <line className="compat-uaam-axis-line" x1={padding} y1={centerY} x2={width - padding} y2={centerY} />
        {[0, 50, 100].map((tick) => (
          <g key={tick}>
            <line className="compat-uaam-tick" x1={toX(tick)} y1={centerY - 8} x2={toX(tick)} y2={centerY + 8} />
            <text className="compat-uaam-tick-label" x={toX(tick)} y={height - 4} textAnchor="middle">{tick}</text>
          </g>
        ))}
        {laidOut.map((point) => {
          const index = visual.members.findIndex((member) => member.alias === point.alias);
          const label = labelFor(point.alias, visual.members, memberLabels);
          const x = toX(point.x);
          const y = centerY + point.lane * 27;
          return (
            <g
              className="compat-uaam-point"
              key={point.alias}
              transform={`translate(${x} ${y})`}
              data-alias={point.alias}
              data-percentile={point.percentile}
              data-x={point.x}
              data-lane={point.lane}
              aria-label={`${label} 第${point.percentile}パーセンタイル`}
            >
              <circle cx="0" cy="0" r="14" style={{ '--compat-member-color': MEMBER_COLORS[index % MEMBER_COLORS.length] }} />
              <text x="0" y="5" textAnchor="middle" data-dot-initial={firstGrapheme(label)}>{firstGrapheme(label)}</text>
            </g>
          );
        })}
      </svg>
      <div className="compat-uaam-mobile-points" aria-label={`${axis.label}の自己申告相対位置`}>
        {laidOut.length > 0 ? laidOut.map((point) => {
          const label = labelFor(point.alias, visual.members, memberLabels);
          const index = visual.members.findIndex((member) => member.alias === point.alias);
          return (
            <span key={point.alias} style={{ '--compat-member-color': MEMBER_COLORS[index % MEMBER_COLORS.length] }}>
              <b aria-hidden="true">{firstGrapheme(label)}</b>{label} 第{point.percentile}パーセンタイル
            </span>
          );
        }) : <span>比較できるデータがありません。</span>}
      </div>
    </article>
  );
}

function UaamOverview({ visual, memberLabels }) {
  const titleId = useId();
  const highlighted = visual.uaam.axes.filter((axis) => ['similarity', 'complementarity'].includes(axis.signal)).slice(0, 4);
  return (
    <section className="compat-uaam-overview" aria-labelledby={titleId}>
      <div className="compat-mandala-subhead">
        <p className="compat-kicker">UAAM / ALL 16 AXES</p>
        <h3 id={titleId}>16才覚の自己申告相対位置</h3>
        <p>診断参加者コホート内の位置です。客観能力や人物の優劣ではありません。</p>
      </div>
      {highlighted.length > 0 && (
        <div className="compat-uaam-signals" aria-label="閾値を越えた分布">
          {highlighted.map((axis) => (
            <span key={axis.key}><b>{axis.label}</b>{SIGNAL_LABELS[axis.signal]}</span>
          ))}
        </div>
      )}
      <details className="compat-uaam-details">
        <summary>16軸の分布を見る</summary>
        <div className="compat-uaam-grid">
          {visual.uaam.axes.map((axis) => (
            <UaamPlot key={axis.key} axis={axis} visual={visual} memberLabels={memberLabels} />
          ))}
        </div>
      </details>
    </section>
  );
}

export default function CompatMandala({ visual, memberLabels = [] }) {
  const titleId = useId();
  if (!visual || visual.schemaVersion !== 2) return null;
  return (
    <section className="compat-mandala" aria-labelledby={titleId}>
      <header className="compat-mandala-heading">
        <p className="compat-kicker">COMPATIBILITY MANDALA</p>
        <h2 id={titleId}>相性マンダラ</h2>
        <p>生成軸・完全一致語・自己申告相対位置を、結論ではなく読み合わせの地図として表示します。</p>
      </header>
      <NetworkMandala visual={visual} memberLabels={memberLabels} />
      <MemberCards visual={visual} memberLabels={memberLabels} />
      <MatchedTerms visual={visual} memberLabels={memberLabels} />
      <UaamOverview visual={visual} memberLabels={memberLabels} />
    </section>
  );
}
