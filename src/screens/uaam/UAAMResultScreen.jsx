import { useState, useRef, useEffect } from 'react';
import { signOutUser } from '../../firebase';
import { UAAM_AXES } from '../../data/uaam_questions';

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
  meaning: '意味', mindfulness: '気づき', mindshift: '意識転換', mastery: '熟達',
  learning: '学習', logical: '論理', life: '社会実装', leadership: 'リーダーシップ',
  critical: '批判的思考', creativity: '創造性', communication: '伝える力', collaboration: '協働',
  idea: 'アイデア', innovation: '変革', implementation: '実装', influence: '影響',
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
  life:          '学んだ知識を実生活の小さな課題解決に適用してみましょう。「知っている」から「使える」への転換が社会実装力の本質です。',
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

/**
 * スコアスケール自動検出
 * クライアント計算: 1-5点×3問 = MAX_SUB=15, MAX_AXIS=60
 * サーバー計算:     0-4点×3問 = MAX_SUB=12, MAX_AXIS=48
 * 実データから動的に判定する
 */
function detectScale(scores) {
  if (!scores) return { maxSub: 15, maxAxis: 60 };
  let hasOver12 = false;
  for (const axis of Object.values(scores)) {
    if (axis?.subs) {
      for (const v of Object.values(axis.subs)) {
        if (v > 12) { hasOver12 = true; break; }
      }
    }
    if (hasOver12) break;
  }
  return hasOver12
    ? { maxSub: 15, maxAxis: 60 }
    : { maxSub: 12, maxAxis: 48 };
}

// デフォルト値（コンポーネント外で使う箇所用）
let MAX_AXIS = 60;
let MAX_SUB = 15;
let MAX_CROSS = MAX_AXIS * MAX_AXIS;
let DISPLAY_CROSS = MAX_CROSS / 2;
const displayDomain = (raw) => Math.round(raw / 2);
const AXIS_COLORS = { mindset: '#2C5F8A', literacy: '#1E7A4A', competency: '#A07A18', impact: '#8B3A28' };

/* ============================================================
 * タイプ判定
 * ============================================================ */
function determineType(scores) {
  const d = (k) => scores[k]?.domainTotal || 0;
  const types = [
    { name: '構想力タイプ', score: Math.round(d('mindset') * d('literacy')) },
    { name: '統率力タイプ', score: Math.round(d('mindset') * d('impact')) },
    { name: '実装力タイプ', score: Math.round(d('literacy') * d('competency')) },
    { name: '変革力タイプ', score: Math.round(d('impact') * d('competency')) },
  ];
  types.sort((a, b) => b.score - a.score);
  return types[0];
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

  /* 扇形定義 ─ 軸配置に対応する角度 */
  const FAN_DEFS = [
    { key: 'vision',     label: '構想力', formula: '志 × 知', axes: ['mindset', 'literacy'],
      startAngle: -Math.PI / 2, endAngle: 0,                color: '#3D7A7A', lx: 0.45, ly: -0.45 },
    { key: 'execution',  label: '実装力', formula: '知 × 技', axes: ['literacy', 'competency'],
      startAngle: 0,             endAngle: Math.PI / 2,      color: '#7A8A2E', lx: 0.45, ly: 0.45 },
    { key: 'revolution', label: '変革力', formula: '衝 × 技', axes: ['impact', 'competency'],
      startAngle: Math.PI / 2,   endAngle: Math.PI,          color: '#B5622E', lx: -0.45, ly: 0.45 },
    { key: 'command',    label: '統率力', formula: '志 × 衝', axes: ['mindset', 'impact'],
      startAngle: Math.PI,       endAngle: 3 * Math.PI / 2,  color: '#6B4C8A', lx: -0.45, ly: -0.45 },
  ];

  const AXIS_LABEL_POS = [
    { kanji: '志', en: 'WHY',   dx: 0,  dy: -1, align: 'center', base: 'bottom', color: AXIS_COLORS.mindset },
    { kanji: '技', en: 'HOW',   dx: 0,  dy: 1,  align: 'center', base: 'top',    color: AXIS_COLORS.competency },
    { kanji: '知', en: 'THINK', dx: 1,  dy: 0,  align: 'left',   base: 'middle', color: AXIS_COLORS.literacy },
    { kanji: '衝', en: 'ACT',   dx: -1, dy: 0,  align: 'right',  base: 'middle', color: AXIS_COLORS.impact },
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

    /* 十字軸 */
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(cx - R - 20, cy); ctx.lineTo(cx + R + 20, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - R - 20); ctx.lineTo(cx, cy + R + 20); ctx.stroke();

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
      { key: 'meaning',       jp: '意味',           en: 'Meaning',        group: 'mindset' },
      { key: 'mindfulness',   jp: '気づき',         en: 'Mindfulness',    group: 'mindset' },
      { key: 'mindshift',     jp: '意識転換',       en: 'Mindshift',      group: 'mindset' },
      { key: 'mastery',       jp: '熟達',           en: 'Mastery',        group: 'mindset' },
      { key: 'learning',      jp: '学習',           en: 'Learning',       group: 'literacy' },
      { key: 'logical',       jp: '論理',           en: 'Logical',        group: 'literacy' },
      { key: 'life',          jp: '社会実装',       en: 'Life',           group: 'literacy' },
      { key: 'leadership',    jp: 'リーダーシップ', en: 'Leadership',     group: 'literacy' },
      { key: 'critical',      jp: '批判的思考',     en: 'Critical',       group: 'competency' },
      { key: 'creativity',    jp: '創造性',         en: 'Creativity',     group: 'competency' },
      { key: 'communication', jp: '伝える力',       en: 'Communication',  group: 'competency' },
      { key: 'collaboration', jp: '協働',           en: 'Collaboration',  group: 'competency' },
      { key: 'idea',          jp: 'アイデア',       en: 'Idea',           group: 'impact' },
      { key: 'innovation',    jp: '変革',           en: 'Innovation',     group: 'impact' },
      { key: 'implementation',jp: '実装',           en: 'Implementation', group: 'impact' },
      { key: 'influence',     jp: '影響',           en: 'Influence',      group: 'impact' },
    ];

    const GC = {
      mindset:    { fill: 'rgba(91,155,213,0.35)',  stroke: '#5B9BD5', glow: 'rgba(91,155,213,0.6)' },
      literacy:   { fill: 'rgba(61,170,109,0.35)',  stroke: '#3DAA6D', glow: 'rgba(61,170,109,0.6)' },
      competency: { fill: 'rgba(212,170,80,0.35)',  stroke: '#D4AA50', glow: 'rgba(212,170,80,0.6)' },
      impact:     { fill: 'rgba(212,106,80,0.35)',  stroke: '#D46A50', glow: 'rgba(212,106,80,0.6)' },
    };

    const data = axes.map(a => (scores[a.group]?.subs?.[a.key]) || 0);
    const n = 16;
    const step = (2 * Math.PI) / n;
    const startAngle = -Math.PI / 2;

    const getPoint = (i, val) => {
      const angle = startAngle + i * step;
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

    // === グリッド（5段階 3,6,9,12,15）===
    [3, 6, 9, 12, 15].forEach((v, vi) => {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const p = getPoint(i % n, v);
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
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

    // === セクション背景（薄いパイ）===
    const groupOrder = ['mindset', 'literacy', 'competency', 'impact'];
    groupOrder.forEach((grp, gi) => {
      const a1 = startAngle + gi * 4 * step - step * 0.5;
      const a2 = startAngle + (gi + 1) * 4 * step - step * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a1, a2);
      ctx.closePath();
      ctx.fillStyle = `${GC[grp].stroke}08`;
      ctx.fill();
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
      const angle = startAngle + i * step;
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
      ctx.fillText(axes[i].jp, lx + nudgeX, ly - 11);

      // 英語ラベル（グループカラー）
      ctx.font = '600 10px "SF Mono", Consolas, monospace';
      ctx.fillStyle = GC[grp].stroke;
      ctx.fillText(axes[i].en, lx + nudgeX, ly + 4);

      // スコア数字（大きく、白、太字）
      ctx.font = 'bold 16px "Playfair Display", Georgia, serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(score + '', lx + nudgeX, ly + 22);

      ctx.restore();
    }

    // === グループラベル（志・知・技・衝）===
    const groupLabels = [
      { jp: '志', en: 'Mindset',    angle: startAngle + 1.5 * step, color: GC.mindset.stroke },
      { jp: '知', en: 'Literacy',   angle: startAngle + 5.5 * step, color: GC.literacy.stroke },
      { jp: '技', en: 'Competency', angle: startAngle + 9.5 * step, color: GC.competency.stroke },
      { jp: '衝', en: 'Impact',     angle: startAngle + 13.5 * step,color: GC.impact.stroke },
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
          <span style={{ fontSize: 22, fontWeight: 800, color: '#FFD700', fontFamily: "'Playfair Display', Georgia, serif" }}>{totalScore}</span>
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
export default function UAAMResultScreen({ user, result, isAdmin, onReset, onAdmin, onLogout }) {
  const { scores, analysis } = result;

  // スケール自動検出（サーバー0-12 vs クライアント0-15）
  const scale = detectScale(scores);
  MAX_SUB = scale.maxSub;
  MAX_AXIS = scale.maxAxis;
  MAX_CROSS = MAX_AXIS * MAX_AXIS;
  DISPLAY_CROSS = MAX_CROSS / 2;

  const topType = determineType(scores);
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
          {isAdmin && (
            <button onClick={onAdmin} style={{
              padding: '6px 12px', borderRadius: 6, border: `1px solid ${BORDER}`,
              background: 'transparent', color: TEXT_SECONDARY, fontSize: 12, cursor: 'pointer',
            }}>管理画面</button>
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

        {/* ===== タイトル ===== */}
        <Section style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: TEXT_MUTED, letterSpacing: '0.15em',
            textTransform: 'uppercase', marginBottom: 8,
          }}>Universal Ability Assessment Model</div>
          <h1 style={{
            fontFamily: "'Noto Serif JP', Georgia, serif",
            fontSize: 24, fontWeight: 700, color: TEXT_PRIMARY, margin: '0 0 16px',
          }}>{user.displayName}</h1>
          <div style={{
            display: 'inline-block', background: `${ACCENT_GOLD}10`,
            border: `1px solid ${ACCENT_GOLD}30`, borderRadius: 8, padding: '10px 24px',
          }}>
            <div style={{
              fontSize: 22, fontWeight: 800, color: ACCENT_GOLD,
              fontFamily: "'Noto Serif JP', Georgia, serif",
            }}>{topType.name}</div>
            <div style={{
              fontSize: 13, color: TEXT_MUTED, marginTop: 4,
              fontFamily: NUM_FONT,
            }}>
              Score: <span style={{ fontWeight: 700, color: ACCENT_GOLD }}>{displayDomain(topType.score)}</span>
              <span style={{ color: TEXT_MUTED }}> / {DISPLAY_CROSS}</span>
            </div>
          </div>
          {analysis?.type_description && (
            <p style={{
              fontSize: 14, color: TEXT_SECONDARY, marginTop: 16, lineHeight: 1.8,
            }}>{analysis.type_description}</p>
          )}
        </Section>

        {/* ===== 総合スコア（4色扇形） ===== */}
        <Section>
          <SectionHeader title="志知技衝 総合スコア" subtitle="MLCI Total Score" />
          <MainFanChart scores={scores} />
        </Section>

        {/* ===== サブ項目 扇形チャート x4 ===== */}
        {subRadars.map(({ axis, data, order }) => (
          <Section key={axis.key} style={{ marginBottom: 16 }}>
            <SectionHeader
              title={`${axis.label}（${axis.english}）`}
              subtitle={axis.description}
              color={AXIS_COLORS[axis.key]}
            />

            {/* 軸スコア */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              marginBottom: 12, padding: '8px 0',
            }}>
              <span style={{
                fontSize: 32, fontWeight: 900, color: AXIS_COLORS[axis.key],
                fontFamily: NUM_FONT,
              }}>{scores[axis.key]?.total || 0}</span>
              <span style={{ fontSize: 14, color: TEXT_MUTED, fontFamily: NUM_FONT }}>/ {MAX_AXIS}</span>
            </div>

            <SubFanChart
              axis={axis}
              data={data}
              order={order}
              axisColor={AXIS_COLORS[axis.key]}
            />
          </Section>
        ))}

        {/* ===== 才覚発動領域マトリクス ===== */}
        <ActivityDomainChart scores={scores} />

        {/* ===== 16軸レーダーチャート ===== */}
        <RadarChart16 scores={scores} />

        {/* ===== AI分析 ===== */}
        {analysis && (
          <>
            {/* 軸別分析 */}
            <Section>
              <SectionHeader title="AI 分析レポート" subtitle="AI Analysis — 志知技衝 総合スコアに基づく分析" />

              {analysis.axis_analysis && Object.entries(analysis.axis_analysis).map(([key, text]) => {
                const ax = UAAM_AXES.find(a => a.key === key);
                if (!ax) return null;
                const clr = AXIS_COLORS[key];
                return (
                  <div key={key} style={{
                    borderLeft: `3px solid ${clr}`,
                    padding: '14px 18px',
                    marginBottom: 14,
                    background: `${clr}06`,
                    borderRadius: '0 8px 8px 0',
                  }}>
                    <div style={{
                      fontSize: 14, fontWeight: 700, color: clr, marginBottom: 6,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <span style={{
                        fontFamily: "'Noto Serif JP', serif",
                        fontSize: 16,
                      }}>{ax.label}</span>
                      {ax.english}
                    </div>
                    <p style={{
                      fontSize: 14, color: TEXT_SECONDARY, margin: 0, lineHeight: 1.9,
                    }}>{text}</p>
                  </div>
                );
              })}
            </Section>

            {/* ナラティブ */}
            {analysis.narrative && (
              <Section>
                <SectionHeader title="ナラティブ" subtitle="Narrative — あなたの才覚の物語" />
                <p style={{
                  fontSize: 15, color: TEXT_PRIMARY, lineHeight: 2.0, margin: 0,
                  paddingLeft: 16, borderLeft: `2px solid ${BORDER}`,
                }}>{analysis.narrative}</p>
              </Section>
            )}

            {/* Strengths / Growth */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 20,
            }}>
              {analysis.strengths?.length > 0 && (
                <Section style={{ marginBottom: 0 }}>
                  <SectionHeader title="強み" subtitle="Strengths" color="#1E7A4A" />
                  {analysis.strengths.map((s, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                      padding: '10px 0',
                      borderBottom: i < analysis.strengths.length - 1 ? `1px solid ${BORDER}` : 'none',
                    }}>
                      <span style={{
                        fontSize: 13, fontWeight: 700, color: '#1E7A4A',
                        flexShrink: 0, width: 22,
                      }}>{i + 1}.</span>
                      <span style={{ fontSize: 14, color: TEXT_SECONDARY, lineHeight: 1.7 }}>{s}</span>
                    </div>
                  ))}
                </Section>
              )}
              {analysis.growth_areas?.length > 0 && (
                <Section style={{ marginBottom: 0 }}>
                  <SectionHeader title="成長ポイント" subtitle="Growth Areas" color={ACCENT_GOLD} />
                  {analysis.growth_areas.map((g, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                      padding: '10px 0',
                      borderBottom: i < analysis.growth_areas.length - 1 ? `1px solid ${BORDER}` : 'none',
                    }}>
                      <span style={{
                        fontSize: 13, fontWeight: 700, color: ACCENT_GOLD,
                        flexShrink: 0, width: 22,
                      }}>▲</span>
                      <span style={{ fontSize: 14, color: TEXT_SECONDARY, lineHeight: 1.7 }}>{g}</span>
                    </div>
                  ))}
                </Section>
              )}
            </div>

            {/* Action Suggestions */}
            {analysis.action_suggestions?.length > 0 && (
              <Section>
                <SectionHeader title="アクション提案" subtitle="Action Suggestions — 次のステップ" color={AXIS_COLORS.mindset} />
                {analysis.action_suggestions.map((a, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                    padding: '12px 0',
                    borderBottom: i < analysis.action_suggestions.length - 1 ? `1px solid ${BORDER}` : 'none',
                  }}>
                    <span style={{
                      background: AXIS_COLORS.mindset,
                      color: WHITE, fontSize: 11, fontWeight: 700,
                      width: 24, height: 24, borderRadius: 6,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>{i + 1}</span>
                    <span style={{ fontSize: 14, color: TEXT_SECONDARY, lineHeight: 1.7, paddingTop: 2 }}>{a}</span>
                  </div>
                ))}
              </Section>
            )}
          </>
        )}

        {/* ===== ボタン ===== */}
        <div className="no-print" style={{ display: 'flex', gap: 12, marginTop: 8, marginBottom: 40 }}>
          <button onClick={() => window.print()} style={{
            flex: 1, height: 48, borderRadius: 10, border: 'none',
            background: TEXT_PRIMARY, color: WHITE,
            fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}>
            印刷 / PDF保存
          </button>
          <button onClick={onReset} style={{
            flex: 1, height: 48, borderRadius: 10,
            border: `1.5px solid ${BORDER}`, background: WHITE,
            color: TEXT_SECONDARY, fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}>もう一度診断する</button>
        </div>
      </div>
    </div>
  );
}
