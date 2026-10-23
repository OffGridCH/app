/** Eine Schema-Migration der Datenbank `offgrid`. */
export interface Migration {
  /** Zielversion nach der Migration. */
  version: number;
  /** SQL-Statements, die in einer Transaktion ausgeführt werden. */
  statements: string[];
}

/**
 * Migrationen der Datenbank `offgrid`, aufsteigend nach Version.
 *
 * Bestehende Migrationen werden nie geändert. Neue Versionen kommen dazu.
 * Die Version wird in `PRAGMA user_version` gespeichert.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS contacts (
  id            TEXT PRIMARY KEY NOT NULL,
  sending_key   TEXT NOT NULL CHECK (length(sending_key) = 32),
  receiving_key TEXT NOT NULL CHECK (length(receiving_key) = 32),
  display_name  TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 100),
  first_name    TEXT CHECK (first_name IS NULL OR length(first_name) <= 100),
  last_name     TEXT CHECK (last_name IS NULL OR length(last_name) <= 100),
  handshake_at  TEXT NOT NULL,
  last_rssi     INTEGER,
  last_seen_at  TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT
);`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_receiving_key ON contacts(receiving_key);`,
      `CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY NOT NULL,
  contact_id  TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  wire_id     TEXT NOT NULL CHECK (length(wire_id) = 8),
  content     TEXT NOT NULL,
  direction   TEXT NOT NULL CHECK (direction IN ('in','out')),
  kind        TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text','location')),
  sent_at     TEXT NOT NULL,
  status      INTEGER NOT NULL CHECK (status BETWEEN 0 AND 3),
  rssi        INTEGER,
  read_at     TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT
);`,
      `CREATE INDEX IF NOT EXISTS idx_messages_contact_sent ON messages(contact_id, sent_at);`,
      `CREATE INDEX IF NOT EXISTS idx_messages_wire ON messages(contact_id, wire_id);`,
      `CREATE TABLE IF NOT EXISTS coordinates (
  id          TEXT PRIMARY KEY NOT NULL,
  contact_id  TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  message_id  TEXT REFERENCES messages(id) ON DELETE CASCADE,
  latitude    REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude   REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy    REAL,
  context     TEXT NOT NULL DEFAULT 'einmal' CHECK (context IN ('einmal','live')),
  share_id    TEXT,
  share_until TEXT,
  recorded_at TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT
);`,
      `CREATE INDEX IF NOT EXISTS idx_coordinates_message ON coordinates(message_id, recorded_at);`,
      `CREATE TABLE IF NOT EXISTS handshakes (
  id          TEXT PRIMARY KEY NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('shower','scanner')),
  local_key   TEXT NOT NULL CHECK (length(local_key) = 32),
  remote_key  TEXT,
  peer_name   TEXT,
  state       TEXT NOT NULL CHECK (state IN ('waiting','sent','done','cancelled')),
  contact_id  TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT
);`,
      `CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);`,
    ],
  },
];
