const snowflake = require('snowflake-sdk');

const connection = snowflake.createConnection({
  account: "YOUR_ACCOUNT",
  username: "YOUR_USER",
  password: "YOUR_PASSWORD",
  database: "FINANCE",
  schema: "RAW",
  warehouse: "ETL_WH"
});

connection.connect();

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
