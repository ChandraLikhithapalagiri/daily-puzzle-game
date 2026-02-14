import { useEffect, useState } from "react";
import { signInWithPopup } from "firebase/auth";
import { auth, provider } from "./firebase";
import DailyPuzzle from "./components/DailyPuzzle";
import ActivityLog from "./components/ActivityLog";

function App() {
  const [user, setUser] = useState(null);
  const [scores, setScores] = useState([]);

  // Track logged-in user
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Google Login
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
      alert("Login Successful");
    } catch (error) {
      console.log(error);
    }
  };

  // Save score to Neon (called when puzzle completed)
  const saveScore = async (scoreData) => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      alert("Please login first");
      return;
    }

    await fetch("http://localhost:5000/save-score", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uid: currentUser.uid,
        name: currentUser.displayName,
        score: scoreData.score,
      }),
    });

    alert("Score saved in Neon DB!");
  };

  // Fetch leaderboard
  const fetchScores = async () => {
    const res = await fetch("http://localhost:5000/leaderboard");
    const data = await res.json();
    setScores(data);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">

      <h1 className="text-2xl font-bold">Daily Puzzle Game</h1>

      {/* If NOT logged in */}
      {!user && (
        <button
          onClick={handleLogin}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg"
        >
          Login with Google
        </button>
      )}

      {/* If logged in */}
      {user && (
        <>
          <p className="text-lg font-medium">
            Welcome {user.displayName}
          </p>

          {/* Puzzle */}
          <DailyPuzzle
            onComplete={(data) => {
              console.log("Puzzle completed:", data);
              saveScore(data);
            }}
          />

          {/* Activity Log */}
          <ActivityLog />

          {/* Leaderboard Button */}
          <button
            onClick={fetchScores}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg"
          >
            Show Leaderboard
          </button>
        </>
      )}

      {/* Display Scores */}
      <div className="mt-4">
        {scores.map((s, i) => (
          <p key={i}>
            {s.name} - {s.score}
          </p>
        ))}
      </div>
    </div>
  );
}

export default App;
