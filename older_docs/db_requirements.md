

# Database Requirements — v1  
*Postgres + Redis combo for QR Ordering*

---

## 1. Rationale

| Layer | Use‑case | Why this store? |
|-------|----------|-----------------|
| **Postgres** | Durable data you must keep for audits, BI, finance, or offline reconciliation (tables, sessions, carts, orders, events). | SQL joins, ACID, snapshots, backups, analytical tooling. |
| **Redis** | Ultra‑hot, transient, or pub/sub driven data (live session mirrors, cart snapshots, JWT tokens, POS retry queue, rate‑limits). | \<1 ms reads, built‑in TTL, streams, atomic counters. |

---

## 2. Postgres Schema (DDL)

```sql
-- Restaurant + table meta
CREATE TABLE restaurants (
  id            bigserial PRIMARY KEY,
  slug          text UNIQUE,
  name          text,
  opens_at      time,
  closes_at     time
);

CREATE TABLE tables (
  id            bigserial PRIMARY KEY,
  restaurant_id bigint REFERENCES restaurants(id),
  number        int,
  qr_token      text UNIQUE            -- signed HMAC
);

-- Live session
CREATE TYPE session_state AS ENUM ('active','closed','expired');

CREATE TABLE sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   bigint REFERENCES restaurants(id),
  table_id        bigint REFERENCES tables(id),
  state           session_state NOT NULL DEFAULT 'active',
  manual_closed   bool          DEFAULT false,
  daily_pass_required bool      DEFAULT false,
  pass_validated  bool          DEFAULT false,
  created_at      timestamptz   DEFAULT now(),
  last_activity_at timestamptz  NOT NULL,
  UNIQUE (table_id) WHERE (state = 'active')         -- 1 open per table
);

-- Members & cart
CREATE TABLE members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  nickname   text,
  is_host    bool DEFAULT false
);

CREATE TABLE cart_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  member_id  uuid REFERENCES members(id),
  menu_item_id bigint,
  qty        int CHECK (qty > 0),
  note       text,
  version    int  DEFAULT 1,
  UNIQUE (id, version)
);

-- Orders & event log
CREATE TABLE orders (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id),
  pos_ticket text,
  cart_hash  text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE events (
  id         bigserial PRIMARY KEY,
  session_id uuid REFERENCES sessions(id),
  kind       text,
  payload    jsonb,
  created_at timestamptz DEFAULT now()
);
```

**Recommended Indexes**

```sql
CREATE INDEX ON sessions (restaurant_id, state);
CREATE INDEX ON cart_items (session_id);
CREATE INDEX ON events (session_id, created_at DESC);
```

---

## 3. Redis Key Plan

| Key pattern | Example | TTL | Purpose |
|-------------|---------|-----|---------|
| `sess:{sid}` → json | `sess:3b27…` | 3 h | Hot mirror of session flags for instant lookup. |
| `cart:{sid}` → json | `cart:3b27…` | 10 min (reset on write) | Combined cart snapshot for reconnects. |
| `jwt:{jti}` → "1" | `jwt:2d91…` | Equal to `exp` | Token blacklist / single‑use logout. |
| `passOK:{sid}` → "1" | `passOK:3b27…` | 3 h | Skip password prompt after first success. |
| `retry:pos` *(Redis Stream)* | — | — | Orders awaiting POS ACK. |
| `ratelimit:{ip}` → int | `ratelimit:1.2.3.4` | 60 s | 5 ops/min IP rate‑limiting. |

---

## 4. Concurrency & Integrity Patterns

1. **Cart optimistic update**

```sql
UPDATE cart_items
  SET qty = qty + 1,
      version = version + 1
WHERE id = :id
  AND version = :client_version;   -- returns 0 rows on conflict
```

Return **409** to client when `rowCount = 0`.

2. **Session creation race**

```sql
INSERT INTO sessions (restaurant_id, table_id, last_activity_at)
VALUES (:r, :t, now())
ON CONFLICT (table_id) WHERE (state='active')
DO UPDATE SET last_activity_at = now()
RETURNING id;
```

3. **Auto‑expire worker**

```sql
UPDATE sessions
  SET state='expired'
WHERE state='active'
  AND now() - last_activity_at > INTERVAL '90 minutes';
```

4. **POS retry worker**

Read via `XREADGROUP`, re‑POST to POS, then `XACK` / re‑enqueue with incremented `retry_count`.

---

## 5. Ops & Back‑up

| Component | Strategy |
|-----------|-----------|
| **Postgres** | WAL‑G or pgBackRest; 5‑min point‑in‑time recovery. |
| **Redis** | RDB snapshot every 5 min + AOF if persistence is critical. |
| **Connection pool** | PgBouncer (transaction mode) to cap connection storms. |
| **Observability** | `pg_stat_statements`, Redis `INFO`, Grafana dashboards for stream lag. |

---

## 6. Roadmap hooks

| Future feature | DB impact |
|----------------|-----------|
| Online payments | Add `payments` table; reuse existing `orders.session_id` FK. |
| BLE beacons | Add `device_id` claim to JWT; store device table in Postgres. |
| AI‑driven upsell logs | Append event kind `ai_suggestion`; index on `kind`. |

---

**Ready to implement** — this schema and key plan align exactly with the v1 back‑end spec and can scale to hundreds of concurrent tables with minimal tuning.