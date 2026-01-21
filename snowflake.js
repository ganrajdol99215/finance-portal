const snowflake = require('snowflake-sdk');

const connection = snowflake.createConnection({
  account: "SCGDXMY-JK93958",
  username: "GANRAJDOL77",
  password: "YOUR_SNOWFLAKE_PASSWORD",
  database: "FINANCE",
  schema: "RAW",
  warehouse: "ETL_WH",   // or COMPUTE_WH if ETL_WH not created
  role: "ACCOUNTADMIN"
});

connection.connect((err, conn) => {
  if (err) {
    console.error("Snowflake connection failed:", err.message);
  } else {
    console.log("Snowflake connected successfully");
  }
});

function query(sql) {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText: sql,
      complete: (err, stmt, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    });
  });
}

module.exports = { query };
