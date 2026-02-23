/**
 * sync.js
 *
 * Background sync utility.
 * Called on app load and whenever the browser comes back online.
 *
 * Strategy:
 *   1. Read all unsynced activities from Dexie (synced = 0).
 *   2. Get current Firebase Auth user.
 *   3. Push to Firestore via bulkSyncToFirestore().
 *   4. Mark successfully synced activities as synced = 1 in Dexie.
 */

import { auth } from "../firebase";
import { getUnsyncedActivities, markActivitiesSynced } from "../db";
import { bulkSyncToFirestore } from "./firestoreSync";

/**
 * Sync all pending local activities to Firestore.
 * Safe to call multiple times — idempotent due to setDoc merge:true.
 */
export const syncActivities = async () => {
  try {
    const user = auth.currentUser;

    if (!user) {
      // Not logged in — nothing to sync, silently skip
      return;
    }

    const unsynced = await getUnsyncedActivities();

    if (!unsynced.length) {
      return;
    }

    console.log(`[Sync] Found ${unsynced.length} unsynced activities. Uploading...`);

    // Attach uid to each activity before syncing
    const activitiesWithUID = unsynced.map((a) => ({
      ...a,
      uid: user.uid,
    }));

    const syncedDates = await bulkSyncToFirestore(user.uid, activitiesWithUID);

    if (syncedDates.length > 0) {
      await markActivitiesSynced(syncedDates);
      console.log(`[Sync] Successfully synced ${syncedDates.length} activities.`);
    }

    if (syncedDates.length < unsynced.length) {
      console.warn(
        `[Sync] ${unsynced.length - syncedDates.length} activities failed to sync. Will retry next time.`
      );
    }
  } catch (error) {
    // Non-fatal — local data is safe in Dexie, will retry on next load/online event
    console.warn("[Sync] Sync skipped:", error.message);
  }
};
