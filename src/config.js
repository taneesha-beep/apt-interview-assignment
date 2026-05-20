// centralized config -> reads .env and exposes typed values to the rest of the app.

require("dotenv").config();

module.exports = {
  db: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "realtime_orders",
  },
  cdc: {
    user: process.env.CDC_USER || "cdc_user",
    password: process.env.CDC_PASSWORD || "",
  },
  ws: {
    port: parseInt(process.env.WS_PORT, 10) || 8080,
  },
};
