export const validateGrid = (userGrid, solutionGrid) => {
  let isComplete = true;
  let errors = [];

  for (let i = 0; i < solutionGrid.length; i++) {
    for (let j = 0; j < solutionGrid[i].length; j++) {
      if (userGrid[i][j] !== solutionGrid[i][j]) {
        isComplete = false;
        errors.push({ row: i, col: j });
      }
    }
  }

  return { isComplete, errors };
};
