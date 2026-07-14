const ALLOWED_LENSES = ['similarity', 'complementarity'];
const ALLOWED_STATUSES = ['detected', 'not_detected', 'insufficient'];
const ALLOWED_KINDS = ['observation', 'hypothesis'];
const PERSONNEL_LANGUAGE = /(人事評価|採用評価|採用すべき|不採用|査定|処遇|昇進|降格|配属すべき|優秀な人材|劣った人材)/u;
const VACANCY_LANGUAGE = /欠員/u;
const SCALAR_COMPATIBILITY = /(相性|適合度|compatibility)\s*(?:(?:スコア|score|点数)\s*)?(?:[:：=]\s*)?\d+(?:\.\d+)?\s*(?:点|%|％)/iu;
const FORBIDDEN_KEYS = /^(?:compatibility_?score|score|rating|ranking|rank)$/iu;
const SAFE_PATH_KEYS = new Set([
  'dataSufficiency', 'lenses', 'summary', 'limitations', 'id', 'status', 'claims',
  'text', 'kind', 'evidenceIds', 'verificationQuestion', 'unmetFunctionCandidate',
]);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function walk(value, path, errors, rejectVacancy) {
  if (typeof value === 'string') {
    if (PERSONNEL_LANGUAGE.test(value)) errors.push(`${path}: 人事・採用・査定用途の表現は禁止です`);
    if (rejectVacancy && VACANCY_LANGUAGE.test(value)) errors.push(`${path}: 人物の不足を示す「欠員」表現は禁止です`);
    if (SCALAR_COMPATIBILITY.test(value)) errors.push(`${path}: 相性の単一スコアは禁止です`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${path}[${index}]`, errors, rejectVacancy));
    return;
  }
  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.test(key)) errors.push(`${path}.[forbidden-key]: スコア・ランク系フィールドは禁止です`);
      const childPath = SAFE_PATH_KEYS.has(key) ? `${path}.${key}` : `${path}.[field]`;
      walk(child, childPath, errors, rejectVacancy);
    }
  }
}

function exactKeys(value, expected) {
  return isPlainObject(value) && Object.keys(value).sort().join('|') === [...expected].sort().join('|');
}

function validateClaim(claim, path, evidenceIds, lens, errors) {
  if (!exactKeys(claim, ['text', 'kind', 'evidenceIds', 'verificationQuestion'])) {
    errors.push(`${path}: claimのフィールドが契約と一致しません`);
    return;
  }
  if (typeof claim.text !== 'string' || claim.text.trim().length < 1 || claim.text.length > 600) errors.push(`${path}.text: 1〜600文字が必要です`);
  if (!ALLOWED_KINDS.includes(claim.kind)) errors.push(`${path}.kind: observation または hypothesis が必要です`);
  if (!Array.isArray(claim.evidenceIds) || claim.evidenceIds.length < 1 || claim.evidenceIds.length > 8) {
    errors.push(`${path}.evidenceIds: 1〜8件が必要です`);
  } else {
    for (const id of claim.evidenceIds) {
      const evidence = evidenceIds.get(id);
      if (!evidence) errors.push(`${path}.evidenceIds: 未知の証拠IDは禁止です`);
      else if (lens && evidence.lens !== 'both' && evidence.lens !== lens) errors.push(`${path}.evidenceIds: 証拠IDが対象レンズと一致しません`);
    }
  }
  if (typeof claim.verificationQuestion !== 'string' || !claim.verificationQuestion.trim() || claim.verificationQuestion.length > 400) {
    errors.push(`${path}.verificationQuestion: 本人が検証できる質問が必要です`);
  }
}

export function validateCompatOutput(raw, evidenceLedger, options = {}) {
  const errors = [];
  // Omitted options retain the production v1 contract for stored-share compatibility.
  // The live generation path opts into v2 explicitly.
  const schemaVersion = options.schemaVersion ?? 1;
  const expectedRootKeys = schemaVersion === 1
    ? ['dataSufficiency', 'lenses']
    : ['dataSufficiency', 'lenses', 'unmetFunctionCandidate'];
  if (![1, 2].includes(schemaVersion) || !exactKeys(raw, expectedRootKeys)) {
    return { ok: false, errors: [schemaVersion === 1
      ? 'root: dataSufficiency と lenses だけが必要です'
      : 'root: dataSufficiency, lenses, unmetFunctionCandidate だけが必要です'] };
  }
  if (Object.keys(raw)[0] !== 'dataSufficiency') errors.push('root: dataSufficiency を最初に置いてください');
  if (!exactKeys(raw.dataSufficiency, ['summary', 'limitations'])) {
    errors.push('dataSufficiency: summary と limitations が必要です');
  } else {
    if (typeof raw.dataSufficiency.summary !== 'string' || raw.dataSufficiency.summary.length > 500) errors.push('dataSufficiency.summary: 文字列が必要です');
    if (!Array.isArray(raw.dataSufficiency.limitations) || raw.dataSufficiency.limitations.length > 12 || !raw.dataSufficiency.limitations.every((item) => typeof item === 'string' && item.length <= 500)) {
      errors.push('dataSufficiency.limitations: 文字列配列が必要です');
    }
  }

  const evidenceIds = new Map(evidenceLedger.map((item) => [item.id, item]));
  if (!Array.isArray(raw.lenses) || raw.lenses.length !== 2) {
    errors.push('lenses: 同質・補完の2レンズが必要です');
  } else {
    const seen = new Set();
    raw.lenses.forEach((lens, index) => {
      const path = `lenses[${index}]`;
      if (!exactKeys(lens, ['id', 'status', 'summary', 'claims'])) {
        errors.push(`${path}: id/status/summary/claims が必要です`);
        return;
      }
      if (!ALLOWED_LENSES.includes(lens.id) || seen.has(lens.id)) errors.push(`${path}.id: 同質・補完を一度ずつ指定してください`);
      seen.add(lens.id);
      if (!ALLOWED_STATUSES.includes(lens.status)) errors.push(`${path}.status: 不正です`);
      if (typeof lens.summary !== 'string' || !lens.summary.trim() || lens.summary.length > 600) errors.push(`${path}.summary: 1〜600文字が必要です`);
      if (!Array.isArray(lens.claims) || lens.claims.length > 8) errors.push(`${path}.claims: 最大8件の配列が必要です`);
      else lens.claims.forEach((claim, claimIndex) => validateClaim(claim, `${path}.claims[${claimIndex}]`, evidenceIds, lens.id, errors));
      if (lens.status === 'detected' && (!Array.isArray(lens.claims) || lens.claims.length === 0)) errors.push(`${path}: detected にはclaimが必要です`);
      if (['not_detected', 'insufficient'].includes(lens.status) && Array.isArray(lens.claims) && lens.claims.length > 0) errors.push(`${path}: 不検出・データ不足ではclaimを書かないでください`);
    });
    if (seen.size !== 2) errors.push('lenses: 同質・補完の両方が必要です');
  }

  if (schemaVersion === 2 && raw.unmetFunctionCandidate !== null) {
    if (!options.goalProvided) {
      errors.push('unmetFunctionCandidate: チーム目的がある場合だけ許可されます');
    }
    validateClaim(raw.unmetFunctionCandidate, 'unmetFunctionCandidate', evidenceIds, null, errors);
    if (raw.unmetFunctionCandidate?.kind !== 'hypothesis') {
      errors.push('unmetFunctionCandidate.kind: hypothesis だけが許可されます');
    }
  }

  walk(raw, 'root', errors, schemaVersion === 2);
  return errors.length === 0 ? { ok: true, value: raw, errors: [] } : { ok: false, errors };
}
