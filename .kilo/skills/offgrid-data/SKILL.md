---
name: offgrid-data
description: Datenmodell und Datenbank der OffGrid-App – SQLite-Schema (Migrationen), Repository-Methoden inkl. Standort-Koordinaten, Mapping, Memory-Implementierung für den Browser. Laden bei allem, was Daten speichert oder liest.
---

# OffGrid Daten

Basis: ERD der Planung (`docs/datenmodell.md`) mit den dort markierten Ergänzungen. Plugin: `@capacitor-community/sqlite`.
Datenbankname `offgrid`, nicht verschlüsselt (`encrypted: false`, mode `no-encryption`).

## 0. Migrations-Mechanismus (T04)

`core/data/migrations.ts` exportiert `MIGRATIONS: { version: number; statements: string[] }[]` (aufsteigend).
`SqliteDatabaseService.open()`: `PRAGMA user_version` lesen → jede Migration mit höherer Version in **einer** Transaktion
ausführen → danach `PRAGMA user_version = <version>`. T04 legt nur Version 1 an. Version 2 (Gruppen) fügt T20 hinzu
(Skill `offgrid-groups`). Bestehende Migrationen werden **nie** geändert, sobald sie gemerged sind.

## 1. Migration v1 (exakt so)

```sql
CREATE TABLE IF NOT EXISTS contacts (
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
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_receiving_key ON contacts(receiving_key);

CREATE TABLE IF NOT EXISTS messages (
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
);
CREATE INDEX IF NOT EXISTS idx_messages_contact_sent ON messages(contact_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_messages_wire ON messages(contact_id, wire_id);

CREATE TABLE IF NOT EXISTS coordinates (
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
);
CREATE INDEX IF NOT EXISTS idx_coordinates_message ON coordinates(message_id, recorded_at);

CREATE TABLE IF NOT EXISTS handshakes (
  id          TEXT PRIMARY KEY NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('shower','scanner')),
  local_key   TEXT NOT NULL CHECK (length(local_key) = 32),
  remote_key  TEXT,
  peer_name   TEXT,
  state       TEXT NOT NULL CHECK (state IN ('waiting','sent','done','cancelled')),
  contact_id  TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
```

- Eine Standort-Nachricht = eine Zeile in `messages` mit `kind = 'location'` und `content = ''` **plus** eine Zeile in
  `coordinates` mit `message_id`. Live-Standort (T19): weitere `coordinates`-Zeilen mit derselben `message_id`
  (neueste = aktuell), `share_id`/`share_until` gesetzt, `context = 'live'`.
- Fremdschlüssel aktivieren: nach dem Öffnen `PRAGMA foreign_keys = ON;`.
- Spalten in DB = snake_case, im TypeScript-Modell = camelCase. Mapping nur in den Repositories.

## 2. Settings-Schlüssel

| key | Wert | Default |
|---|---|---|
| `install_id` | UUID | beim ersten Start erzeugen |
| `display_name` | Text 1–100 | leer → Onboarding Schritt 2 |
| `onboarding_done` | `'1'`/`'0'` | `'0'` |
| `bg_receive` | `'1'`/`'0'` | `'1'` |
| `vibrate` | `'1'`/`'0'` | `'0'` |

## 3. Repositories (abstrakte Klassen, Methoden exakt so)

```ts
abstract class ContactRepository {
  abstract all(): Promise<Contact[]>;
  abstract byId(id: string): Promise<Contact | null>;
  abstract byReceivingKeyTag(tag: string, tagOf: (key: string) => Promise<string>): Promise<Contact | null>;
  abstract insert(c: Contact): Promise<void>;
  abstract updateNames(id: string, displayName: string, firstName: string | null, lastName: string | null): Promise<void>;
  abstract updateSignal(id: string, rssi: number, seenAt: string): Promise<void>;
  abstract delete(id: string): Promise<void>;
  abstract count(): Promise<number>;
}
abstract class MessageRepository {
  abstract forContact(contactId: string): Promise<Message[]>;          // ORDER BY sent_at ASC
  abstract lastPerContact(): Promise<Map<string, Message>>;
  abstract unreadPerContact(): Promise<Map<string, number>>;          // direction='in' AND read_at IS NULL
  abstract queued(): Promise<Message[]>;                               // status=0 AND direction='out' ORDER BY sent_at
  abstract byWireId(contactId: string, wireId: string): Promise<Message | null>;
  abstract insert(m: Message): Promise<void>;
  abstract setStatus(id: string, status: MessageStatus): Promise<void>;
  abstract markRead(contactId: string, at: string): Promise<void>;
  abstract count(): Promise<number>;
}
abstract class CoordinateRepository {
  abstract insert(c: Coordinate): Promise<void>;
  abstract latestForMessage(messageId: string): Promise<Coordinate | null>;   // ORDER BY recorded_at DESC LIMIT 1
  abstract latestForMessages(messageIds: string[]): Promise<Map<string, Coordinate>>;
  abstract messageIdForShare(contactId: string, shareId: string): Promise<string | null>;   // nur von T19 genutzt
  abstract count(): Promise<number>;
}
abstract class HandshakeRepository {
  abstract insert(h: Handshake): Promise<void>;
  abstract open(): Promise<Handshake[]>;                               // state IN ('waiting','sent')
  abstract doneShowers(): Promise<Handshake[]>;                        // role='shower' AND state='done'
  abstract update(h: Handshake): Promise<void>;
}
abstract class SettingsRepository {
  abstract get(key: string): Promise<string | null>;
  abstract set(key: string, value: string): Promise<void>;
  abstract all(): Promise<Record<string, string>>;
}
```

- Jede schreibende Methode setzt `updated_at` (ausser `insert`, dort `created_at`).
- `byReceivingKeyTag`: Lädt alle Kontakte und vergleicht `await tagOf(c.receivingKey) === tag`. (Bei < 100 Kontakten ok.)
- `DatabaseService` ist eine **abstrakte Klasse** mit `open()`, `replaceAll(data)`, `deleteAllUserData()`;
  Implementierungen `SqliteDatabaseService` und `MemoryDatabaseService` (arbeitet auf den Memory-Repositories über deren
  zusätzliche, nur in Memory vorhandene Methoden `clear()` und `insertMany(rows)`).
- Für Import: `replaceAll(data)` führt (Sqlite: in **einer Transaktion**) aus: DELETE aus coordinates, messages, contacts,
  handshakes; INSERT aller importierten Zeilen; `display_name` in settings setzen.
- `DatabaseService.deleteAllUserData()` löscht in einer Transaktion coordinates, messages, contacts, handshakes (Settings bleiben).
- `MessageRepository.byWireId` und `queued()` gelten für beide `kind`s.
- Ab T20 (Migration v2) löschen `replaceAll`/`deleteAllUserData` zusätzlich `group_messages`, `group_members`, `groups`
  (in dieser Reihenfolge) und `replaceAll` fügt `groups` → `group_members` → `group_messages` ein (Skill `offgrid-groups`).
- Alle SQL-Statements mit Parametern (`?`), nie String-Verkettung mit Werten.

## 4. Memory-Implementierung (Browser)

- Gleiche abstrakte Klassen, Daten in `Map`s, gleiche Sortierung und Filter. Starten **leer** (wichtig für Tests).
- `MemoryDatabaseService.seedDemo()` füllt Demo-Daten aus `core/data/memory/seed.ts` – wird nur von `AppStartService`
  im Browser aufgerufen (siehe Architektur §6), nie in Tests:
  - Settings: `install_id = 'demo-install-id'`, `display_name = 'HolyG'`, `onboarding_done = '1'`, `bg_receive = '1'`, `vibrate = '0'`.
  - Kontakte, Nachrichten und der ausstehende Handshake „Jonas Keller“ laut Skill `offgrid-screens` §6 „Demo-Verlauf“.
  - **Keine** Standort-Nachrichten im Seed (die erzeugt man im Browser über den Standort-Button bzw. `ogMock.receiveLocation`).
  - Schlüssel für Demo-Kontakte: beim Seed mit `CryptoService.newKey()` erzeugt.
