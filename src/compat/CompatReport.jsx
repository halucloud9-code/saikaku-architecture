import CompatMandala from './CompatMandala';
import './compat.css';

const STATUS_LABELS = {
  detected: '検出',
  not_detected: 'この診断データでは不検出',
  insufficient: 'データ不足',
};

const CATEGORY_LABELS = { talent: '才能', value: '価値観', passion: '情熱' };

export function Availability({ availability }) {
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

function Claim({ claim }) {
  return (
    <article className="compat-claim">
      <p className={`compat-claim-kind ${claim.kind}`}>
        {claim.kind === 'hypothesis' ? '[仮説]' : '[観察]'}
      </p>
      <p>{claim.text}</p>
      <p className="compat-question">確認したい問い：{claim.verificationQuestion}</p>
    </article>
  );
}

function EvidenceFold({ result, memberLabels }) {
  const claimRefs = [
    ...result.lenses.flatMap((lens) => lens.claims.map((claim, index) => ({
      label: `${lens.id === 'similarity' ? '同質' : '補完'}の主張${index + 1}`,
      ids: claim.evidenceIds,
    }))),
    ...(result.unmetFunctionCandidate ? [{ label: '未充足機能候補', ids: result.unmetFunctionCandidate.evidenceIds }] : []),
  ];
  return (
    <details className="compat-evidence-fold">
      <summary>根拠とデータ範囲</summary>
      <div className="compat-evidence-content">
        <section>
          <h3>対象者別の利用データ</h3>
          <div className="compat-availability-list">
            {result.dataSufficiency.memberAvailability?.map((member, index) => (
              <div key={member.alias} className="compat-availability-row">
                <strong>
                  {member.alias}
                  {memberLabels[index] ? <span className="compat-member-label">{memberLabels[index]}</span> : null}
                </strong>
                <Availability availability={member} />
              </div>
            ))}
          </div>
        </section>
        {claimRefs.length > 0 && (
          <section>
            <h3>主張と証拠ID</h3>
            <ul className="compat-claim-evidence-list">
              {claimRefs.map((item) => <li key={item.label}><strong>{item.label}</strong>: {item.ids.join(', ')}</li>)}
            </ul>
          </section>
        )}
        {result.evidence?.length > 0 && (
          <section>
            <h3>決定論的な証拠台帳</h3>
            <ul className="compat-ledger-list">
              {result.evidence.map((item) => <li key={item.id}><code>{item.id}</code> {item.text}</li>)}
            </ul>
          </section>
        )}
        {result.model && <p className="compat-model-meta">生成モデル: {result.model}</p>}
      </div>
    </details>
  );
}

export default function CompatReport({ result, memberLabels = [] }) {
  if (!result) return null;
  return (
    <section className="compat-report" aria-label="相性分析結果">
      <div className="compat-sufficiency-summary">
        <strong>§0 データの範囲を先に</strong>
        <span>{result.dataSufficiency.summary}</span>
        {result.dataSufficiency.limitations?.length > 0 && (
          <ul>{result.dataSufficiency.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
        )}
      </div>

      <CompatMandala visual={result.visual} memberLabels={memberLabels} />

      <div className="compat-claims-grid">
        {result.lenses.map((lens) => (
          <section className="compat-section" key={lens.id}>
            <p className="compat-kicker">{lens.id === 'similarity' ? '同質レンズ' : '補完レンズ'}</p>
            <h2>{STATUS_LABELS[lens.status] || lens.status}</h2>
            <p>{lens.summary}</p>
            {lens.claims.map((claim, index) => <Claim claim={claim} key={`${lens.id}-${index}`} />)}
          </section>
        ))}
      </div>

      {result.unmetFunctionCandidate && (
        <section className="compat-section compat-unmet-function">
          <p className="compat-kicker">GOAL-CONDITIONAL HYPOTHESIS</p>
          <h2>未充足機能候補</h2>
          <p>チームの目的に対する仮説です。人物の不足や採用判断を示すものではありません。</p>
          <Claim claim={result.unmetFunctionCandidate} />
        </section>
      )}

      <EvidenceFold result={result} memberLabels={memberLabels} />
      <footer className="compat-ethics">{result.ethicsNotice}</footer>
    </section>
  );
}
