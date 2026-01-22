const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");

const db = require("./db");      // RDS (PostgreSQL)
const uploadToS3 = require("./s3"); // S3 uploader

const app = express();
const PORT = 3000;

/* -------------------- MIDDLEWARE -------------------- */
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, "public")));

/* -------------------- ROUTES -------------------- */

// Home page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

// Dashboard page
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "dashboard.html"));
});

// Form submit → RDS → S3
app.post("/submit", async (req, res) => {
  const { pre_risk, on_risk, cusip, isin } = req.body;
  
app.get("/records", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "records.html"));
});
  

  try {
    // 1️⃣ Insert into RDS
    const result = await db.query(
      `INSERT INTO oc_details
       (pre_risk, on_risk, cusip, isin)
       VALUES ($1, $2, $3, $4)
       RETURNING universe_id`,
      [pre_risk, on_risk, cusip, isin]
    );

    const universeId = result.rows[0].universe_id;

    // 2️⃣ Upload to S3 (folder = universe_id)
    await uploadToS3(`${universeId}/pre_risk.csv`, `universe_id,pre_risk\n${universeId},${pre_risk}`);
    await uploadToS3(`${universeId}/on_risk.csv`, `universe_id,on_risk\n${universeId},${on_risk}`);
    await uploadToS3(`${universeId}/cusip.csv`, `universe_id,cusip\n${universeId},${cusip}`);
    await uploadToS3(`${universeId}/isin.csv`, `universe_id,isin\n${universeId},${isin}`);

    res.json({
      status: "success",
      universe_id: universeId
    });

  } catch (err) {
    console.error("Submit error:", err);
    res.status(500).json({ error: "Failed to process request" });
  }
});

app.get("/records", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "records.html"));
});

/* -------------------- API FOR DASHBOARD -------------------- */

// Latest 10 records
app.get("/api/latest", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT * FROM oc_details ORDER BY created_at DESC LIMIT 10"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch data" });
  }
});

// Count by pre_risk
app.get("/api/count-pre-risk", async (req, res) => {
  try {
    const result = await db.query(
      "SELECT pre_risk, COUNT(*) FROM oc_details GROUP BY pre_risk"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch counts" });
  }
});

// Search by CUSIP
app.get("/api/search", async (req, res) => {
  const { cusip } = req.query;
  try {
    const result = await db.query(
      "SELECT * FROM oc_details WHERE cusip = $1",
      [cusip]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
});


/* -------------------- START SERVER -------------------- */

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
