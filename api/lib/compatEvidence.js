import { COMPAT_CATEGORIES, profileAvailability } from './compatProfiles.js';

const SOURCE_KINDS = ['user_top5', 'generated_axis'];
const UAAM_MIN_COHORT = 30;
const UAAM_SIMILAR_MAX_GAP = 15;
const UAAM_COMPLEMENT_MIN_GAP = 30;
const VISUAL_CATEGORY_ORDER = ['value', 'talent', 'passion'];
const VISUAL_SOURCE_ORDER = ['user_top5', 'generated_axis'];

const UAAM_VISUAL_AXES = [
  ['meaning', '基軸力'],
  ['mindfulness', '認知力'],
  ['mindshift', '転換力'],
  ['mastery', '熟達力'],
  ['learning', '謙学力'],
  ['logical', '論理力'],
  ['life', '活用力'],
  ['leadership', '統率力'],
  ['critical', '本質力'],
  ['creativity', '創造力'],
  ['communication', '伝達力'],
  ['collaboration', '協働力'],
  ['idea', '構想力'],
  ['innovation', '変革力'],
  ['implementation', '実装力'],
  ['influence', '影響力'],
];

function percentile(values, target) {
  if (values.length < UAAM_MIN_COHORT || !Number.isFinite(target)) return null;
  let below = 0;
  let equal = 0;
  for (const value of values) {
    if (value < target) below += 1;
    else if (value === target) equal += 1;
  }
  return Math.round(((below + equal * 0.5) / values.length) * 100);
}

function cohortBySubscore(uaamDocs) {
  const cohort = {};
  for (const data of uaamDocs) {
    const scores = data?.scores;
    if (!scores) continue;
    for (const axis of ['mindset', 'literacy', 'competency', 'impact']) {
      for (const [key, raw] of Object.entries(scores[axis]?.subs || {})) {
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 0 || value > 20) continue;
        (cohort[key] ||= []).push(value);
      }
    }
  }
  return cohort;
}

function comparableTokens(profile, category, sourceKind) {
  const bucket = profile.categories[category][sourceKind];
  if (sourceKind === 'user_top5') return bucket;
  return bucket.flatMap((axis) => axis.tokens);
}

function sharedSourceKinds(left, right, category) {
  return SOURCE_KINDS.filter((sourceKind) => (
    comparableTokens(left, category, sourceKind).length > 0
    && comparableTokens(right, category, sourceKind).length > 0
  ));
}

function exactMatches(left, right, category, sourceKind) {
  const rightSet = new Set(comparableTokens(right, category, sourceKind));
  return [...new Set(comparableTokens(left, category, sourceKind).filter((token) => rightSet.has(token)))];
}

function aliasFor(index, mode) {
  if (mode === 'pair') return index === 0 ? 'A' : 'B';
  return `M${index + 1}`;
}

function addEvidence(ledger, lens, kind, promptText, details = {}) {
  const id = `E-${String(ledger.length + 1).padStart(3, '0')}`;
  ledger.push({ id, lens, kind, promptText, details });
  return id;
}

function generatedAxisSignals(profiles, ledger) {
  for (const profile of profiles) {
    for (const category of COMPAT_CATEGORIES) {
      const names = profile.categories[category].generated_axis.map((axis) => axis.name).filter(Boolean);
      if (names.length === 0) continue;
      addEvidence(
        ledger,
        'both',
        'generated_axis',
        `${profile.alias} の ${category} に生成済み軸がある: ${names.join(' / ')}`,
        { alias: profile.alias, category, names },
      );
    }
  }
}

function exactMatchEvidence(profiles, ledger) {
  // 公開プロフィールを含むチームでは、全ペアを公開側にもある生成軸に揃える。
  // 内部メンバー同士だけ生Top5を使うと、公開メンバーの証拠機会が体系的に少なくなるため。
  const globallyAllowedKinds = profiles.some((profile) => profile.source === 'public')
    ? ['generated_axis']
    : SOURCE_KINDS;
  for (let i = 0; i < profiles.length; i += 1) {
    for (let j = i + 1; j < profiles.length; j += 1) {
      const left = profiles[i];
      const right = profiles[j];
      for (const category of COMPAT_CATEGORIES) {
        for (const sourceKind of sharedSourceKinds(left, right, category).filter((kind) => globallyAllowedKinds.includes(kind))) {
          const matches = exactMatches(left, right, category, sourceKind);
          if (matches.length === 0) continue;
          addEvidence(
            ledger,
            'similarity',
            'exact_nfkc_match',
            `${left.alias} と ${right.alias} の ${category} で、${sourceKind} のNFKC完全一致が ${matches.length} 件ある。本人が入力したTop5の語はLLMに送信されない。生成軸名は別名化プロフィールの一部としてLLMに渡る。`,
            { aliases: [left.alias, right.alias], category, sourceKind, matches },
          );
        }
      }
    }
  }
}

function uaamEvidence(profiles, uaamDocs, mode, ledger) {
  const eligibleProfiles = profiles.filter((profile) => profile.uaam);
  const requiredProfiles = mode === 'pair' ? profiles.length : Math.max(2, Math.ceil(profiles.length * 0.6));
  const cohort = cohortBySubscore(uaamDocs);
  const eligible = eligibleProfiles.length >= requiredProfiles
    && Object.values(cohort).some((values) => values.length >= UAAM_MIN_COHORT);

  if (!eligible) {
    return {
      eligible: false,
      availableProfiles: eligibleProfiles.length,
      requiredProfiles,
      minimumCohort: UAAM_MIN_COHORT,
      reason: `UAAMは ${eligibleProfiles.length}/${profiles.length} 名。必要人数 ${requiredProfiles} 名、各サブ指標のコホート最低 ${UAAM_MIN_COHORT} 件。`,
    };
  }

  const percentiles = new Map();
  for (const profile of eligibleProfiles) {
    const values = {};
    for (const [key, raw] of Object.entries(profile.uaam)) {
      const rank = percentile(cohort[key] || [], raw);
      if (rank !== null) values[key] = rank;
    }
    percentiles.set(profile.alias, values);
  }

  const subs = new Set([...percentiles.values()].flatMap((value) => Object.keys(value)));
  for (const sub of subs) {
    const points = eligibleProfiles
      .map((profile) => ({ alias: profile.alias, percentile: percentiles.get(profile.alias)?.[sub] }))
      .filter((point) => Number.isFinite(point.percentile));
    if (points.length < 2) continue;
    const values = points.map((point) => point.percentile);
    const gap = Math.max(...values) - Math.min(...values);
    if (gap <= UAAM_SIMILAR_MAX_GAP) {
      addEvidence(ledger, 'similarity', 'uaam_percentile_similarity', `UAAM ${sub} は対象者間のpercentile幅が ${gap}pt（${points.map((p) => `${p.alias}:${p.percentile}`).join(', ')}）。`, { sub, points, gap });
    } else if (gap >= UAAM_COMPLEMENT_MIN_GAP) {
      addEvidence(ledger, 'complementarity', 'uaam_percentile_complement', `UAAM ${sub} は対象者間のpercentile幅が ${gap}pt（${points.map((p) => `${p.alias}:${p.percentile}`).join(', ')}）。`, { sub, points, gap });
    }
  }

  return {
    eligible: true,
    availableProfiles: eligibleProfiles.length,
    requiredProfiles,
    minimumCohort: UAAM_MIN_COHORT,
  };
}

export function buildCompatEvidence(rawProfiles, uaamDocs, mode) {
  const profiles = rawProfiles.map((profile, index) => ({ ...profile, alias: aliasFor(index, mode) }));
  const ledger = [];
  generatedAxisSignals(profiles, ledger);
  exactMatchEvidence(profiles, ledger);
  const uaam = uaamEvidence(profiles, uaamDocs, mode, ledger);

  const memberAvailability = profiles.map((profile) => ({
    alias: profile.alias,
    source: profile.source,
    ...profileAvailability(profile),
  }));
  const limitations = [];
  if (profiles.some((profile) => profile.source === 'public')) {
    limitations.push('公開プロフィールには生Top5・core_words・UAAMがないため、共通する生成済み軸だけを比較します。欠落は「この診断データでは不検出」と扱います。');
  }
  if (!uaam.eligible) limitations.push(`UAAM数値比較はデータ不足です。${uaam.reason}`);
  if (!ledger.some((item) => item.lens === 'similarity')) limitations.push('同質レンズの決定論的証拠は、この診断データでは不検出です。');
  if (!ledger.some((item) => item.lens === 'complementarity')) limitations.push('補完レンズの決定論的証拠は、この診断データでは不検出です。');

  return {
    profiles,
    ledger,
    promptEvidence: ledger.map(({ id, lens, kind, promptText }) => ({ id, lens, kind, text: promptText })),
    dataSufficiency: {
      summary: limitations.length === 0 ? '両レンズを検討できる診断データがあります。' : '利用できる診断データの範囲内で分析します。',
      memberAvailability,
      limitations,
      uaam,
    },
  };
}

export function buildCompatVisual({ profiles, ledger, uaamDocs, uaamEligible }) {
  const cohort = cohortBySubscore(uaamDocs);
  const members = profiles.map((profile) => ({
    alias: profile.alias,
    axes: Object.fromEntries(COMPAT_CATEGORIES.map((category) => [
      category,
      profile.categories[category].generated_axis.map((axis) => axis.name).filter(Boolean),
    ])),
  }));
  const matches = ledger
    .filter((item) => item.kind === 'exact_nfkc_match')
    .map((item) => ({
      aliases: item.details.aliases,
      category: item.details.category,
      sourceKind: item.details.sourceKind,
      terms: item.details.matches,
    }))
    .sort((left, right) => (
      VISUAL_CATEGORY_ORDER.indexOf(left.category) - VISUAL_CATEGORY_ORDER.indexOf(right.category)
      || left.aliases.join('|').localeCompare(right.aliases.join('|'))
      || VISUAL_SOURCE_ORDER.indexOf(left.sourceKind) - VISUAL_SOURCE_ORDER.indexOf(right.sourceKind)
    ));
  const axes = UAAM_VISUAL_AXES.map(([key, label]) => {
    const cohortValues = cohort[key] || [];
    const points = profiles
      .map((profile) => ({ alias: profile.alias, percentile: percentile(cohortValues, profile.uaam?.[key]) }))
      .filter((point) => point.percentile !== null);
    const values = points.map((point) => point.percentile);
    const gap = values.length >= 2 ? Math.max(...values) - Math.min(...values) : null;
    let signal = 'insufficient';
    if (uaamEligible && gap !== null) {
      if (gap <= UAAM_SIMILAR_MAX_GAP) signal = 'similarity';
      else if (gap >= UAAM_COMPLEMENT_MIN_GAP) signal = 'complementarity';
      else signal = 'neutral';
    }
    return {
      key,
      label,
      cohortSize: cohortValues.length,
      signal,
      points,
    };
  });

  return {
    schemaVersion: 2,
    members,
    matches,
    uaam: {
      eligible: uaamEligible,
      axes,
    },
  };
}

export const COMPAT_EVIDENCE_THRESHOLDS = {
  uaamMinCohort: UAAM_MIN_COHORT,
  uaamSimilarMaxGap: UAAM_SIMILAR_MAX_GAP,
  uaamComplementMinGap: UAAM_COMPLEMENT_MIN_GAP,
};

export const COMPAT_VISUAL_UAAM_AXES = UAAM_VISUAL_AXES.map(([key, label]) => ({ key, label }));
