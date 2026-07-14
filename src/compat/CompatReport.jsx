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

export default function CompatReport({ result, memberLabels = [] }) {
  if (!result) return null;
  return (
    <section className="compat-report" aria-label="相性分析結果">
      <div className="compat-section sufficiency">
        <p className="compat-kicker">§0 データ充足度</p>
        <h2>最初に、読める範囲</h2>
        <p>{result.dataSufficiency.summary}</p>
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
