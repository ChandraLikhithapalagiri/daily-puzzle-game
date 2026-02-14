const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

app.get("/", (req, res) => {
  res.send("Server running");
});
app.post("/save-score", async (req, res) => {
  const { uid, name, score } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO scores (uid, name, score) VALUES ($1, $2, $3) RETURNING *",
      [uid, name, score]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.get("/leaderboard", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM scores ORDER BY score DESC"
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/sync-activity", async (req, res) => {
  const { uid, name, date, score, timeTaken, difficulty, solved } = req.body;

  try {
    await pool.query(
      `INSERT INTO activity (uid, name, date, score, time_taken, difficulty, solved)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [uid, name, date, score, timeTaken, difficulty, solved]
    );

    res.json({ success: true });
  } catch (err) {
    console.log(err);
    res.status(500).send("Error saving activity");
  }
});


app.listen(5000, () => {
  console.log("Server started on port 5000");
});
 