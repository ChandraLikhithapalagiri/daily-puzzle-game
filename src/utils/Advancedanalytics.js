/**
 * advancedAnalytics.js
 * src/utils/advancedAnalytics.js
 *
 * Facade over insightsEngine + thin cache layer.
 * DailyPuzzle.jsx only needs bustAnalyticsCache from here.
 */

import { computeInsightsData } from "./insightsengine";

let _cache = null;

/** Call after any DB write to invalidate memo. */
export function bustAnalyticsCache() {
  _cache = null;
}

/** Full insights snapshot, memoised until next bust. */
export async function getInsightsSnapshot() {
  if (!_cache) _cache = await computeInsightsData();
  return _cache;
}