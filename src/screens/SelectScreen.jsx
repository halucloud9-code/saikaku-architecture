import { useState } from 'react';
import { signOutUser } from '../firebase';

const UAAM_PASS = 'kokusogaku';

export default function SelectScreen({ user, isAdmin, onSelectSaikaku, onSelectUaam, onAdmin, onLogout }) {
  const [showPassModal, setShowPassModal] = useState(false);
  const [pass, setPass] = useState('');
  const [passError, setPassError] = useState('');
  const [hoverSaikaku, setHoverSaikaku] = useState(false);
  const [hoverUaam, setHoverUaam] = useState(false);

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
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0D0B09 0%, #1A1610 40%, #0D0B09 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* 背景装飾 */}
      <div style={{
        position: 'absolute', top: -120, right: -120,
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(196,146,42,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -80, left: -80,
        width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(74,111,165,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* ヘッダー */}
      <div style={{
        background: 'rgba(13,11,9,0.6)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(196,146,42,0.15)',
        padding: '14px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {user?.photoURL && (
            <img src={user.photoURL} alt="" style={{
              width: 34, height: 34, borderRadius: '50%',
              border: '2px solid rgba(196,146,42,0.3)',
            }} />
          )}
          <span style={{ fontSize: 13, color: '#FFFFFF', fontWeight: 600 }}>{user?.displayName}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isAdmin && (
            <button onClick={onAdmin} style={{
              fontSize: 11, color: '#C4922A', background: 'rgba(196,146,42,0.08)',
              border: '1px solid rgba(196,146,42,0.2)', borderRadius: 6,
              padding: '5px 12px', cursor: 'pointer', fontWeight: 600,
              letterSpacing: '0.03em',
            }}>管理</button>
          )}
          <button onClick={async () => { await signOutUser(); onLogout(); }} style={{
            fontSize: 11, color: '#8A8070', background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
            padding: '5px 12px', cursor: 'pointer', fontWeight: 500,
          }}>ログアウト</button>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div style={{
        maxWidth: 520, margin: '0 auto', padding: '48px 20px 60px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28,
        position: 'relative', zIndex: 1,
      }}>
        {/* タイトルセクション */}
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            marginBottom: 16,
          }}>
            <div style={{ width: 32, height: 1, background: 'linear-gradient(90deg, transparent, #C4922A)' }} />
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.3em', color: '#C4922A',
              textTransform: 'uppercase',
            }}>Select Program</span>
            <div style={{ width: 32, height: 1, background: 'linear-gradient(90deg, #C4922A, transparent)' }} />
          </div>
          <h1 style={{
            fontSize: 28, fontWeight: 800, color: '#F5F0E8', margin: 0,
            fontFamily: "'Noto Serif JP', Georgia, serif",
            letterSpacing: '0.08em',
          }}>診断プログラム</h1>
          <p style={{
            fontSize: 13, color: '#FFFFFF', marginTop: 10,
            lineHeight: 1.7, letterSpacing: '0.02em',
          }}>
            あなたの才覚を解き明かすプログラムを選択してください
          </p>
        </div>

        {/* ─── 才覚領域カード ─── */}
        <button
          onClick={onSelectSaikaku}
          onMouseEnter={() => setHoverSaikaku(true)}
          onMouseLeave={() => setHoverSaikaku(false)}
          style={{
            width: '100%',
            background: hoverSaikaku
              ? 'linear-gradient(145deg, rgba(196,146,42,0.12) 0%, rgba(26,22,16,0.95) 100%)'
              : 'linear-gradient(145deg, rgba(196,146,42,0.06) 0%, rgba(26,22,16,0.9) 100%)',
            border: `1px solid ${hoverSaikaku ? 'rgba(196,146,42,0.4)' : 'rgba(196,146,42,0.15)'}`,
            borderRadius: 20, padding: 0, cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            transform: hoverSaikaku ? 'translateY(-4px)' : 'translateY(0)',
            boxShadow: hoverSaikaku
              ? '0 20px 60px rgba(196,146,42,0.15), 0 0 0 1px rgba(196,146,42,0.1) inset'
              : '0 4px 24px rgba(0,0,0,0.3)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* ゴールドのアクセントライン */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 2,
            background: 'linear-gradient(90deg, transparent 10%, #C4922A 50%, transparent 90%)',
            opacity: hoverSaikaku ? 1 : 0.4,
            transition: 'opacity 0.4s ease',
          }} />

          <div style={{ padding: '32px 28px' }}>
            {/* サブラベル */}
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              background: 'rgba(196,146,42,0.1)',
              border: '1px solid rgba(196,146,42,0.2)',
              borderRadius: 100, padding: '4px 14px', marginBottom: 16,
            }}>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', color: '#C4922A',
                textTransform: 'uppercase',
              }}>Unique Ability</span>
            </div>

            {/* タイトル */}
            <div style={{ marginBottom: 6 }}>
              <span style={{
                fontSize: 26, fontWeight: 900, color: '#FFFFFF',
                fontFamily: "'Noto Serif JP', Georgia, serif",
                letterSpacing: '0.06em',
                display: 'block',
              }}>才覚領域</span>
            </div>
            <div style={{
              fontSize: 12, fontWeight: 600, color: '#C4922A',
              letterSpacing: '0.12em', marginBottom: 20,
              fontFamily: "'Playfair Display', Georgia, serif",
            }}>Architecture</div>

            {/* 区切り */}
            <div style={{
              width: 40, height: 1, background: 'rgba(196,146,42,0.3)',
              marginBottom: 18,
            }} />

            {/* 説明文 */}
            <p style={{
              fontSize: 14, color: '#FFFFFF', margin: 0, lineHeight: 2,
              letterSpacing: '0.02em',
            }}>
              価値観 × 才能 × 情熱<br />
              化学反応を起こす<br />
              あなただけの才覚領域を見つけだす
            </p>

            {/* CTA */}
            <div style={{
              marginTop: 24, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: hoverSaikaku ? 'rgba(196,146,42,0.2)' : 'rgba(196,146,42,0.08)',
                borderRadius: 8, padding: '8px 16px',
                transition: 'background 0.3s ease',
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#C4922A', letterSpacing: '0.05em' }}>
                  診断を開始する
                </span>
                <span style={{
                  fontSize: 14, color: '#C4922A',
                  transform: hoverSaikaku ? 'translateX(3px)' : 'translateX(0)',
                  transition: 'transform 0.3s ease',
                  display: 'inline-block',
                }}>→</span>
              </div>
            </div>
          </div>
        </button>

        {/* ─── 才覚発動領域カード ─── */}
        <button
          onClick={handleUaamClick}
          onMouseEnter={() => setHoverUaam(true)}
          onMouseLeave={() => setHoverUaam(false)}
          style={{
            width: '100%',
            background: hoverUaam
              ? 'linear-gradient(145deg, rgba(74,111,165,0.12) 0%, rgba(26,22,16,0.95) 100%)'
              : 'linear-gradient(145deg, rgba(74,111,165,0.06) 0%, rgba(26,22,16,0.9) 100%)',
            border: `1px solid ${hoverUaam ? 'rgba(74,111,165,0.4)' : 'rgba(74,111,165,0.15)'}`,
            borderRadius: 20, padding: 0, cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            transform: hoverUaam ? 'translateY(-4px)' : 'translateY(0)',
            boxShadow: hoverUaam
              ? '0 20px 60px rgba(74,111,165,0.15), 0 0 0 1px rgba(74,111,165,0.1) inset'
              : '0 4px 24px rgba(0,0,0,0.3)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* ブルーのアクセントライン */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 2,
            background: 'linear-gradient(90deg, transparent 10%, #4A6FA5 50%, transparent 90%)',
            opacity: hoverUaam ? 1 : 0.4,
            transition: 'opacity 0.4s ease',
          }} />

          <div style={{ padding: '32px 28px' }}>
            {/* サブラベル */}
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              background: 'rgba(74,111,165,0.1)',
              border: '1px solid rgba(74,111,165,0.2)',
              borderRadius: 100, padding: '4px 14px', marginBottom: 16,
            }}>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', color: '#6B9AD4',
                textTransform: 'uppercase',
              }}>Unique Ability Activation Matrix</span>
            </div>

            {/* タイトル */}
            <div style={{ marginBottom: 6 }}>
              <span style={{
                fontSize: 26, fontWeight: 900, color: '#FFFFFF',
                fontFamily: "'Noto Serif JP', Georgia, serif",
                letterSpacing: '0.06em',
                display: 'block',
              }}>才覚発動領域<span style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 16, fontWeight: 700, color: '#6B9AD4',
                marginLeft: 6, letterSpacing: '0.08em',
              }}>MATRIX</span></span>
            </div>
            <div style={{
              fontSize: 12, fontWeight: 600, color: '#6B9AD4',
              letterSpacing: '0.15em', marginBottom: 20,
            }}>志 · 知 · 技 · 衝</div>

            {/* 区切り */}
            <div style={{
              width: 40, height: 1, background: 'rgba(74,111,165,0.3)',
              marginBottom: 18,
            }} />

            {/* 左右レイアウト：説明文 + Coming Soon */}
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
              {/* 左：説明文 */}
              <div style={{ flex: 1 }}>
                <p style={{
                  fontSize: 14, color: '#FFFFFF', margin: 0, lineHeight: 2,
                  letterSpacing: '0.02em',
                }}>
                  <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700 }}>48</span>問の診断で<span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700 }}>4</span>軸<span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700 }}>16</span>項目を分析し<br />
                  才覚発動領域マトリクスを可視化します
                </p>
              </div>

              {/* 右：Coming Soon + 才覚発動 展開領域 */}
              <div style={{
                textAlign: 'center',
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid rgba(255,215,0,0.15)',
                background: 'rgba(255,215,0,0.04)',
                minWidth: 120,
              }}>
                <div style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: 12, fontWeight: 700, letterSpacing: '0.15em',
                  color: '#FFD700',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}>Coming Soon</div>
                <div style={{
                  fontFamily: "'Noto Serif JP', Georgia, serif",
                  fontSize: 13, fontWeight: 800, color: '#FFFFFF',
                  lineHeight: 1.6, letterSpacing: '0.05em',
                }}>才覚発動<br />展開領域</div>
              </div>
            </div>

            {/* CTA + ロック */}
            <div style={{
              marginTop: 24, display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: hoverUaam ? 'rgba(74,111,165,0.2)' : 'rgba(74,111,165,0.08)',
                borderRadius: 8, padding: '8px 16px',
                transition: 'background 0.3s ease',
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#6B9AD4', letterSpacing: '0.05em' }}>
                  診断を開始する
                </span>
                <span style={{
                  fontSize: 14, color: '#6B9AD4',
                  transform: hoverUaam ? 'translateX(3px)' : 'translateX(0)',
                  transition: 'transform 0.3s ease',
                  display: 'inline-block',
                }}>→</span>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 11, color: 'rgba(107,154,212,0.5)', fontWeight: 500,
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span>パスワード</span>
              </div>
            </div>
          </div>
        </button>

        {/* フッター */}
        <p style={{
          fontSize: 10, color: 'rgba(138,128,112,0.4)', textAlign: 'center',
          marginTop: 8, letterSpacing: '0.1em',
        }}>
          Powered by GRIFFON × Firebase
        </p>
      </div>

      {/* ─── パスワードモーダル ─── */}
      {showPassModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20,
          animation: 'fadeIn 0.2s ease',
        }} onClick={() => setShowPassModal(false)}>
          <div style={{
            background: 'linear-gradient(160deg, #1E1A14 0%, #141210 100%)',
            border: '1px solid rgba(74,111,165,0.2)',
            borderRadius: 20, padding: '36px 32px',
            width: '100%', maxWidth: 380,
            boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(74,111,165,0.05) inset',
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              background: 'rgba(74,111,165,0.1)',
              border: '1px solid rgba(74,111,165,0.2)',
              borderRadius: 100, padding: '4px 14px', marginBottom: 16,
            }}>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', color: '#6B9AD4',
                textTransform: 'uppercase',
              }}>Activation Matrix</span>
            </div>
            <h2 style={{
              fontSize: 22, fontWeight: 800, color: '#F5F0E8', margin: '0 0 8px',
              fontFamily: "'Noto Serif JP', Georgia, serif",
              letterSpacing: '0.06em',
            }}>才覚発動領域</h2>
            <p style={{ fontSize: 13, color: '#8A8070', margin: '0 0 24px' }}>
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
                width: '100%', padding: '14px 16px', fontSize: 15,
                border: `1px solid ${passError ? 'rgba(220,68,68,0.5)' : 'rgba(74,111,165,0.25)'}`,
                borderRadius: 12, outline: 'none', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.04)',
                color: '#F5F0E8',
                transition: 'border-color 0.2s ease',
              }}
            />
            {passError && (
              <p style={{ fontSize: 12, color: '#DC4444', margin: '10px 0 0', fontWeight: 500 }}>{passError}</p>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setShowPassModal(false)} style={{
                flex: 1, padding: '13px', borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'transparent', color: '#8A8070', fontSize: 14,
                fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}>キャンセル</button>
              <button onClick={handlePassSubmit} style={{
                flex: 1, padding: '13px', borderRadius: 12, border: 'none',
                background: 'linear-gradient(135deg, #4A6FA5, #3A5A8A)',
                color: '#F5F0E8', fontSize: 14,
                fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(74,111,165,0.3)',
                transition: 'all 0.2s ease',
              }}>確認</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
