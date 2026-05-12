import { useEffect, useRef, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import * as d3 from 'd3';
import { db } from '../../firebase';
import { PRESENTERS, EVENT_ID } from '../uaam16';

// talkLevel → エッジ色
const LEVEL_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#f97316', '#e63946'];

function tagColor(talkLevel) {
  return LEVEL_COLORS[Math.min((talkLevel ?? 1) - 1, 4)];
}

// 参加者UIDから名前
const presenterMap = new Map(PRESENTERS.map(p => [p.uid, p]));

function buildGraph(resonances) {
  const nodes = PRESENTERS.map(p => ({ id: p.uid, name: p.name }));
  const links = [];
  const weightMap = new Map();

  resonances.forEach(r => {
    const key = `${r.fromUid}→${r.toUid}`;
    // fromUid はFirebase UID, toUid は u01..u23
    // グラフには toUid (u01..u23) の間のエッジのみを引く
    // → 聞き手側のuidがu01..u23に含まれるかどうか分からないので
    //   talkLevel * 重みでエッジを貼る
    const existing = weightMap.get(key);
    if (existing) {
      existing.weight += r.talkLevel;
    } else {
      // fromUid が u01..u23 でない場合、エッジを匿名ノードとして扱う
      // ここでは presenterMap に fromUid があるかチェック
      const fromPresenter = presenterMap.get(r.fromUid);
      const source = fromPresenter ? r.fromUid : `_ext_${r.fromUid.slice(0, 6)}`;
      weightMap.set(key, { source, target: r.toUid, weight: r.talkLevel });
    }
  });

  weightMap.forEach(link => links.push(link));
  return { nodes, links };
}

export default function AlphaMap() {
  const svgRef = useRef(null);
  const simRef = useRef(null);
  const [count, setCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'alpha_events', EVENT_ID, 'resonance'),
      (snap) => {
        const resonances = [];
        snap.forEach(d => resonances.push({ id: d.id, ...d.data() }));
        setCount(resonances.length);
        setLastUpdated(new Date());
        renderGraph(resonances);
      },
      (err) => console.error('[AlphaMap] snapshot error:', err)
    );
    return () => {
      unsub();
      simRef.current?.stop();
    };
  }, []);

  const renderGraph = (resonances) => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const W = window.innerWidth;
    const H = window.innerHeight;
    svg.attr('width', W).attr('height', H);

    const { nodes, links } = buildGraph(resonances);

    // zoom container
    const g = svg.append('g');

    svg.call(
      d3.zoom()
        .scaleExtent([0.3, 3])
        .on('zoom', (e) => g.attr('transform', e.transform))
    );

    // Simulation
    simRef.current?.stop();
    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links)
        .id(d => d.id)
        .distance(d => 120 - d.weight * 8)
        .strength(d => Math.min(d.weight / 10, 0.8))
      )
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide(36));
    simRef.current = sim;

    // Links (edges)
    const linkSel = g.append('g')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', d => tagColor(d.weight))
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', d => Math.max(1, d.weight * 0.6));

    // Nodes (circles)
    const nodeSel = g.append('g')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .call(
        d3.drag()
          .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
          .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
          .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
      );

    // Circle
    nodeSel.append('circle')
      .attr('r', 28)
      .attr('fill', '#14141a')
      .attr('stroke', '#2a2a35')
      .attr('stroke-width', 1.5);

    // Resonance count indicator ring
    const receivedCount = new Map();
    resonances.forEach(r => {
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
      .attr('dy', '-2px')
      .attr('font-size', 18)
      .attr('font-weight', 700)
      .attr('fill', '#f4f4f5')
      .text(d => d.name.charAt(0));

    // Name label
    nodeSel.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '18px')
      .attr('font-size', 9)
      .attr('fill', '#a1a1aa')
      .text(d => d.name);

    // Tick
    sim.on('tick', () => {
      linkSel
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);
      nodeSel.attr('transform', d => `translate(${d.x},${d.y})`);
    });
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
          {lastUpdated && (
            <div style={{ fontSize: 10, color: '#71717a', marginTop: 2 }}>
              {lastUpdated.toLocaleTimeString('ja-JP')} 更新
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 16, left: 16,
        background: 'rgba(20,20,26,0.85)', border: '1px solid #2a2a35',
        borderRadius: 10, padding: '10px 14px', backdropFilter: 'blur(8px)',
      }}>
        <div style={{ fontSize: 10, color: '#71717a', marginBottom: 8, letterSpacing: '0.1em' }}>
          EDGE COLOR — 話したい度
        </div>
        {['Lv1', 'Lv2', 'Lv3', 'Lv4', 'Lv5'].map((label, i) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
          }}>
            <div style={{ width: 16, height: 2, background: LEVEL_COLORS[i], borderRadius: 1 }} />
            <span style={{ fontSize: 11, color: '#a1a1aa' }}>{label}</span>
          </div>
        ))}
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
