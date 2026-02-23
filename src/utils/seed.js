// Generate seed based on date
export const getDailySeed = (date) => {
  const d = date.format("YYYYMMDD");
  return parseInt(d);
};

// Simple pseudo-random generator
export const createPRNG = (seed) => {
  let value = seed;

  return function () {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
};
