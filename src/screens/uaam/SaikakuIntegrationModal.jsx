import { useCallback, useEffect, useMemo, useState } from 'react';
import SaikakuIntegration, { formatIntegrationDate } from './SaikakuIntegration';
import { loadCoachingAnswers, saveCoachingAnswers } from '../../api/coachingAnswers';

const LEGACY_MESSAGE = 'この統合分析は移行前のデータです。最新の組み合わせで再生成してください';

function isLegacyFallback(summary) {
  return summary?.saikakuAttemptId === 'legacy-fallback'
    || summary?.uaamAttemptId === 'legacy-fallback';
}

function sourceFromSummary(summary, fallbackSource) {
  const source = summary?.source ?? {};
  return {
    saikakuLabel:
      fallbackSource?.saikakuLabel
      ?? source.saikakuLabel
      ?? summary?.saikakuLabel
      ?? summary?.saikakuAttemptLabel
      ?? summary?.saikakuAttemptId
      ?? '',
    uaamLabel:
      fallbackSource?.uaamLabel
      ?? source.uaamLabel
      ?? summary?.uaamLabel
      ?? summary?.uaamAttemptLabel
      ?? summary?.uaamAttemptId
      ?? '',
    saikakuDate:
      fallbackSource?.saikakuDate
      ?? source.saikakuDate
      ?? source.saikakuCreatedAt
      ?? summary?.saikakuDate
      ?? summary?.saikakuCreatedAt
      ?? null,
    uaamDate:
      fallbackSource?.uaamDate
      ?? source.uaamDate
      ?? source.uaamCreatedAt
      ?? summary?.uaamDate
      ?? summary?.uaamCreatedAt
      ?? null,
  };
}

function integrationBodyFromSummary(summary) {
  const body =
    summary?.integration
    ?? summary?.integrationBody
    ?? summary?.body
    ?? summary?.analysis?.saikaku_integration
    ?? null;

  if (body) return body;

  if (summary?.integrationScore !== undefined || summary?.activationCore) {
    return {
      integration_score: summary.integrationScore ?? 0,
      activation_core: summary.activationCore ?? '統合分析',
    };
  }

  return null;
}

function summaryList(integrationSummary, integrationSummaries) {
  if (Array.isArray(integrationSummaries)) return integrationSummaries.filter(Boolean);
  if (Array.isArray(integrationSummary)) return integrationSummary.filter(Boolean);
  if (Array.isArray(integrationSummary?.integrationSummaries)) {
    return integrationSummary.integrationSummaries.filter(Boolean);
  }
  if (Array.isArray(integrationSummary?.summaries)) {
    return integrationSummary.summaries.filter(Boolean);
  }
  return integrationSummary ? [integrationSummary] : [];
}

function optionLabel(summary, index) {
  const source = sourceFromSummary(summary);
  const uaam = source.uaamLabel || summary?.activationCore || `統合分析 ${index + 1}`;
  const date = source.uaamDate ? `（${formatIntegrationDate(source.uaamDate)}）` : '';
  return `${uaam}${date}`;
}

export default function SaikakuIntegrationModal({
  open,
  onClose,
  integrationSummary,
  integrationSummaries,
  kind,
  source,
}) {
  const summaries = useMemo(
    () => summaryList(integrationSummary, integrationSummaries),
    [integrationSummary, integrationSummaries],
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [answersMap, setAnswersMap] = useState({});
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [hasUnsavedAnswers, setHasUnsavedAnswers] = useState(false);

  useEffect(() => {
    if (open) setSelectedIndex(0);
  }, [open, integrationSummary, integrationSummaries]);

  useEffect(() => {
    if (open) setHasUnsavedAnswers(false);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    loadCoachingAnswers()
      .then((map) => {
        if (!cancelled) setAnswersMap(map || {});
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open]);

  const requestClose = useCallback(() => {
    if (hasUnsavedAnswers && !window.confirm('保存していない回答があります。閉じますか？')) {
      return;
    }
    onClose?.();
  }, [hasUnsavedAnswers, onClose]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') requestClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, requestClose]);

  if (!open) return null;

  const handleCoachingSave = async (items) => {
    setSaving(true);
    try {
      const updated = await saveCoachingAnswers(items);
      setAnswersMap(updated);
      setLastSavedAt(new Date());
    } catch (e) {
      console.warn('[coaching] save failed:', e);
      throw e;
    } finally {
      setSaving(false);
    }
  };

  const selectedSummary = summaries[selectedIndex] ?? summaries[0] ?? integrationSummary ?? null;
  const selectedSource = sourceFromSummary(selectedSummary, source);
  const integration = integrationBodyFromSummary(selectedSummary);
  const legacy = isLegacyFallback(selectedSummary);
  const stale = selectedSummary?.status === 'stale';

  return (
    <div
      data-testid="saikaku-integration-modal-backdrop"
      onClick={requestClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(13,11,9,0.72)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
        padding: 18,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="才覚発動統合分析"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(720px, 100%)',
          maxHeight: '88vh',
          overflowY: 'auto',
          background: '#F5F0E8',
          border: '1px solid rgba(232,224,212,0.45)',
          borderRadius: 16,
          boxShadow: '0 28px 90px rgba(0,0,0,0.42)',
        }}
      >
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          background: 'linear-gradient(135deg, #0D2137 0%, #1A3A52 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}>
          <div>
            <div style={{
              fontSize: 9,
              color: '#B8960C',
              fontWeight: 800,
              letterSpacing: '0.18em',
              fontFamily: "'Outfit', sans-serif",
              marginBottom: 4,
            }}>
              SAIKAKU × UAAM INTEGRATION
            </div>
            <div style={{
              color: '#FFFFFF',
              fontSize: 17,
              fontWeight: 800,
              fontFamily: "'Noto Serif JP', serif",
              letterSpacing: '0.04em',
            }}>
              才覚発動統合分析
            </div>
            {(stale || legacy) && (
              <div style={{
                display: 'inline-flex',
                marginTop: 10,
                border: '1px solid rgba(245,211,106,0.44)',
                background: 'rgba(184,150,12,0.16)',
                color: '#F5D36A',
                borderRadius: 999,
                padding: '4px 10px',
                fontSize: 10,
                fontWeight: 800,
              }}>
                要再生成
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label="閉じる"
            onClick={requestClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.16)',
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.78)',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: 16 }}>
          {legacy && (
            <div style={{
              background: '#FFF8E6',
              border: '1px solid rgba(184,150,12,0.28)',
              color: '#6D5600',
              borderRadius: 10,
              padding: '12px 14px',
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1.8,
              marginBottom: 12,
              fontFamily: "'Noto Serif JP', serif",
            }}>
              {LEGACY_MESSAGE}
            </div>
          )}

          {kind === 'saikaku' && summaries.length > 1 && (
            <label
              htmlFor="saikaku-integration-select"
              style={{
                display: 'block',
                color: '#5C5142',
                fontSize: 12,
                fontWeight: 800,
                lineHeight: 1.6,
                marginBottom: 12,
              }}
            >
              他のUAAM結果と統合された分析を見る
              <select
                id="saikaku-integration-select"
                value={selectedIndex}
                onChange={(event) => setSelectedIndex(Number(event.target.value))}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: 6,
                  border: '1px solid #D4C9B0',
                  borderRadius: 8,
                  background: '#FFFDF7',
                  color: '#1A1A1A',
                  padding: '10px 12px',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {summaries.map((summary, index) => (
                  <option key={`${summary?.saikakuAttemptId ?? 'saikaku'}-${summary?.uaamAttemptId ?? index}`} value={index}>
                    {optionLabel(summary, index)}
                  </option>
                ))}
              </select>
            </label>
          )}

          {integration ? (
            <div style={{
              borderRadius: 14,
              overflow: 'hidden',
              boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
              border: '1px solid #E8E0D4',
            }}>
              <SaikakuIntegration
                integration={integration}
                source={selectedSource}
                status={selectedSummary?.status}
                answersMap={answersMap}
                onSave={handleCoachingSave}
                saving={saving}
                lastSavedAt={lastSavedAt}
                onDirtyChange={setHasUnsavedAnswers}
                defaultOpen
                readOnly
              />
            </div>
          ) : (
            <div style={{
              background: '#FFFDF7',
              border: '1px solid #E8E0D4',
              borderRadius: 12,
              padding: 18,
              color: '#5C5142',
              fontSize: 13,
              lineHeight: 1.8,
            }}>
              統合分析の本文を表示できませんでした。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
