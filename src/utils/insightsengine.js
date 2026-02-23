/**
 * insightsEngine.js
 *
 * Performance analytics engine for the Insights Dashboard.
 * Reads from Dexie only — no network calls.
 *
 * Deliberately separate from retentionEngine.js:
 *   retentionEngine  → "am I showing up?" (consistency, streaks, retention)
 *   insightsEngine   → "am I improving?" (performance, progression, efficiency)
 *
 * ─── Metrics produced ────────────────────────────────────────────────────────
 *
 *  performanceTrend
 *    Chronological array of up to 60 solved sessions with:
 *      { date, score, timeTaken, difficulty, attempts, rollingAvg }
 *    rollingAvg = 7-session rolling average score (null for first 6 points)
 *    Used by: score trend chart with rolling average overlay
 *
 *  difficultyTimeline
 *    Chronological array of all solved sessions with:
 *      { date, difficultyLevel }
 *    difficultyLevel: easy=1, medium=2, hard=3
 *    Used by: difficulty progression step chart
 *
 *  speedScatterPoints
 *    Array of { timeTaken, score, difficulty } for last 60 solved sessions
 *    Used by: speed vs score scatter plot
 *
 *  attemptsBreakdown
 *    Per-difficulty breakdown of attempt counts:
 *      { easy: { first, second, thirdPlus, total },
 *        medium: { ... },
 *        hard: { ... } }
 *    first      = solved on attempt 1 (clean)
 *    second     = solved on attempt 2
 *    thirdPlus  = solved on attempt 3 or more
 *    Used by: attempts efficiency stacked bar
 *
 *  personalBests
 *    Per-difficulty bests:
 *      { easy:   { bestScore, fastestTime, cleanStreak },
 *        medium: { ... },
 *        hard:   { ... } }
 *    cleanStreak = longest run of consecutive first-attempt solves at that difficulty
 *    Used by: personal bests table
 *
 *  performanceSummary
 *    Single-line adaptive engine status:
 *      { currentDifficulty, trend, performanceScore, nextThreshold }
 *    trend: "improving" | "stable" | "declining"
 *    nextThreshold: points needed to advance or at risk of regression
 *    Used by: "You are here" progress indicator
 */

import dayjs from "dayjs";
import { getAllActivities } from "../db";
import { getAdaptiveDifficulty } from "./Difficultyengine";

const DIFFICULTY_LEVEL = { easy: 1, medium: 2, hard: 3 };

/* ─────────────────────────────────────────────────────────────────────────── */
/*  ROLLING AVERAGE                                                            */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Compute a rolling average over a window of values.
 * Returns null for positions where the window isn't full yet.
 *
 * @param   {number[]} values
 * @param   {number}   window
 * @returns {(number|null)[]}
 */
function rollingAverage(values, window = 7) {
  return values.map((_, i) => {
    if (i < window - 1) return null;
    const slice = values.slice(i - window + 1, i + 1);
    return Math.round(slice.reduce((s, v) => s + v, 0) / window);
  });
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  CLEAN STREAK PER DIFFICULTY                                                */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Given a chronological array of solved activities filtered to one difficulty,
 * find the longest consecutive run where attempts === 1.
 *
 * @param   {object[]} sessions — chronological, pre-filtered by difficulty
 * @returns {number}
 */
function longestCleanStreak(sessions) {
  let best = 0;
  let run  = 0;
  for (const s of sessions) {
    if ((s.attempts ?? 1) === 1) {
      run++;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  MAIN ENTRY                                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Compute the full insights snapshot.
 * Safe to call repeatedly — pure reads, no writes.
 *
 * @returns {Promise<InsightsSnapshot>}
 */
export async function computeInsightsData() {
  const all    = await getAllActivities();          // newest-first
  const solved = all.filter((a) => a.solved);      // newest-first

  if (solved.length === 0) {
    return {
      isEmpty:            true,
      performanceTrend:   [],
      difficultyTimeline: [],
      speedScatterPoints: [],
      attemptsBreakdown:  { easy: null, medium: null, hard: null },
      personalBests:      { easy: null, medium: null, hard: null },
      performanceSummary: null,
    };
  }

  /* ── Chronological base arrays ────────────────────────────────────────── */

  // Last 60 solved sessions, oldest-first
  const recentChron = solved.slice(0, 60).reverse();

  /* ── Performance trend + rolling average ─────────────────────────────── */

  const rawScores  = recentChron.map((s) => s.score ?? 0);
  const rolling    = rollingAverage(rawScores, 7);

  const performanceTrend = recentChron.map((s, i) => ({
    date:        s.date,
    score:       s.score       ?? 0,
    timeTaken:   s.timeTaken   ?? 0,
    difficulty:  s.difficulty  ?? "easy",
    attempts:    s.attempts    ?? 1,
    rollingAvg:  rolling[i],           // null until session 7
  }));

  /* ── Difficulty timeline ──────────────────────────────────────────────── */

  // Use ALL solved history (not just last 60) to show the full progression arc
  const difficultyTimeline = solved
    .slice()
    .reverse()                                     // oldest-first
    .map((s) => ({
      date:            s.date,
      difficultyLevel: DIFFICULTY_LEVEL[s.difficulty] ?? 1,
      difficulty:      s.difficulty ?? "easy",
    }));

  /* ── Speed vs score scatter ───────────────────────────────────────────── */

  const speedScatterPoints = recentChron.map((s) => ({
    timeTaken:  s.timeTaken  ?? 0,
    score:      s.score      ?? 0,
    difficulty: s.difficulty ?? "easy",
    date:       s.date,
  }));

  /* ── Attempts breakdown per difficulty ────────────────────────────────── */

  const attemptsBreakdown = { easy: null, medium: null, hard: null };

  for (const diff of ["easy", "medium", "hard"]) {
    const group = solved.filter((s) => (s.difficulty ?? "easy") === diff);
    if (group.length === 0) continue;

    const first     = group.filter((s) => (s.attempts ?? 1) === 1).length;
    const second    = group.filter((s) => (s.attempts ?? 1) === 2).length;
    const thirdPlus = group.filter((s) => (s.attempts ?? 1) >= 3).length;

    attemptsBreakdown[diff] = {
      first,
      second,
      thirdPlus,
      total: group.length,
      firstPct:     Math.round((first     / group.length) * 100),
      secondPct:    Math.round((second    / group.length) * 100),
      thirdPlusPct: Math.round((thirdPlus / group.length) * 100),
    };
  }

  /* ── Personal bests per difficulty ───────────────────────────────────── */

  const personalBests = { easy: null, medium: null, hard: null };

  for (const diff of ["easy", "medium", "hard"]) {
    const group = solved
      .filter((s) => (s.difficulty ?? "easy") === diff)
      .slice()
      .reverse();                                  // chronological for streak

    if (group.length === 0) continue;

    const bestScore    = Math.max(...group.map((s) => s.score      ?? 0));
    const fastestTime  = Math.min(...group.map((s) => s.timeTaken  ?? Infinity));
    const cleanStreak  = longestCleanStreak(group);
    const totalSolved  = group.length;
    const avgScore     = Math.round(
      group.reduce((sum, s) => sum + (s.score ?? 0), 0) / group.length
    );

    personalBests[diff] = {
      bestScore,
      fastestTime: fastestTime === Infinity ? 0 : fastestTime,
      cleanStreak,
      totalSolved,
      avgScore,
    };
  }

  /* ── Performance summary (from adaptive engine) ───────────────────────── */

  let performanceSummary = null;
  try {
    const adaptive = await getAdaptiveDifficulty();
    const THRESHOLD_INCREASE = 75;
    const THRESHOLD_DECREASE = 35;

    const ptsToAdvance  = adaptive.difficulty !== "hard"
      ? Math.max(0, THRESHOLD_INCREASE - adaptive.performanceScore)
      : null;
    const ptsAtRisk     = adaptive.difficulty !== "easy"
      ? Math.max(0, adaptive.performanceScore - THRESHOLD_DECREASE)
      : null;

    performanceSummary = {
      currentDifficulty: adaptive.difficulty,
      trend:             adaptive.trend,
      performanceScore:  adaptive.performanceScore,
      ptsToAdvance,        // null if already at hard
      ptsAtRisk,           // null if already at easy
      reason:            adaptive.reason,
    };
  } catch (err) {
    console.warn("[insightsEngine] Could not fetch adaptive state:", err);
  }

  return {
    isEmpty:            false,
    performanceTrend,
    difficultyTimeline,
    speedScatterPoints,
    attemptsBreakdown,
    personalBests,
    performanceSummary,
  };
}