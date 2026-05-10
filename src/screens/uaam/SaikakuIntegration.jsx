/**
 * SaikakuIntegration.jsx
 * 才覚×UAAM 統合発動分析 結果コンポーネント
 * 才覚領域（WHY/HOW/WHAT）× UAAM4軸（志/知/技/衝）の
 * クロス分析をMcKinsey級レイアウトで表示する
 */
import { useState, useEffect, useMemo } from 'react';
import { normalizeQuestionText } from '../../utils/normalizeQuestionText';

/* ── パレット ─────────────────────── */
const P = {
  bg:      '#F5F0E8',
  surface: '#FFFDF7',
  border:  '#E8E0D4',
  gold:    '#B8960C',
  goldDim: '#C4A535',
  text:    '#1A1A1A',
  muted:   '#666666',
  ignition:'#1A5276',   // 超発動 - 深い青
  latent:  '#1E8449',   // 潜在   - 深い緑
  idle:    '#784212',   // 遊休   - 深い茶
  score_hi:'#196F3D',
  score_lo:'#922B21',
};

const ZONE_META = {
  ignition: { label: '超発動ゾーン', color: P.ignition, bg: '#EBF5FB', icon: '⚡' },
  latent:   { label: '潜在ゾーン',   color: P.latent,   bg: '#EAFAF1', icon: '🌱' },
  idle:     { label: '遊休ゾーン',   color: P.idle,     bg: '#FEF9E7', icon: '⚠️' },
};

/* ── サブコンポーネント ─────────────── */

export function formatIntegrationDate(value) {
  if (value === null || value === undefined || value === '') return '日付未設定';

  let date;
  if (typeof value?.toDate === 'function') {
    date = value.toDate();
  } else if (typeof value?._seconds === 'number') {
    date = new Date(value._seconds * 1000);
  } else if (typeof value?.seconds === 'number') {
    date = new Date(value.seconds * 1000);
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) return '日付未設定';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

function hasSource(source) {
  return !!(
    source
    && (source.saikakuLabel || source.uaamLabel || source.saikakuDate || source.uaamDate)
  );
}

function SourceHeader({ source }) {
  if (!hasSource(source)) return null;

  return (
    <div style={{
      background: '#FFF8E6',
      borderBottom: `1px solid ${P.border}`,
      padding: '12px 18px',
    }}>
      <div style={{
        fontSize: 10,
        color: P.gold,
        fontWeight: 800,
        letterSpacing: '0.16em',
        fontFamily: "'Outfit', sans-serif",
        marginBottom: 4,
      }}>
        出典
      </div>
      <div style={{
        fontSize: 12,
        color: P.text,
        fontWeight: 700,
        lineHeight: 1.8,
        fontFamily: "'Noto Serif JP', serif",
      }}>
        才覚領域: {source.saikakuLabel || '未設定'}（{formatIntegrationDate(source.saikakuDate)}）× UAAM: {source.uaamLabel || '未設定'}（{formatIntegrationDate(source.uaamDate)}）
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  if (status !== 'stale') return null;

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      border: '1px solid rgba(184,150,12,0.45)',
      background: 'rgba(184,150,12,0.14)',
      color: '#F5D36A',
      borderRadius: 100,
      padding: '4px 9px',
      fontSize: 10,
      fontWeight: 800,
      letterSpacing: '0.06em',
      whiteSpace: 'nowrap',
    }}>
      要再生成
    </span>
  );
}

function RegenerateButton({ regenerationCount, onRegenerate }) {
  const [regenerating, setRegenerating] = useState(false);
  const count = Number.isFinite(Number(regenerationCount)) ? Number(regenerationCount) : 0;
  const disabled = regenerating || count >= 1;
  const remaining = Math.max(0, 1 - count);

  if (typeof onRegenerate !== 'function') return null;

  const handleClick = async (event) => {
    event.stopPropagation();
    if (disabled) return;

    setRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      style={{
        border: `1px solid ${disabled ? 'rgba(255,255,255,0.14)' : 'rgba(245,211,106,0.55)'}`,
        background: disabled ? 'rgba(255,255,255,0.06)' : 'rgba(184,150,12,0.18)',
        color: disabled ? 'rgba(255,255,255,0.42)' : '#F5D36A',
        borderRadius: 999,
        padding: '8px 12px',
        fontSize: 11,
        fontWeight: 800,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: "'Noto Serif JP', serif",
        whiteSpace: 'nowrap',
      }}
    >
      {regenerating ? '再生成中...' : `再生成（残り ${remaining} 回）`}
    </button>
  );
}

function ScoreRing({ score }) {
  const r = 38, cx = 50, cy = 50;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? P.score_hi : score >= 45 ? P.goldDim : P.score_lo;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={100} height={100} viewBox="0 0 100 100">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={P.border} strokeWidth={8} />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={22} fontWeight={700} fill={color}
          fontFamily="'Outfit', sans-serif">{score}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={10} fill={P.muted}
          fontFamily="'Noto Serif JP', serif">統合スコア</text>
      </svg>
    </div>
  );
}

function ZoneCard({ zone, type }) {
  const meta = ZONE_META[type];
  return (
    <div style={{
      background: meta.bg,
      border: `1px solid ${meta.color}33`,
      borderLeft: `4px solid ${meta.color}`,
      borderRadius: 10,
      padding: '14px 16px',
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 14 }}>{meta.icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: meta.color, letterSpacing: '0.05em',
          fontFamily: "'Outfit', sans-serif" }}>
          {meta.label}
        </span>
        <span style={{ fontSize: 11, color: P.muted, marginLeft: 'auto',
          fontFamily: "'Outfit', sans-serif" }}>
          {zone.axis_uaam && zone.axis_saikaku && `${axisLabel(zone.axis_uaam)} × ${saikakuLabel(zone.axis_saikaku)}`}
        </span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: P.text, marginBottom: 4,
        fontFamily: "'Noto Serif JP', serif" }}>{toJP(zone.label)}</div>

      {type === 'ignition' && zone.insight && (
        <div style={{ fontSize: 12, color: P.text, lineHeight: 1.7, opacity: 0.82,
          fontFamily: "'Noto Serif JP', serif" }}>{toJP(zone.insight)}</div>
      )}
      {type === 'latent' && (
        <>
          {zone.potential && (
            <div style={{ fontSize: 12, color: P.text, lineHeight: 1.7, opacity: 0.82,
              fontFamily: "'Noto Serif JP', serif" }}>{toJP(zone.potential)}</div>
          )}
          {zone.action && (
            <div style={{ marginTop: 6, padding: '6px 10px', background: `${meta.color}15`,
              borderRadius: 6, fontSize: 11, color: meta.color, fontWeight: 600,
              fontFamily: "'Noto Serif JP', serif" }}>
              → {toJP(zone.action)}
            </div>
          )}
        </>
      )}
      {type === 'idle' && (
        <>
          {zone.warning && (
            <div style={{ fontSize: 12, color: '#7D6608', lineHeight: 1.7,
              fontFamily: "'Noto Serif JP', serif" }}>{toJP(zone.warning)}</div>
          )}
          {zone.reframe && (
            <div style={{ marginTop: 6, padding: '6px 10px', background: `${meta.color}15`,
              borderRadius: 6, fontSize: 11, color: meta.color, fontWeight: 600,
              fontFamily: "'Noto Serif JP', serif" }}>
              ↺ {toJP(zone.reframe)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RoadmapRow({ period, text }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>
      <div style={{ minWidth: 52, height: 22, background: P.gold, borderRadius: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0,
        fontFamily: "'Outfit', sans-serif" }}>{period}</div>
      <div style={{ fontSize: 13, color: P.text, lineHeight: 1.7, paddingTop: 2,
        fontFamily: "'Noto Serif JP', serif" }}>{toJP(text)}</div>
    </div>
  );
}

function SectionHeader({ title, sub }) {
  return (
    <div style={{ marginBottom: 14, paddingBottom: 8, borderBottom: `1px solid ${P.border}` }}>
      <div style={{ fontSize: 10, letterSpacing: '0.15em', color: P.gold, fontWeight: 700,
        fontFamily: "'Outfit', sans-serif", marginBottom: 2 }}>{sub}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: P.text,
        fontFamily: "'Noto Serif JP', serif" }}>{title}</div>
    </div>
  );
}

/* ── ラベルヘルパー ─────────────────── */
function axisLabel(axis) {
  return { mindset: '志', literacy: '知', competency: '技', impact: '衝' }[axis] || axis || '';
}
function saikakuLabel(axis) {
  return { WHY: '価値観(WHY)', HOW: '才能(HOW)', WHAT: '情熱(WHAT)' }[axis] || axis || '';
}

// 既存の分析テキスト内の英語才覚名を日本語に置換
const EN_TO_JP = {
  Meaning: '基軸力', Mindfulness: '認知力', Mindshift: '転換力', Mastery: '熟達力',
  Learning: '謙学力', Logical: '論理力',    Life: '活用力',     Leadership: '統率力',
  Critical: '本質力', Creativity: '創造力', Communication: '伝達力', Collaboration: '協働力',
  Idea: '構想力',    Innovation: '変革力',  Implementation: '実装力', Influence: '影響力',
};
function toJP(text) {
  if (!text || typeof text !== 'string') return text;
  return Object.entries(EN_TO_JP).reduce(
    (s, [en, jp]) => s.replace(new RegExp(en, 'g'), jp),
    text
  );
}

function formatSavedTime(date) {
  if (!date) return '';
  const savedAt = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(savedAt.getTime())) return '';
  const hh = String(savedAt.getHours()).padStart(2, '0');
  const mm = String(savedAt.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/* ── メインコンポーネント ────────────── */
export default function SaikakuIntegration({
  integration,
  // issue-62: コーチング回答の保存
  answersMap = {},
  onSave,
  saving = false,
  lastSavedAt = null,
  // issue-44/46: per-pair integration / regenerate / readOnly
  source,
  regenerationCount,
  onRegenerate,
  onClose,
  status,
  defaultOpen = false,
  readOnly = false,
  hideCoachingAnswers = false,
  onDirtyChange,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [draftAnswers, setDraftAnswers] = useState([]);
  const [dirtyByQuestion, setDirtyByQuestion] = useState(() => new Map());
  const [saveError, setSaveError] = useState('');
  const coachingQuestions = useMemo(
    () => (Array.isArray(integration?.coaching_questions) ? integration.coaching_questions : []),
    [integration?.coaching_questions]
  );
  const answerEntries = useMemo(() => Object.values(answersMap || {}), [answersMap]);
  const savedTime = useMemo(() => formatSavedTime(lastSavedAt), [lastSavedAt]);
  const hasDraftAnswer = coachingQuestions.some((_, i) => (draftAnswers[i] || '').trim().length > 0);
  const canSave = !!onSave && !saving && hasDraftAnswer;

  useEffect(() => {
    onDirtyChange?.(dirtyByQuestion.size > 0);
  }, [dirtyByQuestion, onDirtyChange]);

  useEffect(() => {
    setDraftAnswers((prev) => {
      const next = coachingQuestions.map((questionText, i) => {
        // normalize同士で照合 — server側 sha1(normalize(text)) と等価のqid マッチ。
        // 末尾`？`違い・全角半角空白・NFKC 互換差を吸収する（issue #62 設計の本質）。
        const normalizedCurrent = normalizeQuestionText(questionText);
        if (!normalizedCurrent) return '';
        if (dirtyByQuestion.has(normalizedCurrent)) {
          return dirtyByQuestion.get(normalizedCurrent) ?? '';
        }
        const saved = answerEntries.find((entry) => {
          const normalizedSaved = normalizeQuestionText(entry?.questionText);
          return normalizedSaved !== null && normalizedSaved === normalizedCurrent;
        });
        return typeof saved?.answer === 'string' ? saved.answer : '';
      });
      const unchanged = next.length === prev.length
        && next.every((value, index) => value === prev[index]);
      return unchanged ? prev : next;
    });
  }, [answerEntries, coachingQuestions, dirtyByQuestion]);

  const updateDraftAnswer = (index, value) => {
    const normalizedKey = normalizeQuestionText(coachingQuestions[index]);
    if (normalizedKey) {
      const savedEntry = answerEntries.find((entry) => {
        const normalizedSaved = normalizeQuestionText(entry?.questionText);
        return normalizedSaved !== null && normalizedSaved === normalizedKey;
      });
      const savedAnswer = typeof savedEntry?.answer === 'string' ? savedEntry.answer : '';

      setDirtyByQuestion((prev) => {
        const next = new Map(prev);
        if (value === savedAnswer) {
          next.delete(normalizedKey);
        } else {
          next.set(normalizedKey, value);
        }
        return next;
      });
    }
    setDraftAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleSaveDrafts = async () => {
    if (!canSave) return;
    setSaveError('');
    const items = coachingQuestions
      .map((questionText, i) => ({ questionText, answer: draftAnswers[i] || '' }))
      .filter(({ questionText, answer }) => (
        typeof questionText === 'string'
        && questionText.trim().length > 0
        && answer.trim().length > 0
      ));
    if (items.length === 0) return;

    try {
      await onSave(items);
      const savedKeys = items
        .map((item) => normalizeQuestionText(item.questionText))
        .filter(Boolean);
      setDirtyByQuestion((prev) => {
        const next = new Map(prev);
        for (const key of savedKeys) next.delete(key);
        return next;
      });
    } catch (e) {
      setSaveError(e?.message || '回答を保存できませんでした。再度お試しください。');
    }
  };

  if (!integration) return null;

  const {
    integration_score = 0,
    activation_core = '',
    activation_equation = '',
    leverage_point = '',
    ignition_zones = [],
    latent_zones = [],
    idle_zones = [],
    mission_direction = '',
    flow_route = '',
    hidden_potential = '',
    roadmap = {},
  } = integration;

  return (
    <div style={{ marginTop: 0 }}>
      <SourceHeader source={source} />

      {/* ── ヘッダータップでアコーディオン ── */}
      <div
        role="region"
        aria-label="才覚発動統合分析ヘッダー"
        style={{
          background: `linear-gradient(135deg, #0D2137 0%, #1A3A52 100%)`,
          padding: '18px 20px 16px',
          borderTop: `3px solid ${P.gold}`,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-controls="saikaku-integration-body"
          style={{
            flex: '1 1 280px',
            minWidth: 0,
            width: '100%',
            textAlign: 'left',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            userSelect: 'none',
            padding: 0,
            font: 'inherit',
            color: 'inherit',
          }}
        >
          {/* タイトル行 */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 9, letterSpacing: '0.2em', color: P.gold, fontWeight: 700,
                fontFamily: "'Outfit', sans-serif", marginBottom: 4 }}>
                才覚 × UAAM INTEGRATION
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF',
                fontFamily: "'Noto Serif JP', serif" }}>
                才覚発動統合分析
              </div>
            </div>
            <div style={{
              flex: '0 0 auto',
              marginTop: 4,
              fontSize: 16, color: 'rgba(255,255,255,0.5)',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.25s ease',
            }}>▼</div>
          </div>

          {/* 才覚発動コア */}
          <div style={{
            marginTop: 12, padding: '10px 14px',
            background: 'rgba(255,255,255,0.07)', borderRadius: 8,
            borderLeft: `3px solid ${P.gold}`,
          }}>
            <div style={{ fontSize: 9, color: P.goldDim, fontWeight: 700, letterSpacing: '0.15em',
              fontFamily: "'Outfit', sans-serif", marginBottom: 3 }}>ACTIVATION CORE</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF', letterSpacing: '0.04em',
              fontFamily: "'Noto Serif JP', serif" }}>{toJP(activation_core)}</div>
          </div>

          {/* 発動方程式 */}
          {activation_equation && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.7)',
              lineHeight: 1.65, fontFamily: "'Noto Serif JP', serif",
              fontStyle: 'italic' }}>
              「{toJP(activation_equation)}」
            </div>
          )}
        </button>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flex: '0 1 auto',
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
        }}>
          <StatusBadge status={status} />
          {!readOnly && (
            <RegenerateButton
              regenerationCount={regenerationCount}
              onRegenerate={onRegenerate}
            />
          )}
          <ScoreRing score={integration_score} />
          {typeof onClose === 'function' && (
            <button
              type="button"
              aria-label="閉じる"
              onClick={onClose}
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.14)',
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.72)',
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* ── アコーディオン本体 ── */}
      {open && (
        <div id="saikaku-integration-body" style={{ background: P.surface, animation: 'amFadeIn 0.25s ease' }}>

          {/* 最高レバレッジポイント */}
          {leverage_point && (
            <div style={{
              margin: '0', padding: '14px 20px',
              background: `${P.gold}18`,
              borderBottom: `1px solid ${P.border}`,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 18 }}>🎯</span>
              <div>
                <div style={{ fontSize: 9, color: P.gold, fontWeight: 700, letterSpacing: '0.12em',
                  fontFamily: "'Outfit', sans-serif", marginBottom: 2 }}>
                  HIGHEST LEVERAGE — 今すぐの一手
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: P.text,
                  fontFamily: "'Noto Serif JP', serif" }}>{toJP(leverage_point)}</div>
              </div>
            </div>
          )}

          {/* ── ゾーン分析 ── */}
          <div style={{ padding: '20px 20px 4px' }}>
            <SectionHeader title="才覚発動ゾーン分析" sub="ACTIVATION ZONE MAPPING" />

            {ignition_zones.length > 0 && ignition_zones.map((z, i) => (
              <ZoneCard key={`ig-${i}`} zone={z} type="ignition" />
            ))}
            {latent_zones.length > 0 && latent_zones.map((z, i) => (
              <ZoneCard key={`lt-${i}`} zone={z} type="latent" />
            ))}
            {idle_zones.length > 0 && idle_zones.map((z, i) => (
              <ZoneCard key={`id-${i}`} zone={z} type="idle" />
            ))}
          </div>

          {/* ── ミッション方向性 ── */}
          {mission_direction && (
            <div style={{ padding: '0 20px 20px' }}>
              <SectionHeader title="使命の方向性" sub="MISSION DIRECTION" />
              <div style={{ fontSize: 13, color: P.text, lineHeight: 1.85,
                fontFamily: "'Noto Serif JP', serif", whiteSpace: 'pre-line' }}>
                {toJP(mission_direction)}
              </div>
            </div>
          )}

          {/* ── フロー状態 + 隠れポテンシャル ── */}
          <div style={{ padding: '0 20px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {flow_route && (
              <div style={{ background: '#EBF5FB', borderRadius: 10, padding: '14px',
                border: `1px solid ${P.ignition}22` }}>
                <div style={{ fontSize: 9, color: P.ignition, fontWeight: 700, letterSpacing: '0.12em',
                  fontFamily: "'Outfit', sans-serif", marginBottom: 6 }}>FLOW ROUTE</div>
                <div style={{ fontSize: 12, color: P.text, lineHeight: 1.7,
                  fontFamily: "'Noto Serif JP', serif" }}>{toJP(flow_route)}</div>
              </div>
            )}
            {hidden_potential && (
              <div style={{ background: '#EAFAF1', borderRadius: 10, padding: '14px',
                border: `1px solid ${P.latent}22` }}>
                <div style={{ fontSize: 9, color: P.latent, fontWeight: 700, letterSpacing: '0.12em',
                  fontFamily: "'Outfit', sans-serif", marginBottom: 6 }}>HIDDEN POTENTIAL</div>
                <div style={{ fontSize: 12, color: P.text, lineHeight: 1.7,
                  fontFamily: "'Noto Serif JP', serif" }}>{toJP(hidden_potential)}</div>
              </div>
            )}
          </div>

          {/* ── ロードマップ ── */}
          {(roadmap.now || roadmap.year1 || roadmap.year3 || roadmap.year10) && (
            <div style={{ padding: '0 20px 20px', borderTop: `1px solid ${P.border}`, paddingTop: 20 }}>
              <SectionHeader title="才覚発動ロードマップ" sub="ACTIVATION ROADMAP" />
              {roadmap.now   && <RoadmapRow period="NOW"   text={roadmap.now} />}
              {roadmap.year1 && <RoadmapRow period="1Y"    text={roadmap.year1} />}
              {roadmap.year3 && <RoadmapRow period="3Y"    text={roadmap.year3} />}
              {roadmap.year10 && <RoadmapRow period="10Y"  text={roadmap.year10} />}
            </div>
          )}

          {/* ── コーチングキー質問 ── */}
          {coachingQuestions.length > 0 && (
            <div style={{ padding: '0 20px 24px', borderTop: `1px solid ${P.border}`, paddingTop: 20 }}>
              <SectionHeader title="コーチングキー質問" sub="COACHING KEY QUESTIONS" />
              {coachingQuestions.map((q, i) => {
                const draft = draftAnswers[i] || '';
                return (
                  <div key={i} style={{ marginBottom: 16 }}>
                    <div style={{
                      display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start',
                    }}>
                      <div style={{
                        minWidth: 22, height: 22, background: `${P.gold}22`,
                        borderRadius: '50%', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 11, fontWeight: 700, color: P.gold,
                        flexShrink: 0, fontFamily: "'Outfit', sans-serif",
                      }}>{i + 1}</div>
                      <div style={{ fontSize: 13, color: P.text, lineHeight: 1.7, paddingTop: 1,
                        fontFamily: "'Noto Serif JP', serif" }}>{toJP(q)}</div>
                    </div>
                    {!hideCoachingAnswers && (
                      <textarea
                        value={draft}
                        onChange={(e) => updateDraftAnswer(i, e.target.value)}
                        disabled={saving}
                        rows={3}
                        maxLength={2000}
                        placeholder="あなたの考えを書いてみてください"
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          minHeight: 88,
                          padding: '10px 12px',
                          border: `1px solid ${P.border}`,
                          borderRadius: 8,
                          background: saving ? '#F7F3EC' : P.surface,
                          color: P.text,
                          fontSize: 13,
                          lineHeight: 1.7,
                          fontFamily: "'Noto Serif JP', serif",
                          resize: 'vertical',
                          outlineOffset: 2,
                          opacity: saving ? 0.72 : 1,
                        }}
                      />
                    )}
                  </div>
                );
              })}
              {!hideCoachingAnswers && (
                <>
                  <button
                    type="button"
                    onClick={handleSaveDrafts}
                    disabled={!canSave}
                    style={{
                      width: '100%',
                      marginTop: 2,
                      padding: '12px 16px',
                      border: 'none',
                      borderRadius: 8,
                      background: canSave
                        ? `linear-gradient(135deg, ${P.gold} 0%, ${P.goldDim} 100%)`
                        : P.border,
                      color: canSave ? '#fff' : P.muted,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: canSave ? 'pointer' : 'not-allowed',
                      fontFamily: "'Noto Serif JP', serif",
                      transition: 'opacity 0.2s ease',
                      outlineOffset: 2,
                    }}
                  >
                    {saving ? '保存中…' : '💾 回答を保存'}
                  </button>
                  {saveError && (
                    <div role="alert" style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: P.score_lo,
                      textAlign: 'center',
                      fontFamily: "'Noto Serif JP', serif",
                    }}>
                      {saveError}
                    </div>
                  )}
                  {savedTime && (
                    <div style={{
                      marginTop: 8,
                      fontSize: 11,
                      color: P.muted,
                      textAlign: 'center',
                      fontFamily: "'Outfit', sans-serif",
                    }}>
                      最終保存: {savedTime}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
