const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db');
const upload = require('./s3');
const path = require('path');

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));


// Load UI
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'views/index.html'));
});


// Submit API
app.post("/submit", async (req, res) => {

  try {

    const { pre_risk, on_risk, cusip, isin } = req.body;

    // 1. Insert to RDS
    const result = await db.query(
      `INSERT INTO instrument_master
      (pre_risk, on_risk, cusip, isin)
      VALUES ($1,$2,$3,$4)
      RETURNING universe_id`,
      [pre_risk, on_risk, cusip, isin]
    );

    const id = result.rows[0].universe_id;


    // 2. Upload to S3 in folder = universe id

    await upload(`${id}/pre_risk.csv`,
      `universe_id,pre_risk\n${id},${pre_risk}`);

    await upload(`${id}/on_risk.csv`,
      `universe_id,on_risk\n${id},${on_risk}`);

    await upload(`${id}/cusip.csv`,
      `universe_id,cusip\n${id},${cusip}`);

    await upload(`${id}/isin.csv`,
      `universe_id,isin\n${id},${isin}`);


    res.send(`
      <h3>Saved Successfully</h3>
      <b>Universe ID: ${id}</b>
      <br/><a href="/">Go Back</a>
    `);

  } catch (err) {
    res.send("Error: " + err.message);
  }

});


app.listen(3000, () =>
  console.log("Server running on http://localhost:3000")
);
