/**
 * retentionEngine.js
 *
 * Offline-first analytics engine. Reads from Dexie only.
 * Computes all retention metrics used by the visualization system.
 * No network calls. No external dependencies beyond dayjs + Dexie.
 *
 * ─── Metrics produced ────────────────────────────────────────────────────────
 *
 *  Summary stats
 *    totalPlayed       — total days with a solved puzzle
 *    currentStreak     — consecutive solved days ending today or yesterday
 *    longestStreak     — longest ever consecutive run
 *    bestScore         — highest single-day score
 *    avgScore          — mean score across all solved days
 *    avgTime           — mean solve time in seconds across all solved days
 *
 *  Weekly retention (last 8 weeks)
 *    Array of { weekLabel, rate, solvedDays, totalDays }
 *    rate = solved days / 7 (0.0–1.0) — what % of that week had activity
 *
 *  Day-of-week pattern (Sun=0 … Sat=6)
 *    Array of { day, label, count, rate }
 *    Shows which days of the week the user most reliably plays
 *
 *  Score trend (last 30 solved days, chronological)
 *    Array of { date, score, timeTaken, difficulty }
 *    Feeds the trend sparkline / chart
 *
 *  Difficulty distribution (last 30 days)
 *    { easy, medium, hard }  — count of solved days at each level
 *
 *  Activity map (365 days)
 *    Record<dateString, activity>  — used by the heatmap grid
 *    Intensity computed here: difficulty-weighted score (not raw score)
 *      intensity 0 = no activity
 *      intensity 1 = solved easy,   score < 50
 *      intensity 2 = solved easy,   score ≥ 50  OR  medium, score < 50
 *      intensity 3 = solved medium, score ≥ 50  OR  hard,   score < 50
 *      intensity 4 = solved hard,   score ≥ 50  (peak performance)
 */

import dayjs from "dayjs";
import { getAllActivities } from "../db";

/* ─── Intensity calculation ─────────────────────────────────────────────── */

const DIFFICULTY_WEIGHT = { easy: 1, medium: 2, hard: 3 };

/**
 * Return an intensity level 0–4 for a heatmap cell.
 * Encodes both difficulty and score, not just score alone.
 *
 * @param   {object|undefined} entry
 * @returns {0|1|2|3|4}
 */
export function computeIntensity(entry) {
  if (!entry || !entry.solved) return 0;

  const weight = DIFFICULTY_WEIGHT[entry.difficulty] ?? 1;
  const fast   = entry.score >= 50; // above the midpoint

  // weight 1 (easy):   slow=1, fast=2
  // weight 2 (medium): slow=2, fast=3
  // weight 3 (hard):   slow=3, fast=4
  return Math.min(weight + (fast ? 1 : 0), 4);
}

/* ─── Streak helpers ────────────────────────────────────────────────────── */

function buildStreaks(solvedDates) {
  // solvedDates must be sorted oldest-first
  if (solvedDates.length === 0) return { currentStreak: 0, longestStreak: 0 };

  // Longest streak — single forward pass
  let longestStreak = 1;
  let run = 1;
  for (let i = 1; i < solvedDates.length; i++) {
    const diff = dayjs(solvedDates[i]).diff(dayjs(solvedDates[i - 1]), "day");
    run = diff === 1 ? run + 1 : 1;
    if (run > longestStreak) longestStreak = run;
  }

  // Current streak — backward from today
  const solvedSet  = new Set(solvedDates);
  const today      = dayjs().format("YYYY-MM-DD");
  const yesterday  = dayjs().subtract(1, "day").format("YYYY-MM-DD");
  const anchor     = solvedSet.has(today) ? today
                   : solvedSet.has(yesterday) ? yesterday
                   : null;

  let currentStreak = 0;
  if (anchor) {
    let cursor = dayjs(anchor);
    while (solvedSet.has(cursor.format("YYYY-MM-DD"))) {
      currentStreak++;
      cursor = cursor.subtract(1, "day");
    }
  }

  return { currentStreak, longestStreak };
}

/* ─── Main computation ──────────────────────────────────────────────────── */

/**
 * Compute all retention metrics from Dexie data.
 * Returns a single analytics snapshot object.
 * Safe to call repeatedly — pure read, no writes.
 *
 * @returns {Promise<RetentionSnapshot>}
 */
export async function computeRetentionData() {
  const all    = await getAllActivities();                  // newest-first
  const solved = all.filter((a) => a.solved);

  /* ── Summary stats ─────────────────────────────────────────────────── */

  const totalPlayed = solved.length;

  const solvedDatesAsc = solved
    .map((a) => a.date)
    .sort();                                               // oldest-first for streak

  const { currentStreak, longestStreak } = buildStreaks(solvedDatesAsc);

  const bestScore = solved.reduce((max, a) => Math.max(max, a.score ?? 0), 0);
  const avgScore  = totalPlayed > 0
    ? Math.round(solved.reduce((s, a) => s + (a.score ?? 0), 0) / totalPlayed)
    : 0;
  const avgTime   = totalPlayed > 0
    ? Math.round(solved.reduce((s, a) => s + (a.timeTaken ?? 0), 0) / totalPlayed)
    : 0;

  /* ── Weekly retention — last 8 weeks ───────────────────────────────── */

  const solvedSet = new Set(solvedDatesAsc);
  const today     = dayjs();

  const weeklyRetention = [];
  for (let w = 7; w >= 0; w--) {
    const weekStart  = today.subtract(w * 7 + 6, "day");
    const weekEnd    = today.subtract(w * 7,      "day");

    let solvedDays = 0;
    const totalDays = 7;

    for (let d = 0; d < 7; d++) {
      const date = weekStart.add(d, "day").format("YYYY-MM-DD");
      if (solvedSet.has(date)) solvedDays++;
    }

    // Label: "Feb 10" for the Monday of that week
    const weekLabel = weekStart.format("MMM D");

    weeklyRetention.push({
      weekLabel,
      rate:       solvedDays / totalDays,    // 0.0–1.0
      solvedDays,
      totalDays,
    });
  }

  /* ── Day-of-week pattern ────────────────────────────────────────────── */

  const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dowCounts  = [0, 0, 0, 0, 0, 0, 0];

  solved.forEach((a) => {
    const dow = dayjs(a.date).day(); // 0=Sun … 6=Sat
    dowCounts[dow]++;
  });

  const maxDow = Math.max(...dowCounts, 1); // avoid /0
  const dowPattern = DOW_LABELS.map((label, i) => ({
    day:   i,
    label,
    count: dowCounts[i],
    rate:  dowCounts[i] / maxDow,            // 0.0–1.0 relative to peak day
  }));

  /* ── Score trend — last 30 solved days, chronological ──────────────── */

  const scoreTrend = solved
    .slice(0, 30)                             // newest-first, take 30
    .reverse()                                // chronological
    .map((a) => ({
      date:       a.date,
      score:      a.score      ?? 0,
      timeTaken:  a.timeTaken  ?? 0,
      difficulty: a.difficulty ?? "easy",
    }));

  /* ── Difficulty distribution — last 30 solved days ─────────────────── */

  const diffWindow = solved.slice(0, 30);
  const diffDist   = { easy: 0, medium: 0, hard: 0 };
  diffWindow.forEach((a) => {
    const d = a.difficulty ?? "easy";
    if (diffDist[d] !== undefined) diffDist[d]++;
  });

  /* ── Activity map — 365-day window ─────────────────────────────────── */

  const activityMap = {};
  all.forEach((a) => {
    if (a.date) activityMap[a.date] = a;
  });

  /* ── Return full snapshot ───────────────────────────────────────────── */

  return {
    summary: {
      totalPlayed,
      currentStreak,
      longestStreak,
      bestScore,
      avgScore,
      avgTime,
    },
    weeklyRetention,   // Array<{ weekLabel, rate, solvedDays, totalDays }>
    dowPattern,        // Array<{ day, label, count, rate }>
    scoreTrend,        // Array<{ date, score, timeTaken, difficulty }>
    diffDist,          // { easy, medium, hard }
    activityMap,       // Record<dateStr, activity>
  };
}