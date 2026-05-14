import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import * as d3 from 'd3';
import { db } from '../../firebase';
import { PRESENTERS, EVENT_ID, FIREBASE_UID_TO_PRESENTER_UID, LISTENER_ONLY_USERS } from '../uaam16';

const LISTENER_ONLY_MAP = new Map(LISTENER_ONLY_USERS.map(u => [u.firebaseUid, u.name]));

// talkLevel → エッジ色
const LEVEL_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#f97316', '#e63946'];

function tagColor(talkLevel) {
  return LEVEL_COLORS[Math.min((talkLevel ?? 1) - 1, 4)];
}

function buildGraph(resonances, activeLevels) {
  const externalNodes = new Map();
  const directed = new Map(); // 'from→to' -> { source, target, level }

  resonances.forEach(r => {
    if (activeLevels && !activeLevels.has(r.talkLevel)) return;

    const sourcePresenterUid = FIREBASE_UID_TO_PRESENTER_UID.get(r.fromUid);
    const source = sourcePresenterUid || `_ext_${r.fromUid.slice(0, 6)}`;

    if (!sourcePresenterUid && !externalNodes.has(source)) {
      const knownName = LISTENER_ONLY_MAP.get(r.fromUid);
      externalNodes.set(source, { id: source, name: knownName || r.fromName || '外部', external: true });
    }

    directed.set(`${source}→${r.toUid}`, { source, target: r.toUid, level: r.talkLevel });
  });

  // mutual (両者から相互にエントリあり) を1本の link にまとめる
  const links = [];
  const seen = new Set();
  let mutualCount = 0;
  let oneWayCount = 0;
  for (const [key, d] of directed) {
    if (seen.has(key)) continue;
    const reverseKey = `${d.target}→${d.source}`;
    if (directed.has(reverseKey)) {
      const rev = directed.get(reverseKey);
      links.push({
        source: d.source, target: d.target,
        weight: Math.max(d.level, rev.level),
        mutual: true,
      });
      seen.add(key);
      seen.add(reverseKey);
      mutualCount++;
    } else {
      links.push({
        source: d.source, target: d.target,
        weight: d.level,
        mutual: false,
      });
      seen.add(key);
      oneWayCount++;
    }
  }

  const nodes = [
    ...PRESENTERS.map(p => ({ id: p.uid, name: p.name })),
    ...externalNodes.values(),
  ];
  return { nodes, links, mutualCount, oneWayCount };
}

export default function AlphaMap() {
  const svgRef = useRef(null);
  const simRef = useRef(null);
  const resonancesRef = useRef([]);
  const [count, setCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  // 表示するtalkLevel。デフォルトはLv5のみ。
  const [activeLevels, setActiveLevels] = useState(() => new Set([5]));
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [mutualCount, setMutualCount] = useState(0);
  const [oneWayCount, setOneWayCount] = useState(0);
  // selectedNodeId を tick 内 / d3 handler 内から最新値で読むため ref で保持
  const selectedNodeIdRef = useRef(null);
  selectedNodeIdRef.current = selectedNodeId;

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'alpha_events', EVENT_ID, 'resonance'),
      (snap) => {
        const resonances = [];
        snap.forEach(d => resonances.push({ id: d.id, ...d.data() }));
        resonancesRef.current = resonances;
        setCount(resonances.length);
        setLastUpdated(new Date());
        renderGraph(resonances, activeLevels);
      },
      (err) => console.error('[AlphaMap] snapshot error:', err)
    );
    return () => {
      unsub();
      simRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // フィルタが変わったら再描画 (選択ノードは保持)
  useEffect(() => {
    renderGraph(resonancesRef.current, activeLevels);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLevels]);

  // 選択変化時はノード/エッジの強調だけ更新 (再シミュレーションしない)
  useEffect(() => {
    applyHighlight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeId]);

  const applyHighlight = () => {
    const svg = d3.select(svgRef.current);
    const sel = selectedNodeIdRef.current;
    svg.selectAll('line').attr('stroke-opacity', function() {
      const d = d3.select(this).datum();
      const baseOpacity = d.mutual ? 0.95 : (0.4 + d.weight * 0.1);
      if (!sel) return baseOpacity;
      return (d.source.id === sel || d.target.id === sel) ? baseOpacity : 0.05;
    });
    svg.selectAll('g.node-g').attr('opacity', function() {
      const d = d3.select(this).datum();
      if (!sel) return 1;
      return d.id === sel ? 1 : 0.25;
    });
  };

  const toggleLevel = (lv) => {
    setActiveLevels(prev => {
      const next = new Set(prev);
      if (next.has(lv)) next.delete(lv); else next.add(lv);
      return next;
    });
  };

  const renderGraph = (resonances, levels) => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const W = window.innerWidth;
    const H = window.innerHeight;
    svg.attr('width', W).attr('height', H);

    const graph = buildGraph(resonances, levels);
    const { nodes, links } = graph;
    setMutualCount(graph.mutualCount);
    setOneWayCount(graph.oneWayCount);

    // defs: 矢印マーカー (片方向リンク用)
    const defs = svg.append('defs');
    defs.append('marker')
      .attr('id', 'arrow-oneway')
      .attr('viewBox', '0 -4 8 8')
      .attr('refX', 8)
      .attr('refY', 0)
      .attr('markerWidth', 7)
      .attr('markerHeight', 7)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4 L8,0 L0,4')
      .attr('fill', '#e63946')
      .attr('fill-opacity', 0.85);

    // zoom container
    const g = svg.append('g');

    svg.call(
      d3.zoom()
        .scaleExtent([0.3, 3])
        .on('zoom', (e) => g.attr('transform', e.transform))
    );

    // 背景クリックで選択解除
    svg.on('click', (e) => {
      if (e.target === svgRef.current) setSelectedNodeId(null);
    });

    // Simulation
    // Lv3+ (強い共鳴) のリンクだけが距離を縮めるように strength を効かせ、
    // Lv1-2 はレイアウトに影響させずに薄く描画するだけにする。
    simRef.current?.stop();
    const sim = d3.forceSimulation(nodes)
      .alphaDecay(0.05)
      .velocityDecay(0.6)
      .force('link', d3.forceLink(links)
        .id(d => d.id)
        .distance(d => d.weight >= 3 ? 180 - d.weight * 12 : 260)
        .strength(d => d.weight >= 3 ? Math.min(d.weight / 8, 0.6) : 0.02)
      )
      .force('charge', d3.forceManyBody().strength(-260))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide(d => d.external ? 22 : 38));
    simRef.current = sim;

    // Links (edges)
    // mutual: 金色の太線 (相互共鳴ペア)
    // one-way: talkLevelカラーの細線 + 矢印 (片想い)
    const linkSel = g.append('g')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', d => d.mutual ? '#fbbf24' : tagColor(d.weight))
      .attr('stroke-opacity', d => d.mutual ? 0.95 : (0.4 + d.weight * 0.1))
      .attr('stroke-width', d => d.mutual ? Math.max(2.5, d.weight * 0.8) : Math.max(1, d.weight * 0.5))
      .attr('marker-end', d => d.mutual ? null : 'url(#arrow-oneway)');

    // Nodes (circles)
    const nodeSel = g.append('g')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .attr('class', 'node-g')
      .style('cursor', 'pointer')
      .on('click', (e, d) => {
        e.stopPropagation();
        setSelectedNodeId(prev => (prev === d.id ? null : d.id));
      })
      .call(
        d3.drag()
          .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
          .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
          .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
      );

    // Circle
    nodeSel.append('circle')
      .attr('r', d => d.external ? 18 : 28)
      .attr('fill', d => d.external ? '#1a1a22' : '#14141a')
      .attr('stroke', d => d.external ? '#3a3a45' : '#2a2a35')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', d => d.external ? '3,2' : null);

    // Resonance count indicator ring (filter後のtalkLevelで集計)
    const receivedCount = new Map();
    resonances.forEach(r => {
      if (levels && !levels.has(r.talkLevel)) return;
      receivedCount.set(r.toUid, (receivedCount.get(r.toUid) ?? 0) + r.talkLevel);
    });
    const maxScore = Math.max(1, ...receivedCount.values());

    nodeSel.append('circle')
      .attr('r', 28)
      .attr('fill', 'none')
      .attr('stroke', d => {
        const score = receivedCount.get(d.id) ?? 0;
        if (score === 0) return 'transparent';
        const t = score / maxScore;
        return t > 0.6 ? '#e63946' : t > 0.3 ? '#f59e0b' : '#3b82f6';
      })
      .attr('stroke-width', d => {
        const score = receivedCount.get(d.id) ?? 0;
        return Math.max(0, (score / maxScore) * 5);
      })
      .attr('stroke-opacity', 0.8);

    // Initial letter
    nodeSel.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.external ? '-1px' : '-2px')
      .attr('font-size', d => d.external ? 12 : 18)
      .attr('font-weight', 700)
      .attr('fill', d => d.external ? '#a1a1aa' : '#f4f4f5')
      .text(d => (d.name || '?').charAt(0));

    // Name label
    nodeSel.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', d => d.external ? '14px' : '18px')
      .attr('font-size', d => d.external ? 8 : 9)
      .attr('fill', '#a1a1aa')
      .text(d => d.name);

    // Tick: 矢印用にtarget側を半径分手前で止める
    sim.on('tick', () => {
      linkSel
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => {
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const r = (d.target.external ? 18 : 28) + (d.mutual ? 0 : 4);
          return d.target.x - (dx / len) * r;
        })
        .attr('y2', d => {
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const r = (d.target.external ? 18 : 28) + (d.mutual ? 0 : 4);
          return d.target.y - (dy / len) * r;
        });
      nodeSel.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // 描画完了後に現在の選択ハイライトを反映
    applyHighlight();
  };

  return (
    <div style={{
      background: '#0a0a0b', width: '100vw', height: '100vh',
      overflow: 'hidden', position: 'relative',
    }}>
      <svg ref={svgRef} style={{ display: 'block' }} />

      {/* HUD */}
      <div style={{
        position: 'absolute', top: 16, left: 16,
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <div style={{
          background: 'rgba(20,20,26,0.85)', border: '1px solid #2a2a35',
          borderRadius: 10, padding: '10px 16px', backdropFilter: 'blur(8px)',
        }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f4f4f5' }}>α共鳴マップ</div>
          <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>
            リトリートα 2026
          </div>
        </div>

        <div style={{
          background: 'rgba(20,20,26,0.85)', border: '1px solid #2a2a35',
          borderRadius: 10, padding: '8px 14px', backdropFilter: 'blur(8px)',
        }}>
          <div style={{ fontSize: 12, color: '#a1a1aa' }}>
            <span style={{ color: '#f4f4f5', fontWeight: 700 }}>{count}</span> 件の共鳴
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6, fontSize: 11 }}>
            <span style={{ color: '#fbbf24' }}>
              ★ 相互 <span style={{ fontWeight: 700 }}>{mutualCount}</span>
            </span>
            <span style={{ color: '#e63946' }}>
              → 片方向 <span style={{ fontWeight: 700 }}>{oneWayCount}</span>
            </span>
          </div>
          {lastUpdated && (
            <div style={{ fontSize: 10, color: '#71717a', marginTop: 4 }}>
              {lastUpdated.toLocaleTimeString('ja-JP')} 更新
            </div>
          )}
        </div>

        {selectedNodeId && (
          <button
            onClick={() => setSelectedNodeId(null)}
            style={{
              background: 'rgba(251,191,36,0.15)', border: '1px solid #fbbf24',
              borderRadius: 10, padding: '6px 12px', cursor: 'pointer',
              color: '#fbbf24', fontSize: 11, textAlign: 'left',
            }}
          >
            選択: {(PRESENTERS.find(p => p.uid === selectedNodeId)?.name) || selectedNodeId} (クリックで解除)
          </button>
        )}
      </div>

      {/* Legend / Filter */}
      <div style={{
        position: 'absolute', bottom: 16, left: 16,
        background: 'rgba(20,20,26,0.85)', border: '1px solid #2a2a35',
        borderRadius: 10, padding: '10px 14px', backdropFilter: 'blur(8px)',
      }}>
        <div style={{ fontSize: 10, color: '#71717a', marginBottom: 8, letterSpacing: '0.1em' }}>
          FILTER — 話したい度
        </div>
        {[1, 2, 3, 4, 5].map((lv) => {
          const on = activeLevels.has(lv);
          return (
            <button
              key={lv}
              onClick={() => toggleLevel(lv)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', marginBottom: 4, padding: '3px 6px',
                background: on ? 'rgba(255,255,255,0.05)' : 'transparent',
                border: '1px solid', borderColor: on ? '#3a3a45' : 'transparent',
                borderRadius: 6, cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{
                width: 16, height: 3, background: LEVEL_COLORS[lv - 1], borderRadius: 1,
                opacity: on ? 1 : 0.25,
              }} />
              <span style={{
                fontSize: 11, color: on ? '#f4f4f5' : '#52525b', fontWeight: on ? 600 : 400,
              }}>
                Lv{lv}
              </span>
            </button>
          );
        })}
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #1c1c24' }}>
          <div style={{ fontSize: 10, color: '#71717a', marginBottom: 4 }}>NODE RING — 共鳴スコア</div>
          {[['高', '#e63946'], ['中', '#f59e0b'], ['低', '#3b82f6']].map(([label, color]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', border: `2px solid ${color}` }} />
              <span style={{ fontSize: 11, color: '#a1a1aa' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hint */}
      <div style={{
        position: 'absolute', bottom: 16, right: 16,
        fontSize: 11, color: '#71717a',
      }}>
        ドラッグ: ノード移動 ／ スクロール: ズーム
      </div>
    </div>
  );
}
