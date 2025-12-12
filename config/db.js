// db.js
const mysql = require("mysql2/promise");
const fs = require("fs");
require("dotenv").config();

let pool;

(async () => {
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      ssl: {
        ca: fs.readFileSync("./ca.pem")
      }
    });

    // Test connection
    const conn = await pool.getConnection();
    console.log("✅ Database Connected Successfully");
    console.log("→ Host:", process.env.DB_HOST);
    console.log("→ Database:", process.env.DB_NAME);
    conn.release();

  } catch (err) {
    console.error("❌ DB Connection Failed:", err);
  }
})();

module.exports = pool;
