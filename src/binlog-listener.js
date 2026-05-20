// connects to MySQL as replication client and emits an event
// for every row change (INSERT, UPDATE, DELETE) on orders table.

const ZongJi = require("zongji");
const EventEmitter = require("events");
const config = require("./config");

const TARGET_DATABASE = config.db.database;
const TARGET_TABLE = "orders";

// We expose a small EventEmitter so the rest of the app can subscribe
// to 'change' events without knowing anything about zongji or MySQL.
const changes = new EventEmitter();

function start() {
  const zongji = new ZongJi({
    host: config.db.host,
    port: config.db.port,
    user: config.cdc.user,
    password: config.cdc.password,
  });

  // Filter: only deliver row-change events, and only for our table.
  // 'includeSchema' restricts to specific databases and tables.
  zongji.on("ready", () => {
    console.log("[binlog] connected and listening for changes");
  });

  zongji.on("binlog", (event) => {
    // zongji fires many event types: rotate, format, tableMap, writeRows,
    // updateRows, deleteRows, etc. We only care about row changes.
    const name = event.getEventName();

    if (
      name !== "writerows" &&
      name !== "updaterows" &&
      name !== "deleterows"
    ) {
      return;
    }

    // Only events for our target table.
    if (
      !event.tableMap[event.tableId] ||
      event.tableMap[event.tableId].parentSchema !== TARGET_DATABASE ||
      event.tableMap[event.tableId].tableName !== TARGET_TABLE
    ) {
      return;
    }

    // Normalize into a clean shape regardless of operation type.
    if (name === "writerows") {
      event.rows.forEach((row) => {
        changes.emit("change", { type: "insert", row });
      });
    } else if (name === "updaterows") {
      event.rows.forEach((pair) => {
        // pair has shape { before: {...}, after: {...} }
        changes.emit("change", {
          type: "update",
          before: pair.before,
          after: pair.after,
        });
      });
    } else if (name === "deleterows") {
      event.rows.forEach((row) => {
        changes.emit("change", { type: "delete", row });
      });
    }
  });

  zongji.on("error", (err) => {
    console.error("[binlog] error:", err.message);
  });

  // Start consuming the binlog.
  // startAtEnd: true means "ignore old changes, only stream new ones from now on."
  // includeEvents lists which raw event types we want zongji to deliver.
  zongji.start({
    startAtEnd: true,
    includeEvents: ["tablemap", "writerows", "updaterows", "deleterows"],
    includeSchema: { [TARGET_DATABASE]: [TARGET_TABLE] },
  });

  return zongji;
}

module.exports = { start, changes };
