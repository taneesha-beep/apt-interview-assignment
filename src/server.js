// wires binlog listener and websocket server.

const binlog = require("./binlog-listener");
const ws = require("./ws-server");

console.log("starting realtime-orders-cdc service...");

// The wire: every change event coming out of the binlog becomes a
// broadcast to every connected WebSocket client.
binlog.changes.on("change", (evt) => {
  ws.broadcast(evt);
});

ws.start();
binlog.start();
