import { useId } from 'react';

const CATEGORY_LABELS = { value: '価値観', talent: '才能', passion: '情熱' };
const SOURCE_LABELS = { user_top5: '本人がえらんだ分', generated_axis: '診断でみつけた分' };
const SIGNAL_LABELS = {
  similarity: '近い位置にいる',
  complementarity: 'はなれた位置にいる（助け合えるかも）',
  neutral: 'どちらともいえない',
  insufficient: 'くらべるデータが足りない',
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
    ? edges.map((edge) => `${edge.aliases.map((alias) => labelFor(alias, visual.members, memberLabels)).join('と')}に同じ言葉が${edge.count}個`).join('。')
    : 'まったく同じ言葉は、今回のデータでは見つかりませんでした。';

  return (
    <>
      <svg
        className="compat-mandala-network"
        viewBox="0 0 600 600"
        role="img"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <title id={titleId}>メンバーの、診断でみつけた軸と同じ言葉のつながり</title>
        <desc id={descId}>{description} 丸の位置やきょりに、仲の良さという意味はありません。</desc>
        <circle className="compat-mandala-guide" cx="300" cy="300" r="242" />
        {edges.map((edge) => {
          const left = positionByAlias.get(edge.aliases[0]);
          const right = positionByAlias.get(edge.aliases[1]);
          if (!left || !right) return null;
          return (
            <g key={[...edge.aliases].sort().join('-')}>
              <line className="compat-mandala-edge" x1={left.x} y1={left.y} x2={right.x} y2={right.y} />
              <text className="compat-mandala-edge-label" x={(left.x + right.x) / 2} y={(left.y + right.y) / 2 - 8} textAnchor="middle">
                同じ言葉 {edge.count}個
              </text>
            </g>
          );
        })}
        <g className="compat-mandala-center">
          <circle cx="300" cy="300" r="66" />
          <text x="300" y="294" textAnchor="middle">相性マンダラ</text>
          <text className="compat-mandala-center-sub" x="300" y="319" textAnchor="middle">同じ言葉のつながり</text>
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
        <text className="compat-mandala-layout-note" x="300" y="587" textAnchor="middle">ならべ方やきょりは見やすくするためです。強い・弱いという意味はありません。</text>
      </svg>
      <div className="compat-mandala-mobile-network" aria-label="同じ言葉のつながり">
        {edges.length > 0 ? edges.map((edge) => (
          <p key={[...edge.aliases].sort().join('-')}>
            {edge.aliases.map((alias) => labelFor(alias, visual.members, memberLabels)).join(' × ')}：同じ言葉が{edge.count}個
          </p>
        )) : <p>今回のデータでは、まったく同じ言葉は見つかりませんでした。</p>}
      </div>
    </>
  );
}

function MemberCards({ visual, memberLabels }) {
  return (
    <div className="compat-mandala-members" aria-label="メンバーごとにみつかった軸">
      {visual.members.map((member, index) => (
        <article className="compat-mandala-member" key={member.alias} style={{ '--compat-member-color': MEMBER_COLORS[index % MEMBER_COLORS.length] }}>
          <header>
            <span className="compat-mandala-initial" aria-hidden="true">{firstGrapheme(memberLabels[index] || member.alias)}</span>
            <div>
              <h3>{memberLabels[index]?.trim() || member.alias}</h3>
              <p>診断でみつけた分</p>
            </div>
          </header>
          {Object.entries(CATEGORY_LABELS).map(([category, categoryLabel]) => (
            <div className="compat-member-axis" key={category}>
              <strong>{categoryLabel}</strong>
              <span>{member.axes[category]?.length > 0 ? member.axes[category].join(' / ') : 'データなし'}</span>
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
        <p className="compat-kicker">✨ 同じ言葉さがし</p>
        <h3 id={titleId}>まったく同じだった言葉</h3>
        <p>同じ書き方の言葉が見つかった、という事実です。仲の良さの強さを表すものではありません。</p>
      </div>
      {visual.matches.length > 0 ? (
        <div className="compat-match-grid">
          {visual.matches.map((match, index) => (
            <article className="compat-match-card" key={`${match.aliases.join('-')}-${match.category}-${match.sourceKind}-${index}`}>
              <p className="compat-match-pair">{match.aliases.map((alias) => labelFor(alias, visual.members, memberLabels)).join(' × ')}</p>
              <p className="compat-match-meta">{CATEGORY_LABELS[match.category]} · {SOURCE_LABELS[match.sourceKind]} · まったく同じ言葉</p>
              <div className="compat-term-list">
                {match.terms.map((term) => <span key={term}>{term}</span>)}
              </div>
            </article>
          ))}
        </div>
      ) : <p className="compat-empty-state">今回のデータでは、まったく同じ言葉は見つかりませんでした。</p>}
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
    ? laidOut.map((point) => `${labelFor(point.alias, visual.members, memberLabels)}は、みんなの中で${point.percentile}番目くらいの位置です`).join('、')
    : 'くらべられるデータがありません';

  return (
    <article className="compat-uaam-plot" data-signal={axis.signal}>
      <header>
        <strong>{axis.label}</strong>
        <span>{SIGNAL_LABELS[axis.signal]} · くらべた人数 {axis.cohortSize}人</span>
      </header>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={titleId} aria-describedby={descId}>
        <title id={titleId}>{axis.label}で、じぶんが思う立ち位置</title>
        <desc id={descId}>{pointDescription}。横のいちは、みんなの中でのじゅんい（パーセンタイル）です。おなじ場所や近い場所の点は、たてに重ねて表示しています。</desc>
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
              aria-label={`${label} ${point.percentile}番目くらいの位置`}
            >
              <circle cx="0" cy="0" r="14" style={{ '--compat-member-color': MEMBER_COLORS[index % MEMBER_COLORS.length] }} />
              <text x="0" y="5" textAnchor="middle" data-dot-initial={firstGrapheme(label)}>{firstGrapheme(label)}</text>
            </g>
          );
        })}
      </svg>
      <div className="compat-uaam-mobile-points" aria-label={`${axis.label}で、じぶんが思う立ち位置`}>
        {laidOut.length > 0 ? laidOut.map((point) => {
          const label = labelFor(point.alias, visual.members, memberLabels);
          const index = visual.members.findIndex((member) => member.alias === point.alias);
          return (
            <span key={point.alias} style={{ '--compat-member-color': MEMBER_COLORS[index % MEMBER_COLORS.length] }}>
              <b aria-hidden="true">{firstGrapheme(label)}</b>{label} {point.percentile}番目くらいの位置
            </span>
          );
        }) : <span>くらべられるデータがありません。</span>}
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
        <p className="compat-kicker">UAAM・16この軸</p>
        <h3 id={titleId}>16この力を、じぶんでどう思っているか</h3>
        <p>診断を受けた人たちの中でのくらべっこです。どちらが上か下か、という意味ではありません。</p>
      </div>
      {highlighted.length > 0 && (
        <div className="compat-uaam-signals" aria-label="とくに目立つ軸">
          {highlighted.map((axis) => (
            <span key={axis.key}><b>{axis.label}</b>{SIGNAL_LABELS[axis.signal]}</span>
          ))}
        </div>
      )}
      <details className="compat-uaam-details">
        <summary>16この軸をぜんぶ見る</summary>
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
        <p className="compat-kicker">🧭 図でみてみよう</p>
        <h2 id={titleId}>相性マンダラ</h2>
        <p>診断でみつけた軸や、同じ言葉、UAAMのアンケート結果を、結論ではなく「話すきっかけの地図」として見せます。</p>
      </header>
      <NetworkMandala visual={visual} memberLabels={memberLabels} />
      <MemberCards visual={visual} memberLabels={memberLabels} />
      <MatchedTerms visual={visual} memberLabels={memberLabels} />
      <UaamOverview visual={visual} memberLabels={memberLabels} />
    </section>
  );
}
