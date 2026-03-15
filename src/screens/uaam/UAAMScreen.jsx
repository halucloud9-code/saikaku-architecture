import { useState, useMemo } from 'react';
import { UAAM_AXES, UAAM_QUESTIONS, LIKERT_LABELS } from '../../data/uaam_questions';
import { signOutUser } from '../../firebase';

export default function UAAMScreen({ user, isAdmin, onSubmit, onTestResult, onBack, onAdmin, onLogout, error }) {
  const [answers, setAnswers] = useState({});
  const [activeTab, setActiveTab] = useState(0);

  const questionsByAxis = useMemo(() => {
    return UAAM_AXES.map((axis) => ({
      ...axis,
      questions: UAAM_QUESTIONS.filter((q) => q.axis === axis.key),
    }));
  }, []);

  const currentAxis = questionsByAxis[activeTab];

  // 進捗計算
  const totalAnswered = Object.keys(answers).length;
  const totalQuestions = UAAM_QUESTIONS.length;
  const progressPct = Math.round((totalAnswered / totalQuestions) * 100);

  // 各軸の回答数
  const axisProgress = useMemo(() => {
    return questionsByAxis.map((axis) => {
      const answered = axis.questions.filter((q) => answers[q.id] !== undefined).length;
      return { answered, total: axis.questions.length };
    });
  }, [answers, questionsByAxis]);

  const handleAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const allAnswered = totalAnswered === totalQuestions;

  const handleSubmit = () => {
    if (!allAnswered) return;
    onSubmit(answers);
  };

  // 次のタブへ（未回答の軸がある場合）
  const handleNext = () => {
    if (activeTab < UAAM_AXES.length - 1) {
      setActiveTab(activeTab + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    if (activeTab > 0) {
      setActiveTab(activeTab - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F5F0E8' }}>
      {/* ヘッダー */}
      <div
        style={{
          background: '#FDFCFA',
          borderBottom: '1px solid #D4C9B0',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onBack}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #D4C9B0',
              background: 'transparent',
              color: '#7A7060',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            ← 戻る
          </button>
          <span
            style={{
              fontFamily: "'Playfair Display', 'Noto Serif JP', Georgia, serif",
              fontSize: 16,
              fontWeight: 700,
              color: '#2A2520',
            }}
          >
            UAAM 診断
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isAdmin && (
            <button
              onClick={onAdmin}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #D4C9B0',
                background: 'transparent',
                color: '#7A7060',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              管理画面
            </button>
          )}
          {user.photoURL && (
            <img
              src={user.photoURL}
              alt={user.displayName}
              style={{ width: 30, height: 30, borderRadius: '50%', border: '2px solid #D4C9B0' }}
            />
          )}
          <button
            onClick={async () => { await signOutUser(); onLogout(); }}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #D4C9B0',
              background: 'transparent',
              color: '#7A7060',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            ログアウト
          </button>
        </div>
      </div>

      {/* 全体進捗バー */}
      <div style={{ padding: '16px 24px 0', maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: '#7A7060', fontWeight: 600 }}>
            全体進捗：{totalAnswered}/{totalQuestions}問
          </span>
          <span style={{ fontSize: 13, color: '#7A7060', fontWeight: 700 }}>{progressPct}%</span>
        </div>
        <div style={{ height: 6, background: '#D4C9B0', borderRadius: 3, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${progressPct}%`,
              background: 'linear-gradient(to right, #4A6FA5, #2E8B57, #C4922A, #A84432)',
              borderRadius: 3,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* 開発テスト用ボタン */}
      {onTestResult && (
        <div style={{ padding: '12px 24px 0', maxWidth: 800, margin: '0 auto' }}>
          <button
            onClick={onTestResult}
            style={{
              width: '100%',
              padding: '12px 20px',
              borderRadius: 10,
              border: '2px dashed #A84432',
              background: '#A8443215',
              color: '#A84432',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              letterSpacing: '0.05em',
            }}
          >
            🔧 テスト結果を見る（ダミーデータ）
          </button>
        </div>
      )}

      {/* 4軸タブ */}
      <div style={{ padding: '16px 24px 0', maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          {UAAM_AXES.map((axis, i) => {
            const prog = axisProgress[i];
            const isActive = i === activeTab;
            const isComplete = prog.answered === prog.total;
            return (
              <button
                key={axis.key}
                onClick={() => { setActiveTab(i); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                style={{
                  flex: 1,
                  minWidth: 70,
                  padding: '10px 8px',
                  borderRadius: 10,
                  border: isActive ? `2px solid ${axis.color}` : '1px solid #D4C9B0',
                  background: isActive ? `${axis.color}15` : '#FDFCFA',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 800, color: axis.color }}>{axis.label}</div>
                <div style={{ fontSize: 10, color: '#7A7060', marginTop: 2 }}>{axis.english}</div>
                <div style={{ fontSize: 11, color: isComplete ? '#2E8B57' : '#7A7060', marginTop: 4, fontWeight: 600 }}>
                  {isComplete ? '✓' : `${prog.answered}/${prog.total}`}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 質問リスト */}
      <div style={{ padding: '20px 24px', maxWidth: 800, margin: '0 auto' }}>
        {/* 軸ヘッダー */}
        <div
          style={{
            background: `${currentAxis.color}15`,
            border: `1px solid ${currentAxis.color}40`,
            borderLeft: `4px solid ${currentAxis.color}`,
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: currentAxis.color }}>{currentAxis.label}</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: currentAxis.color }}>{currentAxis.english}</div>
              <div style={{ fontSize: 12, color: '#7A7060' }}>{currentAxis.description}</div>
            </div>
          </div>
        </div>

        {/* 質問カード */}
        {currentAxis.questions.map((q, qi) => {
          const globalIdx = UAAM_QUESTIONS.findIndex((x) => x.id === q.id) + 1;
          return (
            <div
              key={q.id}
              style={{
                background: '#FDFCFA',
                border: answers[q.id] !== undefined ? `1px solid ${currentAxis.color}60` : '1px solid #D4C9B0',
                borderRadius: 12,
                padding: '18px 20px',
                marginBottom: 12,
                boxShadow: '0 1px 4px rgba(42,37,32,0.06)',
                transition: 'border-color 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                <span
                  style={{
                    background: currentAxis.color,
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 100,
                    flexShrink: 0,
                  }}
                >
                  Q{globalIdx}
                </span>
                <span style={{ fontSize: 10, color: '#7A7060', flexShrink: 0, marginTop: 2 }}>
                  {currentAxis.subs.find((s) => s.key === q.sub)?.label || q.sub}
                </span>
              </div>
              <p style={{ fontSize: 15, color: '#2A2520', margin: '0 0 14px', lineHeight: 1.6, fontWeight: 500 }}>
                {q.text}
              </p>

              {/* リッカート尺度ボタン */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {LIKERT_LABELS.map((opt) => {
                  const isSelected = answers[q.id] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleAnswer(q.id, opt.value)}
                      style={{
                        flex: 1,
                        minWidth: 50,
                        padding: '8px 4px',
                        borderRadius: 8,
                        border: isSelected ? `2px solid ${currentAxis.color}` : '1px solid #D4C9B0',
                        background: isSelected ? `${currentAxis.color}` : '#FDFCFA',
                        color: isSelected ? '#fff' : '#2A2520',
                        fontSize: 11,
                        fontWeight: isSelected ? 700 : 400,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        textAlign: 'center',
                        lineHeight: 1.3,
                      }}
                    >
                      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{opt.value}</div>
                      <div style={{ fontSize: 9 }}>{opt.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* ナビゲーションボタン */}
        <div style={{ display: 'flex', gap: 12, marginTop: 24, marginBottom: 16 }}>
          {activeTab > 0 && (
            <button
              onClick={handlePrev}
              style={{
                flex: 1,
                padding: '14px 20px',
                borderRadius: 10,
                border: '1px solid #D4C9B0',
                background: '#FDFCFA',
                color: '#7A7060',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ← {UAAM_AXES[activeTab - 1].label}（{UAAM_AXES[activeTab - 1].english}）
            </button>
          )}
          {activeTab < UAAM_AXES.length - 1 && (
            <button
              onClick={handleNext}
              style={{
                flex: 1,
                padding: '14px 20px',
                borderRadius: 10,
                border: 'none',
                background: currentAxis.color,
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {UAAM_AXES[activeTab + 1].label}（{UAAM_AXES[activeTab + 1].english}）→
            </button>
          )}
        </div>

        {/* 送信ボタン */}
        {activeTab === UAAM_AXES.length - 1 && (
          <button
            onClick={handleSubmit}
            disabled={!allAnswered}
            style={{
              width: '100%',
              padding: '16px 20px',
              borderRadius: 12,
              border: 'none',
              background: allAnswered
                ? 'linear-gradient(135deg, #4A6FA5, #2E8B57, #C4922A, #A84432)'
                : '#D4C9B0',
              color: '#fff',
              fontSize: 18,
              fontWeight: 700,
              cursor: allAnswered ? 'pointer' : 'not-allowed',
              letterSpacing: '0.05em',
              marginBottom: 16,
            }}
          >
            {allAnswered ? '診断結果を見る' : `あと${totalQuestions - totalAnswered}問`}
          </button>
        )}

        {error && (
          <div
            style={{
              background: '#FFF0F0',
              border: '1px solid #A84432',
              borderRadius: 10,
              padding: '12px 16px',
              color: '#A84432',
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
