import { useEffect, useState } from "react";
import { getAllActivities } from "../db";

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    async function load() {
      const data = await getAllActivities();
      setLogs(data);
    }
    load();
  }, []);

  return (
    <div className="mt-6 p-4 bg-gray-100 rounded">
      <h3 className="font-bold mb-2">Daily Activity Log</h3>

      {logs.map((log, i) => (
        <div key={i} className="text-sm">
          📅 {log.date} — Score: {log.score} — {log.solved ? "Solved" : "Not Solved"}
        </div>
      ))}
    </div>
  );
}
