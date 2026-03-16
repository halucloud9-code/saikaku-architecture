import { useState, useEffect } from 'react';
import { signOutUser } from '../firebase';

export default function InputScreen({ user, error, isAdmin, onSubmit, onAdmin, onLogout, onBack }) {
  const [name, setName] = useState(user.displayName || '');
  const [valueTop5, setValueTop5] = useState('');
  const [valueOthers, setValueOthers] = useState('');
  const [talentTop5, setTalentTop5] = useState('');
  const [talentOthers, setTalentOthers] = useState('');
  const [passionTop5, setPassionTop5] = useState('');
  const [passionOthers, setPassionOthers] = useState('');
  const [q1, setQ1] = useState('');
  const [q2, setQ2] = useState('');
  const [q3, setQ3] = useState('');
  const [localError, setLocalError] = useState('');

  const resetForm = () => {
    setValueTop5(''); setValueOthers('');
    setTalentTop5(''); setTalentOthers('');
    setPassionTop5(''); setPassionOthers('');
    setQ1(''); setQ2(''); setQ3('');
    setLocalError('');
  };

  useEffect(() => { resetForm(); }, []);

  const handleSubmit = () => {
    if (!talentTop5.trim() || !valueTop5.trim() || !passionTop5.trim()) {
      setLocalError('才能・価値観・情熱の必須項目をすべて入力してください');
      return;
    }
    const formData = {
      name,
      talent_top5: talentTop5.trim(), talent_other: talentOthers.trim(),
      value_top5: valueTop5.trim(), value_other: valueOthers.trim(),
      passion_top5: passionTop5.trim(), passion_other: passionOthers.trim(),
      q1: q1.trim(), q2: q2.trim(), q3: q3.trim(),
    };
    resetForm();
    onSubmit(formData);
  };

  const displayError = localError || error;

  const inputBase = {
    width: '100%', padding: '12px 0', fontSize: 15, color: '#FAFAFA',
    background: 'none', border: 'none', borderBottom: '1px solid #27272A',
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s ease',
  };

  const textareaBase = (color) => ({
    width: '100%', padding: '12px 14px', fontSize: 14, color: '#FAFAFA',
    background: '#111113', border: `1px solid #27272A`, borderRadius: 6,
    outline: 'none', resize: 'vertical', lineHeight: 1.8,
    boxSizing: 'border-box', transition: 'border-color 0.15s ease',
  });

  return (
    <div style={{ minHeight: '100vh', background: '#09090B' }}>
      {/* ヘッダー */}
      <div style={{
        padding: '14px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid #18181B',
        position: 'sticky', top: 0, zIndex: 100, background: '#09090B',
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', color: '#52525B', textTransform: 'uppercase' }}>
          Saikaku Architecture
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isAdmin && (
            <button onClick={onAdmin} style={{
              fontSize: 12, color: '#A1A1AA', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            }}>管理</button>
          )}
          <button onClick={async () => { await signOutUser(); onLogout(); }} style={{
            fontSize: 12, color: '#52525B', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}>ログアウト</button>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '56px 24px 80px' }}>
        {/* タイトル */}
        <div style={{ marginBottom: 56 }}>
          <p style={{
            fontSize: 11, fontWeight: 600, letterSpacing: '0.2em',
            color: '#52525B', textTransform: 'uppercase', margin: '0 0 12px',
          }}>Discovery</p>
          <h1 style={{
            fontFamily: "'Noto Serif JP', 'Times New Roman', serif",
            fontSize: 32, fontWeight: 900, color: '#FAFAFA',
            margin: '0 0 12px', letterSpacing: '-0.01em',
          }}>才覚領域を発見する</h1>
          <p style={{ fontSize: 14, color: '#71717A', margin: 0, lineHeight: 1.8 }}>
            3つのカテゴリと深化の問いから、あなたの才覚領域を解析します
          </p>
        </div>

        {/* 名前 */}
        <div style={{ marginBottom: 48 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#71717A', marginBottom: 4 }}>
            お名前
          </label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="山田 太郎" style={inputBase}
            onFocus={(e) => (e.target.style.borderBottomColor = '#FAFAFA')}
            onBlur={(e) => (e.target.style.borderBottomColor = '#27272A')}
          />
        </div>

        {/* 3カテゴリ */}
        {[
          { key: 'value', label: '価値観', en: 'Values', color: '#4A6FA5',
            sub: '絶対に譲れないもの・大切にしていること',
            top5Label: '最も大切にしている5つ', top5: valueTop5, setTop5: setValueTop5,
            ph5: '例：家族、誠実さ、自由、成長、貢献',
            othersLabel: 'その他', others: valueOthers, setOthers: setValueOthers,
            phO: '例：挑戦、調和、美しさ...',
            hint: '何かを選ぶとき、常に優先している基準は？' },
          { key: 'talent', label: '才能', en: 'Talent', color: '#C4922A',
            sub: '自然にできること・得意なこと',
            top5Label: '最も得意な5つ', top5: talentTop5, setTop5: setTalentTop5,
            ph5: '例：人の話を聞く、分かりやすく説明する、心を動かす...',
            othersLabel: 'その他', others: talentOthers, setOthers: setTalentOthers,
            phO: '例：データ分析、語学、デザイン...',
            hint: '努力している感覚がないのに上手くいくことは？' },
          { key: 'passion', label: '情熱', en: 'Passion', color: '#A84432',
            sub: '夢中になれること・時間を忘れること',
            top5Label: '最も夢中になる5つ', top5: passionTop5, setTop5: setPassionTop5,
            ph5: '例：教育、コーチング、旅、音楽、起業...',
            othersLabel: 'その他', others: passionOthers, setOthers: setPassionOthers,
            phO: '例：料理、読書、スポーツ...',
            hint: '報酬がなくても続けられることは？' },
        ].map((cat, idx) => (
          <div key={cat.key} style={{ marginBottom: 48 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
              <h2 style={{
                fontFamily: "'Noto Serif JP', 'Times New Roman', serif",
                fontSize: 20, fontWeight: 800, color: '#FAFAFA', margin: 0,
              }}>{cat.label}</h2>
              <span style={{ fontSize: 11, fontWeight: 600, color: cat.color, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{cat.en}</span>
            </div>
            <p style={{ fontSize: 13, color: '#52525B', margin: '0 0 20px' }}>{cat.sub}</p>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#A1A1AA' }}>{cat.top5Label}</span>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: '#09090B',
                  background: cat.color, padding: '2px 8px', borderRadius: 3,
                }}>必須</span>
              </div>
              <textarea value={cat.top5} onChange={(e) => cat.setTop5(e.target.value)}
                placeholder={cat.ph5} rows={3} style={textareaBase(cat.color)}
                onFocus={(e) => (e.target.style.borderColor = cat.color)}
                onBlur={(e) => (e.target.style.borderColor = '#27272A')}
              />
            </div>

            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#52525B' }}>{cat.othersLabel}</span>
                <span style={{ fontSize: 11, color: '#3F3F46' }}>任意</span>
              </div>
              <textarea value={cat.others} onChange={(e) => cat.setOthers(e.target.value)}
                placeholder={cat.phO} rows={2}
                style={{ ...textareaBase(cat.color), borderStyle: 'dashed' }}
                onFocus={(e) => (e.target.style.borderColor = '#52525B')}
                onBlur={(e) => (e.target.style.borderColor = '#27272A')}
              />
            </div>

            <p style={{ fontSize: 12, color: '#3F3F46', margin: '8px 0 0' }}>{cat.hint}</p>

            {idx < 2 && <div style={{ height: 1, background: '#18181B', margin: '48px 0 0' }} />}
          </div>
        ))}

        {/* 深化の問い */}
        <div style={{ borderTop: '1px solid #18181B', paddingTop: 48, marginBottom: 48 }}>
          <div style={{ marginBottom: 32 }}>
            <h2 style={{
              fontFamily: "'Noto Serif JP', 'Times New Roman', serif",
              fontSize: 20, fontWeight: 800, color: '#FAFAFA', margin: '0 0 4px',
            }}>深化の問い</h2>
            <p style={{ fontSize: 13, color: '#52525B', margin: 0 }}>
              才覚領域をさらに深めるための3つの問い
            </p>
          </div>

          {[
            { num: '01', q: <>明日死ぬとしたら、心残りなのは何ですか？</>, val: q1, set: setQ1, ph: '思いのままに書いてください' },
            { num: '02', q: <>お金も時間も制限がない。明日、何をしますか？<br /><span style={{ fontSize: 12, color: '#3F3F46' }}>できるだけ具体的に。</span></>, val: q2, set: setQ2, ph: '具体的なシーン・行動・場所・誰といるか...' },
            { num: '03', q: <>才覚領域を全力で生き続けた10年後、あなたの周りはどんな変化を遂げていますか？</>, val: q3, set: setQ3, ph: '人・組織・社会・世界にどんな変化が起きているか' },
          ].map((item, i) => (
            <div key={i} style={{ marginBottom: i < 2 ? 32 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 10 }}>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: '#52525B',
                  minWidth: 24, marginTop: 2,
                }}>{item.num}</span>
                <p style={{
                  fontFamily: "'Noto Serif JP', 'Times New Roman', serif",
                  fontSize: 15, fontWeight: 700, color: '#E4E4E7', margin: 0, lineHeight: 1.8,
                }}>{item.q}</p>
              </div>
              <textarea value={item.val} onChange={(e) => item.set(e.target.value)}
                placeholder={item.ph} rows={3}
                style={{ ...textareaBase('#71717A'), marginLeft: 38 , width: 'calc(100% - 38px)' }}
                onFocus={(e) => (e.target.style.borderColor = '#52525B')}
                onBlur={(e) => (e.target.style.borderColor = '#27272A')}
              />
            </div>
          ))}
        </div>

        {/* エラー */}
        {displayError && (
          <div style={{
            padding: '12px 16px', background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6,
            marginBottom: 20, fontSize: 13, color: '#EF4444',
          }}>{displayError}</div>
        )}

        {/* 送信 */}
        <button onClick={handleSubmit} style={{
          width: '100%', padding: '14px 24px', borderRadius: 6,
          border: 'none', background: '#FAFAFA', color: '#09090B',
          fontSize: 15, fontWeight: 700, cursor: 'pointer',
          transition: 'opacity 0.15s ease',
        }}>
          才覚領域を解析する
        </button>
        <p style={{ textAlign: 'center', fontSize: 12, color: '#3F3F46', marginTop: 12 }}>
          解析には約30秒かかります
        </p>

        {onBack && (
          <div style={{ marginTop: 32, textAlign: 'center' }}>
            <button onClick={onBack} style={{
              fontSize: 13, color: '#52525B', background: 'none',
              border: 'none', cursor: 'pointer', padding: 0,
            }}>← 診断選択に戻る</button>
          </div>
        )}
      </div>
    </div>
  );
}
