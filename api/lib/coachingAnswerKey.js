import { createHash } from 'node:crypto';

function makeCoachingAnswerKey(text) {
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('invalid questionText');
  }

  let normalized = text.normalize('NFKC');
  normalized = normalized.trim();
  normalized = normalized.replace(/　/g, ' ');
  normalized = normalized.replace(/\s+/g, ' ');
  normalized = normalized.replace(/[？！?!．。.]+$/, '');

  if (normalized.length === 0) {
    throw new Error('invalid questionText');
  }

  return createHash('sha1').update(normalized).digest('hex').slice(0, 16);
}

export { makeCoachingAnswerKey };
