import { useEffect, useMemo, useRef, useState } from 'react';
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
  let data;
  try {
    data = await response.json();
  } catch {
    const cause = new Error(response.ok ? '通信の応答を読み取れませんでした' : '通信に失敗しました');
    cause.status = response.status;
    throw cause;
  }
  if (!response.ok) {
    const cause = new Error(data.error || '通信に失敗しました');
    cause.status = response.status;
    cause.code = data.code;
    throw cause;
  }
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
  const [resultSnapshot, setResultSnapshot] = useState(null);
  const [soloPayload, setSoloPayload] = useState(null);
  const [soloSnapshot, setSoloSnapshot] = useState(null);
  const [recommendSummary, setRecommendSummary] = useState(null);
  const [rankingSummary, setRankingSummary] = useState(null);
  const [recommendSnapshot, setRecommendSnapshot] = useState(null);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendNamesConsent, setRecommendNamesConsent] = useState(false);
  const [recommendNamesLoading, setRecommendNamesLoading] = useState(false);
  const [recommendCandidates, setRecommendCandidates] = useState(null);
  const [recommendRanking, setRecommendRanking] = useState(null);
  const [recommendError, setRecommendError] = useState('');
  const analysisGenerationRef = useRef(0);

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

  const maxMembers = mode === 'solo' ? 1 : mode === 'pair' ? 2 : 10;
  const selectedKeys = useMemo(() => new Set(selected.map((member) => member.source === 'internal' ? `internal:${member.id}` : `public:${member.shareUrl}`)), [selected]);
  const canAnalyze = !analyzing
    && consent
    && (mode === 'solo' ? selected.length === 1 : mode === 'pair' ? selected.length === 2 : selected.length >= 3)
    && (mode !== 'team' || goal.trim().length > 0);
  const reportLabels = resultSnapshot?.memberLabels || [];
  const hasMatchedTerms = result?.visual?.schemaVersion === 2
    && Array.isArray(result.visual.matches)
    && result.visual.matches.length > 0;
  const canIssueShare = shareConsent
    && !sharing
    && reportLabels.every((label) => label.length >= 1 && label.length <= 80);
  const hasRecommendationMatches = Array.isArray(recommendSummary)
    && recommendSummary.some((axis) => axis.candidateCount > 0);
  const hasRankingMatches = rankingSummary?.eligible === true
    && Number.isInteger(rankingSummary.matchedCount)
    && rankingSummary.matchedCount > 0;
  const canRevealRecommendationNames = hasRecommendationMatches || hasRankingMatches;
  const isSoloSelection = selected.length === 1;
  const recommendationHeading = isSoloSelection
    ? 'この人にない力を持つ受講者を探す'
    : 'チームにない力を持つ受講者を探す';
  const noDataLabel = isSoloSelection ? 'データなし' : 'チームにデータなし';
  const belowThresholdLabel = isSoloSelection ? '12点未満' : 'チームで12点未満';
  const soloSubject = soloPayload?.subject || null;
  const soloDisplayName = soloSnapshot?.members?.[0]?.displayName?.trim()
    || soloSubject?.displayName
    || '';
  const soloReport = useMemo(() => (
    soloSubject
      ? {
        dataSufficiency: {
          memberAvailability: [{ alias: 'M1', ...soloSubject.availability }],
        },
      }
      : null
  ), [soloSubject]);

  const resetRecommendation = () => {
    setRecommendSummary(null);
    setRankingSummary(null);
    setRecommendSnapshot(null);
    setRecommendLoading(false);
    setRecommendNamesConsent(false);
    setRecommendNamesLoading(false);
    setRecommendCandidates(null);
    setRecommendRanking(null);
    setRecommendError('');
  };

  const invalidateAnalysisResult = () => {
    analysisGenerationRef.current += 1;
    setAnalyzing(false);
    setSharing(false);
    setResult(null);
    setResultSnapshot(null);
    setSoloPayload(null);
    setSoloSnapshot(null);
  };

  const recommendationMembers = (members) => members.map(({ source, id, shareUrl: url }) => ({
    source,
    ...(source === 'internal' ? { id } : { shareUrl: url }),
  }));

  const loadRecommendationSummary = async (members, generation, { preserveError = false } = {}) => {
    if (analysisGenerationRef.current !== generation) return;
    setRecommendLoading(true);
    setRecommendSummary(null);
    setRankingSummary(null);
    setRecommendSnapshot(null);
    if (!preserveError) setRecommendError('');
    try {
      const data = await apiFetch(user, '/api/admin/compat-recommend', {
        method: 'POST',
        body: JSON.stringify({
          action: 'search',
          members: recommendationMembers(members),
          consent: true,
        }),
      });
      if (analysisGenerationRef.current !== generation) return;
      if (typeof data.snapshot !== 'string' || !data.snapshot) {
        throw new Error('受講者の検索結果を読み取れませんでした');
      }
      setRecommendSummary(Array.isArray(data.shortages) ? data.shortages : []);
      setRankingSummary(data.rankingSummary && typeof data.rankingSummary === 'object'
        ? data.rankingSummary
        : null);
      setRecommendSnapshot(data.snapshot);
      if (mode === 'solo' && data.subject) setSoloPayload(data);
    } catch (cause) {
      if (analysisGenerationRef.current !== generation) return;
      setRecommendError(cause.message);
    } finally {
      if (analysisGenerationRef.current === generation) setRecommendLoading(false);
    }
  };

  const switchMode = (nextMode) => {
    invalidateAnalysisResult();
    setMode(nextMode);
    setSelected([]);
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
    invalidateAnalysisResult();
    setSelected((current) => {
      if (selectedKeys.has(key)) return current.filter((member) => !(member.source === 'internal' && member.id === profile.id));
      if (current.length >= maxMembers) return current;
      return [...current, { source: 'internal', id: profile.id, profileVersion: profile.profileVersion, displayName: profile.displayName, availability: profile.availability }];
    });
    setShareConsent(false);
    setShare(null);
    setCopied(false);
    setShareError('');
    resetRecommendation();
  };

  const removeMember = (member) => {
    invalidateAnalysisResult();
    setSelected((current) => current.filter((item) => item !== member));
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
      invalidateAnalysisResult();
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

  const analyzeSolo = async () => {
    const generation = analysisGenerationRef.current + 1;
    analysisGenerationRef.current = generation;
    const snapshot = {
      generation,
      mode: 'solo',
      members: selected.map((member) => ({ ...member })),
    };
    setAnalyzing(true);
    setSharing(false);
    setError('');
    setResult(null);
    setResultSnapshot(null);
    setSoloPayload(null);
    setSoloSnapshot(null);
    setShareConsent(false);
    setShare(null);
    setCopied(false);
    setShareError('');
    resetRecommendation();
    setRecommendLoading(true);
    try {
      const data = await apiFetch(user, '/api/admin/compat-recommend', {
        method: 'POST',
        body: JSON.stringify({
          action: 'search',
          members: recommendationMembers(snapshot.members),
          consent: true,
        }),
      });
      if (analysisGenerationRef.current !== generation) return;
      if (typeof data.snapshot !== 'string' || !data.snapshot || !data.subject) {
        throw new Error('1人分の力マップを読み取れませんでした');
      }
      setRecommendSummary(Array.isArray(data.shortages) ? data.shortages : []);
      setRankingSummary(data.rankingSummary && typeof data.rankingSummary === 'object'
        ? data.rankingSummary
        : null);
      setRecommendSnapshot(data.snapshot);
      setSoloPayload(data);
      setSoloSnapshot(snapshot);
    } catch (cause) {
      if (analysisGenerationRef.current !== generation) return;
      setError(cause.message);
    } finally {
      if (analysisGenerationRef.current === generation) {
        setAnalyzing(false);
        setRecommendLoading(false);
      }
    }
  };

  const analyze = async () => {
    const generation = analysisGenerationRef.current + 1;
    analysisGenerationRef.current = generation;
    const snapshot = {
      generation,
      mode,
      goal: mode === 'team' ? goal.trim() : '',
      members: selected.map((member) => ({ ...member })),
      memberLabels: selected.map((member) => member.displayName.trim()),
    };
    setAnalyzing(true);
    setSharing(false);
    setError('');
    setResult(null);
    setResultSnapshot(null);
    setShareConsent(false);
    setShare(null);
    setCopied(false);
    setShareError('');
    resetRecommendation();
    try {
      const data = await apiFetch(user, '/api/admin/compat-analyze', {
        method: 'POST',
        body: JSON.stringify({
          mode: snapshot.mode,
          members: snapshot.members.map(({ source, id, shareUrl: url, profileVersion }) => ({ source, ...(source === 'internal' ? { id } : { shareUrl: url }), profileVersion })),
          goal: snapshot.goal,
          consent,
        }),
      });
      if (analysisGenerationRef.current !== generation) return;
      setResult(data);
      setResultSnapshot(snapshot);
      setAnalyzing(false);
      void loadRecommendationSummary(snapshot.members, generation);
    } catch (cause) {
      if (analysisGenerationRef.current !== generation) return;
      setError(cause.message);
    } finally {
      if (analysisGenerationRef.current === generation) setAnalyzing(false);
    }
  };

  const toggleRecommendationNames = async (checked) => {
    setRecommendNamesConsent(checked);
    setRecommendCandidates(null);
    setRecommendRanking(null);
    setRecommendError('');
    if (!checked) return;

    const snapshot = mode === 'solo' ? soloSnapshot : resultSnapshot;
    if (!snapshot || analysisGenerationRef.current !== snapshot.generation) return;
    setRecommendNamesLoading(true);
    try {
      const data = await apiFetch(user, '/api/admin/compat-recommend', {
        method: 'POST',
        body: JSON.stringify({
          action: 'show_names',
          members: recommendationMembers(snapshot.members),
          consent: true,
          snapshot: recommendSnapshot,
        }),
      });
      if (analysisGenerationRef.current !== snapshot.generation) return;
      setRecommendCandidates(Array.isArray(data.candidates) ? data.candidates : []);
      setRecommendRanking(Array.isArray(data.ranking) ? data.ranking : []);
    } catch (cause) {
      if (analysisGenerationRef.current !== snapshot.generation) return;
      setRecommendNamesConsent(false);
      setRecommendError(cause.message);
      if (cause.status === 409) {
        setRecommendNamesLoading(false);
        await loadRecommendationSummary(snapshot.members, snapshot.generation, { preserveError: true });
      }
    } finally {
      if (analysisGenerationRef.current === snapshot.generation) setRecommendNamesLoading(false);
    }
  };

  const selectRankingCandidateForPair = (candidate) => {
    const matchingProfiles = profiles.filter((profile) => (
      profile.displayName === candidate.displayName
    ));
    const snapshot = mode === 'solo' ? soloSnapshot : resultSnapshot;
    const subject = snapshot?.members?.find((member) => member.source === 'internal');
    if (matchingProfiles.length !== 1 || !subject) return;
    const candidateProfile = matchingProfiles[0];
    if (candidateProfile.id === subject.id) return;

    invalidateAnalysisResult();
    setMode('pair');
    setSelected([
      { ...subject },
      {
        source: 'internal',
        id: candidateProfile.id,
        profileVersion: candidateProfile.profileVersion,
        displayName: candidateProfile.displayName,
        availability: candidateProfile.availability,
      },
    ]);
    setError('');
    setConsent(false);
    setShareConsent(false);
    setShare(null);
    setCopied(false);
    setShareError('');
    resetRecommendation();
  };

  const issueShare = async () => {
    if (mode === 'solo' || !result) return;
    const snapshot = resultSnapshot;
    if (!snapshot || analysisGenerationRef.current !== snapshot.generation) return;
    setSharing(true);
    setShareError('');
    setCopied(false);
    try {
      const issued = await apiFetch(user, '/api/admin/compat-share', {
        method: 'POST',
        body: JSON.stringify({
          report: reportForCompatShare(result),
          uaamMatrix: result?.uaamMatrix,
          mode: snapshot.mode,
          goal: snapshot.goal,
          memberLabels: snapshot.memberLabels,
          consentConfirmed: shareConsent,
        }),
      });
      if (analysisGenerationRef.current !== snapshot.generation) {
        if (typeof issued?.shareId === 'string' && issued.shareId) {
          void apiFetch(user, '/api/admin/compat-share', {
            method: 'POST',
            body: JSON.stringify({ action: 'revoke', shareId: issued.shareId }),
          }).catch(() => {});
        }
        return;
      }
      setShare({ ...issued, revoked: false });
    } catch (cause) {
      if (analysisGenerationRef.current !== snapshot.generation) return;
      setShareError(cause.message);
    } finally {
      if (analysisGenerationRef.current === snapshot.generation) setSharing(false);
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
          <p>人物には点数をつけません。組み合わせにだけ指標を出します。「似ているところ」と「違いで補い合えるところ」を見つけ、対話のきっかけにします。</p>
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
          <button type="button" aria-pressed={mode === 'solo'} onClick={() => switchMode('solo')}>1人</button>
        </div>

        {mode === 'team' && (
          <label className="compat-field">
            <span>チームの目的 <b>必須</b></span>
            <textarea value={goal} onChange={(event) => {
              invalidateAnalysisResult();
              setGoal(event.target.value);
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

        {mode !== 'solo' && (
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
        )}

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
        <button type="button" className="compat-button primary" onClick={mode === 'solo' ? analyzeSolo : analyze} disabled={!canAnalyze}>
          {analyzing
            ? mode === 'solo' ? '力マップを読み込んでいます…' : '分析しています…'
            : mode === 'solo' ? '力マップと相性を見る' : '相性を分析する'}
        </button>
      </section>

      <CompatReport result={result} memberLabels={reportLabels} uaamMatrix={result?.uaamMatrix} />

      {soloSubject && (
        <section className="compat-solo-result" aria-label={`${soloDisplayName}の診断結果`}>
          <div className="compat-solo-axes">
            <p className="compat-kicker">診断プロフィール</p>
            <h2>{soloDisplayName}の診断で見つかった軸</h2>
            <div className="compat-solo-axis-groups">
              {[
                ['talent', '才能'],
                ['value', '価値観'],
                ['passion', '情熱'],
              ].map(([category, label]) => (
                <section key={category}>
                  <h3>{label}</h3>
                  <div className="compat-solo-axis-chips" aria-label={`${label}の診断で見つかった軸`}>
                    {soloSubject.generatedAxes?.[category]?.length > 0
                      ? soloSubject.generatedAxes[category].map((axis) => <span key={axis}>{axis}</span>)
                      : <span className="muted">データなし</span>}
                  </div>
                </section>
              ))}
            </div>
          </div>
          <CompatReport
            result={soloReport}
            memberLabels={[soloDisplayName]}
            uaamMatrix={soloSubject.uaamMatrix}
          />
        </section>
      )}

      {(result || soloPayload || (mode === 'solo' && analyzing)) && (
        <section className="compat-recommend" aria-label={recommendationHeading}>
          <p className="compat-kicker">受講者を探す</p>
          <h2>{recommendationHeading}</h2>
          <p className="compat-recommend-rule">
            {isSoloSelection
              ? 'この人が12点（発動の目安）未満、またはデータのない軸を、16点以上で持っている人を、名前の順で表示します。'
              : 'チームで12点（発動の目安）未満、またはデータのない軸を、16点以上で持っている人を、名前の順で表示します。'}
          </p>
          <p className="compat-recommend-ethics">
            この機能は、コミュニティ内のチームづくりと相互理解のためのものです。雇用・人事・採用・査定の判断には使いません。
          </p>

          <div className="compat-recommend-status" role="status" aria-live="polite" aria-atomic="true">
            {recommendLoading
              ? '該当人数を集計しています…'
              : recommendNamesLoading
                ? '氏名を読み込んでいます…'
                : recommendNamesConsent && Array.isArray(recommendCandidates)
                  ? '氏名の読み込みが完了しました。'
                  : Array.isArray(recommendSummary)
                    ? '該当人数の集計が完了しました。'
                    : ''}
          </div>
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
                    {`${axis.axisLabel}（${axis.noData ? noDataLabel : belowThresholdLabel}）を16点以上で持つ受講者が ${axis.candidateCount}人 います`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <section className="compat-ranking-summary" aria-labelledby="compat-ranking-heading">
            <h3 id="compat-ranking-heading">学び合いやすい組み合わせ</h3>
            <p className="compat-ranking-rule">
              この指標は「その組み合わせでどれだけ学び合えそうか」を表します。人物の能力や優劣の点数ではありません。相手が変われば値も変わります。
            </p>
            {rankingSummary?.eligible === false && <p>{rankingSummary.reason}</p>}
            {rankingSummary?.eligible === true && rankingSummary.matchedCount === 0 && (
              <p>現在の選択メンバーと組み合わせて表示できる受講者はいません。</p>
            )}
            {rankingSummary?.truncated > 0 && (
              <p>ほかに{rankingSummary.truncated}人が条件に合いましたが、上位10人まで表示しています</p>
            )}
            {rankingSummary?.excludedForMissingAxes > 0 && (
              <p>詳細診断(UAAM)の16項目がそろっていない{rankingSummary.excludedForMissingAxes}人は、比較の対象外です</p>
            )}
          </section>

          {canRevealRecommendationNames && (
            <label className="compat-consent compat-recommend-consent no-print">
              <input
                type="checkbox"
                checked={recommendNamesConsent}
                disabled={recommendNamesLoading || recommendLoading || !recommendSnapshot}
                onChange={(event) => toggleRecommendationNames(event.target.checked)}
              />
              <span>
                表示される候補者それぞれについて、相互理解目的でデータを参照することの同意を個別に確認しました。人事・採用・配属の判断には使いません
              </span>
            </label>
          )}
          {hasRecommendationMatches && recommendNamesConsent && Array.isArray(recommendCandidates) && recommendCandidates.length === 0 && (
            <p>この基準に該当する受講者はいません。</p>
          )}
          {recommendNamesConsent && Array.isArray(recommendCandidates) && recommendCandidates.length > 0 && (
            <div className="compat-recommend-candidates" aria-label="氏名を表示した該当者一覧">
              {recommendCandidates.map((candidate, index) => (
                <article key={index}>
                  <h3>{candidate.displayName}</h3>
                  <div className="compat-recommend-axis-chips" aria-label={`${candidate.displayName}の該当軸`}>
                    {(candidate.matchedAxes || []).map((axis) => (
                      <span key={axis.axisKey}>
                        {axis.axisLabel}・{axis.noData ? noDataLabel : belowThresholdLabel}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}

          {recommendNamesConsent
            && rankingSummary?.eligible === true
            && Array.isArray(recommendRanking)
            && recommendRanking.length > 0 && (
            <div className="compat-ranking-list no-print" role="list" aria-label="学び合いやすい組み合わせの候補者ランキング">
              {recommendRanking.map((candidate, index) => {
                const matchingProfiles = profiles.filter((profile) => (
                  profile.displayName === candidate.displayName
                ));
                const shortageCandidate = matchingProfiles.length === 1
                  ? recommendCandidates?.find((item) => (
                    item.displayName === candidate.displayName
                  ))
                  : null;
                const snapshot = mode === 'solo' ? soloSnapshot : resultSnapshot;
                const subject = snapshot?.members?.find((member) => member.source === 'internal');
                const ambiguousName = matchingProfiles.length > 1;
                const unavailable = matchingProfiles.length !== 1
                  || !subject
                  || matchingProfiles[0]?.id === subject.id;
                const buttonTitle = ambiguousName
                  ? '同名の受講者がいるため、一覧から選んでください'
                  : unavailable
                    ? '受講者一覧から選んでください'
                    : undefined;
                return (
                  <article key={index} role="listitem">
                    <h4>{candidate.displayName}</h4>
                    <p className="compat-ranking-index">
                      <span>この組み合わせの学び合い指標</span>
                      <strong>{candidate.combinationLearningIndex}点</strong>
                    </p>
                    <p className="compat-ranking-breakdown">
                      120マスのうち{candidate.distinctCells}マスが、どちらか片方だけ発動
                      <br />
                      平均点の差 {(candidate.levelGapTenths / 10).toFixed(1)}点
                    </p>
                    {shortageCandidate?.matchedAxes?.length > 0 && (
                      <div className="compat-recommend-axis-chips" aria-label={`${candidate.displayName}の該当軸`}>
                        {shortageCandidate.matchedAxes.map((axis) => (
                          <span key={axis.axisKey}>
                            {axis.axisLabel}・{axis.noData ? noDataLabel : belowThresholdLabel}
                          </span>
                        ))}
                      </div>
                    )}
                    {mode === 'solo' && (
                      <button
                        type="button"
                        className="compat-button secondary compat-ranking-pair-button"
                        disabled={unavailable}
                        title={buttonTitle}
                        onClick={() => selectRankingCandidateForPair(candidate)}
                      >
                        この人とペア分析する
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {result && mode !== 'solo' && (
        <section className="compat-share-controls" aria-label="分析結果の共有">
          <p className="compat-kicker">結果を共有する</p>
          <h2>対象者へ結果を共有</h2>
          <p>URLを知る人が閲覧できます。有効期間は発行から30日で、いつでも失効できます。</p>
          <label className="compat-consent">
            <input type="checkbox" checked={shareConsent} onChange={(event) => setShareConsent(event.target.checked)} disabled={!!share} />
            <span>
              本結果の共有について、対象者全員の同意を確認しました
              {hasMatchedTerms && '（表記が完全に一致した言葉が対象者間に表示されます。本人が入力した言葉はAIには送られません。診断で見つかった軸の名前は、氏名を除いたプロフィールの一部としてAIに渡ります）'}
              。16×16の地図（各組み合わせの発動ゾーン・強弱と担い手の名前）も共有されます。点数そのものは含まれません
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
