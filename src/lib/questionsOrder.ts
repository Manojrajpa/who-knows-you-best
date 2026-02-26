import { shuffleWithSeed } from './random';

export function buildQuestionOrder(seed: number, totalQuestions: number, pick = 10): number[] {
  const total = Number.isFinite(totalQuestions) && totalQuestions > 0 ? totalQuestions : 0;
  const n = Math.max(0, Math.min(pick, total));
  const idxs = Array.from({ length: total }, (_, i) => i);
  return shuffleWithSeed(idxs, seed).slice(0, n);
}
