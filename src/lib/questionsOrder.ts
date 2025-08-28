import { shuffleWithSeed } from './random';

/**
 * Build a deterministic list of unique question indexes.
 * Everyone in the room sees the SAME order because it's derived from the room's seed.
 */
export function buildQuestionOrder(seed: number, totalQuestions: number, pick = 10): number[] {
  const n = Math.max(0, Math.min(pick, totalQuestions));
  const idxs = Array.from({ length: totalQuestions }, (_, i) => i);
  return shuffleWithSeed(idxs, seed).slice(0, n);
}
