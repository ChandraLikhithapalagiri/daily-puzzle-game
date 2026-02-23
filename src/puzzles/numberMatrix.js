function generateMatrixPuzzle(date, difficulty) {
  const today = date || dayjs().format("YYYY-MM-DD");

  const base = seededRandom(today + "base") % 10 + 1;
  const rowStep = (seededRandom(today + "row") % 5) + 1;
  const colStep = (seededRandom(today + "col") % 5) + 1;

  const fullGrid = [];

  for (let r = 0; r < 4; r++) {
    fullGrid[r] = [];
    for (let c = 0; c < 4; c++) {
      fullGrid[r][c] = base + r * colStep + c * rowStep;
    }
  }

  const flatSolution = fullGrid.flat();

  let removeCount = 4;
  if (difficulty === "medium") removeCount = 6;
  if (difficulty === "hard") removeCount = 8;

  const puzzleGrid = [...flatSolution];
  const removedIndexes = [];

  let i = 0;
  while (removedIndexes.length < removeCount) {
    const index = seededRandom(today + "remove" + i) % 16;
    if (!removedIndexes.includes(index)) {
      removedIndexes.push(index);
      puzzleGrid[index] = null;
    }
    i++;
  }

  return {
    type: "matrix",
    grid: puzzleGrid,
    solution: flatSolution,
    difficulty,
    date: today
  };
}
