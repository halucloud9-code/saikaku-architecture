import { useState } from 'react';
import { signOutUser } from '../firebase';

const LIGHT_BG = '#F5F0E8';
const WHITE = '#FFFFFF';
const BORDER = '#D4C9B0';
const TEXT_PRIMARY = '#1A1A1A';
const TEXT_MUTED = '#7A7060';
const ACCENT_GOLD = '#C4922A';
const UAAM_PASS = 'kokusogaku';

export default function SelectScreen({ user, isAdmin, onSelectSaikaku, onSelectUaam, onAdmin, onLogout }) {
  const [showPassModal, setShowPassModal] = useState(false);
  const [pass, setPass] = useState('');
  const [passError, setPassError] = useState('');

  const handleUaamClick = () => {
    setPass('');
    setPassError('');
    setShowPassModal(true);
  };

  const handlePassSubmit = () => {
    if (pass === UAAM_PASS) {
      setShowPassModal(false);
      onSelectUaam();
    } else {
      setPassError('パスワードが正しくありません');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: LIGHT_BG }}>
      {/* ヘッダー */}
      <div style={{
        background: WHITE, borderBottom: `1px solid ${BORDER}`,
        padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {user?.photoURL && (
            <img src={user.photoURL} alt="" style={{ width: 32, height: 32, borderRadius: '50%' }} />
          )}
          <span style={{ fontSize: 13, color: TEXT_PRIMARY }}>{user?.displayName}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isAdmin && (
            <button onClick={onAdmin} style={{
              fontSize: 12, color: TEXT_MUTED, background: 'none', border: `1px solid ${BORDER}`,
              borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
            }}>管理</button>
          )}
          <button onClick={async () => { await signOutUser(); onLogout(); }} style={{
            fontSize: 12, color: TEXT_MUTED, background: 'none', border: `1px solid ${BORDER}`,
            borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
          }}>ログアウト</button>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div style={{
        maxWidth: 480, margin: '0 auto', padding: '40px 20px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: ACCENT_GOLD,
            textTransform: 'uppercase', marginBottom: 8,
          }}>Select Program</div>
          <h1 style={{
            fontSize: 24, fontWeight: 900, color: TEXT_PRIMARY, margin: 0,
            fontFamily: "'Noto Serif JP', Georgia, serif",
          }}>診断プログラム選択</h1>
          <p style={{ fontSize: 13, color: TEXT_MUTED, marginTop: 8 }}>
            受けたい診断を選択してください
          </p>
        </div>

        {/* 才覚領域カード */}
        <button onClick={onSelectSaikaku} style={{
          width: '100%', background: WHITE, border: `2px solid ${BORDER}`,
          borderRadius: 16, padding: '28px 24px', cursor: 'pointer',
          textAlign: 'left', transition: 'all 0.2s',
        }}>
          <div style={{
            background: `linear-gradient(135deg, ${ACCENT_GOLD}18, ${ACCENT_GOLD}08)`,
            borderRadius: 10, padding: '20px 18px',
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: ACCENT_GOLD,
              textTransform: 'uppercase', marginBottom: 6,
            }}>Unique Ability</div>
            <div style={{
              fontSize: 22, fontWeight: 900, color: TEXT_PRIMARY,
              fontFamily: "'Noto Serif JP', Georgia, serif", marginBottom: 4,
            }}>才覚領域</div>
            <div style={{
              fontSize: 12, fontWeight: 600, color: TEXT_MUTED, marginBottom: 12,
              letterSpacing: '0.04em',
            }}>Architecture</div>
            <p style={{ fontSize: 13, color: TEXT_MUTED, margin: 0, lineHeight: 1.8 }}>
              才能 × 価値観 × 情熱<br />
              化学反応を起こす<br />
              あなただけの才覚領域を見つけだす
            </p>
          </div>
        </button>

        {/* UAAMカード */}
        <button onClick={handleUaamClick} style={{
          width: '100%', background: WHITE, border: `2px solid ${BORDER}`,
          borderRadius: 16, padding: '28px 24px', cursor: 'pointer',
          textAlign: 'left', transition: 'all 0.2s',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #4A6FA518, #4A6FA508)',
            borderRadius: 10, padding: '20px 18px',
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: '#4A6FA5',
              textTransform: 'uppercase', marginBottom: 6,
            }}>Unique Ability Activation Matrix</div>
            <div style={{
              fontSize: 22, fontWeight: 900, color: TEXT_PRIMARY,
              fontFamily: "'Noto Serif JP', Georgia, serif", marginBottom: 4,
            }}>UAAM 診断</div>
            <div style={{
              fontSize: 12, fontWeight: 600, color: TEXT_MUTED, marginBottom: 12,
              letterSpacing: '0.04em',
            }}>志 · 知 · 技 · 衝</div>
            <p style={{ fontSize: 13, color: TEXT_MUTED, margin: 0, lineHeight: 1.8 }}>
              48問の診断で4軸16項目を分析し<br />
              才覚活動領域マトリクスを可視化します
            </p>
            <div style={{
              marginTop: 12, fontSize: 11, color: '#4A6FA5', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{ fontSize: 14 }}>🔒</span> パスワードが必要です
            </div>
          </div>
        </button>
      </div>

      {/* パスワードモーダル */}
      {showPassModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20,
        }} onClick={() => setShowPassModal(false)}>
          <div style={{
            background: WHITE, borderRadius: 16, padding: '32px 28px',
            width: '100%', maxWidth: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }} onClick={e => e.stopPropagation()}>
            <h2 style={{
              fontSize: 18, fontWeight: 800, color: TEXT_PRIMARY, margin: '0 0 8px',
              fontFamily: "'Noto Serif JP', Georgia, serif",
            }}>UAAM 診断</h2>
            <p style={{ fontSize: 13, color: TEXT_MUTED, margin: '0 0 20px' }}>
              パスワードを入力してください
            </p>
            <input
              type="password"
              value={pass}
              onChange={e => { setPass(e.target.value); setPassError(''); }}
              onKeyDown={e => e.key === 'Enter' && handlePassSubmit()}
              placeholder="パスワード"
              autoFocus
              style={{
                width: '100%', padding: '12px 14px', fontSize: 15,
                border: `2px solid ${passError ? '#D44' : BORDER}`,
                borderRadius: 10, outline: 'none', boxSizing: 'border-box',
                background: '#FAFAF8',
              }}
            />
            {passError && (
              <p style={{ fontSize: 12, color: '#D44', margin: '8px 0 0' }}>{passError}</p>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowPassModal(false)} style={{
                flex: 1, padding: '12px', borderRadius: 10, border: `1px solid ${BORDER}`,
                background: 'transparent', color: TEXT_MUTED, fontSize: 14,
                fontWeight: 600, cursor: 'pointer',
              }}>キャンセル</button>
              <button onClick={handlePassSubmit} style={{
                flex: 1, padding: '12px', borderRadius: 10, border: 'none',
                background: '#4A6FA5', color: WHITE, fontSize: 14,
                fontWeight: 700, cursor: 'pointer',
              }}>確認</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
