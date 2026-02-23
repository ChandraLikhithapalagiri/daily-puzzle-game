/**
 * App.jsx — Logic Looper
 *
 * Root shell: Auth gate → sticky header → tab nav → tab content
 * Tabs: Today | Activity | Insights | Achievements
 *
 * All brand tokens from constants/brand.js
 * Sync: Firebase + Neon (parallel, non-blocking)
 * dataKey: incremented on solve → Heatmap + InsightsDashboard reload
 */

import { useEffect, useState, useCallback } from "react";
import { signInWithRedirect, getRedirectResult, signOut } from "firebase/auth";
import { auth, provider }                   from "./firebase";
import DailyPuzzle                          from "./components/DailyPuzzle";
import Heatmap                              from "./components/Heatmap";
import InsightsDashboard                    from "./components/insightsdashboard";
import OnlineBanner                         from "./components/OnlineBanner";
import { updateLeaderboard,
         fetchLeaderboard }                 from "./utils/firestoresync";
import { updateNeonLeaderboard,
         fetchNeonLeaderboard }             from "./utils/Neonsync";
import { syncActivities }                   from "./utils/sync";
import { getAllActivities }                  from "./db";
import { BS, font, radius, shadow }         from "./constants/Brand";

/* ─── Tabs ───────────────────────────────────────────────────────────────── */
const TABS = [
  { id: "puzzle",       label: "Today",        icon: "🧩" },
  { id: "activity",     label: "Activity",     icon: "📅" },
  { id: "insights",     label: "Insights",     icon: "📈" },
  { id: "achievements", label: "Achievements", icon: "🏅" },
];

/* ─── Achievements definition ────────────────────────────────────────────── */
const ACHIEVEMENT_DEFS = [
  { id: "first_solve",    icon: "🌟", title: "First Steps",       desc: "Solve your first puzzle",                        check: (s) => s.totalSolved >= 1          },
  { id: "streak_3",       icon: "🔥", title: "On Fire",           desc: "Reach a 3-day streak",                           check: (s) => s.currentStreak >= 3        },
  { id: "streak_7",       icon: "⚡", title: "Week Warrior",      desc: "Reach a 7-day streak",                           check: (s) => s.currentStreak >= 7        },
  { id: "streak_30",      icon: "💎", title: "Unstoppable",       desc: "Reach a 30-day streak",                          check: (s) => s.currentStreak >= 30       },
  { id: "perfect_score",  icon: "💯", title: "Perfect",           desc: "Score 100 on a puzzle",                          check: (s) => s.bestScore >= 100          },
  { id: "speed_demon",    icon: "⚡", title: "Speed Demon",       desc: "Solve a puzzle in under 15 seconds",             check: (s) => s.fastestTime <= 15         },
  { id: "clean_solver",   icon: "✨", title: "Clean Solver",      desc: "Solve 10 puzzles on the first attempt",          check: (s) => s.cleanSolves >= 10         },
  { id: "hard_mode",      icon: "🧠", title: "Brain Buster",      desc: "Solve a hard-difficulty puzzle",                 check: (s) => s.hardSolved >= 1           },
  { id: "century",        icon: "💫", title: "Century",           desc: "Solve 100 total puzzles",                        check: (s) => s.totalSolved >= 100        },
  { id: "consistent",     icon: "🎯", title: "Consistent",        desc: "Solve puzzles 5 days in a row without hints",    check: (s) => s.noHintStreak >= 5         },
];

/* ─── Achievements panel ────────────────────────────────────────────────── */
function AchievementsPanel({ stats }) {
  const S = {
    panel: {
      background: BS.card, border: `1px solid ${BS.border}`,
      borderRadius: radius.xl, boxShadow: shadow.card,
      padding: "24px", width: "100%",
    },
    title: {
      fontSize: "14px", fontWeight: 700, color: BS.text,
      margin: "0 0 4px", fontFamily: font.base,
    },
    sub: { fontSize: "11px", color: BS.textSubtle, margin: "0 0 20px" },
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
      gap: "10px",
    },
    card: (unlocked) => ({
      display: "flex", alignItems: "center", gap: "12px",
      padding: "12px 14px",
      background:   unlocked ? `linear-gradient(135deg, ${BS.primaryLight}, #EDE9FE)` : BS.surface,
      border:       `1px solid ${unlocked ? BS.primary + "40" : BS.border}`,
      borderRadius: radius.md,
      opacity:      unlocked ? 1 : 0.55,
      transition:   "all 0.2s",
    }),
    icon: (unlocked) => ({
      fontSize: "24px", width: "40px", height: "40px",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: unlocked ? BS.primaryLight : BS.surface,
      borderRadius: radius.sm, flexShrink: 0,
      filter: unlocked ? "none" : "grayscale(1)",
    }),
    badge: {
      fontSize: "9px", fontWeight: 700, color: BS.primary,
      background: BS.primaryLight, borderRadius: radius.full,
      padding: "2px 6px", letterSpacing: "0.05em",
      textTransform: "uppercase", display: "inline-block",
      marginTop: "3px",
    },
  };

  const unlocked = ACHIEVEMENT_DEFS.filter((a) => a.check(stats));
  const total    = ACHIEVEMENT_DEFS.length;

  return (
    <div style={S.panel}>
      <h3 style={S.title}>Achievements</h3>
      <p style={S.sub}>{unlocked.length} / {total} unlocked</p>

      {/* Progress bar */}
      <div style={{
        height: "4px", background: BS.border, borderRadius: "2px",
        marginBottom: "20px", overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: "2px",
          width: `${(unlocked.length / total) * 100}%`,
          background: `linear-gradient(90deg, ${BS.primary}, ${BS.violet})`,
          transition: "width 0.8s ease",
        }} />
      </div>

      <div style={S.grid}>
        {ACHIEVEMENT_DEFS.map((a) => {
          const isUnlocked = a.check(stats);
          return (
            <div key={a.id} style={S.card(isUnlocked)} className="fade-in">
              <div style={S.icon(isUnlocked)}>{a.icon}</div>
              <div>
                <div style={{
                  fontSize: "13px", fontWeight: 600,
                  color: isUnlocked ? BS.text : BS.textSubtle,
                  fontFamily: font.base,
                }}>
                  {a.title}
                </div>
                <div style={{ fontSize: "11px", color: BS.textMuted, lineHeight: 1.4 }}>
                  {a.desc}
                </div>
                {isUnlocked && <span style={S.badge}>Unlocked ✓</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Streak celebration modal ───────────────────────────────────────────── */
function StreakModal({ streak, onClose }) {
  if (!streak) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(26,26,46,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "16px",
      animation: "fadeIn 0.2s ease",
    }}
      onClick={onClose}
    >
      <div style={{
        background: BS.card,
        borderRadius: radius.xxl,
        boxShadow: shadow.float,
        padding: "40px 32px",
        textAlign: "center",
        maxWidth: "320px",
        width: "100%",
        animation: "scaleIn 0.3s ease",
      }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: "56px", marginBottom: "8px" }}>
          {streak >= 30 ? "💎" : streak >= 7 ? "⚡" : "🔥"}
        </div>
        <h2 style={{
          fontSize: "24px", fontWeight: 800, color: BS.text,
          margin: "0 0 6px", fontFamily: font.base,
        }}>
          {streak}-Day Streak!
        </h2>
        <p style={{ fontSize: "13px", color: BS.textMuted, margin: "0 0 24px", lineHeight: 1.5 }}>
          {streak >= 30 ? "You're absolutely unstoppable. 💎"
           : streak >= 7  ? "A full week of consistent solving!"
           : "Keep the momentum going!"}
        </p>
        <button
          onClick={onClose}
          style={{
            display: "block", width: "100%",
            padding: "12px",
            background: `linear-gradient(135deg, ${BS.primary}, ${BS.violet})`,
            color: "#fff", border: "none",
            borderRadius: radius.md,
            fontSize: "14px", fontWeight: 700,
            fontFamily: font.base, cursor: "pointer",
          }}
        >
          Keep it up! 🚀
        </button>
      </div>
    </div>
  );
}

/* ─── Share puzzle button ────────────────────────────────────────────────── */
function ShareButton({ score, streak }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const text = `🧩 Logic Looper — Daily Puzzle\n📅 ${new Date().toLocaleDateString()}\n🏆 Score: ${score ?? "–"} | 🔥 Streak: ${streak ?? 0} days\n\nPlay at: ${window.location.href}`;
    if (navigator.share) {
      try { await navigator.share({ text, url: window.location.href }); }
      catch (_) {}
    } else {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleShare}
      style={{
        display: "flex", alignItems: "center", gap: "6px",
        padding: "9px 18px",
        background: copied ? BS.successLight : BS.surface,
        color: copied ? BS.solveText : BS.textMuted,
        border: `1px solid ${copied ? BS.solveBorder : BS.border}`,
        borderRadius: radius.md,
        fontSize: "12px", fontWeight: 600,
        fontFamily: font.base, cursor: "pointer",
        transition: "all 0.2s",
      }}
    >
      {copied ? "✓ Copied!" : "📤 Share"}
    </button>
  );
}

/* ─── Main App ───────────────────────────────────────────────────────────── */
export default function App() {
  const [user,          setUser]          = useState(null);
  const [authReady,     setAuthReady]     = useState(false);
  const [activeTab,     setActiveTab]     = useState("puzzle");
  const [scores,        setScores]        = useState([]);
  const [loadingScores, setLoadingScores] = useState(false);
  const [dataKey,       setDataKey]       = useState(0);
  const [lastScore,     setLastScore]     = useState(null);
  const [streakModal,   setStreakModal]   = useState(null);
  const [achievStats,   setAchievStats]   = useState({
    totalSolved: 0, currentStreak: 0, bestScore: 0,
    fastestTime: Infinity, cleanSolves: 0, hardSolved: 0,
    noHintStreak: 0,
  });

  /* ── Load achievement stats from Dexie ───────────────────────────────── */
  const loadAchievStats = useCallback(async () => {
    try {
      const all    = await getAllActivities();
      const solved = all.filter((a) => a.solved);
      const totalSolved    = solved.length;
      const bestScore      = Math.max(0, ...solved.map((s) => s.score ?? 0));
      const fastestTime    = solved.length ? Math.min(...solved.map((s) => s.timeTaken ?? 999)) : 999;
      const cleanSolves    = solved.filter((s) => (s.attempts ?? 1) === 1).length;
      const hardSolved     = solved.filter((s) => s.difficulty === "hard").length;

      // Current streak
      const dates = [...new Set(solved.map((s) => s.date))].sort();
      let currentStreak = 0;
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const set = new Set(dates);
      if (set.has(today) || set.has(yesterday)) {
        let cursor = set.has(today) ? today : yesterday;
        while (set.has(cursor)) {
          currentStreak++;
          const d = new Date(cursor); d.setDate(d.getDate() - 1);
          cursor = d.toISOString().slice(0, 10);
        }
      }

      // No-hint streak (consecutive clean solves)
      let noHintStreak = 0, run = 0;
      for (const s of [...solved].reverse()) {
        if ((s.hintsUsed ?? 0) === 0 && (s.attempts ?? 1) === 1) { run++; noHintStreak = Math.max(noHintStreak, run); }
        else run = 0;
      }

      setAchievStats({ totalSolved, currentStreak, bestScore, fastestTime, cleanSolves, hardSolved, noHintStreak });
    } catch (_) {}
  }, []);

  /* ── Auth + sync ─────────────────────────────────────────────────────── */
  useEffect(() => {
    // Handle redirect result first (fires after Google redirects back to app)
    getRedirectResult(auth)
      .then((result) => {
        // result is null if no redirect just happened — that is fine
        if (result?.user && navigator.onLine) syncActivities();
      })
      .catch((err) => {
        // Ignore cancelled-popup / COOP errors — user just closed the tab
        if (err.code !== "auth/cancelled-popup-request" &&
            err.code !== "auth/popup-closed-by-user") {
          console.error("[Auth redirect]", err);
        }
      });

    // Subscribe to ongoing auth state (handles page refresh, logout, etc.)
    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u);
      setAuthReady(true);
      if (u && navigator.onLine) syncActivities();
    });
    return () => unsub();
  }, []);

  useEffect(() => { loadAchievStats(); }, [dataKey, loadAchievStats]);

  const handleReconnect = () => {
    if (auth.currentUser) syncActivities();
  };

  /* ── Handlers ────────────────────────────────────────────────────────── */
  const handleLogin = () => {
    // signInWithRedirect: navigates to Google, then back — no popup, no COOP error
    signInWithRedirect(auth, provider).catch((err) => {
      console.error("[Auth]", err);
    });
  };

  const handleLogout = async () => {
    await signOut(auth);
    setScores([]);
    setActiveTab("puzzle");
  };

  const handlePuzzleComplete = async ({ score }) => {
    setDataKey((k) => k + 1);
    setLastScore(score);
    // Show streak modal if milestone
    const s = achievStats.currentStreak + 1;
    if ([3, 7, 14, 30, 50, 100].includes(s)) setStreakModal(s);

    const u = auth.currentUser;
    if (!u) return;
    updateLeaderboard(u.uid, u.displayName, score).catch(() => {});
    updateNeonLeaderboard(u.uid, u.displayName, score).catch(() => {});
  };

  const handleFetchLeaderboard = async () => {
    setLoadingScores(true);
    try {
      let data = await fetchNeonLeaderboard(10);
      if (!data.length) data = await fetchLeaderboard(10);
      setScores(data);
    } catch (err) {
      console.error("[App] Leaderboard fetch failed:", err);
    } finally {
      setLoadingScores(false);
    }
  };

  /* ─── Splash ─────────────────────────────────────────────────────────── */
  if (!authReady) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex",
        alignItems: "center", justifyContent: "center",
        background: BS.surface, fontFamily: font.base,
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "50%",
            background: `linear-gradient(135deg, ${BS.primary}, ${BS.violet})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
            boxShadow: shadow.glow,
            animation: "pulse 1.5s infinite",
          }}>
            <span style={{ fontSize: "24px" }}>🧩</span>
          </div>
          <p style={{ fontSize: "13px", color: BS.textSubtle }}>Loading Logic Looper…</p>
        </div>
      </div>
    );
  }

  /* ─── Pre-login landing ───────────────────────────────────────────────── */
  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: BS.surface, fontFamily: font.base }}>
        <OnlineBanner onReconnect={handleReconnect} />

        <header style={{
          background: BS.card, padding: "14px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: `1px solid ${BS.border}`,
          boxShadow: shadow.card,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <a
              href="https://bluestock.in"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", textDecoration: "none" }}
            >
              <img
                src="https://bluestock.in/static/assets/logo/logo.webp"
                alt="Bluestock Fintech"
                width="112"
                height="28"
                fetchPriority="high"
                decoding="async"
                style={{ height: "28px", width: "auto", objectFit: "contain" }}
              />
            </a>
            <span style={{ width: "1px", height: "22px", background: BS.border, display: "inline-block" }} />
            <span style={{
              fontSize: "12px", fontWeight: 700,
              color: BS.primary, letterSpacing: "0.06em",
              textTransform: "uppercase", fontFamily: font.base,
            }}>
              Daily Puzzle
            </span>
          </div>
          <button
            onClick={handleLogin}
            style={{
              background: `linear-gradient(135deg, ${BS.primary}, ${BS.violet})`,
              color: "#fff", border: "none",
              borderRadius: radius.md,
              padding: "9px 20px", fontSize: "13px",
              fontWeight: 600, fontFamily: font.base, cursor: "pointer",
            }}
          >
            Sign in with Google
          </button>
        </header>

        <main style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          minHeight: "calc(100vh - 60px)", padding: "24px 16px",
        }}>
          <div className="slide-up" style={{
            maxWidth: "420px", width: "100%",
            background: BS.card, border: `1px solid ${BS.border}`,
            borderRadius: radius.xxl, boxShadow: shadow.float,
            padding: "40px 32px", textAlign: "center",
          }}>
            {/* Logo mark */}
            <div style={{
              width: "64px", height: "64px", borderRadius: "20px",
              background: `linear-gradient(135deg, ${BS.primary}, ${BS.violet})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
              boxShadow: shadow.glow,
            }}>
              <span style={{ fontSize: "28px" }}>🧩</span>
            </div>

            <h1 style={{
              fontSize: "26px", fontWeight: 800, color: BS.text,
              margin: "0 0 8px", fontFamily: font.base, letterSpacing: "-0.02em",
            }}>
              Logic Looper
            </h1>
            <p style={{
              fontSize: "14px", color: BS.textMuted, margin: "0 0 28px", lineHeight: 1.6,
            }}>
              One adaptive puzzle a day. Sharpen your logic, build your streak, track every gain.
            </p>

            {/* Feature pills */}
            <div style={{
              display: "flex", flexWrap: "wrap", gap: "8px",
              justifyContent: "center", marginBottom: "28px",
            }}>
              {[
                "🔥 Streak tracking",
                "🧠 Adaptive difficulty",
                "📊 Performance insights",
                "🏅 Achievements",
                "📴 Works offline",
              ].map((f) => (
                <span key={f} style={{
                  background: BS.primaryLight, color: BS.primary,
                  borderRadius: radius.full, padding: "5px 12px",
                  fontSize: "11px", fontWeight: 600, letterSpacing: "0.01em",
                }}>
                  {f}
                </span>
              ))}
            </div>

            <button
              onClick={handleLogin}
              style={{
                display: "block", width: "100%", padding: "13px",
                background: `linear-gradient(135deg, ${BS.primary}, ${BS.violet})`,
                color: "#fff", border: "none",
                borderRadius: radius.md,
                fontSize: "15px", fontWeight: 700,
                fontFamily: font.base, cursor: "pointer",
                letterSpacing: "0.01em",
                boxShadow: shadow.glow,
              }}
            >
              Sign in with Google →
            </button>

            <p style={{ fontSize: "10px", color: BS.textSubtle, margin: "14px 0 0" }}>
              Free · No ads · Your data stays local
            </p>
          </div>
        </main>
      </div>
    );
  }

  /* ─── Logged-in shell ────────────────────────────────────────────────── */
  return (
    <div style={{
      minHeight: "100vh", background: BS.surface, fontFamily: font.base,
      display: "flex", flexDirection: "column",
    }}>
      <OnlineBanner onReconnect={handleReconnect} />

      {/* Streak modal */}
      <StreakModal streak={streakModal} onClose={() => setStreakModal(null)} />

      {/* ── Sticky header ────────────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 30,
        background: BS.card,
        borderBottom: `1px solid ${BS.primaryLight}`,
        boxShadow: "0 1px 8px rgba(65,75,234,0.08)",
      }}>
        {/* ── Single unified navbar row ── */}
        <div style={{
          width: "100%", padding: "0 20px", height: "54px",
          display: "flex", alignItems: "center",
        }}>

          {/* Logo + divider + Daily Puzzle */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
            <a
              href="https://bluestock.in"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", textDecoration: "none" }}
            >
              <img
                src="https://bluestock.in/static/assets/logo/logo.webp"
                alt="Bluestock Fintech"
                width="112"
                height="28"
                fetchPriority="high"
                decoding="async"
                style={{ height: "28px", width: "auto", objectFit: "contain" }}
              />
            </a>
            <span style={{ width: "1px", height: "22px", background: BS.border, display: "inline-block" }} />
            <span style={{
              fontSize: "12px", fontWeight: 700,
              color: BS.primary, letterSpacing: "0.06em",
              textTransform: "uppercase", fontFamily: font.base,
            }}>
              Daily Puzzle
            </span>
          </div>

          {/* Streak badge */}
          {achievStats.currentStreak > 0 && (
            <span style={{
              background: "#FFF3E0", color: "#E65100",
              borderRadius: radius.full, padding: "2px 8px",
              fontSize: "11px", fontWeight: 700, flexShrink: 0,
              marginLeft: "10px",
            }}>
              🔥 {achievStats.currentStreak}
            </span>
          )}

          {/* Tabs — inline, grow to fill middle */}
          <nav style={{
            display: "flex", alignItems: "stretch", height: "54px",
            flex: 1, marginLeft: "12px",
            borderLeft: `1px solid ${BS.primaryLight}`,
            paddingLeft: "4px", overflowX: "auto",
          }}>
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    position: "relative", height: "54px",
                    padding: "0 13px",
                    fontSize: "12px", fontWeight: active ? 700 : 400,
                    color: active ? BS.primary : BS.textMuted,
                    background: "none", border: "none",
                    cursor: "pointer", fontFamily: font.base,
                    display: "flex", alignItems: "center", gap: "4px",
                    whiteSpace: "nowrap", flexShrink: 0,
                    transition: "color 0.15s",
                  }}
                >
                  <span style={{ fontSize: "13px" }}>{tab.icon}</span>
                  {tab.label}
                  {active && (
                    <span style={{
                      position: "absolute", bottom: 0, left: "6px", right: "6px",
                      height: "2.5px",
                      background: `linear-gradient(90deg, ${BS.primary}, ${BS.violet})`,
                      borderRadius: "2px 2px 0 0",
                    }} />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right: share + avatar + sign out */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            <ShareButton score={lastScore} streak={achievStats.currentStreak} />
            <div style={{
              width: "30px", height: "30px", borderRadius: "50%",
              background: `linear-gradient(135deg, ${BS.primary}, ${BS.violet})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "12px", fontWeight: 700, color: "#fff",
            }}>
              {(user.displayName ?? "U")[0].toUpperCase()}
            </div>
            <button
              onClick={handleLogout}
              style={{
                background: BS.surface, color: BS.textMuted,
                border: `1px solid ${BS.borderMuted}`,
                borderRadius: radius.sm,
                padding: "5px 11px", fontSize: "11px",
                fontFamily: font.base, cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </div>

        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        maxWidth: "720px", margin: "0 auto", width: "100%",
        padding: "24px 16px 56px",
        display: "flex", flexDirection: "column",
        gap: "20px", alignItems: "center",
      }}>

        {/* ── Today tab ──────────────────────────────────────────────── */}
        {activeTab === "puzzle" && (
          <div className="slide-up" style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>

            {/* Motivational streak card */}
            {achievStats.currentStreak > 0 && (
              <div style={{
                width: "100%", maxWidth: "440px",
                background: "linear-gradient(135deg, #FFF8F6, #FFF3E0)",
                border: "1px solid #FFCC80",
                borderRadius: radius.lg, padding: "12px 16px",
                display: "flex", alignItems: "center", gap: "10px",
              }}>
                <span style={{ fontSize: "22px" }}>🔥</span>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#BF360C" }}>
                    {achievStats.currentStreak}-Day Streak!
                  </div>
                  <div style={{ fontSize: "11px", color: "#E64A19" }}>
                    {achievStats.currentStreak >= 7 ? "Incredible — keep it going!" :
                     achievStats.currentStreak >= 3 ? "You're building a great habit!" :
                     "Come back tomorrow to extend your streak!"}
                  </div>
                </div>
              </div>
            )}

            <DailyPuzzle onComplete={handlePuzzleComplete} />

            {/* Leaderboard */}
            <button
              onClick={handleFetchLeaderboard}
              disabled={loadingScores}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "10px 24px",
                background: loadingScores
                  ? BS.primaryLight
                  : `linear-gradient(135deg, ${BS.violet}, ${BS.primary})`,
                color: loadingScores ? BS.primary : "#fff",
                border: "none", borderRadius: radius.md,
                fontSize: "13px", fontWeight: 600,
                fontFamily: font.base,
                cursor: loadingScores ? "not-allowed" : "pointer",
                opacity: loadingScores ? 0.7 : 1,
                boxShadow: shadow.card,
              }}
            >
              🏆 {loadingScores ? "Loading…" : "Leaderboard"}
            </button>

            {scores.length > 0 && (
              <div style={{
                background: BS.card, border: `1px solid ${BS.border}`,
                borderRadius: radius.xl, boxShadow: shadow.card,
                padding: "20px", width: "100%", maxWidth: "440px",
              }}>
                <h3 style={{
                  textAlign: "center", fontSize: "13px", fontWeight: 700,
                  color: BS.text, margin: "0 0 16px",
                }}>
                  🏆 Top Players
                </h3>
                {scores.map((s, i) => (
                  <div key={s.uid || i} style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center", padding: "8px 0",
                    borderBottom: i < scores.length - 1 ? `1px solid ${BS.primaryLight}` : "none",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{
                        width: "20px", textAlign: "center",
                        fontSize: "12px", fontWeight: 700,
                        color: i === 0 ? "#F59E0B" : i === 1 ? "#9CA3AF" : i === 2 ? "#B45309" : BS.rankNum,
                      }}>
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                      </span>
                      <span style={{
                        fontSize: "13px",
                        color: s.uid === user?.uid ? BS.primary : BS.text,
                        fontWeight: s.uid === user?.uid ? 700 : 400,
                      }}>
                        {s.name || "Anonymous"}
                        {s.uid === user?.uid && <span style={{ fontSize: "10px", color: BS.violet, marginLeft: "4px" }}>you</span>}
                      </span>
                    </div>
                    <span style={{
                      fontSize: "13px", fontWeight: 700,
                      color: i === 0 ? "#F59E0B" : BS.text,
                    }}>
                      {s.score}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Activity tab ───────────────────────────────────────────── */}
        {activeTab === "activity" && (
          <div className="slide-up" style={{ width: "100%" }}>
            <Heatmap refreshKey={dataKey} />
          </div>
        )}

        {/* ── Insights tab ───────────────────────────────────────────── */}
        {activeTab === "insights" && (
          <div className="slide-up" style={{ width: "100%" }}>
            <InsightsDashboard refreshKey={dataKey} />
          </div>
        )}

        {/* ── Achievements tab ───────────────────────────────────────── */}
        {activeTab === "achievements" && (
          <div className="slide-up" style={{ width: "100%" }}>
            <AchievementsPanel stats={achievStats} />
          </div>
        )}
      </main>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer style={{
        textAlign: "center", padding: "16px",
        borderTop: `1px solid ${BS.primaryLight}`,
        background: BS.card,
      }}>
        <a
          href="https://bluestock.in"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            color: BS.textMuted, textDecoration: "none", fontSize: "11px",
          }}
        >
          <img
            src="https://bluestock.in/static/assets/logo/logo.webp"
            alt="Bluestock"
            width="56"
            height="14"
            loading="lazy"
            decoding="async"
            style={{ height: "14px", width: "auto", objectFit: "contain" }}
          />
          Bluestock Fintech
        </a>
      </footer>
    </div>
  );
}