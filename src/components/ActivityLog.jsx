/**
 * ActivityLog.jsx
 * src/components/ActivityLog.jsx
 *
 * Compact activity log — lists all solved sessions newest-first.
 * Accepts refreshKey prop so it reloads after every puzzle solve.
 */

import { useEffect, useState } from "react";
import { getAllActivities } from "../db";
import { BS, font, radius, shadow } from "../constants/Brand";

const DIFF_STYLE = {
  easy:   { bg: "#ECFDF5", color: "#065F46", label: "Easy"   },
  medium: { bg: "#FFFBEB", color: "#78350F", label: "Medium" },
  hard:   { bg: "#FEF2F2", color: "#7F1D1D", label: "Hard"   },
};

export default function ActivityLog({ refreshKey }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await getAllActivities();
      setLogs(data.filter((d) => d.solved));
      setLoading(false);
    })();
  }, [refreshKey]);

  if (loading) {
    return (
      <div style={{
        background: BS.card, border: `1px solid ${BS.border}`,
        borderRadius: radius.xl, padding: "24px", width: "100%",
      }}>
        <div className="skeleton" style={{ height: "14px", width: "40%", marginBottom: "16px" }} />
        {[1,2,3].map((i) => (
          <div key={i} className="skeleton" style={{ height: "40px", marginBottom: "8px" }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{
      background: BS.card, border: `1px solid ${BS.border}`,
      borderRadius: radius.xl, boxShadow: shadow.card,
      padding: "20px", width: "100%", fontFamily: font.base,
    }}>
      <h3 style={{ fontSize: "13px", fontWeight: 700, color: BS.text, margin: "0 0 4px" }}>
        Activity Log
      </h3>
      <p style={{ fontSize: "11px", color: BS.textSubtle, margin: "0 0 16px" }}>
        {logs.length} solved session{logs.length !== 1 ? "s" : ""}
      </p>

      {logs.length === 0 && (
        <p style={{ textAlign: "center", color: BS.textSubtle, fontSize: "13px", padding: "16px 0" }}>
          No solved puzzles yet — play today's puzzle!
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {logs.slice(0, 30).map((log, i) => {
          const ds = DIFF_STYLE[log.difficulty] ?? DIFF_STYLE.easy;
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 12px",
              background: BS.surface, borderRadius: radius.md,
              border: `1px solid ${BS.border}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "13px" }}>📅</span>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: BS.text }}>
                    {log.date}
                  </div>
                  <div style={{ fontSize: "10px", color: BS.textMuted }}>
                    {log.attempts ?? 1} attempt{(log.attempts ?? 1) !== 1 ? "s" : ""} · {log.timeTaken ?? 0}s
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{
                  background: ds.bg, color: ds.color,
                  borderRadius: radius.full, padding: "2px 8px",
                  fontSize: "10px", fontWeight: 600,
                }}>
                  {ds.label}
                </span>
                <span style={{ fontSize: "14px", fontWeight: 800, color: BS.primary }}>
                  {log.score}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {logs.length > 30 && (
        <p style={{ textAlign: "center", fontSize: "11px", color: BS.textSubtle, marginTop: "12px" }}>
          Showing 30 of {logs.length} sessions
        </p>
      )}
    </div>
  );
}