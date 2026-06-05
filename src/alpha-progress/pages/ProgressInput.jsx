import { useState, useEffect, useRef } from 'react';
import { doc, setDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { GROUPS, EVENT_ID, EVENT_TITLE, SAIKAKU_TAGS, AFFINITY_DOMAINS, RESONANCE_ACTIONS } from '../data';
import GroupCard from '../components/GroupCard';
import TalkLevelSelector from '../../alpha/components/TalkLevelSelector';

const T = {
  bg: '#F5F0E8',
  card: '#FFFFFF',
  border: '#E0D8CE',
  borderSubtle: '#EDE8E0',
  text: '#2A2520',
  muted: '#8A7A6A',
  sub: '#6A5A4A',
  accent: '#C4922A',
  accentBg: 'rgba(196,146,42,0.10)',
  fontFamily: "'Noto Serif JP', 'Hiragino Sans', sans-serif",
};

const S = {
  app: {
    maxWidth: 760, margin: '0 auto', minHeight: '100vh',
    padding: 16, background: T.bg, color: T.text,
    fontFamily: T.fontFamily, fontSize: 15, lineHeight: 1.6,
  },
  label: {
    fontSize: 13, color: T.sub, marginBottom: 8,
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
  },
  section: { marginBottom: 22 },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  textarea: {
    width: '100%', background: T.bg, border: `1px solid ${T.border}`,
    borderRadius: 8, color: T.text, padding: '10px 12px',
    fontSize: 13, fontFamily: 'inherit', resize: 'none',
    outline: 'none', boxSizing: 'border-box',
  },
};

function Chip({ label, active, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled && !active}
      style={{
        padding: '6px 14px', borderRadius: 20,
        cursor: disabled && !active ? 'default' : 'pointer',
        border: `1px solid ${active ? T.accent : T.border}`,
        background: active ? T.accentBg : T.card,
        color: active ? T.accent : disabled && !active ? T.border : T.sub,
        fontSize: 13, fontWeight: active ? 600 : 400,
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );
}

function Toast({ msg, show }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: T.accent, color: '#fff', padding: '10px 20px', borderRadius: 24,
      fontSize: 13, fontWeight: 600,
      opacity: show ? 1 : 0, pointerEvents: 'none',
      transition: 'opacity 0.2s',
      boxShadow: '0 8px 24px rgba(196,146,42,0.3)', zIndex: 100,
    }}>
      {msg}
    </div>
  );
}

const EMPTY_FORM = {
  saikaku: [], saikakuOther: '',
  domains: [], domainsOther: '',
  actions: [],
  help: '', oneworld: '',
  talkLevel: null,
};

function formFromSaved(data) {
  if (!data) return EMPTY_FORM;
  const saikakuOtherEntry = (data.saikaku ?? []).find(s => s.startsWith('その他:'));
  const domainsOtherEntry = (data.domains ?? []).find(s => s.startsWith('その他:'));
  return {
    saikaku: (data.saikaku ?? []).map(s => s.startsWith('その他:') ? 'その他' : s),
    saikakuOther: saikakuOtherEntry ? saikakuOtherEntry.slice(4) : '',
    domains: (data.domains ?? []).map(s => s.startsWith('その他:') ? 'その他' : s),
    domainsOther: domainsOtherEntry ? domainsOtherEntry.slice(4) : '',
    actions: data.actions ?? [],
    help: data.help ?? '',
    oneworld: data.oneworld ?? '',
    talkLevel: data.talkLevel ?? null,
  };
}

export default function ProgressInput({ user, onLogout }) {
  const [saved, setSaved] = useState(new Map());
  const [current, setCurrent] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '' });
  const [loading, setLoading] = useState(true);
  const panelRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(collection(db, 'alpha_events', EVENT_ID, 'resonance'));
        const map = new Map();
        snap.forEach(d => {
          const data = d.data();
          if (data.fromUid === user.uid) map.set(data.toUid, data);
        });
        setSaved(map);
      } catch (e) {
        console.warn('[Progress] load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user.uid]);

  const selectGroup = (g) => {
    setCurrent(g);
    setForm(formFromSaved(saved.get(g.id)));
    setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const toggleSet = (key, value, max) => {
    setForm(f => {
      const arr = f[key];
      if (arr.includes(value)) return { ...f, [key]: arr.filter(v => v !== value) };
      if (max && arr.length >= max) return f;
      return { ...f, [key]: [...arr, value] };
    });
  };

  const showToast = (msg) => {
    setToast({ show: true, msg });
    setTimeout(() => setToast({ show: false, msg: '' }), 1800);
  };

  const handleSave = async () => {
    if (!form.talkLevel || !current) return;
    setSaving(true);
    try {
      const saikakuFinal = form.saikaku.map(s =>
        s === 'その他' ? `その他:${form.saikakuOther}` : s
      );
      const domainsFinal = form.domains.map(s =>
        s === 'その他' ? `その他:${form.domainsOther}` : s
      );
      const data = {
        fromUid: user.uid,
        fromName: user.displayName || user.email || '',
        toUid: current.id,
        toName: current.name,
        presenter: current.presenter,
        saikaku: saikakuFinal,
        domains: domainsFinal,
        actions: form.actions,
        help: form.help,
        oneworld: form.oneworld,
        talkLevel: form.talkLevel,
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'alpha_events', EVENT_ID, 'resonance', `${user.uid}__${current.id}`), data);
      setSaved(prev => new Map(prev).set(current.id, data));
      showToast('保存しました');

      const nextUnsaved = GROUPS.find(g => !saved.has(g.id) && g.id !== current.id);
      if (nextUnsaved) {
        setTimeout(() => selectGroup(nextUnsaved), 400);
      } else {
        setCurrent(null);
      }
    } catch (e) {
      console.error('[Progress] save error:', e);
      showToast('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const progress = saved.size;
  const total = GROUPS.length;

  if (loading) {
    return (
      <div style={{ ...S.app, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: `3px solid ${T.border}`, borderTopColor: T.accent,
          animation: 'spin 1s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={S.app}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 4px 16px', borderBottom: `1px solid ${T.border}`, marginBottom: 20,
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{EVENT_TITLE}</div>
          <div style={{ fontSize: 11, color: T.accent, letterSpacing: '0.12em', marginTop: 2 }}>
            RETREAT α 2026 ・ 進捗報告会 6/6
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 12, color: T.muted }}>進捗 {progress}/{total}</div>
          <button onClick={onLogout} style={{
            background: 'transparent', border: `1px solid ${T.border}`,
            color: T.muted, fontSize: 11, padding: '4px 10px',
            borderRadius: 6, cursor: 'pointer',
          }}>ログアウト</button>
        </div>
      </div>

      {/* Group grid */}
      <div style={{ fontSize: 11, color: T.muted, letterSpacing: '0.06em', marginBottom: 10 }}>
        発表グループを選択 ── 各事業の発表（①進捗／②行き詰まり／③今後／④One World活用）を聞いて記入
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
        gap: 12, marginBottom: 24,
      }}>
        {GROUPS.map(g => (
          <GroupCard
            key={g.id}
            group={g}
            done={saved.has(g.id)}
            active={current?.id === g.id}
            onClick={() => selectGroup(g)}
          />
        ))}
      </div>

      {/* Input panel */}
      {current ? (
        <div ref={panelRef} style={{
          background: T.card, border: `1px solid ${T.border}`,
          borderRadius: 12, padding: 20, marginBottom: 20,
          boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
        }}>
          {/* Group info */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            paddingBottom: 16, borderBottom: `1px solid ${T.borderSubtle}`, marginBottom: 16,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: T.bg, border: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, fontWeight: 800, color: T.accent, flexShrink: 0,
            }}>
              {current.icon}
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: T.text, lineHeight: 1.35 }}>{current.name}</div>
              <div style={{ fontSize: 12, color: T.accent, marginTop: 3, fontWeight: 700 }}>
                発表：{current.presenter}
                {current.members && current.members.length ? `　｜　メンバー：${current.members.join('・')}` : ''}
              </div>
            </div>
          </div>

          {/* Talk guide */}
          <div style={{
            background: T.accentBg, border: '1px solid #ECE0C4', borderRadius: 10,
            padding: '11px 14px', marginBottom: 20, fontSize: 12, color: '#7a6a3a', lineHeight: 1.7,
          }}>
            この発表で語られること ▶ <b>①進捗</b>（αからどう動いたか）／<b>②行き詰まり</b>（正直に）／<b>③今後の計画</b>／<b>④10/18 One World の活用法</b>。
            特に<b>②と④</b>に「自分が力になれること」を見つけたら、それがマッチングです。
          </div>

          {/* ① 才覚で感じたもの */}
          <div style={S.section}>
            <div style={S.label}>
              <span>① この事業に感じた才覚</span>
              <span style={{ fontSize: 11, color: T.muted }}>最大3つ　{form.saikaku.length}/3</span>
            </div>
            <div style={S.chips}>
              {SAIKAKU_TAGS.map(tag => (
                <Chip
                  key={tag} label={tag}
                  active={form.saikaku.includes(tag)}
                  onClick={() => toggleSet('saikaku', tag, 3)}
                  disabled={form.saikaku.length >= 3}
                />
              ))}
            </div>
            {form.saikaku.includes('その他') && (
              <input
                value={form.saikakuOther}
                onChange={e => setForm(f => ({ ...f, saikakuOther: e.target.value }))}
                placeholder="具体的に..."
                maxLength={40}
                style={{
                  marginTop: 8, width: '100%', background: T.bg,
                  border: `1px solid ${T.border}`, borderRadius: 8,
                  color: T.text, padding: '8px 12px', fontSize: 13,
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                }}
              />
            )}
          </div>

          {/* ② 響いた領域 */}
          <div style={S.section}>
            <div style={S.label}>
              <span>② 響いた／可能性を感じた領域</span>
              <span style={{ fontSize: 11, color: T.muted }}>複数可</span>
            </div>
            <div style={S.chips}>
              {AFFINITY_DOMAINS.map(tag => (
                <Chip
                  key={tag} label={tag}
                  active={form.domains.includes(tag)}
                  onClick={() => toggleSet('domains', tag, null)}
                  disabled={false}
                />
              ))}
            </div>
            {form.domains.includes('その他') && (
              <input
                value={form.domainsOther}
                onChange={e => setForm(f => ({ ...f, domainsOther: e.target.value }))}
                placeholder="具体的に..."
                maxLength={40}
                style={{
                  marginTop: 8, width: '100%', background: T.bg,
                  border: `1px solid ${T.border}`, borderRadius: 8,
                  color: T.text, padding: '8px 12px', fontSize: 13,
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                }}
              />
            )}
          </div>

          {/* ③ この事業と… */}
          <div style={S.section}>
            <div style={S.label}>
              <span>③ この事業と…</span>
              <span style={{ fontSize: 11, color: T.muted }}>複数可</span>
            </div>
            <div style={S.chips}>
              {RESONANCE_ACTIONS.map(tag => (
                <Chip
                  key={tag} label={tag}
                  active={form.actions.includes(tag)}
                  onClick={() => toggleSet('actions', tag, null)}
                  disabled={false}
                />
              ))}
            </div>
          </div>

          {/* ④ ★行き詰まりに力になれること */}
          <div style={S.section}>
            <div style={S.label}>
              <span>④ ★②の行き詰まりに「私が力になれる」こと・繋げられる人</span>
              <span style={{ fontSize: 11, color: T.muted }}>任意・マッチング</span>
            </div>
            <textarea
              value={form.help}
              onChange={e => setForm(f => ({ ...f, help: e.target.value }))}
              maxLength={200} rows={2}
              placeholder="例：その集客なら○○さんを紹介できる／そのシステムは私が組める..."
              style={S.textarea}
            />
          </div>

          {/* ⑤ ★One World活用 */}
          <div style={S.section}>
            <div style={S.label}>
              <span>⑤ ★10/18 One World での活用・一緒にやれること</span>
              <span style={{ fontSize: 11, color: T.muted }}>任意</span>
            </div>
            <textarea
              value={form.oneworld}
              onChange={e => setForm(f => ({ ...f, oneworld: e.target.value }))}
              maxLength={200} rows={2}
              placeholder="例：安田講堂のこの枠でこう出せる／このブースで組める..."
              style={S.textarea}
            />
          </div>

          {/* ⑥ 後で話したい度 */}
          <div style={S.section}>
            <div style={S.label}>
              <span>⑥ 後で話したい度</span>
              <span style={{ fontSize: 11, color: '#a84432' }}>必須</span>
            </div>
            <TalkLevelSelector value={form.talkLevel} onChange={v => setForm(f => ({ ...f, talkLevel: v }))} />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setCurrent(null)}
              style={{
                padding: '14px 16px', background: 'transparent', color: T.sub,
                border: `1px solid ${T.border}`, borderRadius: 8, cursor: 'pointer', fontSize: 13,
              }}
            >
              閉じる
            </button>
            <button
              onClick={handleSave}
              disabled={!form.talkLevel || saving}
              style={{
                flex: 1, padding: '14px 20px',
                background: form.talkLevel && !saving ? T.accent : T.border,
                color: '#fff', border: 'none', borderRadius: 8,
                fontSize: 15, fontWeight: 700,
                cursor: form.talkLevel && !saving ? 'pointer' : 'not-allowed',
                opacity: form.talkLevel && !saving ? 1 : 0.6,
                transition: 'background 0.2s',
              }}
            >
              {saving ? '保存中…' : '保存して次へ'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: T.muted, fontSize: 14 }}>
          {progress >= total ? (
            <>
              <div style={{ fontSize: 32, marginBottom: 12, color: T.accent, opacity: 0.7 }}>✓</div>
              全事業分の入力が完了しました。お疲れさま。
            </>
          ) : (
            <>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>◎</div>
              上のリストから発表グループを選んで入力を始める
            </>
          )}
        </div>
      )}

      <Toast msg={toast.msg} show={toast.show} />
    </div>
  );
}
