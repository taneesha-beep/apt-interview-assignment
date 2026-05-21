# Real-time Order Updates (MySQL CDC → WebSockets)

A backend service that streams row changes on a MySQL `orders` table to connected browser clients in real time, with no client-side polling. Built as a take-home assignment.
 
## Skills demonstrated: 
Change Data Capture · MySQL replication protocol · Event-driven architecture · WebSockets · Node.js · Database security (least privilege) · System design tradeoffs

## How it works

```
  ┌──────────────┐     binlog      ┌──────────────────┐   broadcast   ┌──────────┐
  │    MySQL     │ ──────────────▶ │  Node.js service │ ────────────▶ │ Browser  │
  │  (orders)    │   (ROW format)  │  binlog + ws     │   (WebSocket) │ clients  │
  └──────────────┘                 └──────────────────┘               └──────────┘
        ▲
        │ writes from anywhere
        │ (CLI, GUI, app, cron)
```

Any INSERT/UPDATE/DELETE on `orders` — from any source — gets captured by MySQL's binary log, read by the Node service acting as a replication client, and pushed to every connected WebSocket client.

<img width="1440" height="900" alt="Screenshot 2026-05-20 at 5 17 03 PM" src="https://github.com/user-attachments/assets/f92410ee-dfa8-4943-9c18-5a08d5981c7c" />
<img width="1440" height="900" alt="Screenshot 2026-05-20 at 5 17 34 PM" src="https://github.com/user-attachments/assets/d1afa8c6-dc95-43c7-a33e-876473e2b554" />
<img width="1440" height="900" alt="Screenshot 2026-05-20 at 5 17 47 PM" src="https://github.com/user-attachments/assets/973db844-173c-4570-bbfa-548680e1a31b" />
<img width="1440" height="900" alt="Screenshot 2026-05-20 at 5 18 07 PM" src="https://github.com/user-attachments/assets/84d356f2-513f-40fe-b656-ea9d380df90b" />

## Why this approach

The assignment forbids client-side polling. There are essentially three ways to detect database changes:

| Approach                           | What it does                                             | Why I didn't pick it                                                 |
| ---------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------- |
| **Database polling**               | Backend repeatedly queries the table for new rows        | The exact pattern the assignment rules out; wasteful at scale        |
| **App-level events**               | Backend broadcasts whenever its own API writes to the DB | Misses changes from any other source (GUIs, scripts, other services) |
| **Change Data Capture (binlog)** ✓ | Backend reads MySQL's replication log as a fake replica  | Catches _every_ change at the DB layer, regardless of source         |

CDC is how production tools like Debezium, Maxwell, and AWS DMS work. It's the most robust and the only one that genuinely treats the database as the source of truth.

## Tech choices

- **Node.js** — event-driven runtime, natural fit for streaming work
- **MySQL 8** with `binlog_format=ROW` — gives full before/after row data on every change
- **`@vlasky/zongji`** — actively-maintained MySQL replication client for Node
- **`ws`** — minimal WebSocket library; no Express or Socket.IO overhead needed
- **Plain HTML browser client** — no build step, opens by double-clicking

## Project structure

```
src/
  config.js           Loads .env into a typed config object
  binlog-listener.js  Connects to MySQL as a replication client; emits change events
  ws-server.js        WebSocket server; tracks connected clients; broadcasts payloads
  server.js           Entry point — wires binlog change events to ws.broadcast()
db/
  schema.sql          Creates the realtime_orders DB and orders table with seed data
  replication-user.sql Creates a least-privilege cdc_user for the binlog reader
client/
  index.html          Browser client with auto-reconnect and color-coded events
```

The two halves of the system (binlog reader and WebSocket server) are independent modules that know nothing about each other. They're wired together in `server.js` in two lines. This makes each piece independently testable and replaceable.

## Setup

### Prerequisites

- Node.js 18+
- MySQL 8 (or 5.7 with binlog enabled)

### 1. Enable the binlog in MySQL

In your MySQL config (`my.cnf` / `my.ini`), under `[mysqld]`:

```ini
server_id         = 1
log_bin           = mysql-bin
binlog_format     = ROW
binlog_row_image  = FULL
```

Restart MySQL. Verify with:

```bash
mysql -u root -p -e "SHOW VARIABLES WHERE Variable_name IN ('log_bin','binlog_format','binlog_row_image','server_id');"
```

### 2. Create the schema and CDC user

```bash
mysql -u root -p < db/schema.sql
mysql -u root -p < db/replication-user.sql
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env and set DB_PASSWORD and CDC_PASSWORD
```

### 4. Install and run

```bash
npm install
npm start
```

You should see:

```
[ws] server listening on ws://localhost:8080
[binlog] connected and listening for changes
```

### 5. Open the client

Open `client/index.html` directly in a browser. Status should turn green.

### 6. Demo

In another terminal:

```bash
mysql -u root -p -e "INSERT INTO realtime_orders.orders (customer_name, product_name, status) VALUES ('Demo', 'Headphones', 'pending');"
mysql -u root -p -e "UPDATE realtime_orders.orders SET status='shipped' WHERE customer_name='Demo';"
mysql -u root -p -e "DELETE FROM realtime_orders.orders WHERE customer_name='Demo';"
```

Color-coded event cards appear in the browser within a second of each change. Try the same from MySQL Workbench or any other tool — the system catches changes regardless of source, because the binlog operates at the database layer.

## Message format

Each WebSocket message is a JSON object:

```json
{ "type": "insert", "row": { "id": 4, "customer_name": "...", "status": "pending", ... } }
{ "type": "update", "before": { ... }, "after": { ... } }
{ "type": "delete", "row": { ... } }
```

On connect, the server sends a one-time hello:

```json
{ "type": "hello", "message": "connected to realtime-orders feed" }
```

## Design notes

- **Least-privilege CDC user.** The binlog reader connects as `cdc_user`, which has only `REPLICATION SLAVE`, `REPLICATION CLIENT`, and scoped `SELECT` on the target schema. It cannot modify data.
- **Schema-filtered binlog stream.** zongji is configured with `includeSchema: { realtime_orders: ['orders'] }` so unrelated table changes aren't even delivered to Node.
- **`startAtEnd: true`.** The service streams only changes that happen _after_ it starts — historical binlog entries (e.g. the seed inserts) are skipped.
- **Client auto-reconnect.** If the backend restarts, the browser client retries every 2 seconds.
- **Decoupled modules.** Each piece can be tested in isolation; the wire between them is a single `EventEmitter` subscription.

## What I'd build next

Things deliberately left out to keep the assignment focused, but worth naming:

- **Binlog position persistence.** Currently a restart skips any changes that occurred while the service was down. Production CDC stores the last `{file, position}` and resumes from it.
- **Versioned event envelope.** A consistent `{v, id, ts, type, data}` shape across all messages, with server-generated event IDs, would be a cleaner public contract.
- **Horizontal scaling.** One Node process can handle thousands of WebSocket clients; beyond that, a Redis pub/sub fanout between a single binlog reader and many WebSocket servers is the standard pattern.
- **Per-client subscriptions.** Clients could send a subscribe message specifying filters (e.g. by customer or status), and the server would only push matching events.
- **Authentication.** In production, the WebSocket upgrade would require a token, and clients would only receive events for data they're authorized to see.
- **Alternative transport.** Server-Sent Events (SSE) would be a simpler, one-way alternative to WebSockets and is worth considering for read-only feeds in environments that don't tolerate WebSocket connections well.

## Notes

- Binlog format must be `ROW` with `binlog_row_image=FULL` — `STATEMENT` format won't work because we need actual row data, not SQL text.
- Cloud-managed MySQL services often restrict binlog access; this project assumes a local or self-managed MySQL.
