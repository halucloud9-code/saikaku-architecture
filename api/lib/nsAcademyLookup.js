import { serializeTimestamps } from './serialize.js';

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function copyField(target, source, key) {
  if (hasOwn(source, key)) {
    target[key] = serializeTimestamps(source[key]);
  }
}

function updatedAtMillis(value) {
  const serialized = serializeTimestamps(value);
  if (typeof serialized !== 'string') return null;

  const millis = Date.parse(serialized);
  return Number.isFinite(millis) ? millis : null;
}

export function shapeResultsDocument(source) {
  if (!source) return null;

  const shaped = {};
  copyField(shaped, source, 'uid');
  copyField(shaped, source, 'createdAt');
  copyField(shaped, source, 'updatedAt');
  copyField(shaped, source, 'inputTalentTop5');
  copyField(shaped, source, 'inputPassionTop5');
  copyField(shaped, source, 'inputValueTop5');
  copyField(shaped, source, 'selectedKakuchiiki');

  if (hasOwn(source, 'result')) {
    if (source.result && typeof source.result === 'object') {
      const result = {};
      copyField(result, source.result, 'kakuchiiki');
      copyField(result, source.result, 'core_words');
      shaped.result = result;
    } else {
      shaped.result = null;
    }
  }

  return shaped;
}

export function shapeUaamResultsDocument(source) {
  if (!source) return null;

  const shaped = {};
  copyField(shaped, source, 'uid');
  copyField(shaped, source, 'createdAt');
  copyField(shaped, source, 'updatedAt');
  copyField(shaped, source, 'scores');
  copyField(shaped, source, 'analysis');
  copyField(shaped, source, 'leadership_stage');
  copyField(shaped, source, 'personality_level');
  return shaped;
}

export function buildNsAcademyLookupResponse(resultsSource, uaamResultsSource) {
  const updatedAtCandidates = [resultsSource?.updatedAt, uaamResultsSource?.updatedAt]
    .map(updatedAtMillis)
    .filter((value) => value !== null);
  const sourceUpdatedAt = updatedAtCandidates.length > 0
    ? new Date(Math.max(...updatedAtCandidates)).toISOString()
    : null;

  return {
    contract_version: 1,
    source_updated_at: sourceUpdatedAt,
    results: shapeResultsDocument(resultsSource),
    uaam_results: shapeUaamResultsDocument(uaamResultsSource),
  };
}
