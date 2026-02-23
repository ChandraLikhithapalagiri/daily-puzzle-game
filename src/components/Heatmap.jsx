/**
 * Heatmap.jsx — "Am I showing up?" Retention Visualization
 *
 * All data from Dexie via Retentionengine.js. Offline-first.
 * Reloads via refreshKey prop whenever a puzzle is completed.
 *
 * Sections:
 *   1. Summary stats bar
 *   2. 365-day activity heatmap
 *   3. Weekly retention (8 weeks)
 *   4. Day-of-week pattern
 *   5. Score trend sparkline (last 30 sessions)
 *   6. Difficulty distribution
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import dayjs from "dayjs";
import { computeRetentionData, computeIntensity } from "../utils/Retentionengine";
import { BS, font, radius, shadow } from "../constants/Brand";

/* ─── Intensity colours ──────────────────────────────────────────────────── */
const INTENSITY_COLOR = [
  "#E4E8FF", // 0 — no activity
  "#93C5FD", // 1 — easy, slow
  "#60A5FA", // 2 — easy fast / medium slow
  "#414BEA", // 3 — medium fast / hard slow
  "#190482", // 4 — peak (hard + fast)
];

function weekBarColor(rate) {
  if (rate >= 0.85) return BS.primary;
  if (rate >= 0.57) return "#60A5FA";
  if (rate >= 0.28) return "#FBBF24";
  return "#FCA5A5";
}

const DIFF_COLOR = {
  easy:   { bg: "#ECFDF5", color: "#065F46" },
  medium: { bg: "#FFFBEB", color: "#78350F" },
  hard:   { bg: "#FEF2F2", color: "#7F1D1D" },
};

/* ─── Shared primitives ──────────────────────────────────────────────────── */
function Panel({ children }) {
  return (
    <div style={{
      background: BS.card, border: `1px solid ${BS.border}`,
      borderRadius: radius.xl, boxShadow: shadow.card,
      padding: "20px 20px 24px",
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <h3 style={{
        fontSize: "11px", fontWeight: 700, color: BS.textMuted,
        textTransform: "uppercase", letterSpacing: "0.08em",
        margin: 0, fontFamily: font.base,
      }}>
        {children}
      </h3>
      <div style={{
        height: "2px", width: "24px",
        background: `linear-gradient(90deg, ${BS.primary}, ${BS.violet})`,
        borderRadius: "1px", marginTop: "5px",
      }} />
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "14px 12px",
      background: accent ? BS.primaryLight : BS.surface,
      border: `1px solid ${accent ? BS.primary + "40" : BS.border}`,
      borderRadius: radius.lg, minWidth: "80px", flex: 1,
    }}>
      <span style={{
        fontSize: "22px", fontWeight: 800,
        color: accent ? BS.primary : BS.text, lineHeight: 1,
        fontFamily: font.base,
      }}>
        {value}
      </span>
      {sub && (
        <span style={{ fontSize: "10px", color: BS.textSubtle, marginTop: "2px" }}>
          {sub}
        </span>
      )}
      <span style={{
        fontSize: "10px", color: BS.textMuted, marginTop: "4px",
        textAlign: "center", lineHeight: 1.3,
      }}>
        {label}
      </span>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export default function Heatmap({ refreshKey }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      setData(await computeRetentionData());
    } catch (err) {
      console.error("[Heatmap]", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData, refreshKey]);

  const days365 = useMemo(() => {
    const today = dayjs();
    return Array.from({ length: 365 }, (_, i) => today.subtract(364 - i, "day"));
  }, []);

  /* ── Loading skeleton ─────────────────────────────────────────────── */
  if (loading || !data) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", gap: "12px", width: "100%",
      }}>
        {[120, 200, 100, 80, 100, 80].map((h, i) => (
          <div key={i} className="skeleton" style={{ height: `${h}px`, borderRadius: radius.xl }} />
        ))}
      </div>
    );
  }

  const { summary, weeklyRetention, dowPattern, scoreTrend, diffDist, activityMap } = data;
  const trendScores  = scoreTrend.map((p) => p.score);
  const trendMin     = trendScores.length ? Math.max(0,   Math.min(...trendScores) - 5) : 0;
  const trendMax     = trendScores.length ? Math.min(100, Math.max(...trendScores) + 5) : 100;
  const trendRange   = trendMax - trendMin || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}
         className="stagger">

      {/* ── 1. Summary stats ─────────────────────────────────────────── */}
      <Panel>
        <SectionTitle>Your Stats</SectionTitle>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          <StatCard label="Days Played"    value={summary.totalPlayed}              accent />
          <StatCard label="Current Streak" value={summary.currentStreak} sub="🔥 days" accent={summary.currentStreak > 0} />
          <StatCard label="Longest Streak" value={summary.longestStreak} sub="🏆 days" />
          <StatCard label="Best Score"     value={summary.bestScore} />
          <StatCard label="Avg Score"      value={summary.avgScore} />
          <StatCard label="Avg Time"       value={`${summary.avgTime}s`} />
        </div>
      </Panel>

      {/* ── 2. Activity heatmap ───────────────────────────────────────── */}
      <Panel>
        <SectionTitle>Activity — Last 365 Days</SectionTitle>
        <div style={{ overflowX: "auto", paddingBottom: "4px" }}>
          <div style={{
            display: "grid",
            gridTemplateRows: "repeat(7, 12px)",
            gridAutoFlow: "column",
            gap: "3px",
            width: "max-content",
          }}>
            {days365.map((d, i) => {
              const dateStr = d.format("YYYY-MM-DD");
              const entry   = activityMap[dateStr];
              const level   = computeIntensity(entry);
              const tooltip = entry?.solved
                ? `${dateStr} · Score ${entry.score} · ${entry.timeTaken}s · ${entry.difficulty}`
                : `${dateStr} · not played`;
              return (
                <div
                  key={i}
                  title={tooltip}
                  style={{
                    width: "12px", height: "12px", borderRadius: "3px",
                    background: INTENSITY_COLOR[level],
                    cursor: "default",
                    transition: "transform 0.1s",
                  }}
                  onMouseEnter={(e) => (e.target.style.transform = "scale(1.3)")}
                  onMouseLeave={(e) => (e.target.style.transform = "scale(1)")}
                />
              );
            })}
          </div>
        </div>
        {/* Legend */}
        <div style={{
          display: "flex", alignItems: "center", gap: "6px",
          marginTop: "8px", fontSize: "10px", color: BS.textSubtle,
        }}>
          <span>Less</span>
          {INTENSITY_COLOR.map((c, i) => (
            <div key={i} style={{ width: "12px", height: "12px", borderRadius: "3px", background: c }} />
          ))}
          <span>More</span>
          <span style={{ marginLeft: "8px", color: BS.border }}>· intensity = difficulty × speed</span>
        </div>
      </Panel>

      {/* ── 3. Weekly retention ───────────────────────────────────────── */}
      <Panel>
        <SectionTitle>Weekly Retention — Last 8 Weeks</SectionTitle>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "80px" }}>
          {weeklyRetention.map((w, i) => (
            <div key={i} style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", gap: "4px",
            }}>
              <div style={{ width: "100%", height: "56px", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                <div
                  title={`${w.weekLabel}: ${w.solvedDays}/${w.totalDays} days`}
                  style={{
                    width: "100%", borderRadius: "4px 4px 0 0",
                    background: weekBarColor(w.rate),
                    height: `${Math.max(w.rate * 56, 3)}px`,
                    transition: "height 0.5s ease",
                  }}
                />
              </div>
              <span style={{ fontSize: "8px", color: BS.textSubtle, textAlign: "center" }}>
                {w.weekLabel}
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: "12px", marginTop: "8px", flexWrap: "wrap" }}>
          {[
            { color: BS.primary, label: "≥6/7 days" },
            { color: "#60A5FA",  label: "4–5/7" },
            { color: "#FBBF24",  label: "2–3/7" },
            { color: "#FCA5A5",  label: "0–1/7" },
          ].map(({ color, label }) => (
            <span key={label} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: BS.textMuted }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: color, display: "inline-block" }} />
              {label}
            </span>
          ))}
        </div>
      </Panel>

      {/* ── 4. Day-of-week pattern ────────────────────────────────────── */}
      <Panel>
        <SectionTitle>Day-of-Week Pattern</SectionTitle>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "64px" }}>
          {dowPattern.map((d) => (
            <div key={d.day} style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", gap: "4px",
            }}>
              <div style={{ width: "100%", height: "40px", display: "flex", alignItems: "flex-end" }}>
                <div
                  title={`${d.label}: ${d.count} solves`}
                  style={{
                    width: "100%", borderRadius: "4px 4px 0 0",
                    background: BS.violet + "CC",
                    height: `${Math.max(d.rate * 40, d.count > 0 ? 4 : 0)}px`,
                    transition: "height 0.4s ease",
                  }}
                />
              </div>
              <span style={{ fontSize: "9px", color: BS.textSubtle }}>{d.label}</span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: "10px", color: BS.textSubtle, margin: "6px 0 0" }}>
          Height = relative solve frequency across the week.
        </p>
      </Panel>

      {/* ── 5. Score trend ────────────────────────────────────────────── */}
      {scoreTrend.length >= 3 && (
        <Panel>
          <SectionTitle>Score Trend — Last {scoreTrend.length} Sessions</SectionTitle>
          <div style={{ position: "relative", height: "64px", display: "flex", alignItems: "flex-end", gap: "2px" }}>
            {scoreTrend.map((point, i) => {
              const heightPct = ((point.score - trendMin) / trendRange) * 100;
              const color =
                point.difficulty === "hard"   ? "#F87171" :
                point.difficulty === "medium" ? "#FBBF24" : "#34D399";
              return (
                <div
                  key={i}
                  title={`${point.date} · Score ${point.score} · ${point.timeTaken}s`}
                  style={{
                    flex: 1, borderRadius: "3px 3px 0 0",
                    background: color,
                    height: `${Math.max(heightPct, 4)}%`,
                    minWidth: "4px",
                    transition: "height 0.3s ease",
                  }}
                />
              );
            })}
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between",
            fontSize: "10px", color: BS.textSubtle, marginTop: "4px",
          }}>
            <span>{scoreTrend[0]?.date}</span>
            <span>{scoreTrend[scoreTrend.length - 1]?.date}</span>
          </div>
          <div style={{ display: "flex", gap: "12px", marginTop: "6px" }}>
            {[
              { color: "#34D399", label: "Easy"   },
              { color: "#FBBF24", label: "Medium" },
              { color: "#F87171", label: "Hard"   },
            ].map(({ color, label }) => (
              <span key={label} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: BS.textMuted }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: color, display: "inline-block" }} />
                {label}
              </span>
            ))}
          </div>
        </Panel>
      )}

      {/* ── 6. Difficulty distribution ────────────────────────────────── */}
      {summary.totalPlayed > 0 && (
        <Panel>
          <SectionTitle>Difficulty Split — Last 30 Sessions</SectionTitle>
          {["easy", "medium", "hard"].map((d) => {
            const count = diffDist[d] ?? 0;
            const total = (diffDist.easy + diffDist.medium + diffDist.hard) || 1;
            const pct   = Math.round((count / total) * 100);
            const dc    = DIFF_COLOR[d];
            return (
              <div key={d} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                <span style={{
                  background: dc.bg, color: dc.color,
                  borderRadius: radius.full, padding: "2px 8px",
                  fontSize: "10px", fontWeight: 700,
                  textTransform: "capitalize", minWidth: "52px", textAlign: "center",
                }}>
                  {d}
                </span>
                <div style={{
                  flex: 1, height: "8px", background: BS.border,
                  borderRadius: "4px", overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%", borderRadius: "4px",
                    background: d === "hard" ? "#F87171" : d === "medium" ? "#FBBF24" : "#34D399",
                    width: `${pct}%`, transition: "width 0.6s ease",
                  }} />
                </div>
                <span style={{ fontSize: "10px", color: BS.textMuted, minWidth: "32px", textAlign: "right" }}>
                  {count}d
                </span>
              </div>
            );
          })}
        </Panel>
      )}

      {summary.totalPlayed === 0 && (
        <Panel>
          <p style={{ textAlign: "center", color: BS.textSubtle, fontSize: "13px", padding: "24px 0" }}>
            No activity yet — solve your first puzzle to see your stats!
          </p>
        </Panel>
      )}
    </div>
  );
}