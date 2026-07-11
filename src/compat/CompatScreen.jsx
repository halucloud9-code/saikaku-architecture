import { useEffect, useMemo, useState } from 'react';
import './compat.css';

const STATUS_LABELS = {
  detected: '検出',
  not_detected: 'この診断データでは不検出',
  insufficient: 'データ不足',
};

const CATEGORY_LABELS = { talent: '才能', value: '価値観', passion: '情熱' };

async function apiFetch(user, path, options = {}) {
  const token = await user.getIdToken();
  const response = await fetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '通信に失敗しました');
  return data;
}

function Availability({ availability }) {
  if (!availability) return null;
  return (
    <div className="compat-badges" aria-label="利用可能な診断データ">
      {Object.entries(availability.categories || {}).map(([category, state]) => (
        <span className="compat-badge" key={category}>
          {CATEGORY_LABELS[category]}: {state.userTop5 ? '本人Top5＋' : ''}{state.generatedAxes ? '生成軸' : 'この診断データでは不検出'}
        </span>
      ))}
      <span className={`compat-badge ${availability.uaam ? '' : 'muted'}`}>UAAM: {availability.uaam ? 'あり' : 'データなし'}</span>
    </div>
  );
}

export function CompatReport({ result }) {
  if (!result) return null;
  return (
    <section className="compat-report" aria-label="相性分析結果">
      <div className="compat-section sufficiency">
        <p className="compat-kicker">§0 データ充足度</p>
        <h2>最初に、読める範囲</h2>
        <p>{result.dataSufficiency.summary}</p>
        <div className="compat-availability-list">
          {result.dataSufficiency.memberAvailability?.map((member) => (
            <div key={member.alias} className="compat-availability-row">
              <strong>{member.alias}</strong>
              <Availability availability={member} />
            </div>
          ))}
        </div>
        {result.dataSufficiency.limitations?.length > 0 && (
          <ul>{result.dataSufficiency.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
        )}
      </div>

      {result.lenses.map((lens) => (
        <div className="compat-section" key={lens.id}>
          <p className="compat-kicker">{lens.id === 'similarity' ? '同質レンズ' : '補完レンズ'}</p>
          <h2>{STATUS_LABELS[lens.status] || lens.status}</h2>
          <p>{lens.summary}</p>
          {lens.claims.map((claim, index) => (
            <article className="compat-claim" key={`${lens.id}-${index}`}>
              <p className={`compat-claim-kind ${claim.kind}`}>
                {claim.kind === 'hypothesis' ? '[仮説]' : '[観察]'}
              </p>
              <p>{claim.text}</p>
              <p className="compat-evidence-ids">証拠: {claim.evidenceIds.join(', ')}</p>
              <p className="compat-question">確認したい問い：{claim.verificationQuestion}</p>
            </article>
          ))}
        </div>
      ))}

      <footer className="compat-ethics">{result.ethicsNotice}</footer>
    </section>
  );
}

export default function CompatScreen({ user, onBack, onLogout }) {
  const [mode, setMode] = useState('pair');
  const [profiles, setProfiles] = useState([]);
  const [selected, setSelected] = useState([]);
  const [publicImport, setPublicImport] = useState({ enabled: false, message: '' });
  const [shareUrl, setShareUrl] = useState('');
  const [goal, setGoal] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    let active = true;
    apiFetch(user, '/api/admin/compat-profiles')
      .then((data) => {
        if (!active) return;
        setProfiles(data.profiles || []);
        setPublicImport(data.publicImport || { enabled: false, message: '' });
      })
      .catch((cause) => active && setError(cause.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [user]);

  const maxMembers = mode === 'pair' ? 2 : 10;
  const selectedKeys = useMemo(() => new Set(selected.map((member) => member.source === 'internal' ? `internal:${member.id}` : `public:${member.shareUrl}`)), [selected]);
  const canAnalyze = !analyzing
    && consent
    && (mode === 'pair' ? selected.length === 2 : selected.length >= 3)
    && (mode !== 'team' || goal.trim().length > 0);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setSelected([]);
    setResult(null);
    setError('');
    setConsent(false);
  };

  const toggleProfile = (profile) => {
    const key = `internal:${profile.id}`;
    setSelected((current) => {
      if (selectedKeys.has(key)) return current.filter((member) => !(member.source === 'internal' && member.id === profile.id));
      if (current.length >= maxMembers) return current;
      return [...current, { source: 'internal', id: profile.id, profileVersion: profile.profileVersion, displayName: profile.displayName, availability: profile.availability }];
    });
    setResult(null);
  };

  const importProfile = async () => {
    setImporting(true);
    setError('');
    try {
      const data = await apiFetch(user, '/api/admin/compat-import', { method: 'POST', body: JSON.stringify({ shareUrl: shareUrl.trim() }) });
      const member = data.member;
      const key = `public:${member.shareUrl}`;
      setSelected((current) => {
        if (current.some((item) => (item.source === 'public' ? `public:${item.shareUrl}` : `internal:${item.id}`) === key)) return current;
        if (current.length >= maxMembers) return current;
        return [...current, member];
      });
      setShareUrl('');
      setResult(null);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setImporting(false);
    }
  };

  const analyze = async () => {
    setAnalyzing(true);
    setError('');
    setResult(null);
    try {
      const data = await apiFetch(user, '/api/admin/compat-analyze', {
        method: 'POST',
        body: JSON.stringify({
          mode,
          members: selected.map(({ source, id, shareUrl: url, profileVersion }) => ({ source, ...(source === 'internal' ? { id } : { shareUrl: url }), profileVersion })),
          goal: mode === 'team' ? goal.trim() : '',
          consent,
        }),
      });
      setResult(data);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <main className="compat-page">
      <header className="compat-header">
        <div>
          <p className="compat-kicker">ADMIN / COMPATIBILITY</p>
          <h1>相性診断</h1>
          <p>相性を採点せず、同質と補完の証拠を、対話できる仮説にします。</p>
        </div>
        <div className="compat-header-actions">
          <button type="button" className="compat-button secondary" onClick={onBack}>管理画面へ</button>
          <button type="button" className="compat-button secondary" onClick={onLogout}>ログアウト</button>
        </div>
      </header>

      <section className="compat-controls">
        <div className="compat-mode" role="group" aria-label="分析モード">
          <button type="button" aria-pressed={mode === 'pair'} onClick={() => switchMode('pair')}>ペア（2名）</button>
          <button type="button" aria-pressed={mode === 'team'} onClick={() => switchMode('team')}>チーム（3名以上）</button>
        </div>

        {mode === 'team' && (
          <label className="compat-field">
            <span>チームの目的 <b>必須</b></span>
            <textarea value={goal} onChange={(event) => setGoal(event.target.value)} maxLength={500} placeholder="例：新規事業の仮説を3か月で検証する" />
          </label>
        )}

        <h2>内部メンバー</h2>
        {loading ? <p>プロフィールを読み込んでいます…</p> : (
          <div className="compat-profile-grid">
            {profiles.map((profile) => {
              const checked = selectedKeys.has(`internal:${profile.id}`);
              return (
                <label className={`compat-profile ${checked ? 'selected' : ''}`} key={profile.id}>
                  <input type="checkbox" checked={checked} onChange={() => toggleProfile(profile)} disabled={!checked && selected.length >= maxMembers} />
                  <strong>{profile.displayName}</strong>
                  <Availability availability={profile.availability} />
                </label>
              );
            })}
          </div>
        )}

        <div className="compat-import">
          <h2>公開アプリから追加</h2>
          <p>{publicImport.message}</p>
          {publicImport.enabled && (
            <div className="compat-import-row">
              <input aria-label="公開アプリ共有URL" type="url" value={shareUrl} onChange={(event) => setShareUrl(event.target.value)} placeholder="https://app.saikaku-architecture.com/share/..." />
              <button type="button" className="compat-button secondary" onClick={importProfile} disabled={importing || !shareUrl.trim() || selected.length >= maxMembers}>{importing ? '取込中…' : '追加'}</button>
            </div>
          )}
        </div>

        {selected.length > 0 && (
          <div className="compat-selected">
            <h2>選択中（{selected.length}名）</h2>
            {selected.map((member, index) => (
              <div className="compat-selected-row" key={member.source === 'internal' ? member.id : member.shareUrl}>
                <span><b>{mode === 'pair' ? (index === 0 ? 'A' : 'B') : `M${index + 1}`}</b> {member.displayName}</span>
                <button type="button" onClick={() => setSelected((current) => current.filter((item) => item !== member))}>外す</button>
              </div>
            ))}
          </div>
        )}

        <label className="compat-consent">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          <span>対象者全員から、相互理解のために診断データを参照・分析する同意を得ています。人事評価・採用評価には使いません。</span>
        </label>

        {error && <p className="compat-error" role="alert">{error}</p>}
        <button type="button" className="compat-button primary" onClick={analyze} disabled={!canAnalyze}>
          {analyzing ? '分析しています…' : '相性を分析する'}
        </button>
      </section>

      <CompatReport result={result} />
    </main>
  );
}

