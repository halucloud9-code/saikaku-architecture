import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import CompatReport from './CompatReport';

function usePrivateDocumentMetadata() {
  useEffect(() => {
    const previousTitle = document.title;
    const existingRobots = document.querySelector('meta[name="robots"]');
    const robots = existingRobots || document.createElement('meta');
    const previousRobots = existingRobots?.getAttribute('content');
    const existingReferrer = document.querySelector('meta[name="referrer"]');
    const referrer = existingReferrer || document.createElement('meta');
    const previousReferrer = existingReferrer?.getAttribute('content');
    if (!existingRobots) {
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }
    if (!existingReferrer) {
      referrer.setAttribute('name', 'referrer');
      document.head.appendChild(referrer);
    }
    robots.setAttribute('content', 'noindex, nofollow, noarchive');
    referrer.setAttribute('content', 'no-referrer');
    document.title = '共有された相性診断';

    return () => {
      document.title = previousTitle;
      if (!existingRobots) robots.remove();
      else if (previousRobots === null) robots.removeAttribute('content');
      else robots.setAttribute('content', previousRobots);
      if (!existingReferrer) referrer.remove();
      else if (previousReferrer === null) referrer.removeAttribute('content');
      else referrer.setAttribute('content', previousReferrer);
    };
  }, []);
}

export default function CompatShareScreen() {
  const { shareId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const hasMatchedTerms = data?.report?.visual?.schemaVersion === 2
    && Array.isArray(data.report.visual.matches)
    && data.report.visual.matches.length > 0;
  usePrivateDocumentMetadata();

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/compat-share?id=${encodeURIComponent(shareId || '')}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || '共有結果を取得できませんでした');
        return body;
      })
      .then((body) => setData(body))
      .catch((cause) => {
        if (cause.name !== 'AbortError') setError('この共有結果は見つからないか、有効期限切れ、または失効済みです。');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [shareId]);

  return (
    <main className="compat-page compat-share-page">
      <header className="compat-header">
        <div>
          <p className="compat-kicker">SHARED / COMPATIBILITY</p>
          <h1>相性診断</h1>
          <p>この結果は発行者により共有されたものです（期限付き）。</p>
        </div>
      </header>

      {loading && <p className="compat-share-state">共有結果を読み込んでいます…</p>}
      {error && <p className="compat-error compat-share-state" role="alert">{error}</p>}
      {data && (
        <>
          <section className="compat-share-guidance" aria-label="共有時の注意">
            <p>このURLは対象者本人への限定共有です。本人全員の同意なく再共有しないでください。</p>
            {hasMatchedTerms && (
              <p>完全一致語は、対象者全員の共有同意に基づいて表示されています。本人が入力したTop5の語はLLMに送信されない。生成軸名は別名化プロフィールの一部としてLLMに渡る。</p>
            )}
            <p>内容の訂正または共有停止を希望する場合は、URLを送った発行者へ連絡してください。</p>
          </section>
          <CompatReport result={data.report} memberLabels={data.memberLabels} />
        </>
      )}
    </main>
  );
}
