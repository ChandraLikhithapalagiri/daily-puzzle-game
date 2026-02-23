import Dexie from "dexie";

/**
 * LOCAL DATABASE — Dexie (IndexedDB)
 *
 * Canonical activity schema:
 * {
 *   date:        string  — "YYYY-MM-DD"  ← PRIMARY KEY (always string)
 *   uid:         string  — Firebase Auth UID
 *   score:       number
 *   timeTaken:   number  — seconds elapsed
 *   difficulty:  string  — "easy" | "medium" | "hard"
 *   solved:      boolean
 *   attempts:    number  — total submit attempts (including failures)
 *   puzzleSeed:  string  — seed used to generate puzzle (date-based)
 *   synced:      number  — 0 = not synced to Firestore, 1 = synced
 *                          (integer — Dexie cannot reliably index booleans)
 *   createdAt:   number  — Unix ms timestamp of first save
 * }
 *
 * VERSION HISTORY:
 *   v1/v2 — original schema (synced stored as boolean, no uid/attempts)
 *   v3    — standardized schema (synced as 0/1, added uid/attempts/etc.)
 *   v4    — ONE-TIME MIGRATION: clears all stale records saved with old
 *            boolean `synced` values that break IDBKeyRange queries.
 *
 * WHY THE CLEAR IS NECESSARY:
 *   Old records had `synced: false` (boolean). Dexie's IndexedDB layer uses
 *   IDBKeyRange under the hood. IDBKeyRange.only(0) does NOT match boolean
 *   false — they are different types in IndexedDB. This caused:
 *     - getUnsyncedActivities() to always return [] (missed unsynced records)
 *     - Old stale solved=true records persisting and triggering the
 *       "already solved" false-positive bug on fresh logins.
 *   The migration clears the table once. Users re-sync from Firestore
 *   on next login if they have cloud data.
 */

export const localDB = new Dexie("DailyPuzzleDB");

// All prior versions must be declared so Dexie can walk the upgrade path.
localDB.version(1).stores({
  activities: "date, score, timeTaken, difficulty, solved, synced",
});
localDB.version(2).stores({
  activities: "date, score, timeTaken, difficulty, solved, synced",
});
localDB.version(3).stores({
  activities: "date, uid, synced",
});
localDB.version(4)
  .stores({
    activities: "date, uid, synced",
  })
  .upgrade((tx) => {
    // Wipe all records that may have corrupt field types from v1/v2.
    // This is a one-time cost. Fresh records written after this point
    // will always use the correct integer synced value.
    console.log("[DB v4] Clearing stale activity records from old schema.");
    return tx.table("activities").clear();
  });

/* ─────────────────────────────────────────────────────────────────────────── */
/*  WRITE                                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Save (insert or overwrite) a daily activity record.
 * This is an UPSERT — pass the full intended state of the record.
 * createdAt is NEVER overwritten once set.
 *
 * @param   {object} activity
 * @returns {object} The normalized record that was actually written
 */
export const saveDailyActivity = async (activity) => {
  if (!activity.date || typeof activity.date !== "string") {
    throw new Error("[DB] saveDailyActivity: `date` must be a non-empty string.");
  }

  // Read existing so we can preserve immutable fields (createdAt)
  // and avoid accidentally resetting fields not included in the patch.
  const existing = await localDB.activities.get(activity.date);

  const record = {
    date:       String(activity.date),
    uid:        activity.uid        ?? existing?.uid        ?? "",
    score:      activity.score      ?? existing?.score      ?? 0,
    timeTaken:  activity.timeTaken  ?? existing?.timeTaken  ?? 0,
    difficulty: activity.difficulty ?? existing?.difficulty ?? "easy",
    solved:     activity.solved     ?? existing?.solved     ?? false,
    attempts:   activity.attempts   ?? existing?.attempts   ?? 1,
    puzzleSeed: activity.puzzleSeed ?? existing?.puzzleSeed ?? "",
    synced:     ((activity.synced ?? existing?.synced ?? 0) ? 1 : 0),
    createdAt:  existing?.createdAt ?? activity.createdAt ?? Date.now(),
  };

  await localDB.activities.put(record);
  return record;
};

/**
 * Apply a partial update to an existing activity.
 * Safer than saveDailyActivity when you only need to change one or two fields.
 * No-op if the record does not exist.
 *
 * @param {string} date
 * @param {object} patch — only the fields to change
 */
export const patchActivity = async (date, patch) => {
  if (!date) return;
  await localDB.activities.update(String(date), patch);
};

/* ─────────────────────────────────────────────────────────────────────────── */
/*  READ                                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * Look up today's activity by date string.
 * Uses direct primary-key access (.get) — O(1), no full-table scan.
 *
 * @param   {string}        date — "YYYY-MM-DD"
 * @returns {object|null}
 */
export const getActivityByDate = async (date) => {
  if (!date || typeof date !== "string") return null;
  return (await localDB.activities.get(String(date))) ?? null;
};

/**
 * Return all activities, sorted newest-first.
 *
 * @returns {object[]}
 */
export const getAllActivities = async () => {
  const all = await localDB.activities.toArray();
  return all.sort((a, b) => (b.date > a.date ? 1 : -1));
};

/**
 * Return only activities not yet uploaded to Firestore (synced === 0).
 * Relies on integer index — records must use 0/1, not true/false.
 *
 * @returns {object[]}
 */
export const getUnsyncedActivities = async () => {
  return await localDB.activities.where("synced").equals(0).toArray();
};

/**
 * Mark the given dates as synced in Dexie (synced = 1).
 *
 * @param {string[]} dates
 */
export const markActivitiesSynced = async (dates) => {
  await Promise.all(
    dates.map((date) => localDB.activities.update(String(date), { synced: 1 }))
  );
};

/**
 * Increment the attempt counter for a given date.
 * Only updates — does NOT create a new record on its own.
 * A record is created only when a puzzle is successfully solved.
 *
 * @param {string} date
 */
export const incrementAttempts = async (date) => {
  if (!date) return;
  const existing = await getActivityByDate(date);
  if (existing) {
    await patchActivity(date, { attempts: (existing.attempts ?? 0) + 1 });
  }
};

/**
 * Return the N most recent SOLVED activities for streak/difficulty logic.
 * Sorted newest-first.
 *
 * @param   {number}   n
 * @returns {object[]}
 */
export const getRecentSolvedActivities = async (n = 7) => {
  const all = await getAllActivities();
  return all.filter((a) => a.solved).slice(0, n);
};