import { useState, useEffect } from 'react';
import { signOutUser } from '../firebase';

export default function InputScreen({ user, error, isAdmin, onSubmit, onAdmin, onLogout, onBack }) {
  const [name, setName] = useState(user.displayName || '');

  // 価値観
  const [valueTop5, setValueTop5] = useState('');
  const [valueOthers, setValueOthers] = useState('');

  // 才能
  const [talentTop5, setTalentTop5] = useState('');
  const [talentOthers, setTalentOthers] = useState('');

  // 情熱
  const [passionTop5, setPassionTop5] = useState('');
  const [passionOthers, setPassionOthers] = useState('');

  // 追加3問
  const [q1, setQ1] = useState('');
  const [q2, setQ2] = useState('');
  const [q3, setQ3] = useState('');

  const [localError, setLocalError] = useState('');

  const resetForm = () => {
    setValueTop5('');
    setValueOthers('');
    setTalentTop5('');
    setTalentOthers('');
    setPassionTop5('');
    setPassionOthers('');
    setQ1('');
    setQ2('');
    setQ3('');
    setLocalError('');
  };

  useEffect(() => {
    resetForm();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = () => {
    if (!talentTop5.trim() || !valueTop5.trim() || !passionTop5.trim()) {
      setLocalError('才能・価値観・情熱の必須項目（最も大切な5つ）をすべて入力してください');
      return;
    }
    const formData = {
      name,
      talent_top5: talentTop5.trim(),
      talent_other: talentOthers.trim(),
      value_top5: valueTop5.trim(),
      value_other: valueOthers.trim(),
      passion_top5: passionTop5.trim(),
      passion_other: passionOthers.trim(),
      q1: q1.trim(),
      q2: q2.trim(),
      q3: q3.trim(),
    };
    resetForm();
    onSubmit(formData);
  };

  const displayError = localError || error;

  const CATEGORIES = [
    {
      key: 'value', label: '価値観', en: 'VALUES', color: '#60A5FA',
      sublabel: 'あなたが絶対に譲れないもの・大切にしていること',
      labelTop5: '最も大切にしている5つ', top5: valueTop5, setTop5: setValueTop5,
      placeholderTop5: '例：家族、誠実さ、自由、成長、貢献',
      labelOthers: 'その他の価値観', others: valueOthers, setOthers: setValueOthers,
      placeholderOthers: '例：挑戦、調和、美しさ...',
      hint: '何かを選ぶとき、常に優先している基準・信念・こだわりは？',
    },
    {
      key: 'talent', label: '才能', en: 'TALENT', color: '#FBBF24',
      sublabel: 'あなたが自然にできること・得意なこと',
      labelTop5: '最も得意な5つ', top5: talentTop5, setTop5: setTalentTop5,
      placeholderTop5: '例：人の話を聞く、分かりやすく説明する、人の心を動かす...',
      labelOthers: 'その他の才能', others: talentOthers, setOthers: setTalentOthers,
      placeholderOthers: '例：データ分析、語学、デザイン...',
      hint: '他の人より自然にできること、努力している感覚がないのに上手くいくことは？',
    },
    {
      key: 'passion', label: '情熱', en: 'PASSION', color: '#F87171',
      sublabel: 'あなたが夢中になれること・時間を忘れること',
      labelTop5: '最も夢中になる5つ', top5: passionTop5, setTop5: setPassionTop5,
      placeholderTop5: '例：教育、コーチング、旅、音楽、起業...',
      labelOthers: 'その他の情熱', others: passionOthers, setOthers: setPassionOthers,
      placeholderOthers: '例：料理、読書、スポーツ...',
      hint: '報酬がなくても続けられること、関わると元気になることは？',
    },
  ];

  const QUESTIONS = [
    { num: 'Q1', q: <>明日死ぬとしたら<br />心残りなのは何ですか？</>, val: q1, set: setQ1, ph: '思いのままに書いてください' },
    { num: 'Q2', q: <>お金も時間も制限が一切ない。<br />明日、何をしますか？<br /><span style={{ fontSize: 11, color: '#B0A090' }}>できるだけ具体的に。</span></>, val: q2, set: setQ2, ph: '具体的なシーン・行動・場所・誰といるか...' },
    { num: 'Q3', q: <>才覚領域を全力で生き続けた10年後<br />あなたの周りはどんな影響や変化を遂げていますか？</>, val: q3, set: setQ3, ph: '人・組織・社会・世界...どんな変化が起きているか' },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(170deg, #1C1814 0%, #2A2420 30%, #1C1814 60%, #221E18 100%)',
    }}>

      {/* ── ヘッダー ── */}
      <div style={{
        background: 'rgba(34,30,24,0.95)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(212,170,80,0.2)',
        padding: '14px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <span style={{
          fontFamily: "'Noto Serif JP', 'Times New Roman', serif",
          fontSize: 14, fontWeight: 700, color: '#F5EDD8',
        }}>
          Unique Ability <span style={{ color: '#D4AA50', fontSize: 12, fontWeight: 400 }}>Architecture</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isAdmin && (
            <button onClick={onAdmin} style={{ fontSize: 12, color: '#C8B898', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>管理</button>
          )}
          {user.photoURL && (
            <img src={user.photoURL} alt={user.displayName} style={{ width: 26, height: 26, borderRadius: '50%', border: '1.5px solid rgba(212,170,80,0.4)' }} />
          )}
          <button onClick={async () => { await signOutUser(); onLogout(); }} style={{
            fontSize: 12, color: '#A09080', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}>ログアウト</button>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* タイトル */}
        <div style={{ marginBottom: 40, textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 40, height: 1, background: 'linear-gradient(90deg, transparent, #FFD700)' }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', color: '#FFD700', textTransform: 'uppercase' }}>Discovery</span>
            <div style={{ width: 40, height: 1, background: 'linear-gradient(90deg, #FFD700, transparent)' }} />
          </div>
          <h2 style={{
            fontFamily: "'Noto Serif JP', 'Times New Roman', serif",
            fontSize: 28, fontWeight: 900, color: '#FFFFFF',
            margin: '0 0 8px',
          }}>才覚領域を発見する</h2>
          <p style={{ fontSize: 13, color: '#FFFFFF', margin: 0, lineHeight: 1.8, opacity: 0.85 }}>
            <span style={{ fontFamily: "'Playfair Display', 'Noto Serif JP', Georgia, serif", fontSize: 16, fontWeight: 700 }}>3</span>つの問いに答えるだけで、あなただけの才覚領域が明らかになります
          </p>
        </div>

        {/* フォームカード */}
        <div style={{
          background: 'linear-gradient(180deg, #302A22 0%, #28231C 100%)',
          borderRadius: 16,
          border: '1px solid rgba(212,170,80,0.25)',
          padding: '36px 28px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.3), inset 0 1px 0 rgba(212,170,80,0.1)',
        }}>
          {/* 名前 */}
          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#FFFFFF', marginBottom: 8 }}>
              お名前
            </label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="山田 太郎"
              style={{
                width: '100%', padding: '14px 0', borderRadius: 0,
                border: 'none', borderBottom: '1.5px solid rgba(212,170,80,0.35)', background: 'transparent',
                fontSize: 16, color: '#FFFFFF', outline: 'none', boxSizing: 'border-box',
                fontFamily: "'Noto Serif JP', 'Times New Roman', serif",
              }}
            />
          </div>

          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(212,170,80,0.25), transparent)', margin: '0 0 32px' }} />

          {/* 3カテゴリ */}
          {CATEGORIES.map((cat, ci) => (
            <div key={cat.key} style={{ marginBottom: ci < 2 ? 36 : 0 }}>
              <div style={{
                background: 'linear-gradient(135deg, #3A3428 0%, #332E24 100%)',
                borderRadius: 12,
                borderTop: `3px solid ${cat.color}`,
                borderLeft: '1px solid rgba(212,170,80,0.12)',
                borderRight: '1px solid rgba(212,170,80,0.12)',
                borderBottom: '1px solid rgba(212,170,80,0.08)',
                padding: '24px 22px',
                marginBottom: 16,
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontFamily: "'Noto Serif JP', 'Times New Roman', serif", fontSize: 20, fontWeight: 800, color: '#FFFFFF' }}>{cat.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: cat.color, letterSpacing: '0.12em' }}>{cat.en}</span>
                </div>
                <p style={{ fontSize: 13, color: '#F0E8D8', margin: '0 0 20px', lineHeight: 1.6 }}>{cat.sublabel}</p>

                {/* TOP5 必須 */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>{cat.labelTop5}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: '#1A1610',
                      background: cat.color, padding: '2px 10px', borderRadius: 100,
                    }}>必須</span>
                  </div>
                  <textarea value={cat.top5} onChange={(e) => cat.setTop5(e.target.value)}
                    placeholder={cat.placeholderTop5} rows={3}
                    style={{
                      width: '100%', padding: '14px 16px', borderRadius: 8,
                      border: `1px solid ${cat.color}30`, background: 'rgba(20,18,14,0.5)',
                      fontSize: 14, color: '#FFFFFF', outline: 'none', resize: 'vertical',
                      lineHeight: 1.8, boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* その他 任意 */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: '#F0E8D8', fontWeight: 600 }}>{cat.labelOthers}</span>
                    <span style={{ fontSize: 11, color: '#C8B898' }}>（任意）</span>
                  </div>
                  <textarea value={cat.others} onChange={(e) => cat.setOthers(e.target.value)}
                    placeholder={cat.placeholderOthers} rows={2}
                    style={{
                      width: '100%', padding: '12px 16px', borderRadius: 8,
                      border: '1px dashed rgba(212,170,80,0.2)', background: 'transparent',
                      fontSize: 13, color: '#FFFFFF', outline: 'none', resize: 'vertical',
                      lineHeight: 1.8, boxSizing: 'border-box',
                    }}
                  />
                </div>

                <p style={{ fontSize: 12, color: '#E0D0B0', margin: '8px 0 0', lineHeight: 1.6 }}>
                  {cat.hint}
                </p>
              </div>
            </div>
          ))}

          {/* 深化の問い */}
          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(168,150,200,0.3), transparent)', margin: '8px 0 32px' }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <div style={{ width: 3, height: 20, background: 'linear-gradient(to bottom, #C8B0E8, #9878C0)', borderRadius: 2 }} />
              <span style={{ fontFamily: "'Noto Serif JP', 'Times New Roman', serif", fontSize: 18, fontWeight: 800, color: '#FFFFFF' }}>深化の問い</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#D8C8F0', letterSpacing: '0.1em' }}>DEEP QUESTIONS</span>
            </div>

            {QUESTIONS.map((item, qi) => (
              <div key={item.num} style={{ marginBottom: qi < 2 ? 28 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 30, height: 30, borderRadius: '50%',
                    background: 'rgba(168,150,200,0.2)', border: '1px solid rgba(168,150,200,0.4)',
                    color: '#E0D0F8', fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 2,
                  }}>{item.num}</span>
                  <p style={{
                    fontSize: 14, fontWeight: 700, color: '#FFFFFF', margin: 0, lineHeight: 1.9,
                    fontFamily: "'Noto Serif JP', 'Times New Roman', serif",
                  }}>{item.q}</p>
                </div>
                <textarea value={item.val} onChange={(e) => item.set(e.target.value)}
                  placeholder={item.ph} rows={3}
                  style={{
                    width: '100%', padding: '14px 16px', borderRadius: 8,
                    border: '1px solid rgba(168,150,200,0.25)', background: 'rgba(168,150,200,0.06)',
                    fontSize: 14, color: '#FFFFFF', outline: 'none', resize: 'vertical',
                    lineHeight: 1.8, boxSizing: 'border-box',
                  }}
                />
                {qi < 2 && <div style={{ height: 1, background: 'rgba(168,150,200,0.12)', margin: '24px 0 0' }} />}
              </div>
            ))}
          </div>

          {/* エラー */}
          {displayError && (
            <div style={{
              padding: '14px 18px', background: 'rgba(220,68,68,0.1)',
              border: '1px solid rgba(220,68,68,0.25)', borderRadius: 10,
              marginTop: 24, fontSize: 13, color: '#F87171',
            }}>{displayError}</div>
          )}

          {/* 送信ボタン */}
          <button onClick={handleSubmit} style={{
            width: '100%', padding: '18px 24px', borderRadius: 12, marginTop: 32,
            border: '1px solid rgba(255,220,130,0.3)',
            background: 'linear-gradient(135deg, #FBBF24 0%, #D4AA50 50%, #FBBF24 100%)',
            color: '#1A1610', fontSize: 16, fontWeight: 700,
            fontFamily: "'Noto Serif JP', 'Times New Roman', serif",
            cursor: 'pointer', letterSpacing: '0.06em',
            boxShadow: '0 6px 28px rgba(212,170,80,0.4), 0 2px 8px rgba(251,191,36,0.2)',
          }}>才覚領域を解析する →</button>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#E0D0B0', marginTop: 14 }}>
            ※ 解析には約30秒かかります
          </p>

          {/* 戻る */}
          {onBack && (
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(212,170,80,0.12)', textAlign: 'center' }}>
              <button onClick={onBack} style={{
                padding: '10px 24px', borderRadius: 8,
                border: '1px solid rgba(212,170,80,0.2)',
                background: 'transparent', color: '#F0E8D8', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>← 診断選択に戻る</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
