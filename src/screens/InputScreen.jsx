import { useState, useEffect } from 'react';
import { signOutUser } from '../firebase';

const Header = ({ user, isAdmin, onAdmin, onLogout }) => (
  <div style={{
    background: 'rgba(13,11,9,0.6)',
    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(196,146,42,0.12)',
    padding: '12px 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    position: 'sticky', top: 0, zIndex: 100,
  }}>
    <span style={{
      fontFamily: "'Noto Serif JP', Georgia, serif",
      fontSize: 15, fontWeight: 700, color: '#F5F0E8', letterSpacing: '0.06em',
    }}>才覚領域 <span style={{ color: 'rgba(196,146,42,0.6)', fontSize: 12, fontWeight: 500 }}>Architecture</span></span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {isAdmin && (
        <button onClick={onAdmin} style={{
          padding: '5px 12px', borderRadius: 6,
          border: '1px solid rgba(196,146,42,0.2)',
          background: 'rgba(196,146,42,0.08)', color: '#C4922A',
          fontSize: 11, cursor: 'pointer', fontWeight: 600,
        }}>管理画面</button>
      )}
      {user.photoURL && (
        <img src={user.photoURL} alt={user.displayName}
          style={{ width: 30, height: 30, borderRadius: '50%', border: '2px solid rgba(196,146,42,0.2)' }} />
      )}
      <button onClick={async () => { await signOutUser(); onLogout(); }} style={{
        padding: '5px 12px', borderRadius: 6,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)', color: '#8A8070',
        fontSize: 11, cursor: 'pointer', fontWeight: 500,
      }}>ログアウト</button>
    </div>
  </div>
);

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

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(170deg, #0D0B09 0%, #14110D 50%, #0D0B09 100%)',
      position: 'relative',
    }}>
      <Header user={user} isAdmin={isAdmin} onAdmin={onAdmin} onLogout={onLogout} />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px 80px' }}>
        {/* タイトル */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 24, height: 1, background: 'linear-gradient(90deg, transparent, #C4922A)' }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', color: '#C4922A', textTransform: 'uppercase' }}>Discovery</span>
            <div style={{ width: 24, height: 1, background: 'linear-gradient(90deg, #C4922A, transparent)' }} />
          </div>
          <h2 style={{
            fontFamily: "'Noto Serif JP', Georgia, serif",
            fontSize: 24, fontWeight: 800, color: '#F5F0E8',
            margin: '0 0 8px', letterSpacing: '0.08em',
          }}>才覚領域を発見する</h2>
          <p style={{ fontSize: 13, color: '#8A8070', margin: 0, lineHeight: 1.8 }}>
            3つの問いに答えるだけで、あなただけの才覚領域が明らかになります
          </p>
        </div>

        {/* フォームカード */}
        <div style={{
          background: 'rgba(20,17,13,0.7)',
          backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          borderRadius: 24, border: '1px solid rgba(196,146,42,0.1)',
          padding: '40px 36px',
          boxShadow: '0 8px 48px rgba(0,0,0,0.4)',
        }}>
          {/* 名前 */}
          <div style={{ marginBottom: 32 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#BFB5A0', marginBottom: 8, letterSpacing: '0.04em' }}>
              お名前
            </label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="山田 太郎"
              style={{
                width: '100%', padding: '14px 16px', borderRadius: 12,
                border: '1px solid rgba(196,146,42,0.15)', background: 'rgba(255,255,255,0.03)',
                fontSize: 15, color: '#F5F0E8', outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.2s ease',
              }}
            />
          </div>

          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(196,146,42,0.15), transparent)', margin: '0 0 32px' }} />

          {/* 価値観 */}
          <FieldBlock
            label="価値観" sublabel="あなたが絶対に譲れないもの・大切にしていること"
            color="#4A6FA5" glowColor="rgba(74,111,165,0.08)"
            labelTop5="最も大切にしている5つ" valueTop5={valueTop5} onChangeTop5={setValueTop5}
            placeholderTop5="例：家族、誠実さ、自由、成長、貢献"
            labelOthers="その他の価値観" valueOthers={valueOthers} onChangeOthers={setValueOthers}
            placeholderOthers="例：挑戦、調和、美しさ..."
            hint="何かを選ぶとき、常に優先している基準・信念・こだわりは？"
          />

          {/* 才能 */}
          <FieldBlock
            label="才能" sublabel="あなたが自然にできること・得意なこと"
            color="#C4922A" glowColor="rgba(196,146,42,0.08)"
            labelTop5="最も得意な5つ" valueTop5={talentTop5} onChangeTop5={setTalentTop5}
            placeholderTop5="例：人の話を聞く、分かりやすく説明する、人の心を動かす..."
            labelOthers="その他の才能" valueOthers={talentOthers} onChangeOthers={setTalentOthers}
            placeholderOthers="例：データ分析、語学、デザイン..."
            hint="他の人より自然にできること、努力している感覚がないのに上手くいくことは？"
          />

          {/* 情熱 */}
          <FieldBlock
            label="情熱" sublabel="あなたが夢中になれること・時間を忘れること"
            color="#A84432" glowColor="rgba(168,68,50,0.08)"
            labelTop5="最も夢中になる5つ" valueTop5={passionTop5} onChangeTop5={setPassionTop5}
            placeholderTop5="例：教育、コーチング、旅、音楽、起業..."
            labelOthers="その他の情熱" valueOthers={passionOthers} onChangeOthers={setPassionOthers}
            placeholderOthers="例：料理、読書、スポーツ..."
            hint="報酬がなくても続けられること、関わると元気になることは？"
            last
          />

          {/* 深化の問い */}
          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(123,94,167,0.2), transparent)', margin: '8px 0 32px' }} />
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <div style={{ width: 3, height: 22, background: 'linear-gradient(to bottom, #7B5EA7, #5A3E87)', borderRadius: 2 }} />
              <div>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#A896C8', letterSpacing: '0.06em' }}>深化の問い</span>
                <span style={{ fontSize: 12, color: '#8A8070', marginLeft: 10 }}>才覚領域をさらに深めるための3つの問い</span>
              </div>
            </div>

            <QuestionBlock num="Q1"
              question={<>明日死ぬとしたら<br />心残りなのは何ですか？</>}
              value={q1} onChange={setQ1} placeholder="思いのままに書いてください"
              color="#7B5EA7" />
            <QuestionBlock num="Q2"
              question={<>お金も時間も制限が一切ない。<br />明日、何をしますか？<br /><span style={{fontSize:11, color:'#6A5A80'}}>できるだけ具体的に。</span></>}
              value={q2} onChange={setQ2} placeholder="具体的なシーン・行動・場所・誰といるか..."
              color="#7B5EA7" />
            <QuestionBlock num="Q3"
              question={<>才覚領域を全力で生き続けた10年後<br />あなたの周りはどんな影響や変化を遂げていますか？</>}
              value={q3} onChange={setQ3} placeholder="人・組織・社会・世界...どんな変化が起きているか"
              color="#7B5EA7" last />
          </div>

          {/* エラー */}
          {displayError && (
            <div style={{
              padding: '14px 18px', background: 'rgba(220,68,68,0.08)',
              border: '1px solid rgba(220,68,68,0.2)', borderRadius: 12,
              marginBottom: 24, fontSize: 13, color: '#DC4444',
            }}>{displayError}</div>
          )}

          {/* 送信ボタン */}
          <button onClick={handleSubmit} style={{
            width: '100%', padding: '18px 24px', borderRadius: 14,
            border: 'none',
            background: 'linear-gradient(135deg, #C4922A, #A84432)',
            color: '#FDFCFA', fontSize: 16, fontWeight: 700,
            fontFamily: "'Noto Serif JP', Georgia, serif",
            cursor: 'pointer', letterSpacing: '0.06em',
            boxShadow: '0 6px 24px rgba(196,146,42,0.3)',
            transition: 'all 0.2s ease',
          }}>才覚領域を解析する →</button>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#6A6050', marginTop: 14 }}>
            ※ 解析には約30秒かかります
          </p>

          {/* 戻る */}
          {onBack && (
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
              <button onClick={onBack} style={{
                padding: '10px 24px', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'transparent', color: '#8A8070', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>← 診断選択に戻る</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldBlock({ label, sublabel, color, glowColor, labelTop5, valueTop5, onChangeTop5, placeholderTop5, labelOthers, valueOthers, onChangeOthers, placeholderOthers, hint, last }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 3, height: 22, background: color, borderRadius: 2, flexShrink: 0 }} />
        <div>
          <span style={{ fontSize: 16, fontWeight: 700, color, letterSpacing: '0.06em' }}>{label}</span>
          <span style={{ fontSize: 12, color: '#8A8070', marginLeft: 10 }}>{sublabel}</span>
        </div>
      </div>

      {/* TOP5 */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: '#BFB5A0', fontWeight: 700 }}>★</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#BFB5A0' }}>{labelTop5}</span>
          <span style={{
            fontSize: 9, fontWeight: 700, color: '#0D0B09',
            background: color, padding: '2px 10px', borderRadius: 100,
          }}>必須</span>
        </div>
        <textarea value={valueTop5} onChange={(e) => onChangeTop5(e.target.value)}
          placeholder={placeholderTop5} rows={3}
          style={{
            width: '100%', padding: '14px 16px', borderRadius: 12,
            border: `1px solid ${color}30`, background: glowColor,
            fontSize: 14, color: '#F5F0E8', outline: 'none', resize: 'vertical',
            lineHeight: 1.8, boxSizing: 'border-box', transition: 'border-color 0.2s ease',
          }}
          onFocus={(e) => (e.target.style.borderColor = `${color}80`)}
          onBlur={(e) => (e.target.style.borderColor = `${color}30`)}
        />
      </div>

      {/* その他 */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: '#9A9080', fontWeight: 600 }}>{labelOthers}</span>
          <span style={{ fontSize: 11, color: '#6A6050' }}>（任意）</span>
        </div>
        <textarea value={valueOthers} onChange={(e) => onChangeOthers(e.target.value)}
          placeholder={placeholderOthers} rows={2}
          style={{
            width: '100%', padding: '12px 16px', borderRadius: 12,
            border: `1px dashed ${color}20`, background: 'rgba(255,255,255,0.02)',
            fontSize: 13, color: '#BFB5A0', outline: 'none', resize: 'vertical',
            lineHeight: 1.8, boxSizing: 'border-box', transition: 'border-color 0.2s ease',
          }}
          onFocus={(e) => (e.target.style.borderColor = `${color}50`)}
          onBlur={(e) => (e.target.style.borderColor = `${color}20`)}
        />
      </div>

      <p style={{ fontSize: 12, color: '#8A8070', margin: '8px 0 0', lineHeight: 1.7 }}>
        💡 {hint}
      </p>
      {!last && (
        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)', margin: '28px 0 0' }} />
      )}
    </div>
  );
}

function QuestionBlock({ num, question, value, onChange, placeholder, color, last }) {
  return (
    <div style={{ marginBottom: last ? 0 : 28 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 30, height: 30, borderRadius: '50%',
          background: `${color}20`, border: `1px solid ${color}40`,
          color, fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 2,
        }}>{num}</span>
        <p style={{
          fontSize: 14, fontWeight: 700, color: '#D4C9B0', margin: 0, lineHeight: 1.9,
          fontFamily: "'Noto Serif JP', Georgia, serif",
        }}>{question}</p>
      </div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} rows={3}
        style={{
          width: '100%', padding: '14px 16px', borderRadius: 12,
          border: `1px solid ${color}25`, background: `${color}08`,
          fontSize: 14, color: '#F5F0E8', outline: 'none', resize: 'vertical',
          lineHeight: 1.8, boxSizing: 'border-box', transition: 'border-color 0.2s ease',
        }}
        onFocus={(e) => (e.target.style.borderColor = `${color}60`)}
        onBlur={(e) => (e.target.style.borderColor = `${color}25`)}
      />
      {!last && <div style={{ height: 1, background: 'rgba(123,94,167,0.1)', margin: '24px 0 0' }} />}
    </div>
  );
}
