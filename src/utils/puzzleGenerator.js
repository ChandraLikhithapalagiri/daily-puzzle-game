/**
 * puzzleGenerator.js
 *
 * Pure deterministic puzzle generator.
 * Given (date, type, difficulty) → always returns the same puzzle.
 * No Dexie reads. No side effects. No difficulty decisions.
 *
 * Difficulty decisions are owned by difficultyEngine.js.
 * This file only generates puzzles.
 *
 * ─── Sequence Puzzle Types ───────────────────────────────────────────────────
 *
 *  EASY
 *    seq-arithmetic    2, 5, 8, 11, 14, ?       (a + n*d)
 *    seq-geometric     3, 6, 12, 24, 48, ?       (a * r^n)
 *
 *  MEDIUM
 *    seq-squares       1, 4, 9, 16, 25, ?        (n²)
 *    seq-fibonacci     2, 3, 5, 8, 13, ?         (a(n) = a(n-1) + a(n-2))
 *
 *  HARD
 *    seq-alternating   1, -2, 4, -8, 16, ?       (alternating geometric)
 *    seq-polynomial    1, 5, 14, 30, 55, ?        (a + b*n + c*n²)
 *
 * ─── Matrix Puzzle Types ─────────────────────────────────────────────────────
 *
 *  EASY
 *    mat-arithmetic    Each row: arithmetic sequence. Each column: arithmetic sequence.
 *                      Rule: cell(r,c) = base + r*rowStep + c*colStep
 *
 *  MEDIUM
 *    mat-multiplication  Multiplication table offset.
 *                        Rule: cell(r,c) = (r+rowBase) * (c+colBase)
 *
 *  HARD
 *    mat-polynomial    Row and column interact quadratically.
 *                      Rule: cell(r,c) = base + r*rowStep + c*colStep + r*c*mixStep
 *
 * ─── Determinism ─────────────────────────────────────────────────────────────
 * Every parameter (base, step, pattern type selection) is derived from
 * SHA256(date + salt) → integer. Same date → same puzzle, always.
 *
 * ─── Blank cell selection (matrix puzzles) ───────────────────────────────────
 * Cells are removed using a validity check: a cell is only blanked if the
 * remaining visible cells still uniquely determine the pattern. This prevents
 * under-determined puzzles (multiple valid solutions) at all difficulty levels.
 */

import dayjs from "dayjs";
import SHA256 from "crypto-js/sha256";
import { getAdaptiveDifficulty } from "./Difficultyengine";

/* ─── updateUserStats shim ──────────────────────────────────────────────── */
// Kept as no-op so DailyPuzzle.jsx call sites don't need to change.
// Real stats live in difficultyEngine.js / streakEngine.js.
export function updateUserStats(_solved, _timeTaken) {}

/* ─── Seeded random ─────────────────────────────────────────────────────── */

/**
 * Deterministic integer from a seed string.
 * Returns a positive integer derived from SHA256(seedString).
 *
 * @param   {string} seedString
 * @returns {number}
 */
function sr(seedString) {
  const hash = SHA256(seedString).toString();
  return parseInt(hash.substring(0, 8), 16);
}

/**
 * Deterministic integer in range [min, max] inclusive.
 *
 * @param   {string} seed
 * @param   {number} min
 * @param   {number} max
 * @returns {number}
 */
function srRange(seed, min, max) {
  return min + (sr(seed) % (max - min + 1));
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  SEQUENCE PUZZLES                                                           */
/* ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Select which sequence pattern to use for a given date + difficulty.
 * Returns a string key that maps to a generator function.
 *
 * @param   {string} date
 * @param   {"easy"|"medium"|"hard"} difficulty
 * @returns {string}
 */
function pickSequencePattern(date, difficulty) {
  const pick = sr(date + "seqpattern") % 2; // 0 or 1
  const patterns = {
    easy:   ["arithmetic", "geometric"],
    medium: ["squares",    "fibonacci"],
    hard:   ["alternating","polynomial"],
  };
  return patterns[difficulty]?.[pick] ?? "arithmetic";
}

/* ── Arithmetic: a, a+d, a+2d, a+3d … ─────────────────────────────────── */
function genArithmetic(date, difficulty) {
  const ranges = {
    easy:   { baseMin: 1,  baseMax: 10,  stepMin: 2,  stepMax: 6  },
    medium: { baseMin: 5,  baseMax: 30,  stepMin: 4,  stepMax: 12 },
    hard:   { baseMin: 10, baseMax: 50,  stepMin: 7,  stepMax: 20 },
  };
  const r    = ranges[difficulty] ?? ranges.easy;
  const base = srRange(date + "arith_base", r.baseMin, r.baseMax);
  const step = srRange(date + "arith_step", r.stepMin, r.stepMax);

  const terms = Array.from({ length: 5 }, (_, i) => base + i * step);
  return {
    sequence: terms,
    answer:   base + 5 * step,
    hint:     `Arithmetic sequence (+${step} each term)`,
  };
}

/* ── Geometric: a, a*r, a*r², … ────────────────────────────────────────── */
function genGeometric(date, difficulty) {
  const ranges = {
    easy:   { baseMin: 1, baseMax: 4,  ratioMin: 2, ratioMax: 3 },
    medium: { baseMin: 1, baseMax: 5,  ratioMin: 2, ratioMax: 4 },
    hard:   { baseMin: 2, baseMax: 6,  ratioMin: 3, ratioMax: 5 },
  };
  const r     = ranges[difficulty] ?? ranges.easy;
  const base  = srRange(date + "geo_base",  r.baseMin, r.baseMax);
  const ratio = srRange(date + "geo_ratio", r.ratioMin, r.ratioMax);

  const terms = Array.from({ length: 5 }, (_, i) => base * Math.pow(ratio, i));
  return {
    sequence: terms,
    answer:   base * Math.pow(ratio, 5),
    hint:     `Geometric sequence (×${ratio} each term)`,
  };
}

/* ── Squares: n², (n+1)², … ─────────────────────────────────────────────── */
function genSquares(date) {
  // Starting n is seeded so it shifts each day
  const startN = srRange(date + "sq_start", 1, 8);
  const terms  = Array.from({ length: 5 }, (_, i) => Math.pow(startN + i, 2));
  return {
    sequence: terms,
    answer:   Math.pow(startN + 5, 2),
    hint:     `Perfect squares starting from ${startN}²`,
  };
}

/* ── Fibonacci-style: a(n) = a(n-1) + a(n-2) ───────────────────────────── */
function genFibonacci(date) {
  const a0 = srRange(date + "fib_a0", 1, 5);
  const a1 = srRange(date + "fib_a1", 2, 8);
  const terms = [a0, a1];
  for (let i = 2; i < 5; i++) terms.push(terms[i - 1] + terms[i - 2]);
  const answer = terms[3] + terms[4];
  return {
    sequence: terms,
    answer,
    hint:     `Each term = sum of previous two (Fibonacci-style)`,
  };
}

/* ── Alternating geometric: a, -a*r, a*r², -a*r³, … ────────────────────── */
function genAlternating(date) {
  const base  = srRange(date + "alt_base",  2, 5);
  const ratio = srRange(date + "alt_ratio", 2, 3);

  const terms = Array.from({ length: 5 }, (_, i) =>
    Math.pow(-1, i) * base * Math.pow(ratio, i)
  );
  const answer = Math.pow(-1, 5) * base * Math.pow(ratio, 5);
  return {
    sequence: terms,
    answer,
    hint:     `Alternating signs, geometric growth (×${ratio})`,
  };
}

/* ── Polynomial: a + b*n + c*n² ─────────────────────────────────────────── */
function genPolynomial(date) {
  const a = srRange(date + "poly_a", 1,  5);
  const b = srRange(date + "poly_b", 1,  4);
  const c = srRange(date + "poly_c", 1,  3);

  // n is 1-based to avoid trivial first-term = a
  const terms  = Array.from({ length: 5 }, (_, i) => a + b * (i + 1) + c * Math.pow(i + 1, 2));
  const answer = a + b * 6 + c * 36;
  return {
    sequence: terms,
    answer,
    hint:     `Quadratic sequence (a + b×n + c×n²)`,
  };
}

/* ── Main sequence builder ──────────────────────────────────────────────── */

/**
 * Generate a sequence puzzle for the given date and difficulty.
 * Pattern is chosen deterministically from the date.
 *
 * @param   {string} date       — "YYYY-MM-DD"
 * @param   {"easy"|"medium"|"hard"} difficulty
 * @returns {object}            — puzzle object
 */
export function generateSequencePuzzle(date, difficulty) {
  const pattern = pickSequencePattern(date, difficulty);

  let result;
  switch (pattern) {
    case "geometric":   result = genGeometric(date, difficulty);  break;
    case "squares":     result = genSquares(date);                break;
    case "fibonacci":   result = genFibonacci(date);              break;
    case "alternating": result = genAlternating(date);            break;
    case "polynomial":  result = genPolynomial(date);             break;
    case "arithmetic":
    default:            result = genArithmetic(date, difficulty); break;
  }

  return {
    type:       "sequence",
    sequence:   result.sequence,
    answer:     result.answer,
    hint:       result.hint,
    patternKey: pattern,
    difficulty,
    date,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  MATRIX PUZZLES                                                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Pick which matrix pattern to use.
 *
 * @param   {string} date
 * @param   {"easy"|"medium"|"hard"} difficulty
 * @returns {string}
 */
function pickMatrixPattern(date, difficulty) {
  const patterns = {
    easy:   ["arithmetic"],
    medium: ["arithmetic", "multiplication"],
    hard:   ["multiplication", "polynomial"],
  };
  const opts = patterns[difficulty] ?? ["arithmetic"];
  const pick = sr(date + "matpattern") % opts.length;
  return opts[pick];
}

/* ── Arithmetic matrix: cell(r,c) = base + r*rowStep + c*colStep ─────────── */
function buildArithmeticGrid(date) {
  const base    = srRange(date + "mat_base",    2,  10);
  const rowStep = srRange(date + "mat_rowstep", 2,  8);
  const colStep = srRange(date + "mat_colstep", 1,  6);

  const grid = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      grid.push(base + r * rowStep + c * colStep);
    }
  }
  return {
    grid,
    hint: `Row increases by ${rowStep}, column increases by ${colStep}`,
    ruleKey: "arithmetic",
  };
}

/* ── Multiplication matrix: cell(r,c) = (r+rBase) * (c+cBase) ───────────── */
function buildMultiplicationGrid(date) {
  const rBase = srRange(date + "mul_rbase", 1, 5);
  const cBase = srRange(date + "mul_cbase", 1, 5);

  const grid = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      grid.push((r + rBase) * (c + cBase));
    }
  }
  return {
    grid,
    hint: `Multiplication table: row factor ${rBase}–${rBase + 3}, column factor ${cBase}–${cBase + 3}`,
    ruleKey: "multiplication",
  };
}

/* ── Polynomial matrix: cell(r,c) = base + r*rs + c*cs + r*c*ms ─────────── */
function buildPolynomialGrid(date) {
  const base    = srRange(date + "poly_base",  1,  5);
  const rowStep = srRange(date + "poly_rs",    2,  5);
  const colStep = srRange(date + "poly_cs",    1,  4);
  const mixStep = srRange(date + "poly_mix",   1,  3);

  const grid = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      grid.push(base + r * rowStep + c * colStep + r * c * mixStep);
    }
  }
  return {
    grid,
    hint: `Each cell = base + row×${rowStep} + col×${colStep} + row×col×${mixStep}`,
    ruleKey: "polynomial",
  };
}

/* ── Blank cell selection ────────────────────────────────────────────────── */

/**
 * Remove cells from the grid, ensuring the puzzle remains uniquely solvable.
 *
 * Strategy:
 *   For arithmetic and multiplication grids, any 2 cells per row/column
 *   determine the pattern, so we can safely remove cells that are not
 *   the sole visible cell in their row AND column.
 *
 *   We use a greedy approach: try to blank a candidate cell; only blank it
 *   if at least 2 other cells remain visible in both its row and column.
 *   This is conservative but guarantees no ambiguity.
 *
 * @param   {number[]} flatGrid  — 16-element solution array (row-major)
 * @param   {number}   count     — how many cells to blank
 * @param   {string}   date      — for seeded candidate ordering
 * @returns {(number|null)[]}    — puzzle grid with nulls for blanks
 */
function blankCells(flatGrid, count, date) {
  const puzzle  = [...flatGrid];
  const blanked = new Set();

  // Generate a seeded candidate order (shuffle indices deterministically)
  const indices   = Array.from({ length: 16 }, (_, i) => i);
  const shuffled  = indices.sort(
    (a, b) => sr(date + "blank" + a) - sr(date + "blank" + b)
  );

  for (const idx of shuffled) {
    if (blanked.size >= count) break;

    const row = Math.floor(idx / 4);
    const col = idx % 4;

    // Count visible cells in this row and column (excluding idx itself)
    const visibleInRow = indices.filter(
      (i) => Math.floor(i / 4) === row && i !== idx && !blanked.has(i)
    ).length;

    const visibleInCol = indices.filter(
      (i) => i % 4 === col && i !== idx && !blanked.has(i)
    ).length;

    // Only blank if at least 2 others remain visible in both row and column
    if (visibleInRow >= 2 && visibleInCol >= 2) {
      blanked.add(idx);
    }
  }

  // Apply blanks to puzzle grid
  blanked.forEach((idx) => { puzzle[idx] = null; });
  return puzzle;
}

/* ── Main matrix builder ─────────────────────────────────────────────────── */

/**
 * Generate a matrix puzzle for the given date and difficulty.
 *
 * @param   {string} date
 * @param   {"easy"|"medium"|"hard"} difficulty
 * @returns {object}
 */
export function generateMatrixPuzzle(date, difficulty) {
  const pattern = pickMatrixPattern(date, difficulty);

  let built;
  switch (pattern) {
    case "multiplication": built = buildMultiplicationGrid(date); break;
    case "polynomial":     built = buildPolynomialGrid(date);     break;
    case "arithmetic":
    default:               built = buildArithmeticGrid(date);     break;
  }

  // Blank count by difficulty — conservative to guarantee unique solutions
  const blankCount = { easy: 3, medium: 5, hard: 7 }[difficulty] ?? 3;

  const puzzleGrid = blankCells(built.grid, blankCount, date);

  return {
    type:       "matrix",
    grid:       puzzleGrid,
    solution:   built.grid,
    hint:       built.hint,
    patternKey: built.ruleKey,
    difficulty,
    date,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  MAIN ENTRY                                                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Generate today's adaptive daily puzzle.
 *
 * Flow:
 *   1. Ask difficultyEngine for today's recommended type + difficulty
 *   2. Generate the corresponding puzzle deterministically
 *
 * @param   {string} [date] — override date, default = today (for testing)
 * @returns {Promise<object>}
 */
export async function generateDailyPuzzle(date) {
  const today = date || dayjs().format("YYYY-MM-DD");

  const { puzzleType, difficulty } = await getAdaptiveDifficulty();

  if (puzzleType === "sequence") {
    return generateSequencePuzzle(today, difficulty);
  }

  return generateMatrixPuzzle(today, difficulty);
}