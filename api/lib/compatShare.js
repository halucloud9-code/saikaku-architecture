import { validateCompatForbiddenLanguage, validateCompatOutput } from './validateCompatOutput.js';
import { COMPAT_EVIDENCE_THRESHOLDS, COMPAT_VISUAL_UAAM_AXES } from './compatEvidence.js';
import { getZone, UAAM_ZONE_THRESHOLDS } from '../../src/lib/uaamZones.js';
import {
  compareCompatTeamAverageStrength,
  getCompatTeamAverageZone,
  isCompatCarrierZone,
} from '../../src/lib/compatTeamZones.js';

export const COMPAT_SHARE_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
export const COMPAT_ETHICS_NOTICE = '本結果は相互理解のための対話素材です。人事評価・採用評価には流用しません。';
export const COMPAT_VISUAL_TERM_MAX_LENGTH = 80;
export const COMPAT_VISUAL_AXIS_MAX_LENGTH = 160;

const SHARE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu;
const REPORT_KEYS_V1 = ['dataSufficiency', 'lenses', 'evidence', 'ethicsNotice', 'model'];
const REPORT_KEYS_V2 = [...REPORT_KEYS_V1, 'unmetFunctionCandidate', 'visual'];
const SUFFICIENCY_KEYS = ['summary', 'memberAvailability', 'limitations', 'uaam'];
const CATEGORY_KEYS = ['talent', 'value', 'passion'];
const EVIDENCE_LENSES = ['both', 'similarity', 'complementarity'];
const EVIDENCE_KINDS = ['generated_axis', 'exact_nfkc_match', 'uaam_percentile_similarity', 'uaam_percentile_complement'];
const VISUAL_SIGNALS = ['similarity', 'complementarity', 'neutral', 'insufficient'];
const SHARED_MATRIX_ZONES = ['natural', 'pro', 'active', 'potential', 'dormant', 'no-data'];
const SHARED_MATRIX_DATA_STATUSES = ['measured', 'no-data'];
const SHARED_MATRIX_ZONE_ORDER = ['dormant', 'potential', 'active', 'pro', 'natural'];
const SHARED_MATRIX_ZONE_RANK = Object.fromEntries(
  SHARED_MATRIX_ZONE_ORDER.map((zone, index) => [zone, index]),
);
const SHARED_MATRIX_MAX_BYTES = 64 * 1_024;

export const COMPAT_SHARED_MATRIX_AXES = COMPAT_VISUAL_UAAM_AXES.map(({ key }) => key);

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, expected) {
  return isPlainObject(value)
    && Object.keys(value).sort().join('|') === [...expected].sort().join('|');
}

function jsonByteLength(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function containsSharedMatrixForbiddenShape(value) {
  if (Array.isArray(value)) return value.some(containsSharedMatrixForbiddenShape);
  if (!isPlainObject(value)) {
    return typeof value === 'number'
      && Number.isFinite(value)
      && value >= 0
      && value <= UAAM_ZONE_THRESHOLDS.scoreMax;
  }
  return Object.entries(value).some(([key, child]) => (
    /(?:score|memberScores|uaamMatrix|carrierCount)/iu.test(key)
    || containsSharedMatrixForbiddenShape(child)
  ));
}

function canonicalSharedMatrixPairs() {
  const pairs = [];
  for (let rowIndex = 0; rowIndex < COMPAT_SHARED_MATRIX_AXES.length - 1; rowIndex += 1) {
    for (let colIndex = rowIndex + 1; colIndex < COMPAT_SHARED_MATRIX_AXES.length; colIndex += 1) {
      pairs.push([
        COMPAT_SHARED_MATRIX_AXES[rowIndex],
        COMPAT_SHARED_MATRIX_AXES[colIndex],
      ]);
    }
  }
  return pairs;
}

const COMPAT_SHARED_MATRIX_PAIRS = canonicalSharedMatrixPairs();

export function validateCompatShareUaamMatrix(value, memberAliases) {
  const errors = [];
  const aliasSet = new Set(Array.isArray(memberAliases) ? memberAliases : []);
  if (!hasExactKeys(value, ['memberScores'])) {
    return { ok: false, errors: ['uaamMatrix: memberScoresだけが必要です'] };
  }
  if (!isPlainObject(value.memberScores)
    || Object.keys(value.memberScores).length > aliasSet.size
    || Object.keys(value.memberScores).length > 10) {
    return { ok: false, errors: ['uaamMatrix.memberScores: 対象人数以内のオブジェクトが必要です'] };
  }

  for (const [alias, scores] of Object.entries(value.memberScores)) {
    const path = `uaamMatrix.memberScores.${alias}`;
    if (!aliasSet.has(alias)) {
      errors.push(`${path}: 対象者aliasと一致しません`);
      continue;
    }
    if (!isPlainObject(scores)
      || Object.keys(scores).length < 1
      || Object.keys(scores).length > COMPAT_SHARED_MATRIX_AXES.length) {
      errors.push(`${path}: 1〜16軸のオブジェクトが必要です`);
      continue;
    }
    for (const [axisKey, score] of Object.entries(scores)) {
      if (!COMPAT_SHARED_MATRIX_AXES.includes(axisKey)) {
        errors.push(`${path}.${axisKey}: 軸キーが不正です`);
      } else if (!Number.isInteger(score) || score < 0 || score > UAAM_ZONE_THRESHOLDS.scoreMax) {
        errors.push(`${path}.${axisKey}: 0〜20の整数が必要です`);
      }
    }
  }

  return errors.length === 0
    ? { ok: true, value, errors: [] }
    : { ok: false, errors };
}

export function buildCompatSharedMatrix(uaamMatrix, memberAliases) {
  const validation = validateCompatShareUaamMatrix(uaamMatrix, memberAliases);
  if (!validation.ok) {
    const error = new TypeError('uaamMatrix is invalid');
    error.details = validation.errors;
    throw error;
  }

  const aliases = (Array.isArray(memberAliases) ? memberAliases : []).filter((alias) => (
    Object.prototype.hasOwnProperty.call(validation.value.memberScores, alias)
  ));
  const memberScores = validation.value.memberScores;
  const axes = COMPAT_SHARED_MATRIX_AXES.map((key) => ({
    key,
    dataStatus: aliases.some((alias) => Number.isInteger(memberScores[alias]?.[key]))
      ? 'measured'
      : 'no-data',
  }));
  const rankedCells = COMPAT_SHARED_MATRIX_PAIRS.map(([rowKey, colKey], canonicalIndex) => {
    const details = aliases.map((alias) => {
      const rowScore = memberScores[alias]?.[rowKey];
      const colScore = memberScores[alias]?.[colKey];
      return {
        alias,
        rowScore,
        colScore,
        zone: Number.isInteger(rowScore) && Number.isInteger(colScore)
          ? getZone(rowScore, colScore)
          : null,
      };
    });
    const measuredRow = details.filter(({ rowScore }) => Number.isInteger(rowScore));
    const measuredCol = details.filter(({ colScore }) => Number.isInteger(colScore));
    if (measuredRow.length === 0 || measuredCol.length === 0) {
      return {
        cell: { rowKey, colKey, zone: 'no-data', carrierAliases: [] },
        teamAggregate: null,
        canonicalIndex,
      };
    }
    const teamAggregate = {
      sumA: measuredRow.reduce((sum, item) => sum + item.rowScore, 0),
      countA: measuredRow.length,
      sumB: measuredCol.reduce((sum, item) => sum + item.colScore, 0),
      countB: measuredCol.length,
    };
    const relevantDetails = details.filter(({ rowScore, colScore }) => (
      Number.isInteger(rowScore) || Number.isInteger(colScore)
    ));
    const allMembersNatural = relevantDetails.length > 0 && relevantDetails.every((item) => (
      item.rowScore === UAAM_ZONE_THRESHOLDS.scoreMax
      && item.colScore === UAAM_ZONE_THRESHOLDS.scoreMax
    ));
    const zone = getCompatTeamAverageZone({ ...teamAggregate, allMembersNatural });
    return {
      cell: {
        rowKey,
        colKey,
        zone,
        carrierAliases: details
          .filter((item) => isCompatCarrierZone(item.zone))
          .map((item) => item.alias),
      },
      teamAggregate,
      canonicalIndex,
    };
  });
  const cells = rankedCells.map(({ cell }) => cell);
  const topPairs = rankedCells
    .filter(({ cell }) => !['dormant', 'no-data'].includes(cell.zone))
    .sort((left, right) => (
      SHARED_MATRIX_ZONE_RANK[right.cell.zone] - SHARED_MATRIX_ZONE_RANK[left.cell.zone]
      || compareCompatTeamAverageStrength(right.teamAggregate, left.teamAggregate)
      || left.canonicalIndex - right.canonicalIndex
    ))
    .slice(0, 5)
    .map(({ cell }) => ({ rowKey: cell.rowKey, colKey: cell.colKey }));

  return { axes, cells, topPairs };
}

export function validateCompatSharedMatrix(value, memberAliases) {
  const errors = [];
  const aliases = Array.isArray(memberAliases) ? memberAliases : [];
  const aliasSet = new Set(aliases);
  if (!isPlainObject(value)) {
    return { ok: false, errors: ['sharedMatrix: オブジェクトが必要です'] };
  }
  if (jsonByteLength(value) > SHARED_MATRIX_MAX_BYTES) {
    return { ok: false, errors: ['sharedMatrix: サイズ上限を超えています'] };
  }
  if (containsSharedMatrixForbiddenShape(value)) {
    errors.push('sharedMatrix: 0〜20の生スコア形フィールドを含められません');
  }
  const hasTopPairs = Object.prototype.hasOwnProperty.call(value, 'topPairs');
  const expectedKeys = hasTopPairs ? ['axes', 'cells', 'topPairs'] : ['axes', 'cells'];
  if (!hasExactKeys(value, expectedKeys)) {
    errors.push('sharedMatrix: フィールドが契約と一致しません');
    return { ok: false, errors };
  }

  if (!Array.isArray(value.axes) || value.axes.length !== COMPAT_SHARED_MATRIX_AXES.length) {
    errors.push('sharedMatrix.axes: 全16軸が必要です');
  } else {
    value.axes.forEach((axis, index) => {
      const path = `sharedMatrix.axes[${index}]`;
      if (!hasExactKeys(axis, ['key', 'dataStatus'])) {
        errors.push(`${path}: フィールドが契約と一致しません`);
        return;
      }
      if (axis.key !== COMPAT_SHARED_MATRIX_AXES[index]) {
        errors.push(`${path}.key: 軸順が不正です`);
      }
      if (!SHARED_MATRIX_DATA_STATUSES.includes(axis.dataStatus)) {
        errors.push(`${path}.dataStatus: 不正です`);
      }
    });
  }

  if (!Array.isArray(value.cells) || value.cells.length !== COMPAT_SHARED_MATRIX_PAIRS.length) {
    errors.push('sharedMatrix.cells: 正規120ペアが必要です');
  } else {
    value.cells.forEach((cell, index) => {
      const path = `sharedMatrix.cells[${index}]`;
      const [expectedRowKey, expectedColKey] = COMPAT_SHARED_MATRIX_PAIRS[index];
      if (!hasExactKeys(cell, ['rowKey', 'colKey', 'zone', 'carrierAliases'])) {
        errors.push(`${path}: フィールドが契約と一致しません`);
        return;
      }
      if (cell.rowKey !== expectedRowKey || cell.colKey !== expectedColKey) {
        errors.push(`${path}: ペアまたは順序が不正です`);
      }
      if (!SHARED_MATRIX_ZONES.includes(cell.zone)) {
        errors.push(`${path}.zone: 不正です`);
      }
      if (!Array.isArray(cell.carrierAliases)
        || cell.carrierAliases.length > aliasSet.size
        || new Set(cell.carrierAliases).size !== cell.carrierAliases.length
        || cell.carrierAliases.some((alias) => !aliasSet.has(alias))) {
        errors.push(`${path}.carrierAliases: 対象者aliasの重複なし配列が必要です`);
      } else {
        const canonicalAliases = aliases.filter((alias) => cell.carrierAliases.includes(alias));
        if (canonicalAliases.some((alias, aliasIndex) => alias !== cell.carrierAliases[aliasIndex])) {
          errors.push(`${path}.carrierAliases: 対象者と同じ順序が必要です`);
        }
        if (cell.zone === 'no-data' && cell.carrierAliases.length !== 0) {
          errors.push(`${path}.carrierAliases: データなしセルに担い手は保存できません`);
        }
      }
    });
  }

  if (hasTopPairs) {
    if (!Array.isArray(value.topPairs) || value.topPairs.length > 5) {
      errors.push('sharedMatrix.topPairs: 最大5件の配列が必要です');
    } else {
      const canonicalPairSet = new Set(
        COMPAT_SHARED_MATRIX_PAIRS.map(([rowKey, colKey]) => `${rowKey}|${colKey}`),
      );
      const seenPairs = new Set();
      value.topPairs.forEach((pair, index) => {
        const path = `sharedMatrix.topPairs[${index}]`;
        if (!hasExactKeys(pair, ['rowKey', 'colKey'])) {
          errors.push(`${path}: フィールドが契約と一致しません`);
          return;
        }
        const pairKey = `${pair.rowKey}|${pair.colKey}`;
        if (!canonicalPairSet.has(pairKey)) {
          errors.push(`${path}: 正規ペアではありません`);
        } else if (seenPairs.has(pairKey)) {
          errors.push(`${path}: ペアが重複しています`);
        }
        seenPairs.add(pairKey);
      });
    }
  }

  return errors.length === 0
    ? { ok: true, value, errors: [] }
    : { ok: false, errors };
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

function validateVisualMembers(value, availability, errors) {
  if (!Array.isArray(value) || value.length < 2 || value.length > 10) {
    errors.push('report.visual.members: 2〜10名が必要です');
    return [];
  }
  const aliases = [];
  value.forEach((member, index) => {
    const path = `report.visual.members[${index}]`;
    if (!hasExactKeys(member, ['alias', 'axes'])) {
      errors.push(`${path}: フィールドが契約と一致しません`);
      return;
    }
    if (!/^(?:A|B|M(?:[1-9]|10))$/u.test(member.alias)) errors.push(`${path}.alias: 不正です`);
    aliases.push(member.alias);
    if (!hasExactKeys(member.axes, CATEGORY_KEYS)) {
      errors.push(`${path}.axes: 才能・価値観・情熱が必要です`);
      return;
    }
    for (const category of CATEGORY_KEYS) {
      const axes = member.axes[category];
      if (!Array.isArray(axes)
        || axes.length > 10
        || !axes.every((axis) => boundedString(axis, 1, COMPAT_VISUAL_AXIS_MAX_LENGTH))) {
        errors.push(`${path}.axes.${category}: 最大10件・各160文字以内が必要です`);
      }
    }
  });
  if (new Set(aliases).size !== aliases.length) errors.push('report.visual.members: aliasが重複しています');
  const availabilityAliases = Array.isArray(availability) ? availability.map((member) => member?.alias) : [];
  if (aliases.length !== availabilityAliases.length
    || aliases.some((alias, index) => alias !== availabilityAliases[index])) {
    errors.push('report.visual.members: データ充足度の対象者と一致しません');
  }
  return aliases;
}

function validateVisualMatches(value, aliases, errors) {
  if (!Array.isArray(value) || value.length > 600) {
    errors.push('report.visual.matches: 最大600件の配列が必要です');
    return;
  }
  value.forEach((match, index) => {
    const path = `report.visual.matches[${index}]`;
    if (!hasExactKeys(match, ['aliases', 'category', 'sourceKind', 'terms'])) {
      errors.push(`${path}: フィールドが契約と一致しません`);
      return;
    }
    if (!Array.isArray(match.aliases)
      || match.aliases.length !== 2
      || match.aliases[0] === match.aliases[1]
      || match.aliases.some((alias) => !aliases.includes(alias))) {
      errors.push(`${path}.aliases: 対象者2名が必要です`);
    }
    if (!CATEGORY_KEYS.includes(match.category)) errors.push(`${path}.category: 不正です`);
    if (!['user_top5', 'generated_axis'].includes(match.sourceKind)) errors.push(`${path}.sourceKind: 不正です`);
    if (!Array.isArray(match.terms)
      || match.terms.length < 1
      || match.terms.length > 100
      || new Set(match.terms).size !== match.terms.length
      || !match.terms.every((term) => boundedString(term, 1, COMPAT_VISUAL_TERM_MAX_LENGTH))) {
      errors.push(`${path}.terms: 重複のない1〜100件・各80文字以内が必要です`);
    }
  });
}

function validateVisualUaam(value, aliases, expectedEligibility, errors) {
  if (!hasExactKeys(value, ['eligible', 'axes'])) {
    errors.push('report.visual.uaam: フィールドが契約と一致しません');
    return;
  }
  if (typeof value.eligible !== 'boolean' || value.eligible !== expectedEligibility) {
    errors.push('report.visual.uaam.eligible: データ充足度と一致しません');
  }
  if (!Array.isArray(value.axes) || value.axes.length !== COMPAT_VISUAL_UAAM_AXES.length) {
    errors.push('report.visual.uaam.axes: 全16軸が必要です');
    return;
  }
  value.axes.forEach((axis, index) => {
    const path = `report.visual.uaam.axes[${index}]`;
    const expected = COMPAT_VISUAL_UAAM_AXES[index];
    if (!hasExactKeys(axis, ['key', 'label', 'cohortSize', 'signal', 'points'])) {
      errors.push(`${path}: フィールドが契約と一致しません`);
      return;
    }
    if (axis.key !== expected.key || axis.label !== expected.label) errors.push(`${path}: 軸名または順序が不正です`);
    if (!Number.isInteger(axis.cohortSize) || axis.cohortSize < 0 || axis.cohortSize > 100_000) {
      errors.push(`${path}.cohortSize: 整数が必要です`);
    }
    if (!VISUAL_SIGNALS.includes(axis.signal)) errors.push(`${path}.signal: 不正です`);
    if (!Array.isArray(axis.points) || axis.points.length > aliases.length) {
      errors.push(`${path}.points: 対象人数以内の配列が必要です`);
      return;
    }
    const pointAliases = [];
    axis.points.forEach((point, pointIndex) => {
      const pointPath = `${path}.points[${pointIndex}]`;
      if (!hasExactKeys(point, ['alias', 'percentile'])) {
        errors.push(`${pointPath}: フィールドが契約と一致しません`);
        return;
      }
      pointAliases.push(point.alias);
      if (!aliases.includes(point.alias)) errors.push(`${pointPath}.alias: 対象者と一致しません`);
      if (!Number.isInteger(point.percentile) || point.percentile < 0 || point.percentile > 100) {
        errors.push(`${pointPath}.percentile: 0〜100の整数が必要です`);
      }
    });
    if (new Set(pointAliases).size !== pointAliases.length) errors.push(`${path}.points: aliasが重複しています`);

    const percentiles = axis.points.map((point) => point?.percentile).filter(Number.isFinite);
    const gap = percentiles.length >= 2 ? Math.max(...percentiles) - Math.min(...percentiles) : null;
    let expectedSignal = 'insufficient';
    if (value.eligible && axis.cohortSize >= COMPAT_EVIDENCE_THRESHOLDS.uaamMinCohort && gap !== null) {
      if (gap <= COMPAT_EVIDENCE_THRESHOLDS.uaamSimilarMaxGap) expectedSignal = 'similarity';
      else if (gap >= COMPAT_EVIDENCE_THRESHOLDS.uaamComplementMinGap) expectedSignal = 'complementarity';
      else expectedSignal = 'neutral';
    }
    if (axis.signal !== expectedSignal) errors.push(`${path}.signal: 点分布の決定論的判定と一致しません`);
  });
}

function validateVisual(value, sufficiency, errors) {
  if (!hasExactKeys(value, ['schemaVersion', 'members', 'matches', 'uaam']) || value.schemaVersion !== 2) {
    errors.push('report.visual: schemaVersion 2 の表示契約が必要です');
    return;
  }
  const aliases = validateVisualMembers(value.members, sufficiency?.memberAvailability, errors);
  validateVisualMatches(value.matches, aliases, errors);
  validateVisualUaam(value.uaam, aliases, sufficiency?.uaam?.eligible, errors);
}

export function isCompatShareId(value) {
  return typeof value === 'string' && SHARE_ID_RE.test(value);
}

export function validateCompatShareReport(report, options = {}) {
  const errors = [];
  const schemaVersion = report?.visual?.schemaVersion === 2 ? 2 : 1;
  const reportKeys = schemaVersion === 2 ? REPORT_KEYS_V2 : REPORT_KEYS_V1;
  if (!hasExactKeys(report, reportKeys)) {
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
  if (schemaVersion === 2) validateVisual(report.visual, sufficiency, errors);

  if (hasExactKeys(sufficiency, SUFFICIENCY_KEYS)) {
    const outputValidation = validateCompatOutput({
      dataSufficiency: {
        summary: sufficiency.summary,
        limitations: sufficiency.limitations,
      },
      lenses: report.lenses,
      ...(schemaVersion === 2 ? { unmetFunctionCandidate: report.unmetFunctionCandidate } : {}),
    }, evidence, { schemaVersion, goalProvided: options.goalProvided === true });
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

  // v1 は既存保存docの読取専用。新規共有は表示用データを含むv2だけを受け付ける。
  if (body.report?.visual?.schemaVersion !== 2) {
    return { ok: false, status: 422, code: 'REPORT_INVALID', error: '共有する分析結果の安全性を確認できませんでした' };
  }

  const reportValidation = validateCompatShareReport(body.report, { goalProvided: body.mode === 'team' });
  if (!reportValidation.ok) {
    return { ok: false, status: 422, code: 'REPORT_INVALID', error: '共有する分析結果の安全性を確認できませんでした', details: reportValidation.errors };
  }
  const submittedTextErrors = [
    ...validateCompatForbiddenLanguage(body.report.visual.matches.map((match) => match.terms), {
      path: 'report.visual.matches[].terms',
      rejectVacancy: true,
    }),
    ...validateCompatForbiddenLanguage(body.report.visual.members.flatMap((member) => (
      CATEGORY_KEYS.flatMap((category) => member.axes[category])
    )), {
      path: 'report.visual.members[].axes',
      rejectVacancy: true,
    }),
    ...validateCompatForbiddenLanguage(body.report.evidence.map((item) => item.text), {
      path: 'report.evidence[].text',
      rejectVacancy: true,
    }),
  ];
  if (submittedTextErrors.length > 0) {
    return {
      ok: false,
      status: 422,
      code: 'REPORT_INVALID',
      error: '共有する分析結果の安全性を確認できませんでした',
      details: submittedTextErrors,
    };
  }
  if (body.report.dataSufficiency.memberAvailability.length !== memberLabels.length) {
    return { ok: false, status: 400, code: 'INVALID_REQUEST', error: '分析結果と対象者ラベルの人数が一致しません' };
  }
  const expectedAliases = memberLabels.map((_label, index) => `M${index + 1}`);
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
