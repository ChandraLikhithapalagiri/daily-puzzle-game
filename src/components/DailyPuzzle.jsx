import { useState, useEffect } from "react";
import { generateDailyPuzzle } from "../utils/puzzlegenerator";
import { saveDailyActivity } from "../db";

export default function DailyPuzzle({ onComplete }) {
  const [puzzle, setPuzzle] = useState(null);
  const [input, setInput] = useState("");
  const [startTime, setStartTime] = useState(null);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const p = generateDailyPuzzle();
    setPuzzle(p);
  }, []);

  const handleStart = () => {
    if (!startTime) setStartTime(Date.now());
  };

  const handleSubmit = async () => {
    if (!puzzle) return;

    if (parseInt(input) === puzzle.answer) {
      const endTime = Date.now();
      const timeTaken = Math.floor((endTime - startTime) / 1000);
      const score = Math.max(100 - timeTaken, 10);

      setCompleted(true);

      // Save in IndexedDB
      await saveDailyActivity({
        date: puzzle.date,
        score,
        timeTaken,
        difficulty: 2,
        solved: true,
        synced: false
      });

      const user = auth.currentUser;

 if (user) {
  await fetch("http://localhost:5000/sync-activity", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      uid: user.uid,
      name: user.displayName,
      date: puzzle.date,
      score,
      timeTaken,
      difficulty: 2,
      solved: true,
    }),
  });
 }


      // Notify parent
      onComplete({
        date: puzzle.date,
        score,
        timeTaken,
        solved: true
      });
    } else {
      alert("Wrong answer. Try again!");
    }
  };

  if (!puzzle) return null;

  return (
    <div className="p-6 bg-white rounded-xl shadow-lg text-center">
      <h2 className="text-xl font-bold mb-4">Complete the sequence</h2>

      <div className="text-lg mb-4">
        {puzzle.sequence.join(", ")}, ?
      </div>

      <input
        type="number"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onFocus={handleStart}
        className="border p-2 rounded"
      />

      <button
        onClick={handleSubmit}
        className="ml-4 px-4 py-2 bg-blue-600 text-white rounded"
      >
        Submit
      </button>

      {completed && <div className="mt-4 text-green-600">Solved!</div>}
    </div>
  );
}
