import { useMemo, useState, useRef, useEffect } from 'react';
import { signOutUser } from '../../firebase';
import { UAAM_AXES, checkValidity, getVFlags } from '../../data/uaam_questions';
import ActivationMatrix from './ActivationMatrix';
import AllPairsTriangle, { SymmetricMatrix } from './AllPairsTriangle';
import ActivationPanel from '../../ActivationPanel';
import SaikakuIntegration from './SaikakuIntegration';
import { normalizeScores } from '../../utils/normalize';
import { attemptToResultProps } from '../../utils/attemptAdapter';

/* ============================================================
 * 定数
 * ============================================================ */
const LIGHT_BG = '#F5F0E8';
const WHITE = '#FFFFFF';
const TEXT_PRIMARY = '#1A1A1A';
const TEXT_SECONDARY = '#333333';
const TEXT_MUTED = '#666666';
const BORDER = '#E8E0D4';
const ACCENT_GOLD = '#B8960C';
const NUM_FONT = "'Outfit', sans-serif";

const SUB_ORDER = {
  mindset:    ['meaning', 'mindfulness', 'mindshift', 'mastery'],
  literacy:   ['learning', 'logical', 'life', 'leadership'],
  competency: ['critical', 'creativity', 'communication', 'collaboration'],
  impact:     ['idea', 'innovation', 'implementation', 'influence'],
};

const SUB_LABELS = {
  meaning: 'Meaning', mindfulness: 'Mindfulness', mindshift: 'Mindshift', mastery: 'Mastery',
  learning: 'Learning', logical: 'Logical', life: 'Life', leadership: 'Leadership',
  critical: 'Critical', creativity: 'Creativity', communication: 'Communication', collaboration: 'Collaboration',
  idea: 'Idea', innovation: 'Innovation', implementation: 'Implementation', influence: 'Influence',
};

const SUB_JP = {
  meaning: '基軸力', mindfulness: '認知力', mindshift: '転換力', mastery: '熟達力',
  learning: '謙学力', logical: '論理力', life: '活用力', leadership: '統率力',
  critical: '本質力', creativity: '創造力', communication: '伝達力', collaboration: '協働力',
  idea: '構想力', innovation: '変革力', implementation: '実装力', influence: '影響力',
};

const QUADRANT_DEFS = [
  { key: 'vision',     label: '構想力', english: 'Visionary Thinking', formula: '志 × 知',
    axes: ['mindset', 'literacy'],    color: '#3D7A7A', pos: 'rt',
    desc: '平静と冷静な態度を保ちながら、自己認識と他者理解を通じて感情や思考を正確に把握し、他人の視点や感情に敏感に対応する能力。' },
  { key: 'command',    label: '統率力', english: 'Leadership', formula: '志 × 衝',
    axes: ['mindset', 'impact'],      color: '#6B4C8A', pos: 'lt',
    desc: '共感と理解を深める学習環境を形成し、個人が互いに影響を与え合いながら成長するプロセスを促進する。' },
  { key: 'execution',  label: '実装力', english: 'Implementation', formula: '知 × 技',
    axes: ['literacy', 'competency'], color: '#7A8A2E', pos: 'rb',
    desc: '個人が自身の行動力と創造力を向上させ、持続的な学習と成長を実現し、イノベーションや改善を促進する能力。' },
  { key: 'revolution', label: '変革力', english: 'Transformation', formula: '衝 × 技',
    axes: ['impact', 'competency'],   color: '#B5622E', pos: 'lb',
    desc: '冷静沈着に分析をし、高度な問題も独創的な創造性でチャンスに変える。戦略的思考を発揮し目標を達成する。' },
];

/* サブ項目ごとの具体的アドバイス */
const SUB_ADVICE = {
  meaning:       '日々の行動に「なぜそれをするのか」を問いかけ、自分の価値観と照らし合わせる習慣をつけましょう。目的意識が明確になると全ての行動の質が変わります。',
  mindfulness:   '1日5分でも静かに自分の感情や思考を観察する時間を設けましょう。「今、自分は何を感じているか」に気づく力が判断力の土台になります。',
  mindshift:     '失敗や困難を「学びの機会」として捉え直す練習をしましょう。「もし逆の立場だったら？」と視点を変えてみることで意識転換力が鍛えられます。',
  mastery:       '一つのスキルに集中して取り組む時間を確保しましょう。毎回「前回よりここを改善する」と小さな目標を持つことで着実に熟達していきます。',
  learning:      '毎日15分の読書や新しい知識のインプットを習慣化しましょう。学んだことを誰かに説明する「アウトプット」が定着の鍵です。',
  logical:       '複雑な問題に直面したら、まず要素を分解して紙に書き出しましょう。「原因→結果」の因果関係を図にすることで論理的思考力が鍛えられます。',
  life:          '学んだ知識を実生活の小さな課題解決に適用してみましょう。「知っている」から「使える」への転換が活用力の本質です。',
  leadership:    'まず身近な場面で「自分から提案する」ことを意識しましょう。相手の話を最後まで聴き、全員が発言できる場を作ることがリーダーシップの第一歩です。',
  critical:      '情報を受け取ったとき「本当にそうか？根拠は？」と問う習慣を持ちましょう。賛成意見と反対意見の両方を調べることで批判的思考力が向上します。',
  creativity:    '日常のルーティンをあえて変えてみましょう。異分野の知識や全く関係のない経験を組み合わせてみることが創造性の源泉です。',
  communication: '伝えたいことを「結論→理由→具体例」の順で整理してから話しましょう。相手が何を知りたいかを先に考えることで伝達力が格段に上がります。',
  collaboration: '意見が異なる人の話を「なぜそう思うのか」まで聴く姿勢を意識しましょう。共通の目標を最初に確認し合うことが効果的な協働の起点です。',
  idea:          '日常の「不便」「違和感」「面白い」をメモする習慣をつけましょう。既存のものを新しい組み合わせで考えることがアイデア発想の基本です。',
  innovation:    '「もっと良くできないか」と現状を疑問視する視点を持ちましょう。小さな改善を繰り返すことが、やがて大きな変革につながります。',
  implementation:'計画を立てたら72時間以内に最初の一歩を踏み出しましょう。完璧を求めず、まず小さく試して改善するサイクルが実装力の核心です。',
  influence:     '言葉だけでなく自分の行動で示すことを意識しましょう。約束を守り、一貫した姿勢を積み重ねることが周囲への影響力の基盤となります。',
};

// 64問版固定: 1-5点×4問 = MAX_SUB=20, MAX_AXIS=80

// デフォルト値（コンポーネント外で使う箇所用）
let MAX_AXIS = 80;
let MAX_SUB = 20;
let MAX_CROSS = MAX_AXIS * MAX_AXIS;
let DISPLAY_CROSS = MAX_CROSS / 2;
const displayDomain = (raw) => Math.round(raw / 2);
const AXIS_COLORS = { mindset: '#2C5F8A', literacy: '#1E7A4A', competency: '#A07A18', impact: '#8B3A28' };

/* ============================================================
 * タイプ判定
 * ============================================================ */
function determineType(scores, analysis) {
  if (analysis?.primary_type) {
    return { name: analysis.primary_type, secondary: analysis.secondary_type || '' };
  }

  const d = (k) => scores[k]?.domainTotal || 0;
  const types = [
    { name: 'VISIONARY', score: Math.round(d('mindset') * d('literacy')) },
    { name: 'CATALYST', score: Math.round(d('mindset') * d('impact')) },
    { name: 'CRAFTER', score: Math.round(d('literacy') * d('competency')) },
    { name: 'STRIKER', score: Math.round(d('impact') * d('competency')) },
  ];
  types.sort((a, b) => b.score - a.score);
  return { name: types[0].name, secondary: types[1].name };
}

/* ============================================================
 * セクションカード（白背景・ライトシャドウ）
 * ============================================================ */
function Section({ children, style = {}, className = '' }) {
  return (
    <div className={`uaam-chart pdf-section ${className}`.trim()} style={{
      background: WHITE,
      borderRadius: 16,
      padding: '28px 24px',
      marginBottom: 20,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      border: `1px solid ${BORDER}`,
      ...style,
    }}>
      {children}
    </div>
  );
}

/* ============================================================
 * セクションヘッダー
 * ============================================================ */
function SectionHeader({ title, subtitle, color = TEXT_PRIMARY }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{
        fontFamily: "'Noto Serif JP', Georgia, serif",
        fontSize: 18, fontWeight: 700, color, margin: 0, letterSpacing: '0.02em',
      }}>{title}</h2>
      {subtitle && (
        <p style={{ fontSize: 13, color: TEXT_SECONDARY, margin: '4px 0 0', fontWeight: 400 }}>{subtitle}</p>
      )}
      <div style={{ width: 40, height: 2, background: color, marginTop: 10, borderRadius: 1, opacity: 0.6 }} />
    </div>
  );
}

/* ============================================================
 * サブ項目 扇形チャート（Canvas）
 * 軸ごとの4サブ項目を扇形で可視化 + クリック展開カード
 * ============================================================ */
/* 45°左回転: 扇の頂点が上、分割線が×パターン */
const SUB_FAN_ANGLES = [
  { startAngle: -3 * Math.PI / 4, endAngle: -Math.PI / 4,     lx: 0,     ly: -0.45 },
  { startAngle: -Math.PI / 4,     endAngle: Math.PI / 4,       lx: 0.45,  ly: 0     },
  { startAngle: Math.PI / 4,      endAngle: 3 * Math.PI / 4,   lx: 0,     ly: 0.45  },
  { startAngle: 3 * Math.PI / 4,  endAngle: 5 * Math.PI / 4,   lx: -0.45, ly: 0     },
];
const SUB_LABEL_DIR = [
  { dx: 0,  dy: -1, align: 'center', base: 'middle' },
  { dx: 1,  dy: 0,  align: 'center', base: 'middle' },
  { dx: 0,  dy: 1,  align: 'center', base: 'middle' },
  { dx: -1, dy: 0,  align: 'center', base: 'middle' },
];

function SubFanChart({ axis, data, order, axisColor }) {
  const canvasRef = useRef(null);
  const [expanded, setExpanded] = useState(null);

  const fans = order.map((subKey, i) => {
    const score = data[i];
    const pct = Math.round((score / MAX_SUB) * 100);
    const r = score / MAX_SUB;
    return { subKey, score, pct, r, ...SUB_FAN_ANGLES[i] };
  });
  const topFan = fans.reduce((a, b) => (a.score > b.score ? a : b));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const DPR = window.devicePixelRatio || 1;
    const S = 380;
    canvas.width = S * DPR;
    canvas.height = S * DPR;
    const ctx = canvas.getContext('2d');
    ctx.scale(DPR, DPR);

    const cx = S / 2, cy = S / 2, R = 110;
    const PI = Math.PI;
    ctx.clearRect(0, 0, S, S);

    /* グリッド円 */
    [0.25, 0.5, 0.75, 1].forEach(p => {
      ctx.beginPath();
      ctx.arc(cx, cy, R * p, 0, PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });

    /* ×軸（斜め分割線） */
    const diag = (R + 20) * Math.SQRT1_2;
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(cx - diag, cy - diag); ctx.lineTo(cx + diag, cy + diag); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + diag, cy - diag); ctx.lineTo(cx - diag, cy + diag); ctx.stroke();

    /* 背景扇形（ゴースト） */
    fans.forEach(f => {
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, f.startAngle, f.endAngle);
      ctx.closePath();
      ctx.fillStyle = axisColor + '12';
      ctx.fill();
    });

    /* スコア扇形 */
    fans.forEach(f => {
      const isTop = f.subKey === topFan.subKey;
      const radius = f.r * R;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, f.startAngle, f.endAngle);
      ctx.closePath();
      ctx.fillStyle = axisColor + (isTop ? '70' : '45');
      ctx.fill();
      ctx.strokeStyle = axisColor;
      ctx.lineWidth = isTop ? 2.5 : 0.5;
      ctx.stroke();
    });

    /* 中心点 */
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();

    /* サブ名ラベル（十字方向） — 全方向 center 揃え */
    const margin = R + 28;
    fans.forEach((f, i) => {
      const lp = SUB_LABEL_DIR[i];
      const isTop = f.subKey === topFan.subKey;
      ctx.font = `${isTop ? '600' : '400'} 13px sans-serif`;
      ctx.fillStyle = isTop ? axisColor : 'rgba(0,0,0,0.55)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(SUB_JP[f.subKey], cx + lp.dx * margin, cy + lp.dy * margin);
    });

    /* 象限内スコア表示 */
    fans.forEach(f => {
      const isTop = f.subKey === topFan.subKey;
      const lx = cx + f.lx * R;
      const ly = cy + f.ly * R;

      ctx.font = `${isTop ? '600' : '400'} 12px sans-serif`;
      ctx.fillStyle = isTop ? axisColor : 'rgba(0,0,0,0.35)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.score + '/' + MAX_SUB, lx, ly);

      ctx.font = '10px sans-serif';
      ctx.fillStyle = isTop ? axisColor : 'rgba(0,0,0,0.25)';
      ctx.fillText(f.pct + '%', lx, ly + 14);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, axisColor]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <canvas ref={canvasRef} style={{ width: '100%', maxWidth: 340, aspectRatio: '1' }} />

      {/* サブ項目カード（タップ展開） */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%' }}>
        {fans.map(f => {
          const isTop = f.subKey === topFan.subKey;
          const isOpen = expanded === f.subKey;
          return (
            <div key={f.subKey}
              onClick={() => setExpanded(isOpen ? null : f.subKey)}
              style={{
                background: isTop ? `${axisColor}0A` : '#FAFAF8',
                border: `1px solid ${isTop ? axisColor + '40' : BORDER}`,
                borderRadius: 10, padding: '12px 14px',
                cursor: 'pointer', transition: 'all 0.2s',
              }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6,
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: isTop ? axisColor : TEXT_PRIMARY }}>
                  {SUB_JP[f.subKey]}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isTop && (
                    <span style={{
                      fontSize: 9, color: WHITE, fontWeight: 700,
                      background: axisColor, padding: '2px 8px', borderRadius: 10,
                    }}>TOP</span>
                  )}
                  <span style={{ fontSize: 10, color: TEXT_MUTED }}>{isOpen ? '▲' : '▼'}</span>
                </div>
              </div>
              <div style={{
                fontSize: 18, fontWeight: 800, color: axisColor, marginBottom: 4,
                fontFamily: NUM_FONT,
              }}>
                {f.pct}<span style={{ fontSize: 12, fontWeight: 500 }}>%</span>
                <span style={{ fontSize: 11, fontWeight: 400, color: TEXT_MUTED, marginLeft: 6 }}>
                  ({f.score}/{MAX_SUB})
                </span>
              </div>
              <div style={{ height: 4, background: '#EDEAE4', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${f.pct}%`, background: axisColor, borderRadius: 2,
                }} />
              </div>
              {isOpen && (
                <div style={{
                  marginTop: 10, paddingTop: 10,
                  borderTop: `1px solid ${axisColor}20`,
                }}>
                  <div style={{
                    fontSize: 11, color: TEXT_MUTED, marginBottom: 4,
                  }}>{SUB_LABELS[f.subKey]}</div>
                  <p style={{
                    fontSize: 12, color: TEXT_SECONDARY, margin: 0,
                    lineHeight: 1.8,
                  }}>{SUB_ADVICE[f.subKey]}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
 * 総合スコア 扇形チャート（Canvas 4色）
 * 志知技衝 4軸を各色で扇形表示 + クリック展開カード
 * ============================================================ */
function MainFanChart({ scores }) {
  const canvasRef = useRef(null);
  const [expanded, setExpanded] = useState(null);

  const MAIN_FANS = [
    { key: 'mindset',    kanji: '志', en: 'WHY',   color: AXIS_COLORS.mindset },
    { key: 'literacy',   kanji: '知', en: 'THINK', color: AXIS_COLORS.literacy },
    { key: 'competency', kanji: '技', en: 'HOW',   color: AXIS_COLORS.competency },
    { key: 'impact',     kanji: '衝', en: 'ACT',   color: AXIS_COLORS.impact },
  ];

  const fans = MAIN_FANS.map((mf, i) => {
    const score = scores[mf.key]?.total || 0;
    const pct = Math.round((score / MAX_AXIS) * 100);
    const r = score / MAX_AXIS;
    return { ...mf, score, pct, r, ...SUB_FAN_ANGLES[i] };
  });
  const topFan = fans.reduce((a, b) => (a.score > b.score ? a : b));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const DPR = window.devicePixelRatio || 1;
    const S = 360;
    canvas.width = S * DPR;
    canvas.height = S * DPR;
    const ctx = canvas.getContext('2d');
    ctx.scale(DPR, DPR);

    const cx = S / 2, cy = S / 2, R = 110;
    const PI = Math.PI;
    ctx.clearRect(0, 0, S, S);

    /* グリッド円 */
    [0.25, 0.5, 0.75, 1].forEach(p => {
      ctx.beginPath();
      ctx.arc(cx, cy, R * p, 0, PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });

    /* ×軸（斜め分割線） */
    const diag = (R + 20) * Math.SQRT1_2;
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(cx - diag, cy - diag); ctx.lineTo(cx + diag, cy + diag); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + diag, cy - diag); ctx.lineTo(cx - diag, cy + diag); ctx.stroke();

    /* 背景扇形（ゴースト）— 各色 */
    fans.forEach(f => {
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, f.startAngle, f.endAngle);
      ctx.closePath();
      ctx.fillStyle = f.color + '12';
      ctx.fill();
    });

    /* スコア扇形 — 各色 */
    fans.forEach(f => {
      const isTop = f.key === topFan.key;
      const radius = f.r * R;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, f.startAngle, f.endAngle);
      ctx.closePath();
      ctx.fillStyle = f.color + (isTop ? '70' : '45');
      ctx.fill();
      ctx.strokeStyle = f.color;
      ctx.lineWidth = isTop ? 2.5 : 0.5;
      ctx.stroke();
    });

    /* 中心点 */
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();

    /* 軸ラベル（漢字 + English） */
    const margin = R + 30;
    fans.forEach((f, i) => {
      const lp = SUB_LABEL_DIR[i];
      const bx = cx + lp.dx * margin;
      const by = cy + lp.dy * margin;

      /* 漢字 */
      ctx.font = '700 18px sans-serif';
      ctx.fillStyle = f.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.kanji, bx, by - 7);

      /* English */
      ctx.font = '500 9px sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillText(f.en, bx, by + 7);
    });

    /* 象限内スコア */
    fans.forEach(f => {
      const isTop = f.key === topFan.key;
      const lx = cx + f.lx * R;
      const ly = cy + f.ly * R;

      ctx.font = `${isTop ? '700' : '400'} 14px sans-serif`;
      ctx.fillStyle = isTop ? f.color : 'rgba(0,0,0,0.35)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.score + '/' + MAX_AXIS, lx, ly);

      ctx.font = '10px sans-serif';
      ctx.fillStyle = isTop ? f.color : 'rgba(0,0,0,0.25)';
      ctx.fillText(f.pct + '%', lx, ly + 15);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <canvas ref={canvasRef} style={{ width: '100%', maxWidth: 340, aspectRatio: '1' }} />

      {/* 軸スコアカード（タップ展開） */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%' }}>
        {fans.map(f => {
          const isTop = f.key === topFan.key;
          const isOpen = expanded === f.key;
          const axisInfo = UAAM_AXES.find(a => a.key === f.key);
          return (
            <div key={f.key}
              onClick={() => setExpanded(isOpen ? null : f.key)}
              style={{
                background: isTop ? `${f.color}0A` : '#FAFAF8',
                border: `1px solid ${isTop ? f.color + '40' : BORDER}`,
                borderRadius: 10, padding: '12px 14px',
                cursor: 'pointer', transition: 'all 0.2s',
              }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6,
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: f.color }}>
                  {f.kanji}<span style={{ fontSize: 11, fontWeight: 500, color: TEXT_MUTED, marginLeft: 4 }}>{axisInfo?.english}</span>
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isTop && (
                    <span style={{
                      fontSize: 9, color: WHITE, fontWeight: 700,
                      background: f.color, padding: '2px 8px', borderRadius: 10,
                    }}>TOP</span>
                  )}
                  <span style={{ fontSize: 10, color: TEXT_MUTED }}>{isOpen ? '▲' : '▼'}</span>
                </div>
              </div>
              <div style={{
                fontSize: 18, fontWeight: 800, color: f.color, marginBottom: 4,
                fontFamily: NUM_FONT,
              }}>
                {f.pct}<span style={{ fontSize: 12, fontWeight: 500 }}>%</span>
                <span style={{ fontSize: 11, fontWeight: 400, color: TEXT_MUTED, marginLeft: 6 }}>
                  ({f.score}/{MAX_AXIS})
                </span>
              </div>
              <div style={{ height: 4, background: '#EDEAE4', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${f.pct}%`, background: f.color, borderRadius: 2,
                }} />
              </div>
              {isOpen && (
                <div style={{
                  marginTop: 10, paddingTop: 10,
                  borderTop: `1px solid ${f.color}20`,
                }}>
                  <div style={{
                    fontSize: 11, color: TEXT_MUTED, marginBottom: 4,
                  }}>{f.en}</div>
                  <p style={{
                    fontSize: 12, color: TEXT_SECONDARY, margin: 0,
                    lineHeight: 1.8,
                  }}>{axisInfo?.description}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
 * FourAxisGrid — 志/知/技/衝 × 2×2 ミニレーダー
 * ============================================================ */
const FOUR_AXES = [
  { key: 'mindset',    jp: '志', en: 'MindSet',   color: '#2C5F8A',
    desc: 'なぜ生き、どこへ向かうのかを定める、存在の軸。',
    subs: ['meaning','mindfulness','mindshift','mastery'],
    subJp: ['基軸力','認知力','転換力','熟達力'] },
  { key: 'competency', jp: '技', en: 'Competency', color: '#A07A18',
    desc: '志と知を現実に体現し、価値へ変える実践の力。',
    subs: ['critical','creativity','communication','collaboration'],
    subJp: ['本質力','創造力','伝達力','協働力'] },
  { key: 'literacy',   jp: '知', en: 'Literacy',   color: '#1E7A4A',
    desc: '物事の本質と構造を見抜き、知恵へ昇華する力。',
    subs: ['learning','logical','life','leadership'],
    subJp: ['謙学力','論理力','活用力','統率力'] },
  { key: 'impact',     jp: '衝', en: 'Impact',     color: '#C0614A',
    desc: '内なる力を集中させ、変化を広げる推進の力。',
    subs: ['idea','innovation','implementation','influence'],
    subJp: ['構想力','変革力','実装力','影響力'] },
];

/* ---------- 扇形セクター path ヘルパー ---------- */
function sectorPath(cx, cy, r, startDeg, endDeg) {
  const s = startDeg * Math.PI / 180;
  const e = endDeg   * Math.PI / 180;
  const x1 = +(cx + r * Math.cos(s)).toFixed(2);
  const y1 = +(cy + r * Math.sin(s)).toFixed(2);
  const x2 = +(cx + r * Math.cos(e)).toFixed(2);
  const y2 = +(cy + r * Math.sin(e)).toFixed(2);
  const large = (endDeg - startDeg > 180) ? 1 : 0;
  return `M${cx},${cy} L${x1},${y1} A${r},${r},0,${large},1,${x2},${y2} Z`;
}

function MiniRadar({ axis, scores }) {
  const rawScores = axis.subs.map(sub => scores?.[axis.key]?.subs?.[sub] ?? 0);
  const maxSub = 20;
  const total   = rawScores.reduce((a, b) => a + b, 0);
  const maxTotal = maxSub * 4;
  const pct      = Math.round((total / maxTotal) * 100);
  const maxScore = Math.max(...rawScores, 1);
  const topIdx   = rawScores.indexOf(maxScore); // ラベル用（先頭1つ）
  const isTopScore = (i) => rawScores[i] === maxScore; // 同点複数対応

  const S = 210, cx = S / 2, cy = S / 2, R = 76;

  // 4扇形（各90°、時計回り）— 45°左回転済み
  // i=0:N(-135°→-45°)  i=1:E(-45°→45°)  i=2:S(45°→135°)  i=3:W(135°→225°)
  const SECTORS = [
    { start: -135, end:  -45 },
    { start:  -45, end:   45 },
    { start:   45, end:  135 },
    { start:  135, end:  225 },
  ];

  // 仕切り線: 45°左回転済み (NW,NE,SE,SW)
  const CARD_DEG = [-135, -45, 45, 135];
  // 外周ラベル: 12時=top(-90), 3時=right(0), 6時=bottom(90), 9時=left(180)
  const LABEL_DEG = [-90, 0, 90, 180];
  const LP = R + 20;

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: 16,
      border: `1px solid ${axis.color}28`,
      padding: '14px 14px 10px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      boxShadow: `0 2px 14px ${axis.color}16`,
    }}>
      {/* ── ヘッダー ── */}
      <div style={{ width: '100%', marginBottom: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div style={{ lineHeight: 1 }}>
            <span style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 22, fontWeight: 800, color: axis.color }}>{axis.jp}</span>
            <span style={{ fontSize: 12, fontWeight: 500, marginLeft: 7, opacity: 0.55, color: axis.color, letterSpacing: '0.04em' }}>{axis.en}</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: axis.color, fontFamily: "'Outfit', sans-serif", lineHeight: 1 }}>
            {pct}<span style={{ fontSize: 12, fontWeight: 400, opacity: 0.55 }}>%</span>
          </div>
        </div>
        {/* 軸説明文 */}
        <div style={{ fontSize: 11, color: axis.color, opacity: 0.70, marginTop: 3, lineHeight: 1.5 }}>
          {axis.desc}
        </div>
        {/* スコアバー */}
        <div style={{ height: 4, background: axis.color + '18', borderRadius: 2, marginTop: 7, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${axis.color}70, ${axis.color})`, borderRadius: 2 }} />
        </div>
        <div style={{ fontSize: 10, color: axis.color, opacity: 0.48, textAlign: 'right', marginTop: 3, fontFamily: "'Outfit', sans-serif" }}>
          {total} / {maxTotal}
        </div>
      </div>

      {/* ── SVG扇形チャート（viewBox レスポンシブ） ── */}
      <svg viewBox={`0 0 ${S} ${S}`} width="100%" style={{ overflow: 'visible', display: 'block' }}>
        {/* 同心円グリッド */}
        {[0.33, 0.66, 1].map(r => (
          <circle key={r} cx={cx} cy={cy} r={R * r}
            fill="none"
            stroke={r === 1 ? axis.color + '28' : 'rgba(0,0,0,0.07)'}
            strokeWidth={r === 1 ? 1 : 0.5}
            strokeDasharray={r < 1 ? '2 3' : 'none'} />
        ))}

        {/* 背景扇形（全半径・薄色） */}
        {SECTORS.map((s, i) => (
          <path key={i} d={sectorPath(cx, cy, R, s.start, s.end)}
            fill={axis.color} fillOpacity={0.07} />
        ))}

        {/* スコア扇形 */}
        {SECTORS.map((s, i) => {
          const r = Math.max(6, (rawScores[i] / maxSub) * R);
          const top = isTopScore(i);
          const baseOpa = 0.38 + (rawScores[i] / maxSub) * 0.28;
          return (
            <path key={i} d={sectorPath(cx, cy, r, s.start, s.end)}
              fill={axis.color} fillOpacity={top ? 0.80 : baseOpa} />
          );
        })}

        {/* 区切り白線（扇形の上に重ねる） */}
        {CARD_DEG.map((deg, i) => {
          const rad = deg * Math.PI / 180;
          return <line key={i}
            x1={cx} y1={cy}
            x2={+(cx + R * Math.cos(rad)).toFixed(2)}
            y2={+(cy + R * Math.sin(rad)).toFixed(2)}
            stroke="rgba(255,255,255,0.88)" strokeWidth={2} />;
        })}

        {/* スコアテキスト（扇形内部） */}
        {SECTORS.map((s, i) => {
          const mid = ((s.start + s.end) / 2) * Math.PI / 180;
          const top = isTopScore(i);
          const textR = R * 0.56;
          const tx = +(cx + textR * Math.cos(mid)).toFixed(2);
          const ty = +(cy + textR * Math.sin(mid)).toFixed(2);
          const fill = top ? '#FFFFFF' : axis.color;
          const opa  = top ? 1 : 0.85;
          return (
            <g key={i}>
              <text x={tx} y={ty - 7} textAnchor="middle" dominantBaseline="middle"
                fontSize={11} fontWeight={700} fill={fill} fillOpacity={opa}
                fontFamily="'Outfit', sans-serif">
                {rawScores[i]}/20
              </text>
              <text x={tx} y={ty + 7} textAnchor="middle" dominantBaseline="middle"
                fontSize={10} fontWeight={500} fill={fill} fillOpacity={opa * 0.85}>
                {Math.round((rawScores[i] / maxSub) * 100)}%
              </text>
            </g>
          );
        })}

        {/* 外周ラベル: 12/3/6/9 o'clock配置 */}
        {LABEL_DEG.map((deg, i) => {
          const rad = deg * Math.PI / 180;
          const lx = +(cx + LP * Math.cos(rad)).toFixed(2);
          const ly = +(cy + LP * Math.sin(rad)).toFixed(2);
          const top = isTopScore(i);
          return (
            <text key={i} x={lx} y={ly}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={11} fontWeight={top ? 700 : 500}
              fill={top ? axis.color : axis.color + 'AA'}>
              {axis.subJp[i]}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function FourAxisGrid({ scores }) {
  return (
    <div className="uaam-chart pdf-section" style={{
      background: '#FFFFFF', borderRadius: 16,
      padding: '24px 20px', marginBottom: 20,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      border: '1px solid #E8E0D4',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {FOUR_AXES.map(axis => (
          <MiniRadar key={axis.key} axis={axis} scores={scores} />
        ))}
      </div>
    </div>
  );
}

/* ============================================================
 * 才覚発動領域チャート（Canvas 扇形）
 * 参照: SaikkakuActivityDomain.jsx — GRIFFON_CODE_v5 準拠
 *
 * 軸配置: 上→志, 右→知, 下→技, 左→衝
 * 象限:   右上→構想力(志×知), 右下→実装力(知×技),
 *         左下→変革力(衝×技), 左上→統率力(志×衝)
 * スコア: 領域 = 軸A × 軸B（最大3600）→ 表示÷2（最大1800）
 * ============================================================ */
function ActivityDomainChart({ scores }) {
  const canvasRef = useRef(null);
  const [expanded, setExpanded] = useState(null);
  const d = (k) => scores[k]?.domainTotal || 0;

  /* 扇形定義 ─ 45°左回転（×パターン）*/
  const FAN_DEFS = [
    { key: 'vision',     label: '構想力', formula: '志 × 知', axes: ['mindset', 'literacy'],
      startAngle: -3 * Math.PI / 4, endAngle: -Math.PI / 4, color: '#3D7A7A', lx: 0,     ly: -0.45 },
    { key: 'execution',  label: '実装力', formula: '知 × 技', axes: ['literacy', 'competency'],
      startAngle: -Math.PI / 4,     endAngle: Math.PI / 4,  color: '#7A8A2E', lx: 0.45,  ly: 0     },
    { key: 'revolution', label: '変革力', formula: '衝 × 技', axes: ['impact', 'competency'],
      startAngle: Math.PI / 4,      endAngle: 3 * Math.PI / 4, color: '#B5622E', lx: 0,  ly: 0.45  },
    { key: 'command',    label: '統率力', formula: '志 × 衝', axes: ['mindset', 'impact'],
      startAngle: 3 * Math.PI / 4,  endAngle: 5 * Math.PI / 4, color: '#6B4C8A', lx: -0.45, ly: 0  },
  ];

  const AXIS_LABEL_POS = [
    { kanji: '志', en: 'WHY',   dx: -0.707, dy: -0.707, align: 'right',  base: 'bottom', color: AXIS_COLORS.mindset },
    { kanji: '知', en: 'THINK', dx:  0.707, dy: -0.707, align: 'left',   base: 'bottom', color: AXIS_COLORS.literacy },
    { kanji: '技', en: 'HOW',   dx:  0.707, dy:  0.707, align: 'left',   base: 'top',    color: AXIS_COLORS.competency },
    { kanji: '衝', en: 'ACT',   dx: -0.707, dy:  0.707, align: 'right',  base: 'top',    color: AXIS_COLORS.impact },
  ];

  /* ---- 領域スコア計算 ---- */
  const domainResults = FAN_DEFS.map(fd => {
    const a = d(fd.axes[0]);
    const b = d(fd.axes[1]);
    const raw = Math.round(a * b);
    const pct = Math.round((raw / MAX_CROSS) * 100);
    const r = ((a / MAX_AXIS) + (b / MAX_AXIS)) / 2;       // 扇形の半径比率
    const disp = displayDomain(raw);                        // ÷2 表示
    return { ...fd, raw, pct, r, disp };
  });
  const topDomain = domainResults.reduce((a, b) => (a.raw > b.raw ? a : b));
  const sorted = [...domainResults].sort((a, b) => b.raw - a.raw);

  /* ---- Canvas 描画 ---- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const DPR = window.devicePixelRatio || 1;
    const S = 300;
    canvas.width  = S * DPR;
    canvas.height = S * DPR;
    const ctx = canvas.getContext('2d');
    ctx.scale(DPR, DPR);

    const cx = S / 2, cy = S / 2, R = 110;
    const PI = Math.PI;
    ctx.clearRect(0, 0, S, S);

    /* グリッド円 */
    [0.25, 0.5, 0.75, 1].forEach(p => {
      ctx.beginPath();
      ctx.arc(cx, cy, R * p, 0, PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });

    /* ×軸（45°回転） */
    const D = (R + 20) * 0.707;
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(cx - D, cy - D); ctx.lineTo(cx + D, cy + D); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + D, cy - D); ctx.lineTo(cx - D, cy + D); ctx.stroke();

    /* 背景扇形（ゴースト） */
    domainResults.forEach(fd => {
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, fd.startAngle, fd.endAngle);
      ctx.closePath();
      ctx.fillStyle = fd.color + '12';
      ctx.fill();
    });

    /* スコア扇形 */
    domainResults.forEach(fd => {
      const isTop = fd.key === topDomain.key;
      const radius = fd.r * R;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, fd.startAngle, fd.endAngle);
      ctx.closePath();
      ctx.fillStyle = fd.color + (isTop ? '70' : '45');
      ctx.fill();
      ctx.strokeStyle = fd.color;
      ctx.lineWidth = isTop ? 2.5 : 0.5;
      ctx.stroke();
    });

    /* 中心点 */
    ctx.beginPath(); ctx.arc(cx, cy, 3, 0, PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();

    /* 軸ラベル（志知技衝） */
    const margin = R + 24;
    AXIS_LABEL_POS.forEach(l => {
      ctx.font = '600 15px sans-serif';
      ctx.fillStyle = l.color;
      ctx.textAlign = l.align;
      ctx.textBaseline = l.base;
      ctx.fillText(l.kanji, cx + l.dx * margin, cy + l.dy * margin);
    });

    /* 領域ラベル（各象限中央） */
    domainResults.forEach(fd => {
      const isTop = fd.key === topDomain.key;
      const lx = cx + fd.lx * R;
      const ly = cy + fd.ly * R;

      ctx.font = `${isTop ? '600' : '400'} 12px sans-serif`;
      ctx.fillStyle = isTop ? fd.color : 'rgba(0,0,0,0.4)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fd.label, lx, ly);

      ctx.font = '11px sans-serif';
      ctx.fillStyle = isTop ? fd.color : 'rgba(0,0,0,0.28)';
      ctx.fillText(fd.pct + '%', lx, ly + 15);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores]);

  /* ---- JSX ---- */
  return (
    <Section>
      <SectionHeader title="才覚発動領域マトリクス" subtitle="Unique Ability Activation Matrix" />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        {/* Canvas グラフ */}
        <canvas ref={canvasRef} style={{ width: 300, height: 300 }} />

        {/* 最確活動領域カード */}
        {(() => {
          const qd = QUADRANT_DEFS.find(q => q.key === topDomain.key);
          return (
            <div style={{
              width: '100%', borderRadius: 14, overflow: 'hidden',
              border: `2px solid ${topDomain.color}40`,
              background: `linear-gradient(135deg, ${topDomain.color}0C 0%, ${topDomain.color}18 100%)`,
            }}>
              {/* 上部アクセントライン */}
              <div style={{
                height: 4,
                background: `linear-gradient(90deg, ${topDomain.color}80, ${topDomain.color}, ${topDomain.color}80)`,
              }} />
              <div style={{ padding: '18px 20px' }}>
                {/* ラベル行 */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                }}>
                  <span style={{
                    fontSize: 9, color: WHITE, fontWeight: 700, letterSpacing: '0.08em',
                    background: topDomain.color, padding: '3px 10px', borderRadius: 10,
                    textTransform: 'uppercase',
                  }}>最確活動領域</span>
                </div>
                {/* メイン表示 */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{
                      fontFamily: "'Noto Serif JP', Georgia, serif",
                      fontSize: 26, fontWeight: 900, color: topDomain.color,
                      letterSpacing: '0.04em', lineHeight: 1.2,
                    }}>{topDomain.label}</div>
                    <div style={{
                      fontSize: 11, color: topDomain.color, opacity: 0.7,
                      fontWeight: 600, marginTop: 2, letterSpacing: '0.06em',
                    }}>{qd?.english || ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: 30, fontWeight: 900, color: topDomain.color,
                      fontFamily: NUM_FONT, lineHeight: 1,
                    }}>
                      {topDomain.pct}<span style={{ fontSize: 14, fontWeight: 500 }}>%</span>
                    </div>
                    <div style={{
                      fontSize: 11, color: TEXT_MUTED, fontFamily: NUM_FONT, marginTop: 2,
                    }}>
                      {topDomain.disp} / {DISPLAY_CROSS}
                    </div>
                  </div>
                </div>
                {/* スコアバー */}
                <div style={{
                  height: 6, background: topDomain.color + '18',
                  borderRadius: 3, overflow: 'hidden', marginTop: 12,
                }}>
                  <div style={{
                    height: '100%', width: `${topDomain.pct}%`,
                    background: `linear-gradient(90deg, ${topDomain.color}90, ${topDomain.color})`,
                    borderRadius: 3,
                    transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
                  }} />
                </div>
                {/* 計算式 + 説明 */}
                <div style={{
                  marginTop: 12, paddingTop: 10,
                  borderTop: `1px solid ${topDomain.color}20`,
                }}>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: topDomain.color, opacity: 0.65,
                    fontFamily: "'Noto Serif JP', serif", marginBottom: 4,
                  }}>{topDomain.formula}</div>
                  <p style={{
                    fontSize: 12, color: TEXT_SECONDARY, margin: 0,
                    lineHeight: 1.8,
                  }}>{qd?.desc}</p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 領域スコアカード（タップで展開） */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%' }}>
          {sorted.map(fd => {
            const isTop = fd.key === topDomain.key;
            const isOpen = expanded === fd.key;
            const qd = QUADRANT_DEFS.find(q => q.key === fd.key);
            return (
              <div key={fd.key}
                onClick={() => setExpanded(isOpen ? null : fd.key)}
                style={{
                  background: isTop ? `${fd.color}0A` : '#FAFAF8',
                  border: `1px solid ${isTop ? fd.color + '40' : BORDER}`,
                  borderRadius: 10, padding: '12px 14px',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}>
                {/* ヘッダー行 */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6,
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: fd.color }}>
                      {fd.label}
                    </div>
                    <div style={{
                      fontSize: 9, color: fd.color, fontWeight: 500, opacity: 0.65,
                      marginTop: 1, letterSpacing: '0.04em',
                    }}>{qd?.english}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isTop && (
                      <span style={{
                        fontSize: 9, color: WHITE, fontWeight: 700,
                        background: fd.color, padding: '2px 8px', borderRadius: 10,
                      }}>TOP</span>
                    )}
                    <span style={{ fontSize: 10, color: TEXT_MUTED }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </div>
                {/* スコア */}
                <div style={{
                  fontSize: 18, fontWeight: 800, color: fd.color, marginBottom: 4,
                  fontFamily: NUM_FONT,
                }}>
                  {fd.pct}<span style={{ fontSize: 12, fontWeight: 500 }}>%</span>
                  <span style={{ fontSize: 11, fontWeight: 400, color: TEXT_MUTED, marginLeft: 6 }}>
                    ({fd.disp}/{DISPLAY_CROSS})
                  </span>
                </div>
                {/* ミニバー */}
                <div style={{ height: 4, background: '#EDEAE4', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${fd.pct}%`, background: fd.color, borderRadius: 2,
                  }} />
                </div>
                {/* 展開時: 説明文 + 弱点アドバイス */}
                {isOpen && (() => {
                  const allSubs = fd.axes.flatMap(axKey =>
                    SUB_ORDER[axKey].map(subKey => ({
                      subKey,
                      label: SUB_JP[subKey],
                      score: scores[axKey]?.subs?.[subKey] || 0,
                    }))
                  );
                  allSubs.sort((a, b) => a.score - b.score);
                  const weakest = allSubs.slice(0, 2);

                  return (
                    <div style={{
                      marginTop: 10, paddingTop: 10,
                      borderTop: `1px solid ${fd.color}20`,
                    }}>
                      <div style={{
                        fontSize: 11, color: TEXT_MUTED, marginBottom: 4,
                        fontFamily: "'Noto Serif JP', serif",
                      }}>{fd.formula}</div>
                      <p style={{
                        fontSize: 13, color: TEXT_SECONDARY, margin: '0 0 12px',
                        lineHeight: 1.8,
                      }}>{qd?.desc}</p>
                      {/* 弱点ピックアップ + アドバイス */}
                      {weakest.map(w => (
                        <div key={w.subKey} style={{
                          background: `${fd.color}08`, borderRadius: 8,
                          padding: '10px 12px', border: `1px solid ${fd.color}15`,
                          marginBottom: 8,
                        }}>
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            marginBottom: 6,
                          }}>
                            <span style={{
                              fontSize: 12, fontWeight: 700, color: fd.color,
                            }}>{w.label}</span>
                            <span style={{
                              fontSize: 12, fontWeight: 800, color: fd.color,
                              fontFamily: NUM_FONT,
                            }}>{w.score}<span style={{ fontSize: 10, fontWeight: 400, color: TEXT_MUTED }}>/{MAX_SUB}</span></span>
                          </div>
                          <p style={{
                            fontSize: 12, color: TEXT_SECONDARY, margin: 0,
                            lineHeight: 1.8,
                          }}>{SUB_ADVICE[w.subKey]}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>

        {/* 説明文 */}
        <div style={{
          fontSize: 11, color: TEXT_MUTED, textAlign: 'center',
          maxWidth: 300, lineHeight: 1.7,
        }}>
          象限の広がりがあなたの才覚発動の現在地を示します。<br />
          面積が大きいほど領域が実際に発動しています。
        </div>
      </div>
    </Section>
  );
}

/* ============================================================
 * 16軸レーダーチャート（才覚発動領域マトリクス連動）
 * — 世界最高峰UI —
 * ============================================================ */
function RadarChart16({ scores }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !scores) return;
    const dpr = window.devicePixelRatio || 1;
    const LOGICAL_W = 800;
    const LOGICAL_H = 800;
    canvas.width = LOGICAL_W * dpr;
    canvas.height = LOGICAL_H * dpr;
    canvas.style.width = '100%';
    canvas.style.maxWidth = LOGICAL_W + 'px';
    canvas.style.height = 'auto';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const W = LOGICAL_W;
    const H = LOGICAL_H;
    const cx = W / 2;
    const cy = H / 2;
    const R = 260;

    const axes = [
      { key: 'meaning',       jp: '基軸力',  en: 'Meaning',        group: 'mindset' },
      { key: 'mindfulness',   jp: '認知力',  en: 'Mindfulness',    group: 'mindset' },
      { key: 'mindshift',     jp: '転換力',  en: 'Mindshift',      group: 'mindset' },
      { key: 'mastery',       jp: '熟達力',  en: 'Mastery',        group: 'mindset' },
      { key: 'learning',      jp: '謙学力',  en: 'Learning',       group: 'literacy' },
      { key: 'logical',       jp: '論理力',  en: 'Logical',        group: 'literacy' },
      { key: 'life',          jp: '活用力',  en: 'Life',           group: 'literacy' },
      { key: 'leadership',    jp: '統率力',  en: 'Leadership',     group: 'literacy' },
      { key: 'critical',      jp: '本質力',  en: 'Critical',       group: 'competency' },
      { key: 'creativity',    jp: '創造力',  en: 'Creativity',     group: 'competency' },
      { key: 'communication', jp: '伝達力',  en: 'Communication',  group: 'competency' },
      { key: 'collaboration', jp: '協働力',  en: 'Collaboration',  group: 'competency' },
      { key: 'idea',          jp: '構想力',  en: 'Idea',           group: 'impact' },
      { key: 'innovation',    jp: '変革力',  en: 'Innovation',     group: 'impact' },
      { key: 'implementation',jp: '実装力',  en: 'Implementation', group: 'impact' },
      { key: 'influence',     jp: '影響力',  en: 'Influence',      group: 'impact' },
    ];

    const GC = {
      mindset:    { fill: 'rgba(91,155,213,0.35)',  stroke: '#5B9BD5', glow: 'rgba(91,155,213,0.6)' },
      literacy:   { fill: 'rgba(61,170,109,0.35)',  stroke: '#3DAA6D', glow: 'rgba(61,170,109,0.6)' },
      competency: { fill: 'rgba(212,170,80,0.35)',  stroke: '#D4AA50', glow: 'rgba(212,170,80,0.6)' },
      impact:     { fill: 'rgba(212,106,80,0.35)',  stroke: '#D46A50', glow: 'rgba(212,106,80,0.6)' },
    };

    const data = axes.map(a => (scores[a.group]?.subs?.[a.key]) || 0);
    const n = 16;
    // === 花びら型レーダー角度設定 ===
    const subStep   = 20 * Math.PI / 180;   // グループ内スポーク間隔 20°
    const gapAngle  = 30 * Math.PI / 180;   // グループ間ギャップ 30°
    const petalStart = -Math.PI / 2 - 1.5 * subStep; // 最初のスポーク開始角

    const getAngle = (i) => {
      const g = Math.floor(i / 4);
      const p = i % 4;
      return petalStart + g * (3 * subStep + gapAngle) + p * subStep;
    };

    const getPoint = (i, val) => {
      const angle = getAngle(i);
      const r = (val / MAX_SUB) * R;
      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    };

    // === 背景クリア ===
    ctx.clearRect(0, 0, W, H);

    // === 背景放射グラデーション ===
    const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R + 100);
    bgGrad.addColorStop(0, 'rgba(20,20,30,0.6)');
    bgGrad.addColorStop(1, 'rgba(5,5,10,0)');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // === グリッド（5段階 3,6,9,12,15）花びら型：グループごとに独立弧 ===
    [3, 6, 9, 12, 15].forEach((v, vi) => {
      for (let gi = 0; gi < 4; gi++) {
        ctx.beginPath();
        for (let j = 0; j < 4; j++) {
          const p = getPoint(gi * 4 + j, v);
          j === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        if (vi === 4) {
          ctx.strokeStyle = 'rgba(255,215,0,0.25)';
          ctx.lineWidth = 1.8;
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = `rgba(255,255,255,${0.04 + vi * 0.02})`;
          ctx.lineWidth = 0.7;
          ctx.setLineDash(vi % 2 === 0 ? [4, 6] : []);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // グリッド数値（右上に小さく表示）
      if (vi > 0) {
        const gp = getPoint(1, v);
        ctx.save();
        ctx.font = '9px "SF Mono", monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.textAlign = 'left';
        ctx.fillText(v + '', gp.x + 4, gp.y - 2);
        ctx.restore();
      }
    });

    // === 軸線 ===
    for (let i = 0; i < n; i++) {
      const p = getPoint(i, MAX_SUB);
      const grp = axes[i].group;
      const grad = ctx.createLinearGradient(cx, cy, p.x, p.y);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, `${GC[grp].stroke}15`);
      grad.addColorStop(1, `${GC[grp].stroke}40`);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // === 扇形セクション背景（グループ領域を明確化）===
    const groupOrder = ['mindset', 'literacy', 'competency', 'impact'];
    groupOrder.forEach((grp, gi) => {
      const a1 = getAngle(gi * 4) - subStep * 0.5;
      const a2 = getAngle(gi * 4 + 3) + subStep * 0.5;

      // ① グラデーション扇形フィル
      const secGrad = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R);
      secGrad.addColorStop(0,   `${GC[grp].stroke}00`);
      secGrad.addColorStop(0.5, `${GC[grp].stroke}10`);
      secGrad.addColorStop(1,   `${GC[grp].stroke}22`);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a1, a2);
      ctx.closePath();
      ctx.fillStyle = secGrad;
      ctx.fill();

      // ② 外周アーク（色付き帯）
      ctx.beginPath();
      ctx.arc(cx, cy, R + 6, a1 + 0.04, a2 - 0.04);
      ctx.strokeStyle = `${GC[grp].stroke}55`;
      ctx.lineWidth = 5;
      ctx.stroke();

      // ③ セクター境界線（中心→外）
      [a1, a2].forEach(angle => {
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + (R + 10) * Math.cos(angle), cy + (R + 10) * Math.sin(angle));
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    });

    // === データ塗りつぶし（全16軸をつなぐ一体型）===
    // まず全体を一つのポリゴンで薄く描画
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const p = getPoint(i, data[i]);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    const allGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    allGrad.addColorStop(0, 'rgba(255,255,255,0.05)');
    allGrad.addColorStop(1, 'rgba(255,255,255,0.02)');
    ctx.fillStyle = allGrad;
    ctx.fill();

    // グループ別カラー塗りつぶし（扇形マスクではなくグループ頂点を結ぶ）
    groupOrder.forEach((grp, gi) => {
      const startIdx = gi * 4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let j = 0; j < 4; j++) {
        const idx = startIdx + j;
        const p = getPoint(idx, data[idx]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();

      // グラデーション塗り
      const gradFill = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      gradFill.addColorStop(0, `${GC[grp].stroke}10`);
      gradFill.addColorStop(0.5, GC[grp].fill);
      gradFill.addColorStop(1, `${GC[grp].stroke}50`);
      ctx.fillStyle = gradFill;
      ctx.fill();

      // 輪郭線（グロー付き）
      ctx.save();
      ctx.shadowColor = GC[grp].glow;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let j = 0; j < 4; j++) {
        const idx = startIdx + j;
        const p = getPoint(idx, data[idx]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.strokeStyle = GC[grp].stroke;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    });

    // === 全16頂点を結ぶ外周線 ===
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const p = getPoint(i, data[i]);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // === データポイント（グロー＋大きめ）===
    for (let i = 0; i < n; i++) {
      const p = getPoint(i, data[i]);
      const grp = axes[i].group;
      // グロー
      ctx.save();
      ctx.shadowColor = GC[grp].glow;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5.5, 0, 2 * Math.PI);
      ctx.fillStyle = GC[grp].stroke;
      ctx.fill();
      ctx.restore();
      // 白枠
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5.5, 0, 2 * Math.PI);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
      // 中心ハイライト
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, 2 * Math.PI);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    }

    // === ラベル ===
    for (let i = 0; i < n; i++) {
      const angle = getAngle(i);
      const grp = axes[i].group;
      const score = data[i];

      // ラベル位置を動的に計算（左右で textAlign を変える）
      const labelR = R + 40;
      const lx = cx + labelR * Math.cos(angle);
      const ly = cy + labelR * Math.sin(angle);

      // テキスト方向判定
      const cos = Math.cos(angle);
      const isRight = cos > 0.15;
      const isLeft = cos < -0.15;
      const align = isRight ? 'left' : isLeft ? 'right' : 'center';

      // ラベルオフセット
      const nudgeX = isRight ? 12 : isLeft ? -12 : 0;

      ctx.save();
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';

      // 日本語ラベル（太め、白）
      ctx.font = 'bold 14px "Noto Serif JP", serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(axes[i].jp, lx + nudgeX, ly - 8);

      // スコア数字（大きく、グループカラー、太字）
      ctx.font = 'bold 15px "DM Sans", "Helvetica Neue", Arial, sans-serif';
      ctx.fillStyle = GC[grp].stroke;
      ctx.fillText(score + '', lx + nudgeX, ly + 12);

      ctx.restore();
    }

    // === グループラベル（志・知・技・衝）===
    // グループラベル: 12/3/6/9時に固定
    const groupLabels = [
      { jp: '志', en: 'WHY',   angle: -Math.PI / 2,      color: GC.mindset.stroke },
      { jp: '知', en: 'THINK', angle: 0,                 color: GC.literacy.stroke },
      { jp: '技', en: 'HOW',   angle:  Math.PI / 2,      color: GC.competency.stroke },
      { jp: '衝', en: 'ACT',   angle:  Math.PI,          color: GC.impact.stroke },
    ];
    groupLabels.forEach(({ jp, en, angle, color }) => {
      const gr = R + 80;
      const gx = cx + gr * Math.cos(angle);
      const gy = cy + gr * Math.sin(angle);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // バッジ背景
      ctx.fillStyle = `${color}18`;
      ctx.strokeStyle = `${color}50`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(gx - 48, gy - 14, 96, 28, 6);
      ctx.fill();
      ctx.stroke();
      // 漢字
      ctx.font = 'bold 15px "Noto Serif JP", serif';
      ctx.fillStyle = color;
      ctx.fillText(jp, gx - 20, gy);
      // 英語
      ctx.font = '600 11px "SF Mono", Consolas, monospace';
      ctx.fillStyle = color;
      ctx.fillText(en, gx + 15, gy);
      ctx.restore();
    });

    // === 中央ロゴ ===
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 9px "SF Mono", Consolas, monospace';
    ctx.fillStyle = 'rgba(255,215,0,0.25)';
    ctx.fillText('SAIKAKU', cx, cy - 6);
    ctx.fillText('ARCHITECTURE', cx, cy + 6);
    ctx.restore();

  }, [scores]);

  // 合計スコア計算
  const totalScore = (() => {
    if (!scores) return 0;
    let sum = 0;
    ['mindset', 'literacy', 'competency', 'impact'].forEach(g => {
      const subs = scores[g]?.subs || {};
      Object.values(subs).forEach(v => { sum += (v || 0); });
    });
    return sum;
  })();

  return (
    <Section>
      <SectionHeader title="才覚発動領域マトリクス — 16軸レーダー" subtitle="Unique Ability Activation Matrix — 16-Axis Radar" />
      <div style={{
        background: 'linear-gradient(180deg, #08080C 0%, #0C0C14 50%, #08080C 100%)',
        borderRadius: 16,
        padding: '28px 12px 20px',
        border: `2px solid ${ACCENT_GOLD}30`,
        boxShadow: `0 0 40px rgba(0,0,0,0.5), inset 0 0 60px rgba(0,0,0,0.3)`,
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* 装飾コーナー */}
        {['top-left','top-right','bottom-left','bottom-right'].map(pos => (
          <div key={pos} style={{
            position: 'absolute',
            width: 24, height: 24,
            [pos.includes('top') ? 'top' : 'bottom']: 8,
            [pos.includes('left') ? 'left' : 'right']: 8,
            borderTop: pos.includes('top') ? `2px solid ${ACCENT_GOLD}40` : 'none',
            borderBottom: pos.includes('bottom') ? `2px solid ${ACCENT_GOLD}40` : 'none',
            borderLeft: pos.includes('left') ? `2px solid ${ACCENT_GOLD}40` : 'none',
            borderRight: pos.includes('right') ? `2px solid ${ACCENT_GOLD}40` : 'none',
          }} />
        ))}

        {/* 合計スコアバッジ */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          background: 'rgba(255,215,0,0.08)',
          border: '1px solid rgba(255,215,0,0.2)',
          borderRadius: 20, padding: '6px 20px', marginBottom: 16,
        }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600, letterSpacing: '0.08em' }}>TOTAL SCORE</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#FFD700', fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif" }}>{totalScore}</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>/ 240</span>
        </div>

        <canvas ref={canvasRef} style={{ display: 'block', margin: '0 auto' }} />

        {/* 凡例 */}
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 16, marginTop: 20, flexWrap: 'wrap',
        }}>
          {[
            { jp: '志', en: 'Mindset', color: '#5B9BD5' },
            { jp: '知', en: 'Literacy', color: '#3DAA6D' },
            { jp: '技', en: 'Competency', color: '#D4AA50' },
            { jp: '衝', en: 'Impact', color: '#D46A50' },
          ].map(g => (
            <div key={g.en} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: `${g.color}10`, border: `1px solid ${g.color}30`,
              borderRadius: 8, padding: '5px 14px',
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%', background: g.color,
                boxShadow: `0 0 6px ${g.color}80`,
              }} />
              <span style={{ fontSize: 12, color: '#FFFFFF', fontWeight: 700 }}>{g.jp}</span>
              <span style={{ fontSize: 10, color: g.color, fontWeight: 600 }}>{g.en}</span>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 12, letterSpacing: '0.05em' }}>
          ※ 外周が15点満点（各軸）・合計240点満点　面積の欠落は改善ポイントを示します
        </p>
      </div>
    </Section>
  );
}

/* ============================================================
 * メインコンポーネント
 * ============================================================ */
export default function UAAMResultScreen({ user, result, attemptData, isAdmin, onReset, onAdmin, onLogout, onScoresRestored }) {
  const attemptProps = useMemo(
    () => (attemptData ? attemptToResultProps(attemptData, 'uaam') : null),
    [attemptData],
  );
  const effectiveResult = attemptProps?.result ?? result;
  const isHistoryView = !!attemptData;
  const { vAnswers, answers } = effectiveResult ?? {};
  // scores はローカル state で管理（復元時に即時反映）
  // normalizeScores が domainSubs/domainTotal を補完する唯一の場所
  const [scores, setScores] = useState(() => normalizeScores(effectiveResult?.scores) ?? effectiveResult?.scores);
  // 統合分析は state で管理（バックフィル後に更新できるように）
  const [analysis, setAnalysis] = useState(effectiveResult?.analysis || null);
  const [integrating, setIntegrating] = useState(false);
  const [integrateError, setIntegrateError] = useState('');

  useEffect(() => {
    setScores(normalizeScores(effectiveResult?.scores) ?? effectiveResult?.scores);
    setAnalysis(effectiveResult?.analysis || null);
  }, [effectiveResult]);

  const runIntegration = async () => {
    if (isHistoryView) return;
    setIntegrating(true);
    setIntegrateError('');
    try {
      const { getAuth } = await import('firebase/auth');
      const idToken = await getAuth().currentUser?.getIdToken();
      if (!idToken) throw new Error('ログインが必要です');
      const res = await fetch('/api/integrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '統合分析に失敗しました');
      setAnalysis(prev => ({ ...prev, saikaku_integration: data.integration }));
    } catch (e) {
      setIntegrateError(e.message);
    } finally {
      setIntegrating(false);
    }
  };

  // 20点固定
  MAX_SUB = 20;
  MAX_AXIS = 80;
  MAX_CROSS = MAX_AXIS * MAX_AXIS;
  DISPLAY_CROSS = MAX_CROSS / 2;

  // 妥当性チェック（V問フラグ判定）
  const validityResult = (vAnswers && answers) ? checkValidity(vAnswers, answers) : null;

  if (!scores) {
    return (
      <div style={{
        minHeight: '100vh',
        background: LIGHT_BG,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: TEXT_PRIMARY, fontSize: 15, fontWeight: 700, margin: '0 0 16px' }}>
            結果データを表示できませんでした
          </p>
          <button onClick={onReset} style={{
            border: `1px solid ${BORDER}`,
            background: WHITE,
            color: TEXT_PRIMARY,
            borderRadius: 10,
            padding: '10px 18px',
            cursor: 'pointer',
            fontWeight: 700,
          }}>
            戻る
          </button>
        </div>
      </div>
    );
  }

  const topType = determineType(scores, analysis);
  const subRadars = UAAM_AXES.map(axis => {
    const subs = scores[axis.key]?.subs || {};
    const order = SUB_ORDER[axis.key];
    return { axis, data: order.map(k => subs[k] || 0), labels: order.map(k => SUB_LABELS[k]), order };
  });

  return (
    <div style={{ minHeight: '100vh', background: LIGHT_BG }}>

      {/* ===== ヘッダー ===== */}
      <div className="no-print" style={{
        background: WHITE,
        borderBottom: `1px solid ${BORDER}`,
        padding: '12px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ lineHeight: 1.3 }}>
          <div style={{
            fontFamily: "'Noto Serif JP', Georgia, serif",
            fontSize: 13, fontWeight: 700, color: TEXT_PRIMARY, letterSpacing: '0.02em',
          }}>Unique Ability Activation Matrix</div>
          <div style={{
            fontSize: 10, color: TEXT_MUTED, letterSpacing: '0.1em',
          }}>- 才覚発動マトリックス -</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isAdmin && !isHistoryView && (
            <>
              <button onClick={onAdmin} style={{
                padding: '6px 12px', borderRadius: 6, border: `1px solid ${BORDER}`,
                background: 'transparent', color: TEXT_SECONDARY, fontSize: 12, cursor: 'pointer',
              }}>管理画面</button>
              <button onClick={async () => {
                if (!confirm('2026/4/4の正しいスコアに復元しますか？')) return;
                try {
                  const { getAuth } = await import('firebase/auth');
                  const idToken = await getAuth().currentUser?.getIdToken();
                  const res = await fetch('/api/admin/restore-scores', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ idToken }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error);
                  // ローカルstateを即時更新（リロード不要）
                  if (data.scores) {
                    const normalized = normalizeScores(data.scores);
                    setScores(normalized);
                    if (onScoresRestored) onScoresRestored(normalized);
                  }
                  alert('✅ ' + data.message);
                } catch (e) {
                  alert('❌ ' + e.message);
                }
              }} style={{
                padding: '6px 12px', borderRadius: 6,
                border: `1px solid #C4922A`,
                background: 'transparent', color: '#C4922A', fontSize: 11, cursor: 'pointer',
              }}>スコア復元</button>
            </>
          )}
          {user.photoURL && (
            <img src={user.photoURL} alt={user.displayName}
              style={{ width: 28, height: 28, borderRadius: '50%', border: `1px solid ${BORDER}` }} />
          )}
          <button onClick={async () => { await signOutUser(); onLogout(); }} style={{
            padding: '6px 12px', borderRadius: 6, border: `1px solid ${BORDER}`,
            background: 'transparent', color: TEXT_SECONDARY, fontSize: 12, cursor: 'pointer',
          }}>ログアウト</button>
        </div>
      </div>

      <div className="pdf-content-wrapper" style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px' }}>
        {isHistoryView && (
          <button
            onClick={onReset}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#4A6FA5',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.06em',
              cursor: 'pointer',
              textDecoration: 'underline',
              textUnderlineOffset: 4,
              marginBottom: 14,
              padding: 0,
            }}
          >
            最新の結果に戻る
          </button>
        )}

        {/* ===== 名前 + Activation Type + 今、発動している力（最上部） ===== */}
        <ActivationPanel scores={
          Object.values(scores || {}).reduce((acc, domain) => {
            if (domain?.subs) Object.assign(acc, domain.subs);
            return acc;
          }, {})
        } threshold={13} userName={user.displayName} mode="top" vAnswers={vAnswers} />

        {/* ===== 16軸レーダーチャート（Activation Matrix） ===== */}
        <ActivationMatrix scores={scores} maxSub={MAX_SUB} />

        {/* ===== ✅ 今、発動している力（MLCI直下） ===== */}
        <ActivationPanel scores={
          Object.values(scores || {}).reduce((acc, domain) => {
            if (domain?.subs) Object.assign(acc, domain.subs);
            return acc;
          }, {})
        } threshold={13} mode="active-only" />

        {/* ===== 16×16 正方形対称マトリクス（右上：FULL+ACTIVE ／ 左下：POTENTIAL） ===== */}
        <SymmetricMatrix scores={scores} maxSub={MAX_SUB} />

        {/* 次に動かす力は AllPairsTriangle の TOP 10 カードに統合済み */}

        {/* ===== AI分析 ===== */}
        {analysis && (
          <>


            {/* 才覚×UAAM 統合発動分析 */}
            {/* integration_score があれば新形式（McKinsey級）、なければ旧形式 or 未生成 */}
            {analysis.saikaku_integration?.integration_score !== undefined ? (
              <div style={{ marginBottom: 20, borderRadius: 16, overflow: 'hidden',
                boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: `1px solid #E8E0D4` }}>
                <SaikakuIntegration integration={analysis.saikaku_integration} />
              </div>
            ) : !isHistoryView ? (
              <Section>
                <SectionHeader title="才覚発動統合分析" subtitle="才覚領域 × UAAM Integration" />
                <p style={{ fontSize: 14, color: TEXT_SECONDARY, marginBottom: 16, lineHeight: 1.9 }}>
                  才覚領域データとUAAMスコアを統合した「才覚発動統合分析」を生成できます。
                </p>
                <button
                  onClick={runIntegration}
                  disabled={integrating}
                  style={{
                    width: '100%', padding: '14px 0',
                    background: integrating
                      ? '#E8E0D4'
                      : 'linear-gradient(135deg, #0D2137 0%, #1A3A52 100%)',
                    color: integrating ? TEXT_MUTED : '#fff',
                    border: 'none', borderRadius: 10,
                    fontSize: 14, fontWeight: 700, cursor: integrating ? 'not-allowed' : 'pointer',
                    fontFamily: "'Noto Serif JP', serif",
                    transition: 'opacity 0.2s',
                  }}
                >
                  {integrating ? '⏳ 統合分析を生成中...' : '⚡ 才覚×UAAM 統合発動分析を生成する'}
                </button>
                {integrateError && (
                  <p style={{ fontSize: 12, color: '#922B21', marginTop: 8, textAlign: 'center' }}>
                    {integrateError}
                  </p>
                )}
              </Section>
            ) : null}

          </>
        )}

        {/* ===== V問フラグ（参加者向け：目立たない表示） ===== */}
        {vAnswers && (() => {
          const { flags } = getVFlags(vAnswers);
          const FlagSvg = ({ color }) => (
            <svg width="7" height="10" viewBox="0 0 7 10" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
              <rect x="0" y="0" width="1.4" height="10" fill={color} rx="0.5"/>
              <path d="M1.4 0.5L6.5 3L1.4 5.5V0.5Z" fill={color}/>
            </svg>
          );
          const VFlag = ({ id }) => {
            const f = flags[id];
            if (f === 'none') return <FlagSvg color="#DDD7CE" />;
            if (f === 'warning') return (
              <span style={{ display: 'inline-flex', gap: 2 }}>
                <FlagSvg color="#C4B8A8" />
              </span>
            );
            return (
              <span style={{ display: 'inline-flex', gap: 2 }}>
                <FlagSvg color="#B0A294" />
                <FlagSvg color="#B0A294" />
              </span>
            );
          };
          return (
            <div className="no-print" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              gap: 6, marginBottom: 12, opacity: 0.7,
            }}>
              <VFlag id="V1" />
              <VFlag id="V2" />
              <VFlag id="V3" />
            </div>
          );
        })()}

        {/* ===== ボタン ===== */}
        <div className="no-print" style={{ display: 'flex', gap: 12, marginTop: 8, marginBottom: 40 }}>
          <button onClick={() => window.print()} style={{
            flex: 1, height: 48, borderRadius: 10, border: 'none',
            background: TEXT_PRIMARY, color: WHITE,
            fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}>
            印刷 / PDF保存
          </button>
        </div>
      </div>
    </div>
  );
}
