PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  balance_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS security_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  q_index INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  answer_hash TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  mileage INTEGER NOT NULL,
  pickup_location TEXT NOT NULL,
  price_per_day_cents INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Bookings are the main "calendar" that blocks dates
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  car_id INTEGER NOT NULL,
  renter_id INTEGER NOT NULL,
  start_date TEXT NOT NULL,          -- YYYY-MM-DD
  end_date TEXT NOT NULL,            -- YYYY-MM-DD (exclusive end recommended)
  status TEXT NOT NULL DEFAULT 'pending',  -- pending/confirmed/cancelled
  total_cents INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE,
  FOREIGN KEY (renter_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Manual blocks (owner marks car unavailable for a range)
CREATE TABLE IF NOT EXISTS availability_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  car_id INTEGER NOT NULL,
  start_date TEXT NOT NULL,          -- YYYY-MM-DD
  end_date TEXT NOT NULL,            -- YYYY-MM-DD
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE
);

-- Watchlist (Observer) - renter watches a car with conditions
CREATE TABLE IF NOT EXISTS watches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  car_id INTEGER NOT NULL,
  max_price_per_day_cents INTEGER,   -- nullable
  watch_start_date TEXT,             -- nullable (desired range)
  watch_end_date TEXT,               -- nullable (desired range)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, car_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  text TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  car_id INTEGER NOT NULL,
  owner_id INTEGER NOT NULL,
  renter_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (car_id) REFERENCES cars(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (renter_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL,
  payer_id INTEGER NOT NULL,
  payee_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (payer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (payee_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL,
  reviewer_id INTEGER NOT NULL,
  reviewee_type TEXT NOT NULL DEFAULT 'user',  -- 'user' or 'car'
  reviewee_id INTEGER NOT NULL,  -- user_id if reviewee_type='user', car_id if 'car'
  rating INTEGER NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(booking_id, reviewer_id),
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bookings_car_dates ON bookings(car_id, start_date, end_date, status);
CREATE INDEX IF NOT EXISTS idx_blocks_car_dates ON availability_blocks(car_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_watches_car ON watches(car_id);
