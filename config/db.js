const sql = require("mssql");

const dbConfig = {
  server: process.env.SQL_SERVER || "localhost\\SQLEXPRESS",
  database: process.env.SQL_DATABASE || "SistemaTickets",
  authentication: {
    type: "default",
    options: {
      userName: process.env.SQL_USER || "n8n_user",
      password: process.env.SQL_PASSWORD || "N8nSegura123",
    },
  },
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableKeepAlive: true,
    connectionTimeout: 30000,
    requestTimeout: 30000,
    useUTC: false,
  },
};

let pool = null;

async function getConnection() {
  try {
    if (pool) {
      return pool;
    }
    pool = await sql.connect(dbConfig);
    return pool;
  } catch (error) {
    console.error("X Error de conexión SQL:", error);
    throw error;
  }
}

module.exports = { sql, getConnection };
