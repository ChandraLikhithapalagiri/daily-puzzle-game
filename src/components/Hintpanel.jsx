/**
 * HintPanel.jsx
 * src/components/HintPanel.jsx
 *
 * Hint system UI — rendered inside DailyPuzzle when puzzle is not yet solved.
 *
 * Props:
 *   date         — "YYYY-MM-DD"
 *   difficulty   — "easy"|"medium"|"hard"
 *   budget       — total hints allowed (from hintEngine.computeHintBudget)
 *   hintsUsed    — hints consumed so far this session
 *   onUseHint    — callback({ level }) — called when user taps "Show hint"
 *   hintText     — current hint string (null until first hint)
 *   puzzleStatus — "idle"|"inProgress"|"solved" — hidden when solved
 */

import { BS, font, radius } from "../constants/Brand";

const LEVEL_LABELS = ["Concept", "Direction", "Proximity", "Bracket"];

export default function HintPanel({
  budget, hintsUsed, onUseHint, hintText, puzzleStatus,
}) {
  if (puzzleStatus === "solved" || budget === 0) return null;

  const remaining  = budget - hintsUsed;
  const nextLevel  = hintsUsed + 1;
  const hasUsed    = hintsUsed > 0;
  const canUseMore = remaining > 0;

  return (
    <div style={{
      background:   BS.primaryLight,
      border:       `1px solid ${BS.primary}30`,
      borderRadius: radius.lg,
      padding:      "14px 16px",
      fontFamily:   font.base,
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "14px" }}>💡</span>
          <span style={{ fontSize: "11px", fontWeight: 700, color: BS.primaryDark, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Hints
          </span>
        </div>
        {/* Pip indicators */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {Array.from({ length: budget }).map((_, i) => (
            <span key={i} style={{
              width: "7px", height: "7px", borderRadius: "50%",
              background: i < hintsUsed ? BS.textSubtle : BS.primary,
              opacity:    i < hintsUsed ? 0.3 : 1,
              display:    "inline-block",
            }} />
          ))}
          <span style={{ fontSize: "10px", color: BS.textMuted, marginLeft: "6px" }}>
            {remaining} left
          </span>
        </div>
      </div>

      {/* Current hint text */}
      {hasUsed && hintText && (
        <div style={{
          background:  "#fff",
          borderLeft:  `3px solid ${BS.primary}`,
          borderRadius:`0 ${radius.sm} ${radius.sm} 0`,
          padding:     "8px 12px",
          marginBottom:"10px",
          fontSize:    "13px",
          lineHeight:  1.5,
          color:       BS.text,
        }}>
          <span style={{ fontSize: "10px", fontWeight: 700, color: BS.primary, textTransform: "uppercase", letterSpacing: "0.05em", marginRight: "6px" }}>
            {LEVEL_LABELS[(hintsUsed - 1)] ?? `Hint ${hintsUsed}`}
          </span>
          {hintText}
        </div>
      )}

      {/* Button or exhausted message */}
      {canUseMore ? (
        <button
          onClick={() => onUseHint({ level: nextLevel })}
          style={{
            display:      "block",
            width:        "100%",
            padding:      "9px",
            background:   BS.primary,
            color:        "#fff",
            border:       "none",
            borderRadius: radius.md,
            fontSize:     "12px",
            fontWeight:   600,
            fontFamily:   font.base,
            cursor:       "pointer",
            transition:   "opacity 0.15s",
            letterSpacing:"0.02em",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          {hasUsed
            ? `Next hint — ${LEVEL_LABELS[nextLevel - 1] ?? `Level ${nextLevel}`}`
            : "Show hint"}
        </button>
      ) : (
        <p style={{ textAlign: "center", fontSize: "11px", color: BS.textMuted, margin: 0 }}>
          All hints used for today's puzzle.
        </p>
      )}

      <p style={{ textAlign: "center", fontSize: "10px", color: BS.textSubtle, margin: "8px 0 0", opacity: 0.7 }}>
        Hint usage is tracked in your performance analytics.
      </p>
    </div>
  );
}