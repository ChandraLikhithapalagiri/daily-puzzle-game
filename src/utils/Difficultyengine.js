/**
 * difficultyEngine.js
 *
 * Single source of truth for all adaptive difficulty decisions.
 * Reads from Dexie — never from localStorage.
 *
 * ─── Decision Model ──────────────────────────────────────────────────────────
 *
 * We compute a numeric "performance score" (0–100) over the last 7 days:
 *
 *   Component 1 — Solve Rate (40 pts max)
 *     = (solved days / total days with activity) * 40
 *
 *   Component 2 — Speed Score (40 pts max)
 *     Compares average solve time against the expected time for the
 *     current difficulty tier. Faster than expected → full points.
 *     2× slower than expected → 0 points.
 *
 *   Component 3 — Clean Solve Bonus (20 pts max)
 *     Penalises puzzles that needed multiple attempts.
 *     = (puzzles solved on first attempt / total solved) * 20
 *
 * Performance score → difficulty tier mapping:
 *   ≥ 75  → increase difficulty (or stay at hard)
 *   35–74 → maintain current difficulty
 *   < 35  → decrease difficulty (or stay at easy)
 *
 * Puzzle type gating:
 *   Matrix is unlocked only after the user has demonstrated competence
 *   at sequence puzzles (score ≥ 50 with at least 3 days of history).
 *   This prevents new users from being thrown into a matrix puzzle
 *   with no context.
 *
 * ─── Expected Solve Times (seconds) ─────────────────────────────────────────
 *   easy    → 60s   (generous — new user learning the system)
 *   medium  → 45s   (comfortable pace)
 *   hard    → 30s   (requires focus and pattern recognition)
 *
 * ─── Determinism guarantee ───────────────────────────────────────────────────
 * Given the same Dexie history, this function always returns the same result.
 * No randomness. No time-of-day dependency. Pure function over data.
 */

import { getAllActivities } from "../db";

/* ─── Constants ─────────────────────────────────────────────────────────── */

export const DIFFICULTY = {
  EASY:   "easy",
  MEDIUM: "medium",
  HARD:   "hard",
};

export const PUZZLE_TYPE = {
  SEQUENCE: "sequence",
  MATRIX:   "matrix",
};

// Expected solve time in seconds per difficulty level
const EXPECTED_SOLVE_TIME = {
  easy:   60,
  medium: 45,
  hard:   30,
};

// How many days of history to consider
const LOOKBACK_DAYS = 7;

// Thresholds for difficulty changes
const THRESHOLD_INCREASE = 75;
const THRESHOLD_DECREASE = 35;

/* ─── Difficulty progression / regression map ───────────────────────────── */

const DIFFICULTY_UP = {
  easy:   DIFFICULTY.MEDIUM,
  medium: DIFFICULTY.HARD,
  hard:   DIFFICULTY.HARD,   // already max
};

const DIFFICULTY_DOWN = {
  easy:   DIFFICULTY.EASY,   // already min
  medium: DIFFICULTY.EASY,
  hard:   DIFFICULTY.MEDIUM,
};

/* ─── Core engine ────────────────────────────────────────────────────────── */

/**
 * Analyse recent activity and return the recommended puzzle configuration
 * for today's puzzle.
 *
 * @returns {Promise<{
 *   puzzleType:  "sequence" | "matrix",
 *   difficulty:  "easy" | "medium" | "hard",
 *   performanceScore: number,       // 0–100 for debugging / display
 *   trend:       "improving" | "stable" | "declining",
 *   reason:      string             // human-readable explanation
 * }>}
 */
export async function getAdaptiveDifficulty() {
  const allActivities = await getAllActivities(); // newest-first

  // Slice to the last LOOKBACK_DAYS days that have ANY activity record
  const recentWindow = allActivities.slice(0, LOOKBACK_DAYS);

  // ── Cold start: no history at all ──────────────────────────────────────
  if (recentWindow.length === 0) {
    return {
      puzzleType:       PUZZLE_TYPE.SEQUENCE,
      difficulty:       DIFFICULTY.EASY,
      performanceScore: 0,
      trend:            "stable",
      reason:           "No history found. Starting with easy sequence puzzle.",
    };
  }

  // ── Separate solved vs unsolved ─────────────────────────────────────────
  const solved   = recentWindow.filter((a) => a.solved);
  const unsolved = recentWindow.filter((a) => !a.solved);

  // ── Determine the dominant difficulty from recent solved puzzles ─────────
  // Use the most common difficulty in recent solved history as the "current" level.
  const currentDifficulty = getDominantDifficulty(solved);

  // ── Component 1: Solve Rate (0–40) ─────────────────────────────────────
  const solveRate      = solved.length / recentWindow.length;
  const solveRateScore = Math.round(solveRate * 40);

  // ── Component 2: Speed Score (0–40) ────────────────────────────────────
  const speedScore = computeSpeedScore(solved, currentDifficulty);

  // ── Component 3: Clean Solve Bonus (0–20) ──────────────────────────────
  // A "clean" solve = attempts === 1 (no wrong guesses before success)
  const cleanSolves      = solved.filter((a) => (a.attempts ?? 1) <= 1).length;
  const cleanSolveScore  = solved.length > 0
    ? Math.round((cleanSolves / solved.length) * 20)
    : 0;

  const performanceScore = solveRateScore + speedScore + cleanSolveScore;

  // ── Trend detection ─────────────────────────────────────────────────────
  // Compare the first half of the window vs the second half
  const trend = computeTrend(solved);

  // ── Difficulty decision ─────────────────────────────────────────────────
  let newDifficulty;
  let reason;

  if (performanceScore >= THRESHOLD_INCREASE) {
    newDifficulty = DIFFICULTY_UP[currentDifficulty];
    reason = `Score ${performanceScore}/100 — strong performance. Increasing difficulty.`;
  } else if (performanceScore < THRESHOLD_DECREASE) {
    newDifficulty = DIFFICULTY_DOWN[currentDifficulty];
    reason = `Score ${performanceScore}/100 — struggling. Decreasing difficulty.`;
  } else {
    newDifficulty = currentDifficulty;
    reason = `Score ${performanceScore}/100 — steady performance. Maintaining difficulty.`;
  }

  // ── Apply trend modifier ────────────────────────────────────────────────
  // If the player is clearly improving or declining FAST, nudge immediately
  // rather than waiting for the threshold to cross.
  if (trend === "improving" && newDifficulty === currentDifficulty && performanceScore >= 60) {
    newDifficulty = DIFFICULTY_UP[currentDifficulty];
    reason += " Upward trend detected — advancing early.";
  }
  if (trend === "declining" && newDifficulty === currentDifficulty && performanceScore <= 45) {
    newDifficulty = DIFFICULTY_DOWN[currentDifficulty];
    reason += " Downward trend detected — stepping back early.";
  }

  // ── Puzzle type decision ────────────────────────────────────────────────
  const puzzleType = decidePuzzleType({
    totalDays:    recentWindow.length,
    solved,
    performanceScore,
    currentDifficulty: newDifficulty,
  });

  return {
    puzzleType,
    difficulty: newDifficulty,
    performanceScore,
    trend,
    reason,
  };
}

/* ─── Helper: dominant difficulty ───────────────────────────────────────── */

/**
 * Returns the most common difficulty level among the given solved activities.
 * Falls back to "easy" if the list is empty.
 *
 * @param   {object[]} solved
 * @returns {"easy"|"medium"|"hard"}
 */
function getDominantDifficulty(solved) {
  if (solved.length === 0) return DIFFICULTY.EASY;

  const counts = { easy: 0, medium: 0, hard: 0 };
  solved.forEach((a) => {
    const d = a.difficulty ?? "easy";
    if (counts[d] !== undefined) counts[d]++;
  });

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/* ─── Helper: speed score ────────────────────────────────────────────────── */

/**
 * Score 0–40 based on how fast the user solves relative to the expected
 * time for their current difficulty tier.
 *
 *   at or under expected time → 40 pts
 *   at 2× expected time       → 0 pts
 *   linear interpolation between those points
 *
 * @param   {object[]} solved
 * @param   {"easy"|"medium"|"hard"} difficulty
 * @returns {number} 0–40
 */
function computeSpeedScore(solved, difficulty) {
  if (solved.length === 0) return 20; // neutral score for new users

  const avgTime = solved.reduce((sum, a) => sum + (a.timeTaken ?? 60), 0) / solved.length;
  const expected = EXPECTED_SOLVE_TIME[difficulty] ?? 60;
  const maxTime  = expected * 2; // 2× expected = 0 pts

  if (avgTime <= expected)  return 40;
  if (avgTime >= maxTime)   return 0;

  // Linear interpolation
  return Math.round(((maxTime - avgTime) / expected) * 40);
}

/* ─── Helper: trend detection ───────────────────────────────────────────── */

/**
 * Compare score quality of the most recent half of solved history
 * against the older half.
 *
 * "quality" here = score / (attempts * timeTaken) — a composite of
 * speed and cleanliness, normalised by difficulty.
 *
 * @param   {object[]} solved — newest-first
 * @returns {"improving"|"stable"|"declining"}
 */
function computeTrend(solved) {
  if (solved.length < 4) return "stable"; // not enough data for a trend

  const mid   = Math.floor(solved.length / 2);
  const newer = solved.slice(0, mid);   // more recent
  const older = solved.slice(mid);       // less recent

  const avgQuality = (group) =>
    group.reduce((sum, a) => {
      const attempts = Math.max(a.attempts ?? 1, 1);
      const time     = Math.max(a.timeTaken ?? 60, 1);
      return sum + (a.score ?? 50) / (attempts * Math.sqrt(time));
    }, 0) / group.length;

  const newerQ = avgQuality(newer);
  const olderQ = avgQuality(older);
  const delta  = newerQ - olderQ;

  if (delta >  0.1) return "improving";
  if (delta < -0.1) return "declining";
  return "stable";
}

/* ─── Helper: puzzle type gating ────────────────────────────────────────── */

/**
 * Matrix puzzles are harder to learn from scratch.
 * Gate them behind demonstrated sequence competence.
 *
 * @param {{ totalDays, solved, performanceScore, currentDifficulty }} params
 * @returns {"sequence"|"matrix"}
 */
function decidePuzzleType({ totalDays, solved, performanceScore, currentDifficulty }) {
  // Must have at least 3 days of history to unlock matrix
  if (totalDays < 3) return PUZZLE_TYPE.SEQUENCE;

  // Must have solved at least 2 of the last 3 days
  if (solved.length < 2) return PUZZLE_TYPE.SEQUENCE;

  // Performance must be respectable and difficulty must be medium or hard
  if (performanceScore >= 50 && currentDifficulty !== DIFFICULTY.EASY) {
    return PUZZLE_TYPE.MATRIX;
  }

  return PUZZLE_TYPE.SEQUENCE;
}