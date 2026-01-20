const { Pool } = require('pg');

const pool = new Pool({

  host: "YOUR_RDS_ENDPOINT",
  user: "appuser",
  password: "password",
  database: "appdb",
  port: 5432

});

module.exports = pool;
