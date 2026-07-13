import { validateCompatOutput } from './validateCompatOutput.js';

export const COMPAT_SHARE_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
export const COMPAT_ETHICS_NOTICE = '本結果は相互理解のための対話素材です。人事評価・採用評価には流用しません。';

const SHARE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu;
const REPORT_KEYS = ['dataSufficiency', 'lenses', 'evidence', 'ethicsNotice', 'model'];
const SUFFICIENCY_KEYS = ['summary', 'memberAvailability', 'limitations', 'uaam'];
const CATEGORY_KEYS = ['talent', 'value', 'passion'];
const EVIDENCE_LENSES = ['both', 'similarity', 'complementarity'];
const EVIDENCE_KINDS = ['generated_axis', 'exact_nfkc_match', 'uaam_percentile_similarity', 'uaam_percentile_complement'];

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, expected) {
  return isPlainObject(value)
    && Object.keys(value).sort().join('|') === [...expected].sort().join('|');
}

function boundedString(value, min, max) {
  return typeof value === 'string' && value.length >= min && value.length <= max;
}

function validateAvailability(member, errors, index) {
  const path = `report.dataSufficiency.memberAvailability[${index}]`;
  if (!hasExactKeys(member, ['alias', 'source', 'categories', 'uaam'])) {
    errors.push(`${path}: フィールドが契約と一致しません`);
    return;
  }
  if (!/^(?:A|B|M(?:[1-9]|10))$/u.test(member.alias)) errors.push(`${path}.alias: 不正です`);
  if (!['internal', 'public'].includes(member.source)) errors.push(`${path}.source: 不正です`);
  if (!hasExactKeys(member.categories, CATEGORY_KEYS)) {
    errors.push(`${path}.categories: 才能・価値観・情熱が必要です`);
  } else {
    for (const category of CATEGORY_KEYS) {
      const state = member.categories[category];
      if (!hasExactKeys(state, ['userTop5', 'generatedAxes'])
        || typeof state.userTop5 !== 'boolean'
        || typeof state.generatedAxes !== 'boolean') {
        errors.push(`${path}.categories.${category}: 可用性が不正です`);
      }
    }
  }
  if (typeof member.uaam !== 'boolean') errors.push(`${path}.uaam: booleanが必要です`);
}

function validateUaam(value, errors) {
  const baseKeys = ['eligible', 'availableProfiles', 'requiredProfiles', 'minimumCohort'];
  const expectedKeys = value?.eligible === false ? [...baseKeys, 'reason'] : baseKeys;
  if (!hasExactKeys(value, expectedKeys)) {
    errors.push('report.dataSufficiency.uaam: フィールドが契約と一致しません');
    return;
  }
  if (typeof value.eligible !== 'boolean') errors.push('report.dataSufficiency.uaam.eligible: booleanが必要です');
  for (const key of ['availableProfiles', 'requiredProfiles', 'minimumCohort']) {
    if (!Number.isInteger(value[key]) || value[key] < 0 || value[key] > 1_000) {
      errors.push(`report.dataSufficiency.uaam.${key}: 整数が必要です`);
    }
  }
  if (value.eligible === false && !boundedString(value.reason, 1, 500)) {
    errors.push('report.dataSufficiency.uaam.reason: 1〜500文字が必要です');
  }
}

function validateEvidence(value, errors) {
  if (!Array.isArray(value) || value.length > 600) {
    errors.push('report.evidence: 最大600件の配列が必要です');
    return [];
  }
  const seen = new Set();
  const safeEvidence = [];
  value.forEach((item, index) => {
    const path = `report.evidence[${index}]`;
    if (!hasExactKeys(item, ['id', 'lens', 'kind', 'text'])) {
      errors.push(`${path}: フィールドが契約と一致しません`);
      return;
    }
    if (!/^E-\d{3}$/u.test(item.id) || seen.has(item.id)) errors.push(`${path}.id: 不正または重複しています`);
    seen.add(item.id);
    if (!EVIDENCE_LENSES.includes(item.lens)) errors.push(`${path}.lens: 不正です`);
    if (!EVIDENCE_KINDS.includes(item.kind)) errors.push(`${path}.kind: 不正です`);
    if (!boundedString(item.text, 1, 1_000)) errors.push(`${path}.text: 1〜1000文字が必要です`);
    safeEvidence.push(item);
  });
  return safeEvidence;
}

export function isCompatShareId(value) {
  return typeof value === 'string' && SHARE_ID_RE.test(value);
}

export function validateCompatShareReport(report) {
  const errors = [];
  if (!hasExactKeys(report, REPORT_KEYS)) {
    return { ok: false, errors: ['report: 分析レスポンスのフィールドと一致しません'] };
  }

  const sufficiency = report.dataSufficiency;
  if (!hasExactKeys(sufficiency, SUFFICIENCY_KEYS)) {
    errors.push('report.dataSufficiency: フィールドが契約と一致しません');
  } else {
    if (!boundedString(sufficiency.summary, 0, 500)) errors.push('report.dataSufficiency.summary: 500文字以内が必要です');
    if (!Array.isArray(sufficiency.limitations)
      || sufficiency.limitations.length > 12
      || !sufficiency.limitations.every((item) => boundedString(item, 0, 500))) {
      errors.push('report.dataSufficiency.limitations: 最大12件・各500文字以内が必要です');
    }
    if (!Array.isArray(sufficiency.memberAvailability)
      || sufficiency.memberAvailability.length < 2
      || sufficiency.memberAvailability.length > 10) {
      errors.push('report.dataSufficiency.memberAvailability: 2〜10名が必要です');
    } else {
      sufficiency.memberAvailability.forEach((member, index) => validateAvailability(member, errors, index));
      const aliases = sufficiency.memberAvailability.map((member) => member?.alias);
      if (new Set(aliases).size !== aliases.length) errors.push('report.dataSufficiency.memberAvailability: aliasが重複しています');
    }
    validateUaam(sufficiency.uaam, errors);
  }

  const evidence = validateEvidence(report.evidence, errors);
  if (report.ethicsNotice !== COMPAT_ETHICS_NOTICE) errors.push('report.ethicsNotice: 倫理注記が契約と一致しません');
  if (!boundedString(report.model, 1, 100)) errors.push('report.model: 1〜100文字が必要です');

  if (hasExactKeys(sufficiency, SUFFICIENCY_KEYS)) {
    const outputValidation = validateCompatOutput({
      dataSufficiency: {
        summary: sufficiency.summary,
        limitations: sufficiency.limitations,
      },
      lenses: report.lenses,
    }, evidence);
    errors.push(...outputValidation.errors.map((error) => `report.${error}`));
  }

  return errors.length === 0
    ? { ok: true, value: report, errors: [] }
    : { ok: false, errors };
}

export function validateCompatShareIssueInput(body) {
  if (!hasExactKeys(body, ['report', 'mode', 'goal', 'memberLabels', 'consentConfirmed'])) {
    return { ok: false, status: 400, code: 'INVALID_REQUEST', error: '共有発行の入力形式が不正です' };
  }
  if (body.consentConfirmed !== true) {
    return { ok: false, status: 400, code: 'CONSENT_REQUIRED', error: '対象者全員の共有同意確認が必要です' };
  }
  if (!['pair', 'team'].includes(body.mode)) {
    return { ok: false, status: 400, code: 'INVALID_REQUEST', error: '分析モードが不正です' };
  }
  if (typeof body.goal !== 'string' || body.goal.length > 500) {
    return { ok: false, status: 400, code: 'INVALID_REQUEST', error: '目的は500文字以内で入力してください' };
  }
  const goal = body.goal.normalize('NFKC').trim();
  if ((body.mode === 'team' && !goal) || (body.mode === 'pair' && goal)) {
    return { ok: false, status: 400, code: 'INVALID_REQUEST', error: '分析モードと目的が一致しません' };
  }
  const minMembers = body.mode === 'pair' ? 2 : 3;
  const maxMembers = body.mode === 'pair' ? 2 : 10;
  if (!Array.isArray(body.memberLabels)
    || body.memberLabels.length < minMembers
    || body.memberLabels.length > maxMembers) {
    return { ok: false, status: 400, code: 'INVALID_REQUEST', error: '対象者ラベルの件数が不正です' };
  }
  const memberLabels = body.memberLabels.map((label) => (
    typeof label === 'string' ? label.normalize('NFKC').trim() : ''
  ));
  if (memberLabels.some((label) => !boundedString(label, 1, 80) || EMAIL_RE.test(label))) {
    return { ok: false, status: 400, code: 'INVALID_REQUEST', error: '対象者ラベルは氏名など80文字以内で入力してください（メールアドレス不可）' };
  }

  const reportValidation = validateCompatShareReport(body.report);
  if (!reportValidation.ok) {
    return { ok: false, status: 422, code: 'REPORT_INVALID', error: '共有する分析結果の安全性を確認できませんでした', details: reportValidation.errors };
  }
  if (body.report.dataSufficiency.memberAvailability.length !== memberLabels.length) {
    return { ok: false, status: 400, code: 'INVALID_REQUEST', error: '分析結果と対象者ラベルの人数が一致しません' };
  }
  const expectedAliases = memberLabels.map((_label, index) => (
    body.mode === 'pair' ? (index === 0 ? 'A' : 'B') : `M${index + 1}`
  ));
  const reportAliases = body.report.dataSufficiency.memberAvailability.map((member) => member.alias);
  if (expectedAliases.some((alias, index) => reportAliases[index] !== alias)) {
    return { ok: false, status: 400, code: 'INVALID_REQUEST', error: '分析モードと対象者aliasが一致しません' };
  }

  return {
    ok: true,
    value: {
      report: reportValidation.value,
      memberLabels,
      mode: body.mode,
      goalProvided: body.mode === 'team',
      consentConfirmed: true,
    },
  };
}

function timestampMillis(value) {
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value?._seconds === 'number') return value._seconds * 1_000;
  if (typeof value?.seconds === 'number') return value.seconds * 1_000;
  return Number.NaN;
}

export function isCompatShareActive(data, nowMs = Date.now()) {
  return isPlainObject(data)
    && data.revoked === false
    && data.consentConfirmed === true
    && Number.isFinite(timestampMillis(data.expiresAt))
    && timestampMillis(data.expiresAt) > nowMs;
}

export function setCompatShareNoStoreHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
}
