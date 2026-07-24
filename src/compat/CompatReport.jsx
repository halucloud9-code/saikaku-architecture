import CompatMandala from './CompatMandala';
import CompatMatrix from './CompatMatrix';
import { replaceMemberAliases } from './memberNames';
import './compat.css';

const STATUS_LABELS = {
  detected: '見つかりました',
  not_detected: '今回のデータでは見つかりませんでした（「ない」と決まったわけではありません）',
  insufficient: 'データが不足しているため、現時点では判断できません',
};

const CATEGORY_LABELS = { talent: '才能', value: '価値観', passion: '情熱' };

export function Availability({ availability }) {
  if (!availability) return null;
  return (
    <div className="compat-badges" aria-label="利用可能な診断データ">
      {Object.entries(availability.categories || {}).map(([category, state]) => (
        <span className="compat-badge" key={category}>
          {CATEGORY_LABELS[category]}: {state.userTop5 ? '本人が選んだ言葉＋' : ''}{state.generatedAxes ? '診断で見つかった軸' : 'データなし'}
        </span>
      ))}
      <span className={`compat-badge ${availability.uaam ? '' : 'muted'}`}>詳細診断（UAAM）: {availability.uaam ? 'あり' : 'データなし'}</span>
    </div>
  );
}

function Claim({ claim, displayText }) {
  return (
    <article className="compat-claim">
      <p className={`compat-claim-kind ${claim.kind}`}>
        {claim.kind === 'hypothesis' ? '💡 仮説（本人との確認が必要です）' : '📄 データで確認できた事実'}
      </p>
      <p>{displayText(claim.text)}</p>
      <p className="compat-question">🗣 本人に確認する問い：{displayText(claim.verificationQuestion)}</p>
    </article>
  );
}

function EvidenceFold({ result, memberLabels }) {
  const members = result.dataSufficiency.memberAvailability || [];
  const displayText = (value) => replaceMemberAliases(value, members, memberLabels);
  const claimRefs = [
    ...result.lenses.flatMap((lens) => lens.claims.map((claim, index) => ({
      label: `${lens.id === 'similarity' ? '似ているところ' : '違いで補い合えるところ'}の内容${index + 1}`,
      text: claim.text,
      ids: claim.evidenceIds,
    }))),
    ...(result.unmetFunctionCandidate ? [{
      label: '目的の達成に、まだ足りない可能性がある働き',
      text: result.unmetFunctionCandidate.text,
      ids: result.unmetFunctionCandidate.evidenceIds,
    }] : []),
  ];
  return (
    <details className="compat-evidence-fold">
      <summary>根拠となったデータを詳しく見る</summary>
      <div className="compat-evidence-content">
        <section>
          <h3>メンバーごとに利用できるデータ</h3>
          <div className="compat-availability-list">
            {members.map((member) => {
              const memberIndex = members.findIndex((candidate) => candidate.alias === member.alias);
              const savedLabel = memberIndex >= 0 && typeof memberLabels[memberIndex] === 'string'
                ? memberLabels[memberIndex].trim()
                : '';
              const displayName = savedLabel || member.alias;
              return (
                <div key={member.alias} className="compat-availability-row">
                  <strong>
                    {displayName}
                    {displayName !== member.alias ? <span className="compat-member-label">{member.alias}</span> : null}
                  </strong>
                  <Availability availability={member} />
                </div>
              );
            })}
          </div>
        </section>
        {claimRefs.length > 0 && (
          <section>
            <h3>各内容と根拠データの対応</h3>
            <ul className="compat-claim-evidence-list">
              {claimRefs.map((item) => (
                <li key={item.label}>
                  <strong>{item.label}</strong>：{displayText(item.text)} — {item.ids.join(', ')}
                </li>
              ))}
            </ul>
          </section>
        )}
        {result.evidence?.length > 0 && (
          <section>
            <h3>根拠データの一覧</h3>
            <ul className="compat-ledger-list">
              {result.evidence.map((item) => <li key={item.id}><code>{item.id}</code> {displayText(item.text)}</li>)}
            </ul>
          </section>
        )}
        {result.model && <p className="compat-model-meta">生成モデル: {result.model}</p>}
      </div>
    </details>
  );
}

export default function CompatReport({
  result,
  memberLabels = [],
  uaamMatrix = null,
  sharedMatrix = null,
}) {
  if (!result) return null;
  const members = result.dataSufficiency.memberAvailability || [];
  const displayText = (value) => replaceMemberAliases(value, members, memberLabels);
  return (
    <section className="compat-report" aria-label="相性分析結果">
      <div className="compat-sufficiency-summary">
        <strong>🔎 はじめに：今回確認できること</strong>
        <span>{displayText(result.dataSufficiency.summary)}</span>
        {result.dataSufficiency.limitations?.length > 0 && (
          <ul>{result.dataSufficiency.limitations.map((item) => <li key={item}>{displayText(item)}</li>)}</ul>
        )}
      </div>

      <CompatMandala visual={result.visual} memberLabels={memberLabels} />
      {uaamMatrix || sharedMatrix ? (
        <CompatMatrix
          mode={sharedMatrix ? 'share' : 'admin'}
          uaamMatrix={uaamMatrix}
          sharedMatrix={sharedMatrix}
          members={result.dataSufficiency.memberAvailability || []}
          memberLabels={memberLabels}
        />
      ) : null}

      <div className="compat-claims-grid">
        {result.lenses.map((lens) => (
          <section className="compat-section" key={lens.id}>
            <p className="compat-kicker">{lens.id === 'similarity' ? '🤝 似ているところ' : '🧩 違いで補い合えるところ'}</p>
            <h2>{STATUS_LABELS[lens.status] || lens.status}</h2>
            <p>{displayText(lens.summary)}</p>
            {lens.claims.map((claim, index) => (
              <Claim claim={claim} displayText={displayText} key={`${lens.id}-${index}`} />
            ))}
          </section>
        ))}
      </div>

      {result.unmetFunctionCandidate && (
        <section className="compat-section compat-unmet-function">
          <p className="compat-kicker">💭 目的から考えられる仮説</p>
          <h2>チームの目的の達成に、まだ足りない可能性がある働き</h2>
          <p>チームの目的から考えられる仮説です。人員の不足や、メンバーの入れ替えを示すものではありません。</p>
          <Claim claim={result.unmetFunctionCandidate} displayText={displayText} />
        </section>
      )}

      <EvidenceFold result={result} memberLabels={memberLabels} />
      <footer className="compat-ethics">{result.ethicsNotice}</footer>
    </section>
  );
}
