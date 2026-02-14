import dayjs from "dayjs";
import SHA256 from "crypto-js/sha256";

const SECRET = "bluestock-secret";

export function generateDailyPuzzle() {
  const today = dayjs().format("YYYY-MM-DD");

  const hash = SHA256(today + SECRET).toString();

  const seed = parseInt(hash.substring(0, 8), 16);

  const base = (seed % 5) + 2; // 2 to 6
  const multiplier = (seed % 3) + 2; // 2 to 4

  const sequence = [];
  let current = base;

  for (let i = 0; i < 4; i++) {
    sequence.push(current);
    current *= multiplier;
  }

  const answer = current;

  return {
    date: today,
    sequence,
    answer
  };
}
