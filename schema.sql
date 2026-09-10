-- Quinton Carpets — Postgres schema, for Supabase.
--
-- Three tables and a rate-limit ledger. No card data, no payment
-- records: money is taken in the shop and nothing about it touches
-- this database.
--
-- Dates and timestamps are TEXT on purpose. Every date the site
-- handles is a Europe/London calendar day written YYYY-MM-DD, and
-- every timestamp is an ISO 8601 string in UTC. Storing them as text
-- keeps them sorting and comparing exactly as they read, and stops a
-- database timezone setting from quietly moving someone's booking to
-- the day before.
--
-- Apply it with:  npm run db:setup

CREATE TABLE IF NOT EXISTS bookings (
  ref           TEXT PRIMARY KEY,          -- QC-DDMM-XXXX
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL,
  email         TEXT NOT NULL,
  address       TEXT NOT NULL,
  postcode      TEXT NOT NULL,
  estimate_code TEXT,                      -- QC-EST-XXXXX, optional
  referred_by   TEXT,                      -- a friend's QC-REF-XXXX, optional
  date          TEXT NOT NULL,             -- YYYY-MM-DD, Europe/London
  slot          TEXT NOT NULL,             -- am | pm | eve
  notes         TEXT,
  created_at    TEXT NOT NULL,             -- ISO 8601 UTC
  status        TEXT NOT NULL DEFAULT 'new'
                CHECK (status IN ('new','called','measured','fitted'))
);

CREATE INDEX IF NOT EXISTS bookings_by_date   ON bookings (date, slot);
CREATE INDEX IF NOT EXISTS bookings_by_status ON bookings (status, date);

-- One code per customer, minted when they book. Redemption is
-- confirmed by the shop, never by the site — this table only counts.
CREATE TABLE IF NOT EXISTS referral_codes (
  code          TEXT PRIMARY KEY,          -- QC-REF-XXXX
  owner_ref     TEXT NOT NULL REFERENCES bookings(ref),
  redemptions   INTEGER NOT NULL DEFAULT 0,
  -- Set by the shop once a referred job is paid; that is what turns
  -- the owner's 10% code into their 20% reward. Kept as 0/1 rather
  -- than a boolean so the queries read the same as they always did.
  reward_earned INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS referral_by_owner ON referral_codes (owner_ref);

-- Seasonal promotions. The shop edits this, not the code, and the
-- client never sees the table — it posts a code and is told what it
-- is worth.
CREATE TABLE IF NOT EXISTS promo_codes (
  code        TEXT PRIMARY KEY,
  percent_off INTEGER,                     -- off fitting only
  amount_off  DOUBLE PRECISION,            -- off the order
  message     TEXT NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1,
  expires_at  TEXT
);

INSERT INTO promo_codes (code, percent_off, amount_off, message, active) VALUES
  ('WINTER10',   10, NULL, 'WINTER10 applied — 10% off fitting.',        1),
  ('NEWFLOOR25', NULL, 25, 'NEWFLOOR25 applied — £25 off your order.',   1)
ON CONFLICT (code) DO NOTHING;

-- Rate limiting, per IP, per hour. Cheaper than a CAPTCHA and it
-- does not make a customer prove they are human to book a measure.
CREATE TABLE IF NOT EXISTS rate_limit (
  bucket  TEXT PRIMARY KEY,                -- ip|YYYY-MM-DDTHH
  hits    INTEGER NOT NULL DEFAULT 0,
  seen_at TEXT NOT NULL
);

-- Nothing in this database is reachable from the browser: the anon
-- key is never shipped to the client and every query runs server-side
-- through the pooled connection. Row Level Security is switched on
-- regardless, so that a key leaking later cannot become a data leak.
-- No policies are added, which means: deny everything except the
-- service role the site connects as.
ALTER TABLE bookings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit     ENABLE ROW LEVEL SECURITY;

-- Supabase grants anon and authenticated full rights on every table in
-- the public schema by default. This site never uses either role — it
-- connects as the owner over the pooled connection — so the grants are
-- nothing but a loaded gun on the table. Row Level Security already
-- denies both roles, but defence should not rest on one setting that a
-- future "enable the Data API" click could undermine.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON SCHEMA public FROM anon, authenticated;

-- And the same for anything added later.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
