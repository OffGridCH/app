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
 * (Version 1 wurde mit T23 einmalig umgeschrieben: Es gab noch keine veröffentlichte App,
 * und das Gerät besitzt die Kontaktschlüssel, nicht mehr die App.)
 * Die Version wird in `PRAGMA user_version` gespeichert.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS contacts (
  contact_id     INTEGER PRIMARY KEY NOT NULL CHECK (contact_id BETWEEN 1 AND 32),
  name           TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 24),
  node_id        TEXT NOT NULL CHECK (length(node_id) = 4),
  public_key     TEXT NOT NULL CHECK (length(public_key) = 44),
  state          TEXT NOT NULL CHECK (state IN ('pending','active')),
  fingerprint    TEXT NOT NULL,
  last_rssi      INTEGER,
  last_snr       REAL,
  tx_ctr         INTEGER NOT NULL DEFAULT 0 CHECK (tx_ctr BETWEEN 0 AND 16777215),
  rx_highest_ctr INTEGER CHECK (rx_highest_ctr IS NULL OR rx_highest_ctr BETWEEN 0 AND 16777215)
);`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_public_key ON contacts(public_key);`,
      `CREATE TABLE IF NOT EXISTS messages (
  id          TEXT PRIMARY KEY NOT NULL,
  contact_id  INTEGER NOT NULL REFERENCES contacts(contact_id) ON DELETE CASCADE,
  ctr         INTEGER CHECK (ctr IS NULL OR ctr BETWEEN 0 AND 16777215),
  msg_ref     INTEGER,
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
      `CREATE INDEX IF NOT EXISTS idx_messages_ctr ON messages(contact_id, direction, ctr);`,
      `CREATE INDEX IF NOT EXISTS idx_messages_msg_ref ON messages(msg_ref);`,
      `CREATE TABLE IF NOT EXISTS coordinates (
  id          TEXT PRIMARY KEY NOT NULL,
  contact_id  INTEGER NOT NULL REFERENCES contacts(contact_id) ON DELETE CASCADE,
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
      `CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);`,
    ],
  },
];
