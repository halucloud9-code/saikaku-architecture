import { useState, useEffect, useRef } from 'react';
import { doc, setDoc, getDocs, collection, serverTimestamp } from 'firebase/firestore';
import { db, signOutUser } from '../../firebase';
import { PRESENTERS, EVENT_ID } from '../uaam16';
import PresenterCard from '../components/PresenterCard';
import UAAMTagPicker from '../components/UAAMTagPicker';
import TalkLevelSelector from '../components/TalkLevelSelector';

const S = {
  app: {
    maxWidth: 720, margin: '0 auto', minHeight: '100vh',
    padding: 16, background: '#0a0a0b', color: '#f4f4f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", sans-serif',
    fontSize: 15, lineHeight: 1.6,
  },
};

function Toast({ msg, show }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: '#10b981', color: '#fff', padding: '10px 20px', borderRadius: 24,
      fontSize: 13, fontWeight: 600,
      opacity: show ? 1 : 0, pointerEvents: 'none',
      transition: 'opacity 0.2s',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      zIndex: 100,
    }}>
      {msg}
    </div>
  );
}

export default function AlphaInput({ user, onLogout }) {
  const [saved, setSaved] = useState(new Map());
  const [current, setCurrent] = useState(null);
  const [tags, setTags] = useState(new Set());
  const [talkLevel, setTalkLevel] = useState(null);
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '' });
  const [loading, setLoading] = useState(true);
  const panelRef = useRef(null);

  // 既存保存データをロード
  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(
          collection(db, 'alpha_events', EVENT_ID, 'resonance')
        );
        const map = new Map();
        snap.forEach(d => {
          const data = d.data();
          if (data.fromUid === user.uid) {
            map.set(data.toUid, data);
          }
        });
        setSaved(map);
      } catch (e) {
        console.warn('[Alpha] load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user.uid]);

  const selectPresenter = (p) => {
    const prev = saved.get(p.uid);
    setCurrent(p);
    setTags(new Set(prev?.tags ?? []));
    setTalkLevel(prev?.talkLevel ?? null);
    setMemo(prev?.memo ?? '');
    setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const handleSave = async () => {
    if (!talkLevel || !current) return;
    setSaving(true);
    try {
      const docId = `${user.uid}__${current.uid}`;
      const data = {
        fromUid: user.uid,
        fromName: user.displayName || user.email || '',
        toUid: current.uid,
        toName: current.name,
        tags: Array.from(tags),
        talkLevel,
        memo,
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, 'alpha_events', EVENT_ID, 'resonance', docId), data);
      setSaved(prev => new Map(prev).set(current.uid, data));
      showToast('保存しました');

      const nextUnsaved = PRESENTERS.find(p => !saved.has(p.uid) && p.uid !== current.uid);
      if (nextUnsaved) {
        setTimeout(() => selectPresenter(nextUnsaved), 400);
      } else {
        setCurrent(null);
      }
    } catch (e) {
      console.error('[Alpha] save error:', e);
      showToast('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const showToast = (msg) => {
    setToast({ show: true, msg });
    setTimeout(() => setToast({ show: false, msg: '' }), 1800);
  };

  const progress = saved.size;
  const total = PRESENTERS.length - 1;

  if (loading) {
    return (
      <div style={{ ...S.app, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          border: '3px solid #2a2a35', borderTopColor: '#e63946',
          animation: 'spin 1s linear infinite',
        }} />
      </div>
    );
  }

  return (
    <div style={S.app}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 4px 16px', borderBottom: '1px solid #2a2a35', marginBottom: 20,
      }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>α共鳴シート</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 12, color: '#71717a' }}>進捗 {progress}/{total}</div>
          <button onClick={onLogout} style={{
            background: 'transparent', border: '1px solid #2a2a35',
            color: '#71717a', fontSize: 11, padding: '4px 10px',
            borderRadius: 6, cursor: 'pointer',
          }}>ログアウト</button>
        </div>
      </div>

      {/* Presenter grid */}
      <div style={{ fontSize: 11, color: '#71717a', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 10 }}>
        話し手を選択
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
        gap: 10, marginBottom: 24,
      }}>
        {PRESENTERS.map(p => (
          <PresenterCard
            key={p.uid}
            presenter={p}
            done={saved.has(p.uid)}
            active={current?.uid === p.uid}
            onClick={() => selectPresenter(p)}
          />
        ))}
      </div>

      {/* Input panel */}
      {current ? (
        <div ref={panelRef} style={{
          background: '#14141a', border: '1px solid #2a2a35',
          borderRadius: 12, padding: 20, marginBottom: 20,
        }}>
          {/* Presenter info */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14,
            paddingBottom: 16, borderBottom: '1px solid #2a2a35', marginBottom: 18,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: '#1c1c24', border: '1px solid #2a2a35',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 700, color: '#a1a1aa', flexShrink: 0,
            }}>
              {current.name.charAt(0)}
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{current.name}</div>
              <div style={{ fontSize: 12, color: '#71717a', marginTop: 2 }}>話し手</div>
            </div>
          </div>

          {/* Saikaku readonly */}
          <div style={{
            background: 'rgba(255,255,255,0.02)', borderRadius: 8,
            padding: '12px 14px', marginBottom: 18, fontSize: 12,
          }}>
            {[['価値観', current.values], ['才能', current.talents], ['情熱', current.passions]].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 8, padding: '4px 0' }}>
                <span style={{ color: '#71717a', flexShrink: 0, width: 44 }}>{k}</span>
                <span style={{ color: '#a1a1aa' }}>{v}</span>
              </div>
            ))}
          </div>

          {/* UAAM tag picker */}
          <div style={{ marginBottom: 18 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              fontSize: 13, color: '#a1a1aa', marginBottom: 8,
            }}>
              <span>見えた才覚（最大3つ）</span>
              <span style={{ fontSize: 11, color: '#71717a' }}>{tags.size}/3</span>
            </div>
            <UAAMTagPicker selected={tags} onChange={setTags} />
          </div>

          {/* Talk level */}
          <div style={{ marginBottom: 18 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              fontSize: 13, color: '#a1a1aa', marginBottom: 8,
            }}>
              <span>後で話したい度</span>
              <span style={{ fontSize: 11, color: '#71717a' }}>必須</span>
            </div>
            <TalkLevelSelector value={talkLevel} onChange={setTalkLevel} />
          </div>

          {/* Memo */}
          <div style={{ marginBottom: 18 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
              fontSize: 13, color: '#a1a1aa', marginBottom: 8,
            }}>
              <span>メモ（任意）</span>
              <span style={{ fontSize: 11, color: '#71717a' }}>80字</span>
            </div>
            <textarea
              value={memo}
              onChange={e => setMemo(e.target.value)}
              maxLength={80}
              rows={2}
              placeholder="ひとこと..."
              style={{
                width: '100%', background: '#0a0a0b', border: '1px solid #2a2a35',
                borderRadius: 8, color: '#f4f4f5', padding: '10px 12px',
                fontSize: 13, fontFamily: 'inherit', resize: 'none',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setCurrent(null)}
              style={{
                padding: '14px 16px', background: 'transparent', color: '#a1a1aa',
                border: '1px solid #2a2a35', borderRadius: 8, cursor: 'pointer', fontSize: 13,
              }}
            >
              閉じる
            </button>
            <button
              onClick={handleSave}
              disabled={!talkLevel || saving}
              style={{
                flex: 1, padding: '14px 20px',
                background: talkLevel && !saving ? '#e63946' : '#2a2a35',
                color: '#fff', border: 'none', borderRadius: 8,
                fontSize: 15, fontWeight: 700, cursor: talkLevel && !saving ? 'pointer' : 'not-allowed',
                opacity: talkLevel && !saving ? 1 : 0.5,
              }}
            >
              {saving ? '保存中…' : '保存して次へ'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          color: '#71717a', fontSize: 14,
        }}>
          {progress >= total ? (
            <>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.6 }}>✓</div>
              全員分入力完了。お疲れさま。
            </>
          ) : (
            <>
              <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>◎</div>
              上のリストから話し手を選んで入力を始める
            </>
          )}
        </div>
      )}

      <Toast msg={toast.msg} show={toast.show} />
    </div>
  );
}
