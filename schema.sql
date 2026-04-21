-- Bachelor Trip Dashboard - D1 Schema

CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS teams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transport_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS event_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  total_cost REAL NOT NULL DEFAULT 0,
  checkin_date TEXT NOT NULL,
  checkout_date TEXT NOT NULL,
  address TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS guests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  status TEXT DEFAULT 'confirmed',
  team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,
  arrival_date TEXT,
  departure_date TEXT,
  notes TEXT,
  housing_override REAL,
  housing_paid REAL DEFAULT 0,
  payment_notes TEXT,
  room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS guest_groups (
  guest_id INTEGER NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (guest_id, group_id)
);

CREATE TABLE IF NOT EXISTS flights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_id INTEGER NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  airline TEXT,
  flight_number TEXT,
  origin_city TEXT,
  origin_code TEXT,
  destination_city TEXT,
  destination_code TEXT,
  departure_terminal TEXT,
  departure_terminal_2 TEXT,
  arrival_terminal TEXT,
  arrival_terminal_2 TEXT,
  departure_datetime TEXT,
  arrival_datetime TEXT,
  transport_type_id INTEGER REFERENCES transport_types(id) ON DELETE SET NULL,
  transport_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  event_date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  location TEXT,
  description TEXT,
  category_id INTEGER REFERENCES event_categories(id) ON DELETE SET NULL,
  total_cost REAL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_guests (
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id INTEGER NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  cost_override REAL,
  PRIMARY KEY (event_id, guest_id)
);

CREATE TABLE IF NOT EXISTS flight_status_cache (
  flight_number TEXT NOT NULL,
  flight_date TEXT NOT NULL,
  status_data TEXT NOT NULL,
  cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (flight_number, flight_date)
);

INSERT OR IGNORE INTO event_categories (name) VALUES ('Dining'), ('Nightlife'), ('Activity'), ('Transport'), ('Lodging'), ('Misc');
INSERT OR IGNORE INTO transport_types (name) VALUES ('Uber'), ('Lyft'), ('Taxi'), ('Group Van'), ('Rental Car'), ('Friend Pickup'), ('Hotel Shuttle');
