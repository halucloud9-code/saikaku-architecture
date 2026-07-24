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

export function reportForCompatShare(result) {
  const report = structuredClone(result);
  if (report && typeof report === 'object') {
    delete report.uaamMatrix;
    if (report.visual?.uaam && typeof report.visual.uaam === 'object') {
      delete report.visual.uaam.memberScores;
    }
  }
  return report;
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
  const [recommendSummary, setRecommendSummary] = useState(null);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendNamesConsent, setRecommendNamesConsent] = useState(false);
  const [recommendNamesLoading, setRecommendNamesLoading] = useState(false);
  const [recommendCandidates, setRecommendCandidates] = useState(null);
  const [recommendError, setRecommendError] = useState('');

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
  const hasRecommendationMatches = Array.isArray(recommendSummary)
    && recommendSummary.some((axis) => axis.candidateCount > 0);

  const resetRecommendation = () => {
    setRecommendSummary(null);
    setRecommendLoading(false);
    setRecommendNamesConsent(false);
    setRecommendNamesLoading(false);
    setRecommendCandidates(null);
    setRecommendError('');
  };

  const recommendationMembers = (members) => members.map(({ source, id, shareUrl: url }) => ({
    source,
    ...(source === 'internal' ? { id } : { shareUrl: url }),
  }));

  const loadRecommendationSummary = async (members) => {
    setRecommendLoading(true);
    setRecommendError('');
    try {
      const data = await apiFetch(user, '/api/admin/compat-recommend', {
        method: 'POST',
        body: JSON.stringify({
          action: 'search',
          members: recommendationMembers(members),
          consent: true,
        }),
      });
      setRecommendSummary(Array.isArray(data.shortages) ? data.shortages : []);
    } catch (cause) {
      setRecommendError(cause.message);
    } finally {
      setRecommendLoading(false);
    }
  };

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
    resetRecommendation();
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
    resetRecommendation();
  };

  const removeMember = (member) => {
    setSelected((current) => current.filter((item) => item !== member));
    setResult(null);
    setShareConsent(false);
    setShare(null);
    setCopied(false);
    setShareError('');
    resetRecommendation();
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
      resetRecommendation();
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
    resetRecommendation();
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
      await loadRecommendationSummary(selected);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleRecommendationNames = async (checked) => {
    setRecommendNamesConsent(checked);
    setRecommendCandidates(null);
    setRecommendError('');
    if (!checked) return;

    setRecommendNamesLoading(true);
    try {
      const data = await apiFetch(user, '/api/admin/compat-recommend', {
        method: 'POST',
        body: JSON.stringify({
          action: 'show_names',
          members: recommendationMembers(selected),
          consent: true,
        }),
      });
      setRecommendCandidates(Array.isArray(data.candidates) ? data.candidates : []);
    } catch (cause) {
      setRecommendNamesConsent(false);
      setRecommendError(cause.message);
    } finally {
      setRecommendNamesLoading(false);
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
          report: reportForCompatShare(result),
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
          <p className="compat-kicker">管理者向け・相性診断</p>
          <h1>相性診断</h1>
          <p>点数はつけません。「似ているところ」と「違いで補い合えるところ」を見つけ、対話のきっかけにします。</p>
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
              resetRecommendation();
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
              <button type="button" className="compat-button secondary" onClick={importProfile} disabled={importing || !shareUrl.trim() || selected.length >= maxMembers}>{importing ? '取り込み中…' : '追加'}</button>
            </div>
          )}
        </div>

        {selected.length > 0 && (
          <div className="compat-selected">
            <h2>選択中（{selected.length}名）</h2>
            {selected.map((member, index) => (
              <div className="compat-selected-row" key={member.source === 'internal' ? member.id : member.shareUrl}>
                <label className="compat-display-name">
                  <span><b>{`M${index + 1}`}</b> レポート表示名</span>
                  <input
                    aria-label={`M${index + 1} レポート表示名`}
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
            <p className="compat-selected-note">表示名は分析用データやAIには送られず、レポートと共有ページの表示にだけ使われます。</p>
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

      <CompatReport result={result} memberLabels={reportLabels} uaamMatrix={result?.uaamMatrix} />

      {result && (
        <section className="compat-recommend" aria-label="チームにない力を持つ受講者を探す">
          <p className="compat-kicker">受講者を探す</p>
          <h2>チームにない力を持つ受講者を探す</h2>
          <p className="compat-recommend-rule">
            チームで12点（発動の目安）未満、またはデータのない軸を、16点以上で持っている人を、名前の順で表示します。
          </p>
          <p className="compat-recommend-ethics">
            この機能は相互理解のための対話相手を探す補助です。人事・採用・配属の判断には使いません。
          </p>

          {recommendLoading && <p role="status">該当人数を集計しています…</p>}
          {recommendError && <p className="compat-error" role="alert">{recommendError}</p>}
          {Array.isArray(recommendSummary) && recommendSummary.length === 0 && (
            <p>現在の選択メンバーには、この基準に該当する不足軸はありません。</p>
          )}
          {Array.isArray(recommendSummary) && recommendSummary.length > 0 && (
            <div className="compat-recommend-summary">
              <h3>氏名を表示する前の集計</h3>
              <ul>
                {recommendSummary.map((axis) => (
                  <li key={axis.axisKey}>
                    {axis.axisLabel}
                    {axis.noData ? '（チームにデータなし）' : '（チームで12点未満）'}
                    を16点以上で持つ受講者が {axis.candidateCount}人 います
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasRecommendationMatches && (
            <label className="compat-consent compat-recommend-consent">
              <input
                type="checkbox"
                checked={recommendNamesConsent}
                disabled={recommendNamesLoading}
                onChange={(event) => toggleRecommendationNames(event.target.checked)}
              />
              <span>
                表示される候補者それぞれについて、相互理解目的でデータを参照することの同意を個別に確認しました。人事・採用・配属の判断には使いません
              </span>
            </label>
          )}
          {recommendNamesLoading && <p role="status">氏名を読み込んでいます…</p>}
          {recommendNamesConsent && Array.isArray(recommendCandidates) && recommendCandidates.length === 0 && (
            <p>この基準に該当する受講者はいません。</p>
          )}
          {recommendNamesConsent && Array.isArray(recommendCandidates) && recommendCandidates.length > 0 && (
            <div className="compat-recommend-candidates" aria-label="氏名を表示した該当者一覧">
              {recommendCandidates.map((candidate) => (
                <article key={candidate.profileId}>
                  <h3>{candidate.displayName}</h3>
                  <div className="compat-recommend-axis-chips" aria-label={`${candidate.displayName}の該当軸`}>
                    {candidate.matchedAxes.map((axis) => (
                      <span key={axis.axisKey}>
                        {axis.axisLabel}・{axis.noData ? 'チームにデータなし' : 'チームで12点未満'}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {result && (
        <section className="compat-share-controls" aria-label="分析結果の共有">
          <p className="compat-kicker">結果を共有する</p>
          <h2>対象者へ結果を共有</h2>
          <p>URLを知る人が閲覧できます。有効期間は発行から30日で、いつでも失効できます。</p>
          <label className="compat-consent">
            <input type="checkbox" checked={shareConsent} onChange={(event) => setShareConsent(event.target.checked)} disabled={!!share} />
            <span>
              本結果の共有について、対象者全員の同意を確認しました
              {hasMatchedTerms && '（表記が完全に一致した言葉が対象者間に表示されます。本人が入力した言葉はAIには送られません。診断で見つかった軸の名前は、氏名を除いたプロフィールの一部としてAIに渡ります）'}
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
