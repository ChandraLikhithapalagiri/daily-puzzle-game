import { openDB } from "idb";

const DB_NAME = "dailyPuzzleDB";

export const dbPromise = openDB(DB_NAME, 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains("activity")) {
      db.createObjectStore("activity", { keyPath: "date" });
    }
  },
});

export async function getAllActivities() {
  const db = await openDB("BluestockDB", 1);
  return db.getAll("dailyActivity");
}

export async function saveDailyActivity(data) {
  const db = await dbPromise;
  await db.put("activity", data);
}
