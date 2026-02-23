/**
 * firestoreSync.js
 *
 * Handles all Firestore read/write operations.
 * Replaces all previous Express (localhost:5000) API calls.
 *
 * Collections:
 *   - activities/{uid}/days/{date}   — per-user daily activity
 *   - leaderboard/{uid}              — aggregated score per user
 */

import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";
import { db as firestore } from "../firebase"; // Firestore instance

/**
 * Sync a single activity to Firestore.
 * Uses setDoc with merge:true to avoid overwriting with stale data.
 *
 * @param {string} uid      - Firebase Auth UID
 * @param {object} activity - Full activity object matching our schema
 */
export const syncActivityToFirestore = async (uid, activity) => {
  if (!uid || !activity?.date) {
    throw new Error("syncActivityToFirestore: uid and activity.date are required.");
  }

  const ref = doc(firestore, "activities", uid, "days", activity.date);

  await setDoc(
    ref,
    {
      date: activity.date,
      uid,
      score: activity.score ?? 0,
      timeTaken: activity.timeTaken ?? 0,
      difficulty: activity.difficulty || "easy",
      solved: activity.solved ?? false,
      attempts: activity.attempts ?? 1,
      puzzleSeed: activity.puzzleSeed || "",
      updatedAt: serverTimestamp(),
    },
    { merge: true } // safe upsert — won't overwrite unrelated fields
  );
};

/**
 * Fetch a single activity from Firestore for a given user + date.
 * Returns null if not found.
 */
export const getActivityFromFirestore = async (uid, date) => {
  if (!uid || !date) return null;

  const ref = doc(firestore, "activities", uid, "days", date);
  const snap = await getDoc(ref);

  return snap.exists() ? snap.data() : null;
};

/**
 * Sync multiple unsynced activities to Firestore in parallel.
 * Returns array of successfully synced dates.
 *
 * @param {string} uid         - Firebase Auth UID
 * @param {object[]} activities - Array of local activity objects
 */
export const bulkSyncToFirestore = async (uid, activities) => {
  if (!uid || !activities?.length) return [];

  const results = await Promise.allSettled(
    activities.map((activity) => syncActivityToFirestore(uid, activity))
  );

  const syncedDates = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      syncedDates.push(activities[index].date);
    } else {
      console.warn(
        `[Firestore] Failed to sync activity for date ${activities[index].date}:`,
        result.reason
      );
    }
  });

  return syncedDates;
};

/**
 * Update the leaderboard entry for a user.
 * Only updates if the new score is higher than the existing one.
 *
 * @param {string} uid          - Firebase Auth UID
 * @param {string} displayName  - User's display name
 * @param {number} score        - Score to potentially record
 */
export const updateLeaderboard = async (uid, displayName, score) => {
  if (!uid) return;

  const ref = doc(firestore, "leaderboard", uid);
  const snap = await getDoc(ref);

  const existing = snap.exists() ? snap.data() : null;

  // Only update if this is a new high score
  if (!existing || score > (existing.score ?? 0)) {
    await setDoc(ref, {
      uid,
      name: displayName || "Anonymous",
      score,
      updatedAt: serverTimestamp(),
    });
  }
};

/**
 * Fetch top leaderboard entries.
 *
 * @param {number} topN - Number of entries to fetch (default: 10)
 * @returns {object[]}  - Sorted leaderboard array
 */
export const fetchLeaderboard = async (topN = 10) => {
  const q = query(
    collection(firestore, "leaderboard"),
    orderBy("score", "desc"),
    limit(topN)
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
};
