/**
 * streakEngine.js
 *
 * Single source of truth for streak calculation.
 * Reads ONLY from Dexie (localDB) — never from localStorage.
 *
 * Two streak values are computed:
 *   currentStreak  — consecutive solved days ending today (or yesterday
 *                    if today is not yet solved — still "alive")
 *   longestStreak  — longest consecutive solved-day run in history
 *
 * Edge cases handled:
 *   - Today not yet solved: streak stays alive (not broken) until tomorrow
 *   - Gap of one day: streak resets to 0
 *   - Empty history: both return 0
 *   - Out-of-order records: sorted before processing
 */

import dayjs from "dayjs";
import { getAllActivities } from "../db";

/**
 * Calculate current and longest streaks from local activity data.
 *
 * @returns {Promise<{ currentStreak: number, longestStreak: number }>}
 */
export const calculateStreaks = async () => {
  const activities = await getAllActivities(); // sorted newest-first

  // Only solved days matter
  const solvedDates = activities
    .filter((a) => a.solved)
    .map((a) => a.date)
    .sort(); // oldest-first for longestStreak pass

  if (solvedDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  /* ── LONGEST STREAK (forward pass) ─────────────────────────────────────── */
  let longestStreak = 1;
  let runLength = 1;

  for (let i = 1; i < solvedDates.length; i++) {
    const prev = dayjs(solvedDates[i - 1]);
    const curr = dayjs(solvedDates[i]);
    const diff = curr.diff(prev, "day");

    if (diff === 1) {
      runLength++;
      if (runLength > longestStreak) longestStreak = runLength;
    } else {
      runLength = 1;
    }
  }

  /* ── CURRENT STREAK (backward from today) ───────────────────────────────── */
  // Build a Set for O(1) lookup
  const solvedSet = new Set(solvedDates);

  const today = dayjs().format("YYYY-MM-DD");
  const yesterday = dayjs().subtract(1, "day").format("YYYY-MM-DD");

  // Streak is alive if today OR yesterday is solved.
  // If neither is solved, streak is 0 regardless of older history.
  const startDate = solvedSet.has(today)
    ? today
    : solvedSet.has(yesterday)
    ? yesterday
    : null;

  if (!startDate) {
    return { currentStreak: 0, longestStreak };
  }

  let currentStreak = 0;
  let cursor = dayjs(startDate);

  while (solvedSet.has(cursor.format("YYYY-MM-DD"))) {
    currentStreak++;
    cursor = cursor.subtract(1, "day");
  }

  return { currentStreak, longestStreak };
};