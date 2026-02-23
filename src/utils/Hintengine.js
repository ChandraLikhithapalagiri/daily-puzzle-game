/**
 * hintEngine.js
 * src/utils/hintEngine.js
 *
 * Hint budget allocation + sequential hint text generation.
 * Persists hint usage in Dexie (hintUsage table added in db v5 upgrade).
 * Falls back gracefully if hintUsage table doesn't exist yet.
 *
 * Budget rules:
 *   easy=3, medium=2, hard=1 (base)
 *   +1 if 7-day accuracy < 50%   (struggling bonus)
 *   +1 if current streak >= 7    (loyalty bonus)
 *   max 4 hints total
 *
 * Hint levels (sequential unlock):
 *   1 — CONCEPT   : category of pattern (never reveals patternKey raw string)
 *   2 — DIRECTION : direction of change
 *   3 — PROXIMITY : warm/cold relative to user's current answer
 *   4 — BRACKET   : numeric range  [answer-15, answer+15]
 */

import { getRecentSolvedActivities, localDB } from "../db";

/* ─── Budget ────────────────────────────────────────────────────────────── */

export async function computeHintBudget(difficulty) {
  const base = { easy: 3, medium: 2, hard: 1 }[difficulty] ?? 1;

  let bonus = 0;
  try {
    const recent = await getRecentSolvedActivities(7);
    const accuracy = recent.length > 0
      ? recent.filter((a) => a.solved).length / recent.length
      : 1;
    if (accuracy < 0.5) bonus++;

    const dates = recent.map((a) => a.date).sort();
    if (dates.length >= 7) bonus++;
  } catch (_) {}

  return Math.min(base + bonus, 4);
}

/* ─── Hint usage persistence ────────────────────────────────────────────── */

export async function useHint(date, difficulty, budget) {
  try {
    const existing = await localDB.hintUsage?.get(String(date));
    const current  = existing?.hintsUsed ?? 0;
    await localDB.hintUsage?.put({
      date:       String(date),
      difficulty,
      hintsUsed:  current + 1,
      budget,
    });
  } catch (_) {
    // hintUsage table may not exist in older DB versions — silently skip
  }
}

export async function getHintsUsedToday(date) {
  try {
    const record = await localDB.hintUsage?.get(String(date));
    return record?.hintsUsed ?? 0;
  } catch (_) {
    return 0;
  }
}

/* ─── Hint text generation ──────────────────────────────────────────────── */

const CONCEPT_MAP = {
  arithmetic:     "The numbers change by a fixed amount each step.",
  geometric:      "Each term is multiplied by a constant ratio.",
  squares:        "The terms are perfect squares of consecutive integers.",
  fibonacci:      "Each term is the sum of the two terms before it.",
  alternating:    "The signs alternate while the magnitude grows.",
  polynomial:     "The differences between terms themselves change — it's quadratic.",
  multiplication: "Each cell is the product of its row and column factors.",
};

export function getHintText({ level, puzzleType, patternKey, userAnswer, answer, correctCount, blankCount }) {
  if (puzzleType === "matrix") {
    return [
      "Each row and column follows a consistent arithmetic rule.",
      "Look at two adjacent visible cells in any row or column to find the step.",
      correctCount > 0
        ? `Good progress — ${correctCount} of ${blankCount} cells are correct so far.`
        : "None of your filled cells match yet — try checking the first row.",
      "Focus on the cell with the most visible neighbours for the clearest pattern.",
    ][level - 1] ?? "Keep going!";
  }

  // Sequence hints
  if (level === 1) {
    return CONCEPT_MAP[patternKey] ?? "Look for a pattern in how the numbers change.";
  }
  if (level === 2) {
    const diff = answer - (userAnswer ?? 0);
    if (patternKey === "alternating") return "The next term has the opposite sign from the previous one.";
    return diff > 0 ? "The next term is larger than your current answer." : "The next term is smaller than your current answer.";
  }
  if (level === 3) {
    if (userAnswer === null) return "Enter your best guess first to get a proximity hint.";
    const delta = Math.abs((userAnswer ?? 0) - answer);
    if (delta === 0) return "Your answer is exactly right — hit submit!";
    if (delta <= 5)  return `Very warm — you're within 5 of the correct value.`;
    if (delta <= 20) return `Warm — you're within 20 of the correct value.`;
    return `Cold — your answer is more than 20 away.`;
  }
  if (level === 4) {
    return `The answer falls between ${answer - 15} and ${answer + 15}.`;
  }
  return "Keep going!";
}