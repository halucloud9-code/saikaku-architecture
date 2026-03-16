import { useState } from 'react';
import { signOutUser } from '../firebase';

const UAAM_PASS = 'kokusogaku';

export default function SelectScreen({ user, isAdmin, onSelectSaikaku, onSelectUaam, onAdmin, onLogout }) {
  const [showPassModal, setShowPassModal] = useState(false);
  const [pass, setPass] = useState('');
  const [passError, setPassError] = useState('');
  const [hoverA, setHoverA] = useState(false);
  const [hoverB, setHoverB] = useState(false);

  const handleUaamClick = () => { setPass(''); setPassError(''); setShowPassModal(true); };
  const handlePassSubmit = () => {
    if (pass === UAAM_PASS) { setShowPassModal(false); onSelectUaam(); }
    else { setPassError('パスワードが正しくありません'); }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#09090B' }}>
      {/* ヘッダー */}
      <div style={{
        padding: '16px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid #18181B',
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', color: '#52525B', textTransform: 'uppercase' }}>
          Saikaku Architecture
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isAdmin && (
            <button onClick={onAdmin} style={{
              fontSize: 12, color: '#A1A1AA', background: 'none',
              border: 'none', cursor: 'pointer', padding: 0,
            }}>管理</button>
          )}
          <span style={{ fontSize: 12, color: '#52525B' }}>{user?.displayName}</span>
          <button onClick={async () => { await signOutUser(); onLogout(); }} style={{
            fontSize: 12, color: '#52525B', background: 'none',
            border: 'none', cursor: 'pointer', padding: 0,
          }}>ログアウト</button>
        </div>
      </div>

      {/* メイン */}
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '80px 24px 60px' }}>
        <p style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.2em',
          color: '#52525B', textTransform: 'uppercase', margin: '0 0 12px',
        }}>Select Program</p>
        <h1 style={{
          fontFamily: "'Noto Serif JP', 'Times New Roman', serif",
          fontSize: 36, fontWeight: 900, color: '#FAFAFA',
          margin: '0 0 12px', lineHeight: 1.15, letterSpacing: '-0.01em',
        }}>診断を選ぶ</h1>
        <p style={{ fontSize: 15, color: '#71717A', margin: '0 0 48px', lineHeight: 1.7 }}>
          あなたの才覚を解き明かすプログラムを選択してください
        </p>

        {/* カードグリッド */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* 才覚領域 */}
          <button
            onClick={onSelectSaikaku}
            onMouseEnter={() => setHoverA(true)}
            onMouseLeave={() => setHoverA(false)}
            style={{
              width: '100%', textAlign: 'left', cursor: 'pointer',
              background: hoverA ? '#18181B' : '#111113',
              border: 'none', padding: '32px 28px',
              borderRadius: '8px 8px 0 0',
              transition: 'background 0.2s ease',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: '0.15em',
                  color: '#C4922A', textTransform: 'uppercase', margin: '0 0 12px',
                }}>Unique Ability</p>
                <h2 style={{
                  fontFamily: "'Noto Serif JP', 'Times New Roman', serif",
                  fontSize: 24, fontWeight: 800, color: '#FAFAFA',
                  margin: '0 0 8px', letterSpacing: '0.02em',
                }}>才覚領域</h2>
                <p style={{ fontSize: 13, color: '#71717A', margin: 0, lineHeight: 1.8 }}>
                  才能 × 価値観 × 情熱の化学反応から<br />
                  あなただけの才覚領域を導き出す
                </p>
              </div>
              <span style={{
                fontSize: 20, color: hoverA ? '#FAFAFA' : '#3F3F46',
                transition: 'all 0.2s ease',
                transform: hoverA ? 'translateX(4px)' : 'none',
                display: 'inline-block', marginTop: 8,
              }}>→</span>
            </div>
          </button>

          {/* 才覚発動領域 */}
          <button
            onClick={handleUaamClick}
            onMouseEnter={() => setHoverB(true)}
            onMouseLeave={() => setHoverB(false)}
            style={{
              width: '100%', textAlign: 'left', cursor: 'pointer',
              background: hoverB ? '#18181B' : '#111113',
              border: 'none', padding: '32px 28px',
              borderRadius: '0 0 8px 8px',
              transition: 'background 0.2s ease',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: '0.15em',
                  color: '#4A6FA5', textTransform: 'uppercase', margin: '0 0 12px',
                }}>Activation Matrix</p>
                <h2 style={{
                  fontFamily: "'Noto Serif JP', 'Times New Roman', serif",
                  fontSize: 24, fontWeight: 800, color: '#FAFAFA',
                  margin: '0 0 4px', letterSpacing: '0.02em',
                }}>才覚発動領域</h2>
                <p style={{
                  fontSize: 11, color: '#4A6FA5', margin: '0 0 8px',
                  fontWeight: 500, letterSpacing: '0.1em',
                }}>志 · 知 · 技 · 衝</p>
                <p style={{ fontSize: 13, color: '#71717A', margin: 0, lineHeight: 1.8 }}>
                  48問で4軸16項目を分析し、才覚発動マトリクスを可視化
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                <span style={{ fontSize: 11, color: '#3F3F46', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <span style={{
                  fontSize: 20, color: hoverB ? '#FAFAFA' : '#3F3F46',
                  transition: 'all 0.2s ease',
                  transform: hoverB ? 'translateX(4px)' : 'none',
                  display: 'inline-block',
                }}>→</span>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* パスワードモーダル */}
      {showPassModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20,
        }} onClick={() => setShowPassModal(false)}>
          <div style={{
            background: '#111113', border: '1px solid #27272A',
            borderRadius: 8, padding: '32px 28px',
            width: '100%', maxWidth: 360,
          }} onClick={e => e.stopPropagation()}>
            <p style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '0.15em',
              color: '#4A6FA5', textTransform: 'uppercase', margin: '0 0 8px',
            }}>Activation Matrix</p>
            <h2 style={{
              fontFamily: "'Noto Serif JP', 'Times New Roman', serif",
              fontSize: 20, fontWeight: 800, color: '#FAFAFA', margin: '0 0 20px',
            }}>パスワードを入力</h2>
            <input
              type="password" value={pass}
              onChange={e => { setPass(e.target.value); setPassError(''); }}
              onKeyDown={e => e.key === 'Enter' && handlePassSubmit()}
              placeholder="パスワード" autoFocus
              style={{
                width: '100%', padding: '12px 14px', fontSize: 14,
                border: `1px solid ${passError ? '#EF4444' : '#27272A'}`,
                borderRadius: 6, outline: 'none', boxSizing: 'border-box',
                background: '#09090B', color: '#FAFAFA',
              }}
            />
            {passError && (
              <p style={{ fontSize: 12, color: '#EF4444', margin: '8px 0 0' }}>{passError}</p>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={() => setShowPassModal(false)} style={{
                flex: 1, padding: '10px', borderRadius: 6,
                border: '1px solid #27272A', background: 'none',
                color: '#71717A', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>キャンセル</button>
              <button onClick={handlePassSubmit} style={{
                flex: 1, padding: '10px', borderRadius: 6, border: 'none',
                background: '#FAFAFA', color: '#09090B',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>確認</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
