const { Pool } = require('pg');

const pool = new Pool({

  host: "database-1.cq72oge0kzty.us-east-1.rds.amazonaws.com",
  user: "ganraj",
  password: "9921569869",
  database: "finance",
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool;
