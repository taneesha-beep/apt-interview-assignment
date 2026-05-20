// A small WebSocket server. Accepts client connections, tracks them in a Set,
// and exposes a broadcast() function that sends a JSON payload to everyone.
//
// This module knows nothing about binlogs or MySQL — it just moves messages.

const { WebSocketServer } = require("ws");
const config = require("./config");

// The set of currently connected clients. Using a Set (not an Array) makes
// add/remove O(1) and prevents accidental duplicates.
const clients = new Set();

let wss = null;

function start() {
  wss = new WebSocketServer({ port: config.ws.port });

  wss.on("listening", () => {
    console.log(`[ws] server listening on ws://localhost:${config.ws.port}`);
  });

  wss.on("connection", (ws, req) => {
    clients.add(ws);
    const ip = req.socket.remoteAddress;
    console.log(`[ws] client connected (${ip}); total=${clients.size}`);

    // Send a small hello so the client immediately knows the connection works.
    safeSend(ws, {
      type: "hello",
      message: "connected to realtime-orders feed",
    });

    ws.on("close", () => {
      clients.delete(ws);
      console.log(`[ws] client disconnected; total=${clients.size}`);
    });

    ws.on("error", (err) => {
      console.error("[ws] client error:", err.message);
      clients.delete(ws);
    });
  });

  wss.on("error", (err) => {
    console.error("[ws] server error:", err.message);
  });

  return wss;
}

// Safely send a JSON payload to a single client. Catches errors so a single
// broken connection can't crash the whole process.
function safeSend(ws, payload) {
  try {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  } catch (err) {
    console.error("[ws] send failed:", err.message);
  }
}

// Broadcast a payload to every connected client.
function broadcast(payload) {
  for (const ws of clients) {
    safeSend(ws, payload);
  }
}

module.exports = { start, broadcast, clients };
