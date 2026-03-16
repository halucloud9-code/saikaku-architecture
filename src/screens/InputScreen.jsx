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
      key: 'value', label: '価値観', en: 'VALUES', color: '#4A6FA5',
      sublabel: 'あなたが絶対に譲れないもの・大切にしていること',
      labelTop5: '最も大切にしている5つ', top5: valueTop5, setTop5: setValueTop5,
      placeholderTop5: '例：家族、誠実さ、自由、成長、貢献',
      labelOthers: 'その他の価値観', others: valueOthers, setOthers: setValueOthers,
      placeholderOthers: '例：挑戦、調和、美しさ...',
      hint: '何かを選ぶとき、常に優先している基準・信念・こだわりは？',
    },
    {
      key: 'talent', label: '才能', en: 'TALENT', color: '#C4922A',
      sublabel: 'あなたが自然にできること・得意なこと',
      labelTop5: '最も得意な5つ', top5: talentTop5, setTop5: setTalentTop5,
      placeholderTop5: '例：人の話を聞く、分かりやすく説明する、人の心を動かす...',
      labelOthers: 'その他の才能', others: talentOthers, setOthers: setTalentOthers,
      placeholderOthers: '例：データ分析、語学、デザイン...',
      hint: '他の人より自然にできること、努力している感覚がないのに上手くいくことは？',
    },
    {
      key: 'passion', label: '情熱', en: 'PASSION', color: '#A84432',
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
    { num: 'Q2', q: <>お金も時間も制限が一切ない。<br />明日、何をしますか？<br /><span style={{ fontSize: 11, color: '#52525B' }}>できるだけ具体的に。</span></>, val: q2, set: setQ2, ph: '具体的なシーン・行動・場所・誰といるか...' },
    { num: 'Q3', q: <>才覚領域を全力で生き続けた10年後<br />あなたの周りはどんな影響や変化を遂げていますか？</>, val: q3, set: setQ3, ph: '人・組織・社会・世界...どんな変化が起きているか' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#09090B' }}>

      {/* ── ヘッダー ── */}
      <div style={{
        background: '#09090B',
        borderBottom: '1px solid #18181B',
        padding: '14px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', color: '#52525B', textTransform: 'uppercase' }}>
          Saikaku Architecture
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isAdmin && (
            <button onClick={onAdmin} style={{ fontSize: 12, color: '#A1A1AA', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>管理</button>
          )}
          {user.photoURL && (
            <img src={user.photoURL} alt={user.displayName} style={{ width: 24, height: 24, borderRadius: '50%' }} />
          )}
          <button onClick={async () => { await signOutUser(); onLogout(); }} style={{
            fontSize: 12, color: '#52525B', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}>ログアウト</button>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* タイトル */}
        <div style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.2em', color: '#52525B', textTransform: 'uppercase', margin: '0 0 12px' }}>
            Discovery
          </p>
          <h2 style={{
            fontFamily: "'Noto Serif JP', 'Times New Roman', serif",
            fontSize: 28, fontWeight: 900, color: '#FAFAFA',
            margin: '0 0 8px',
          }}>才覚領域を発見する</h2>
          <p style={{ fontSize: 13, color: '#52525B', margin: 0, lineHeight: 1.8 }}>
            3つの問いに答えるだけで、あなただけの才覚領域が明らかになります
          </p>
        </div>

        {/* フォームカード */}
        <div style={{
          background: '#111113',
          borderRadius: 8,
          padding: '36px 28px',
        }}>
          {/* 名前 */}
          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#A1A1AA', marginBottom: 8 }}>
              お名前
            </label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="山田 太郎"
              style={{
                width: '100%', padding: '12px 0', borderRadius: 0,
                border: 'none', borderBottom: '1px solid #27272A', background: 'transparent',
                fontSize: 15, color: '#FAFAFA', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ height: 1, background: '#18181B', margin: '0 0 32px' }} />

          {/* 3カテゴリ */}
          {CATEGORIES.map((cat, ci) => (
            <div key={cat.key} style={{ marginBottom: ci < 2 ? 32 : 0 }}>
              {/* カテゴリヘッダー（ResultScreenと同じスタイル） */}
              <div style={{
                background: VENN_BG[cat.key],
                borderRadius: 8,
                borderTop: `2px solid ${cat.color}`,
                padding: '20px 20px 24px',
                marginBottom: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#FAFAFA' }}>{cat.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: cat.color, letterSpacing: '0.1em' }}>{cat.en}</span>
                </div>
                <p style={{ fontSize: 12, color: '#71717A', margin: '0 0 16px' }}>{cat.sublabel}</p>

                {/* TOP5 必須 */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#A1A1AA' }}>{cat.labelTop5}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: '#09090B',
                      background: cat.color, padding: '2px 8px', borderRadius: 3,
                    }}>必須</span>
                  </div>
                  <textarea value={cat.top5} onChange={(e) => cat.setTop5(e.target.value)}
                    placeholder={cat.placeholderTop5} rows={3}
                    style={{
                      width: '100%', padding: '12px 14px', borderRadius: 6,
                      border: `1px solid ${cat.color}30`, background: 'rgba(0,0,0,0.3)',
                      fontSize: 14, color: '#FAFAFA', outline: 'none', resize: 'vertical',
                      lineHeight: 1.8, boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* その他 任意 */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: '#71717A', fontWeight: 600 }}>{cat.labelOthers}</span>
                    <span style={{ fontSize: 11, color: '#3F3F46' }}>（任意）</span>
                  </div>
                  <textarea value={cat.others} onChange={(e) => cat.setOthers(e.target.value)}
                    placeholder={cat.placeholderOthers} rows={2}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 6,
                      border: '1px dashed #27272A', background: 'transparent',
                      fontSize: 13, color: '#A1A1AA', outline: 'none', resize: 'vertical',
                      lineHeight: 1.8, boxSizing: 'border-box',
                    }}
                  />
                </div>

                <p style={{ fontSize: 12, color: '#52525B', margin: '6px 0 0', lineHeight: 1.6 }}>
                  {cat.hint}
                </p>
              </div>

              {ci < 2 && <div style={{ height: 1, background: '#18181B' }} />}
            </div>
          ))}

          {/* 深化の問い */}
          <div style={{ height: 1, background: '#18181B', margin: '32px 0' }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 24 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#FAFAFA' }}>深化の問い</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#7B5EA7', letterSpacing: '0.1em' }}>DEEP QUESTIONS</span>
            </div>

            {QUESTIONS.map((item, qi) => (
              <div key={item.num} style={{ marginBottom: qi < 2 ? 24 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, borderRadius: 6,
                    background: '#18181B', border: '1px solid #27272A',
                    color: '#7B5EA7', fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 2,
                  }}>{item.num}</span>
                  <p style={{
                    fontSize: 14, fontWeight: 700, color: '#A1A1AA', margin: 0, lineHeight: 1.8,
                    fontFamily: "'Noto Serif JP', 'Times New Roman', serif",
                  }}>{item.q}</p>
                </div>
                <textarea value={item.val} onChange={(e) => item.set(e.target.value)}
                  placeholder={item.ph} rows={3}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 6,
                    border: '1px solid #27272A', background: '#18181B',
                    fontSize: 14, color: '#FAFAFA', outline: 'none', resize: 'vertical',
                    lineHeight: 1.8, boxSizing: 'border-box',
                  }}
                />
                {qi < 2 && <div style={{ height: 1, background: '#18181B', margin: '20px 0 0' }} />}
              </div>
            ))}
          </div>

          {/* エラー */}
          {displayError && (
            <div style={{
              padding: '12px 16px', background: 'rgba(220,68,68,0.08)',
              border: '1px solid rgba(220,68,68,0.2)', borderRadius: 6,
              marginTop: 24, fontSize: 13, color: '#DC4444',
            }}>{displayError}</div>
          )}

          {/* 送信ボタン */}
          <button onClick={handleSubmit} style={{
            width: '100%', padding: '16px', borderRadius: 6, marginTop: 32,
            border: 'none',
            background: '#FAFAFA', color: '#09090B',
            fontSize: 14, fontWeight: 700,
            cursor: 'pointer',
          }}>才覚領域を解析する</button>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#3F3F46', marginTop: 12 }}>
            解析には約30秒かかります
          </p>

          {/* 戻る */}
          {onBack && (
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <button onClick={onBack} style={{
                padding: '10px 20px', borderRadius: 6,
                border: '1px solid #18181B',
                background: 'none', color: '#52525B', fontSize: 13, cursor: 'pointer',
              }}>← 診断選択に戻る</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// カテゴリ別背景色（ResultScreenと同じ）
const VENN_BG = {
  value:   '#0D1420',
  talent:  '#14110D',
  passion: '#140D0D',
};
