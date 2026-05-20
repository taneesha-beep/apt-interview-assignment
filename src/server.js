// wires binlog listener and websocket server.

// src/server.js
// Entry point. Wires together the binlog listener and the WebSocket server.

const binlog = require("./binlog-listener");
const ws = require("./ws-server");

console.log("starting realtime-orders-cdc service...");

// For now, still just log changes to the console. The wiring to ws.broadcast
// happens in the next commit.
binlog.changes.on("change", (evt) => {
  console.log("[change]", JSON.stringify(evt, null, 2));
});

ws.start();
binlog.start();
