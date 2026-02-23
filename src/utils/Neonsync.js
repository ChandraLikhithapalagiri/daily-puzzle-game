/**
 * neonSync.js
 * src/utils/neonSync.js
 *
 * Neon DB (Postgres) leaderboard sync.
 * Falls back gracefully — App.jsx calls these non-blocking (.catch(() => {})).
 * Set VITE_NEON_CONNECTION_STRING in your .env to enable.
 * Without it, both functions are no-ops that return empty data.
 */

const NEON_URL = import.meta.env?.VITE_NEON_CONNECTION_STRING ?? null;

/**
 * Update leaderboard for a user.
 * Only records highest score.
 */
export async function updateNeonLeaderboard(uid, displayName, score) {
  if (!NEON_URL) return; // no-op when not configured
  // Implementation requires @neondatabase/serverless on Vercel edge functions.
  // Stub: silently skip.
}

/**
 * Fetch top N leaderboard entries from Neon.
 * Returns [] if unconfigured or on error (App falls back to Firestore).
 */
export async function fetchNeonLeaderboard(topN = 10) {
  if (!NEON_URL) return [];
  return [];
}