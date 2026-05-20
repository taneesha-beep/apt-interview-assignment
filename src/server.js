// wires binlog listener and websocket server.

const { start, changes } = require("./binlog-listener");

console.log("starting realtime-orders-cdc service...");

changes.on("change", (evt) => {
  console.log("[change]", JSON.stringify(evt, null, 2));
});

start();
