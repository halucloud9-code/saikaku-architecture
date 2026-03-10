import { useState, useEffect } from 'react';
import { signOutUser } from '../firebase';

const Header = ({ user, isAdmin, onAdmin, onLogout }) => (
  <div
    style={{
      background: '#FDFCFA',
      borderBottom: '1px solid #D4C9B0',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          fontFamily: 'Shippori Mincho, serif',
          fontSize: 16,
          fontWeight: 700,
          color: '#2A2520',
        }}
      >
        才覚領域 Architecture
      </span>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {isAdmin && (
        <button
          onClick={onAdmin}
          style={{
            padding: '6px 14px',
            borderRadius: 6,
            border: '1px solid #D4C9B0',
            background: 'transparent',
            color: '#7A7060',
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'Noto Sans JP, sans-serif',
          }}
        >
          管理画面
        </button>
      )}
      {user.photoURL && (
        <img
          src={user.photoURL}
          alt={user.displayName}
          style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #D4C9B0' }}
        />
      )}
      <span style={{ fontSize: 13, color: '#7A7060' }}>{user.displayName}</span>
      <button
        onClick={async () => {
          await signOutUser();
          onLogout();
        }}
        style={{
          padding: '6px 14px',
          borderRadius: 6,
          border: '1px solid #D4C9B0',
          background: 'transparent',
          color: '#7A7060',
          fontSize: 13,
          cursor: 'pointer',
          fontFamily: 'Noto Sans JP, sans-serif',
        }}
      >
        ログアウト
      </button>
    </div>
  </div>
);

export default function InputScreen({ user, error, isAdmin, onSubmit, onAdmin, onLogout }) {
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

  // 【修正1】全入力欄を完全クリアする関数
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

  // 【修正3】マウント時に必ず空フォームで開始（Firestore自動表示を防ぐ）
  useEffect(() => {
    resetForm();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = () => {
    if (!talentTop5.trim() || !valueTop5.trim() || !passionTop5.trim()) {
      setLocalError('才能・価値観・情熱の必須項目（最も大切な5つ）をすべて入力してください');
      return;
    }
    // フォームデータを確定してからクリア
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
    // 【修正2】分析開始時に入力欄を初期化
    resetForm();
    onSubmit(formData);
  };

  const displayError = localError || error;

  return (
    <div style={{ minHeight: '100vh', background: '#F5F0E8' }}>
      <Header user={user} isAdmin={isAdmin} onAdmin={onAdmin} onLogout={onLogout} />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px 80px' }}>
        {/* タイトル */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2
            style={{
              fontFamily: 'Shippori Mincho, serif',
              fontSize: 22,
              fontWeight: 700,
              color: '#2A2520',
              margin: '0 0 8px',
            }}
          >
            才覚領域を発見する
          </h2>
          <p style={{ fontSize: 14, color: '#2A2010', margin: 0, lineHeight: 1.7 }}>
            3つの問いに答えるだけで、あなただけの才覚領域が明らかになります
          </p>
        </div>

        {/* フォームカード */}
        <div
          style={{
            background: '#FDFCFA',
            borderRadius: 16,
            border: '1px solid #D4C9B0',
            padding: '36px 40px',
            boxShadow: '0 2px 12px rgba(42,37,32,0.06)',
          }}
        >
          {/* 名前 */}
          <div style={{ marginBottom: 28 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#2A2520', marginBottom: 8 }}>
              お名前
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="山田 太郎"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #D4C9B0',
                background: '#F5F0E8',
                fontSize: 15,
                color: '#2A2520',
                fontFamily: 'Noto Sans JP, sans-serif',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ height: 1, background: '#D4C9B0', margin: '0 0 28px' }} />

          {/* 価値観 */}
          <FieldBlock
            label="価値観"
            sublabel="あなたが絶対に譲れないもの・大切にしていること"
            color="#4A6FA5"
            bg="#EBF0F8"
            labelTop5="最も大切にしている5つ"
            valueTop5={valueTop5}
            onChangeTop5={setValueTop5}
            placeholderTop5="例：家族、誠実さ、自由、成長、貢献"
            labelOthers="その他の価値観"
            valueOthers={valueOthers}
            onChangeOthers={setValueOthers}
            placeholderOthers="例：挑戦、調和、美しさ..."
            hint="何かを選ぶとき、常に優先している基準・信念・こだわりは？"
          />

          {/* 才能 */}
          <FieldBlock
            label="才能"
            sublabel="あなたが自然にできること・得意なこと"
            color="#C4922A"
            bg="#FBF4E8"
            labelTop5="最も得意な5つ"
            valueTop5={talentTop5}
            onChangeTop5={setTalentTop5}
            placeholderTop5="例：人の話を聞く、分かりやすく説明する、人の心を動かす..."
            labelOthers="その他の才能"
            valueOthers={talentOthers}
            onChangeOthers={setTalentOthers}
            placeholderOthers="例：データ分析、語学、デザイン..."
            hint="他の人より自然にできること、努力している感覚がないのに上手くいくことは？"
          />

          {/* 情熱 */}
          <FieldBlock
            label="情熱"
            sublabel="あなたが夢中になれること・時間を忘れること"
            color="#A84432"
            bg="#F8EDEA"
            labelTop5="最も夢中になる5つ"
            valueTop5={passionTop5}
            onChangeTop5={setPassionTop5}
            placeholderTop5="例：教育、コーチング、旅、音楽、起業..."
            labelOthers="その他の情熱"
            valueOthers={passionOthers}
            onChangeOthers={setPassionOthers}
            placeholderOthers="例：料理、読書、スポーツ..."
            hint="報酬がなくても続けられること、関わると元気になることは？"
            last
          />

          {/* 追加の3問 */}
          <div style={{ height: 1, background: '#D4C9B0', margin: '4px 0 28px' }} />
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <div style={{ width: 4, height: 20, background: '#6B5E4E', borderRadius: 2, flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#6B5E4E', fontFamily: 'Shippori Mincho, serif' }}>
                  深化の問い
                </span>
                <span style={{ fontSize: 12, color: '#1A1208', fontWeight: 600, marginLeft: 8 }}>
                  才覚領域をさらに深めるための3つの問い
                </span>
              </div>
            </div>

            {/* Q1 */}
            <QuestionBlock
              num="Q1"
              question={<>明日死ぬとしたら<br />心残りなのは何ですか？</>}
              value={q1}
              onChange={setQ1}
              placeholder="思いのままに書いてください"
              color="#7B5EA7"
              bg="#F3EFF8"
            />

            {/* Q2 */}
            <QuestionBlock
              num="Q2"
              question={<>お金も時間も制限が一切ない。<br />明日、何をしますか？<br /><span style={{fontSize:12, color:'#888'}}>できるだけ具体的に。</span></>}
              value={q2}
              onChange={setQ2}
              placeholder="具体的なシーン・行動・場所・誰といるか..."
              color="#7B5EA7"
              bg="#F3EFF8"
            />

            {/* Q3 */}
            <QuestionBlock
              num="Q3"
              question={<>才覚領域を全力で生き続けた10年後<br />あなたの周りはどんな影響や変化を遂げていますか？</>}
              value={q3}
              onChange={setQ3}
              placeholder="人・組織・社会・世界...どんな変化が起きているか"
              color="#7B5EA7"
              bg="#F3EFF8"
              last
            />
          </div>

          {/* エラー */}
          {displayError && (
            <div
              style={{
                padding: '12px 16px',
                background: '#F8EDEA',
                border: '1px solid #D89080',
                borderRadius: 8,
                marginBottom: 24,
                fontSize: 14,
                color: '#A84432',
              }}
            >
              {displayError}
            </div>
          )}

          {/* 送信ボタン */}
          <button
            onClick={handleSubmit}
            style={{
              width: '100%',
              padding: '16px 24px',
              borderRadius: 10,
              border: 'none',
              background: 'linear-gradient(135deg, #C4922A, #A84432)',
              color: '#FDFCFA',
              fontSize: 16,
              fontWeight: 700,
              fontFamily: 'Shippori Mincho, serif',
              cursor: 'pointer',
              letterSpacing: '0.05em',
              boxShadow: '0 4px 16px rgba(196,146,42,0.3)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-1px)';
              e.target.style.boxShadow = '0 6px 20px rgba(196,146,42,0.4)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 16px rgba(196,146,42,0.3)';
            }}
          >
            才覚領域を解析する →
          </button>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#4A3F35', marginTop: 12 }}>
            ※ 解析には約30秒かかります
          </p>
        </div>
      </div>
    </div>
  );
}

// ── フィールドブロック（TOP5 + その他 の2テキストエリア） ──────────────
function FieldBlock({
  label, sublabel, color, bg,
  labelTop5, valueTop5, onChangeTop5, placeholderTop5,
  labelOthers, valueOthers, onChangeOthers, placeholderOthers,
  hint, last,
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      {/* ラベルヘッダー */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ width: 4, height: 20, background: color, borderRadius: 2, flexShrink: 0 }} />
        <div>
          <span style={{ fontSize: 15, fontWeight: 700, color, fontFamily: 'Shippori Mincho, serif' }}>
            {label}
          </span>
          <span style={{ fontSize: 12, color: '#1A1208', fontWeight: 600, marginLeft: 8 }}>{sublabel}</span>
        </div>
      </div>

      {/* ★ TOP5 エリア（必須） */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: '#1A1208', fontWeight: 700 }}>★</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1A1208' }}>{labelTop5}</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: '#FDFCFA',
              background: color,
              padding: '2px 8px',
              borderRadius: 100,
              marginLeft: 2,
            }}
          >
            必須
          </span>
        </div>
        <textarea
          value={valueTop5}
          onChange={(e) => onChangeTop5(e.target.value)}
          placeholder={placeholderTop5}
          rows={3}
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 8,
            border: `2px solid ${color}50`,
            background: bg,
            fontSize: 14,
            color: '#2A2520',
            fontFamily: 'Noto Sans JP, sans-serif',
            outline: 'none',
            resize: 'vertical',
            lineHeight: 1.7,
            boxSizing: 'border-box',
            transition: 'border-color 0.2s ease',
          }}
          onFocus={(e) => (e.target.style.borderColor = color)}
          onBlur={(e) => (e.target.style.borderColor = `${color}50`)}
        />
      </div>

      {/* その他エリア（任意） */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: '#2A2010', fontWeight: 600 }}>{labelOthers}</span>
          <span style={{ fontSize: 11, color: '#2A2010' }}>（任意）</span>
        </div>
        <textarea
          value={valueOthers}
          onChange={(e) => onChangeOthers(e.target.value)}
          placeholder={placeholderOthers}
          rows={2}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 8,
            border: `1px dashed ${color}35`,
            background: '#FDFCFA',
            fontSize: 13,
            color: '#2A2520',
            fontFamily: 'Noto Sans JP, sans-serif',
            outline: 'none',
            resize: 'vertical',
            lineHeight: 1.7,
            boxSizing: 'border-box',
            transition: 'border-color 0.2s ease',
          }}
          onFocus={(e) => (e.target.style.borderColor = `${color}70`)}
          onBlur={(e) => (e.target.style.borderColor = `${color}35`)}
        />
      </div>

      <p style={{ fontSize: 12, color: '#2A2010', fontWeight: 600, margin: '6px 0 0', lineHeight: 1.6 }}>
        💡 {hint}
      </p>
      {!last && <div style={{ height: 1, background: '#D4C9B0', margin: '24px 0 0' }} />}
    </div>
  );
}

// ── 深化の問いブロック ──────────────────────────────────────────────────
function QuestionBlock({ num, question, value, onChange, placeholder, color, bg, last }) {
  return (
    <div style={{ marginBottom: last ? 0 : 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: color,
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          {num}
        </span>
        <p
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#2A2520',
            margin: 0,
            lineHeight: 1.8,
            fontFamily: 'Shippori Mincho, serif',
          }}
        >
          {question}
        </p>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        style={{
          width: '100%',
          padding: '12px 14px',
          borderRadius: 8,
          border: `2px solid ${color}40`,
          background: bg,
          fontSize: 14,
          color: '#2A2520',
          fontFamily: 'Noto Sans JP, sans-serif',
          outline: 'none',
          resize: 'vertical',
          lineHeight: 1.7,
          boxSizing: 'border-box',
          transition: 'border-color 0.2s ease',
        }}
        onFocus={(e) => (e.target.style.borderColor = color)}
        onBlur={(e) => (e.target.style.borderColor = `${color}40`)}
      />
      {!last && <div style={{ height: 1, background: '#E8E0D4', margin: '20px 0 0' }} />}
    </div>
  );
}
