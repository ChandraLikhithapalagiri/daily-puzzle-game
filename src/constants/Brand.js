/**
 * brand.js  —  Bluestock design tokens
 *
 * Single source of truth for all colours, typography, radius, and shadow values.
 * Every component imports from here. Hex values are NEVER hardcoded elsewhere.
 *
 * Usage:
 *   import { BS, font, radius, shadow } from "../constants/brand";
 *   style={{ color: BS.primary, fontFamily: font.base }}
 */

/* ─── Colour palette ────────────────────────────────────────────────────── */
export const BS = {
  primary:      "#414BEA",   // Bluestock blue — CTA, active tabs, headings
  primaryDark:  "#190482",   // Hover state for primary
  primaryLight: "#D9E2FF",   // Backgrounds, borders, tints
  accent:       "#F05537",   // Warnings, error states, attention
  violet:       "#7752FE",   // Secondary CTA (leaderboard, special actions)
  surface:      "#F6F5F5",   // Page background
  card:         "#FFFFFF",   // Card / panel backgrounds
  border:       "#E8ECFF",   // Card borders
  borderMuted:  "#E0E0E0",   // Neutral border (sign out button)
  rankNum:      "#C4CDE8",   // Leaderboard rank number color
  text:         "#222222",   // Primary text
  textMuted:    "#3D3B40",   // Secondary text, labels
  textSubtle:   "#9CA3AF",   // Tertiary — timestamps, captions
  success:      "#10B981",   // Correct / synced / streak
  successLight: "#ECFDF5",   // Success background tint
  warning:      "#F59E0B",   // Caution states
  warningLight: "#FFFBEB",   // Warning background tint
  error:        "#EF4444",   // Error states
  errorLight:   "#FEF2F2",   // Error background tint
  errorBorder:  "#FCA5A5",   // Error border (red-300)

  // Solve celebration
  solveGrad:    "linear-gradient(135deg, #ECFDF5, #D1FAE5)",
  solveBorder:  "#6EE7B7",   // emerald-300
  solveText:    "#065F46",   // emerald-900
  solveSubtext: "#6EE7B7",   // emerald-300 (stat labels)

  // Difficulty tier colours (used in charts, badges)
  diffEasy:     "#34D399",   // emerald-400
  diffMedium:   "#FBBF24",   // amber-400
  diffHard:     "#F87171",   // red-400
};

/* ─── Difficulty map (for programmatic use) ─────────────────────────────── */
export const DIFF = {
  easy:   { hex: "#34D399", bg: "#ECFDF5", text: "#065F46", label: "Easy"   },
  medium: { hex: "#FBBF24", bg: "#FFFBEB", text: "#78350F", label: "Medium" },
  hard:   { hex: "#F87171", bg: "#FEF2F2", text: "#7F1D1D", label: "Hard"   },
};

/* ─── Typography ────────────────────────────────────────────────────────── */
export const font = {
  base:    "'Poppins', sans-serif",
  mono:    "'Fira Code', 'Courier New', monospace",
};

/* ─── Border radius ─────────────────────────────────────────────────────── */
export const radius = {
  sm:   "6px",
  md:   "10px",
  lg:   "14px",
  xl:   "18px",
  full: "9999px",
};

/* ─── Elevation / shadow ────────────────────────────────────────────────── */
export const shadow = {
  card:  "0 1px 4px rgba(65,75,234,0.08), 0 4px 16px rgba(65,75,234,0.06)",
  float: "0 4px 24px rgba(65,75,234,0.14), 0 1px 6px rgba(65,75,234,0.08)",
  inset: "inset 0 1px 3px rgba(0,0,0,0.06)",
};