-- Quinton Carpets — D1 schema.
--
-- Two tables and a rate-limit ledger. No card data, no payment
-- records: money is taken in the shop and nothing about it touches
-- this database.

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
  code        TEXT PRIMARY KEY,            -- QC-REF-XXXX
  owner_ref   TEXT NOT NULL REFERENCES bookings(ref),
  redemptions INTEGER NOT NULL DEFAULT 0,
  -- Set by the shop once a referred job is paid; that is what turns
  -- the owner's 10% code into their 20% reward.
  reward_earned INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS referral_by_owner ON referral_codes (owner_ref);

-- Seasonal promotions. The shop edits this, not the code, and the
-- client never sees the table — it posts a code and is told what it
-- is worth.
CREATE TABLE IF NOT EXISTS promo_codes (
  code        TEXT PRIMARY KEY,
  percent_off INTEGER,                     -- off fitting only
  amount_off  REAL,                        -- off the order
  message     TEXT NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1,
  expires_at  TEXT
);

INSERT OR IGNORE INTO promo_codes (code, percent_off, amount_off, message, active) VALUES
  ('WINTER10',   10, NULL, 'WINTER10 applied — 10% off fitting.',        1),
  ('NEWFLOOR25', NULL, 25, 'NEWFLOOR25 applied — £25 off your order.',   1);

-- Rate limiting, per IP, per hour. Cheaper than a CAPTCHA and it
-- does not make a customer prove they are human to book a measure.
CREATE TABLE IF NOT EXISTS rate_limit (
  bucket  TEXT PRIMARY KEY,                -- ip|YYYY-MM-DDTHH
  hits    INTEGER NOT NULL DEFAULT 0,
  seen_at TEXT NOT NULL
);
