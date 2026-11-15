PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_date TEXT NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('morning', 'afternoon')),
  capacity INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 500),
  is_open INTEGER NOT NULL DEFAULT 1 CHECK (is_open IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (shift_date, period)
);

CREATE TABLE IF NOT EXISTS shift_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
  full_name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_request_per_person_shift
ON shift_requests (shift_id, mobile) WHERE status IN ('pending', 'approved');

CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts (shift_date, period);
CREATE INDEX IF NOT EXISTS idx_requests_status_created ON shift_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_shift ON shift_requests (shift_id);

CREATE TABLE IF NOT EXISTS notification_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  sent_at TEXT
);

-- Pending requests reserve capacity. Rejected requests release it.
CREATE TRIGGER IF NOT EXISTS trg_capacity_before_request
BEFORE INSERT ON shift_requests
WHEN (SELECT COUNT(*) FROM shift_requests WHERE shift_id = NEW.shift_id AND status IN ('pending', 'approved'))
  >= (SELECT capacity FROM shifts WHERE id = NEW.shift_id)
BEGIN
  SELECT RAISE(ABORT, 'SHIFT_FULL');
END;

CREATE TRIGGER IF NOT EXISTS trg_capacity_before_reopen
BEFORE UPDATE OF status ON shift_requests
WHEN NEW.status IN ('pending', 'approved')
 AND OLD.status = 'rejected'
 AND (SELECT COUNT(*) FROM shift_requests WHERE shift_id = NEW.shift_id AND status IN ('pending', 'approved'))
   >= (SELECT capacity FROM shifts WHERE id = NEW.shift_id)
BEGIN
  SELECT RAISE(ABORT, 'SHIFT_FULL');
END;

CREATE TRIGGER IF NOT EXISTS trg_shift_capacity_guard
BEFORE UPDATE OF capacity ON shifts
WHEN NEW.capacity < (SELECT COUNT(*) FROM shift_requests WHERE shift_id = OLD.id AND status IN ('pending', 'approved'))
BEGIN
  SELECT RAISE(ABORT, 'CAPACITY_BELOW_BOOKED');
END;