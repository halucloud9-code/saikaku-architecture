import { useEffect, useMemo, useState } from 'react';
import CompatReport, { Availability } from './CompatReport';

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
  const [shareConsent, setShareConsent] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [share, setShare] = useState(null);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState('');
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
  const reportLabels = selected.map((member) => member.displayName.trim());
  const hasMatchedTerms = result?.visual?.schemaVersion === 2
    && Array.isArray(result.visual.matches)
    && result.visual.matches.length > 0;
  const canIssueShare = shareConsent
    && !sharing
    && reportLabels.every((label) => label.length >= 1 && label.length <= 80);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setSelected([]);
    setResult(null);
    setError('');
    setConsent(false);
    setShareConsent(false);
    setShare(null);
    setCopied(false);
    setShareError('');
  };

  const toggleProfile = (profile) => {
    const key = `internal:${profile.id}`;
    setSelected((current) => {
      if (selectedKeys.has(key)) return current.filter((member) => !(member.source === 'internal' && member.id === profile.id));
      if (current.length >= maxMembers) return current;
      return [...current, { source: 'internal', id: profile.id, profileVersion: profile.profileVersion, displayName: profile.displayName, availability: profile.availability }];
    });
    setResult(null);
    setShareConsent(false);
    setShare(null);
    setCopied(false);
    setShareError('');
  };

  const removeMember = (member) => {
    setSelected((current) => current.filter((item) => item !== member));
    setResult(null);
    setShareConsent(false);
    setShare(null);
    setCopied(false);
    setShareError('');
  };

  const updateDisplayName = (member, displayName) => {
    setSelected((current) => current.map((item) => (
      item === member ? { ...item, displayName } : item
    )));
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
      setShareConsent(false);
      setShare(null);
      setCopied(false);
      setShareError('');
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
    setShareConsent(false);
    setShare(null);
    setCopied(false);
    setShareError('');
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

  const issueShare = async () => {
    setSharing(true);
    setShareError('');
    setCopied(false);
    try {
      const issued = await apiFetch(user, '/api/admin/compat-share', {
        method: 'POST',
        body: JSON.stringify({
          report: result,
          mode,
          goal: mode === 'team' ? goal.trim() : '',
          memberLabels: reportLabels,
          consentConfirmed: shareConsent,
        }),
      });
      setShare({ ...issued, revoked: false });
    } catch (cause) {
      setShareError(cause.message);
    } finally {
      setSharing(false);
    }
  };

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
    } catch {
      setShareError('共有URLをコピーできませんでした。URL欄から手動でコピーしてください。');
    }
  };

  const revokeShare = async () => {
    if (!window.confirm('この共有URLを失効させます。元には戻せません。よろしいですか？')) return;
    setRevoking(true);
    setShareError('');
    try {
      await apiFetch(user, '/api/admin/compat-share', {
        method: 'POST',
        body: JSON.stringify({ action: 'revoke', shareId: share.shareId }),
      });
      setShare((current) => ({ ...current, revoked: true }));
    } catch (cause) {
      setShareError(cause.message);
    } finally {
      setRevoking(false);
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
            <textarea value={goal} onChange={(event) => {
              setGoal(event.target.value);
              setResult(null);
              setShareConsent(false);
              setShare(null);
              setCopied(false);
              setShareError('');
            }} maxLength={500} placeholder="例：新規事業の仮説を3か月で検証する" />
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
                <label className="compat-display-name">
                  <span><b>{mode === 'pair' ? (index === 0 ? 'A' : 'B') : `M${index + 1}`}</b> レポート表示名</span>
                  <input
                    aria-label={`${mode === 'pair' ? (index === 0 ? 'A' : 'B') : `M${index + 1}`} レポート表示名`}
                    type="text"
                    value={member.displayName}
                    maxLength={80}
                    disabled={!!share}
                    onChange={(event) => updateDisplayName(member, event.target.value)}
                  />
                </label>
                <button type="button" onClick={() => removeMember(member)}>外す</button>
              </div>
            ))}
            <p className="compat-selected-note">表示名は分析用データやLLMには送られず、レポートと共有ページにだけ使われます。</p>
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

      <CompatReport result={result} memberLabels={reportLabels} />

      {result && (
        <section className="compat-share-controls" aria-label="分析結果の共有">
          <p className="compat-kicker">SHARE</p>
          <h2>対象者へ結果を共有</h2>
          <p>URLを知る人が閲覧できます。有効期間は発行から30日で、いつでも失効できます。</p>
          <label className="compat-consent">
            <input type="checkbox" checked={shareConsent} onChange={(event) => setShareConsent(event.target.checked)} disabled={!!share} />
            <span>
              本結果の共有について、対象者全員の同意を確認しました
              {hasMatchedTerms && '（完全一致語が対象者間に表示されます。本人が入力したTop5の語はLLMに送信されない。生成軸名は別名化プロフィールの一部としてLLMに渡る）'}
            </span>
          </label>
          {shareError && <p className="compat-error" role="alert">{shareError}</p>}
          {!share && (
            <button type="button" className="compat-button primary" onClick={issueShare} disabled={!canIssueShare}>
              {sharing ? '発行しています…' : '共有URLを発行'}
            </button>
          )}
          {share && (
            <div className="compat-share-issued">
              <label className="compat-field">
                <span>共有URL</span>
                <input aria-label="発行済み共有URL" readOnly value={share.url} />
              </label>
              {!share.revoked ? (
                <div className="compat-share-actions">
                  <button type="button" className="compat-button secondary" onClick={copyShareUrl}>{copied ? 'コピーしました' : 'コピー'}</button>
                  <button type="button" className="compat-button danger" onClick={revokeShare} disabled={revoking}>{revoking ? '失効中…' : '失効させる'}</button>
                </div>
              ) : <p className="compat-share-revoked" role="status">この共有URLは失効しました。</p>}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
