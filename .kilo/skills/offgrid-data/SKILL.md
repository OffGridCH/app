---
name: offgrid-data
description: Datenmodell und Datenbank der OffGrid-App – SQLite-Schema ohne Kontaktschlüssel (Migrationen), Kontakt-Spiegel vom Gerät, Nachrichten mit ctr und msg_ref, Repository-Methoden inkl. Standort-Koordinaten, Memory-Implementierung für den Browser. Laden bei allem, was Daten speichert oder liest.
---

# OffGrid Daten

## 0. Migrations-Mechanismus (T04)

`core/data/migrations.ts` exportiert `MIGRATIONS: { version: number; statements: string[] }[]` (aufsteigend).
`SqliteDatabaseService.open()`: `PRAGMA user_version` lesen → jede Migration mit höherer Version in **einer** Transaktion
ausführen → danach `PRAGMA user_version = <version>`. Version 2 (Gruppen) fügt T20 hinzu (Skill `offgrid-groups`).
Bestehende Migrationen werden **nie** geändert, sobald sie gemerged sind.
Ausnahme: T23 hat Migration **v1 einmalig umgeschrieben** (Schema ohne Kontaktschlüssel). Es gab noch keine veröffentlichte App
und keine Nutzerdaten; wer ein altes Schema auf dem Handy hat, deinstalliert die App.

## 1. Migration v1 (exakt so)

```sql
CREATE TABLE IF NOT EXISTS contacts (
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
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_public_key ON contacts(public_key);

CREATE TABLE IF NOT EXISTS messages (
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
);
CREATE INDEX IF NOT EXISTS idx_messages_contact_sent ON messages(contact_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_messages_ctr ON messages(contact_id, direction, ctr);
CREATE INDEX IF NOT EXISTS idx_messages_msg_ref ON messages(msg_ref);

CREATE TABLE IF NOT EXISTS coordinates (
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
);
CREATE INDEX IF NOT EXISTS idx_coordinates_message ON coordinates(message_id, recorded_at);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
```

- **Keine Tabelle `handshakes`:** Pairing und Schlüsselableitung macht das Gerät (`pair.begin`/`pair.complete`).
- **Kontakt-Spiegel:** `contact_id` ist der Platz auf dem Gerät (1–32, stabil, solange der Kontakt dort existiert) und zugleich
  der Primärschlüssel. `public_key` ist der öffentliche Schlüssel (Base64, 44 Zeichen), **kein** geheimer Schlüssel. Es gibt
  keine Spalten `sending_key`, `receiving_key`, `display_name`, `first_name`, `last_name`, `handshake_at`, `last_seen_at`.
- **`ctr`** ist der Zähler der Nachricht in ihrer Unterhaltung (0–16777215, getrennt je Richtung); bei ausgehenden Nachrichten
  erst nach der Antwort auf `msg.send` bekannt (vorher `NULL`). **`msg_ref`** ist der lokale Handle des Geräts für
  `msg.status`, gilt nur bis zum nächsten Gerätestart (vorher `NULL`). Reaktionen verweisen mit `ctr & 0xFFFF` auf eine Nachricht.
- `status`: 0 = Queued, 1 = Sent (Gerät: sent/relayed/retrying), 2 = Delivered, 3 = Failed.
- Eine Standort-Nachricht = eine Zeile in `messages` mit `kind = 'location'` und `content = ''` **plus** eine Zeile in
  `coordinates` mit `message_id`. Live-Standort (T19): weitere `coordinates`-Zeilen mit derselben `message_id`
  (neueste = aktuell), `share_id`/`share_until` gesetzt, `context = 'live'`.
- Fremdschlüssel aktivieren: nach dem Öffnen `PRAGMA foreign_keys = ON;`.
- Spalten in DB = snake_case, im TypeScript-Modell = camelCase. Mapping nur in `sqlite-mapping.ts`.
- **Kontakte nie mit `INSERT OR REPLACE` schreiben** (das löscht die Zeile zuerst und kaskadiert den Verlauf weg): `CONTACT_UPSERT`
  nutzt `ON CONFLICT(contact_id) DO UPDATE`.

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
  abstract all(): Promise<Contact[]>;                                  // ORDER BY contact_id
  abstract byId(contactId: number): Promise<Contact | null>;
  abstract upsert(c: Contact): Promise<void>;                          // Spiegel vom Gerät; Verlauf bleibt erhalten
  abstract updateName(contactId: number, name: string): Promise<void>;
  abstract updateLink(contactId: number, rssi: number | null, snr: number | null): Promise<void>;
  abstract setState(contactId: number, state: ContactState): Promise<void>;
  abstract delete(contactId: number): Promise<void>;                   // Nachrichten und Koordinaten fallen mit weg
  abstract count(): Promise<number>;
}
abstract class MessageRepository {
  abstract byId(id: string): Promise<Message | null>;
  abstract forContact(contactId: number): Promise<Message[]>;          // ORDER BY sent_at ASC
  abstract lastPerContact(): Promise<Map<number, Message>>;
  abstract unreadPerContact(): Promise<Map<number, number>>;          // direction='in' AND read_at IS NULL
  abstract queued(): Promise<Message[]>;                               // status=0 AND direction='out' AND msg_ref IS NULL ORDER BY sent_at
  abstract byMsgRef(msgRef: number): Promise<Message | null>;          // offene ausgehende (Queued/Sent) mit diesem Handle
  abstract byCtr(contactId: number, direction: Direction, ctr: number): Promise<Message | null>;
  abstract insert(m: Message): Promise<void>;
  abstract setStatus(id: string, status: MessageStatus): Promise<void>;
  abstract assignRef(id: string, ctr: number, msgRef: number, status: MessageStatus): Promise<void>;   // Antwort auf msg.send
  abstract requeue(id: string): Promise<void>;                         // retry: ctr/msg_ref leeren, status Queued
  abstract failPending(): Promise<number>;                             // sys.boot: alles mit msg_ref und Queued/Sent → Failed
  abstract markRead(contactId: number, at: string): Promise<void>;
  abstract count(): Promise<number>;
}
abstract class CoordinateRepository {
  abstract insert(c: Coordinate): Promise<void>;
  abstract latestForMessage(messageId: string): Promise<Coordinate | null>;   // ORDER BY recorded_at DESC LIMIT 1
  abstract latestForMessages(messageIds: string[]): Promise<Map<string, Coordinate>>;
  abstract messageIdForShare(contactId: number, shareId: string): Promise<string | null>;   // nur von T19 genutzt
  abstract count(): Promise<number>;
}
abstract class SettingsRepository {
  abstract get(key: string): Promise<string | null>;
  abstract set(key: string, value: string): Promise<void>;
  abstract all(): Promise<Record<string, string>>;
}
```

- Schreibende Methoden setzen `updated_at` bei Nachrichten (`setStatus`, `assignRef`, `requeue`, `markRead`, `failPending`). Kontakte haben kein
  `updated_at`: sie sind eine Kopie des Geräts.
- `DatabaseService` ist eine **abstrakte Klasse** mit `open()`, `replaceAll(data)`, `deleteAllUserData()`;
  Implementierungen `SqliteDatabaseService` und `MemoryDatabaseService` (arbeitet auf den Memory-Repositories über deren
  zusätzliche, nur in Memory vorhandene Methoden `clear()` und `insertMany(rows)`). `DatabaseData` = `{ contacts, messages, coordinates }`.
- Für Import: `replaceAll(data)` führt (Sqlite: in **einer Transaktion**) aus: DELETE aus coordinates, messages, contacts;
  INSERT aller importierten Zeilen; `display_name` in settings setzen.
- `DatabaseService.deleteAllUserData()` löscht in einer Transaktion coordinates, messages, contacts (Settings bleiben).
- `MessageRepository.queued()` und `byCtr` gelten für beide `kind`s.
- Ab T20 (Migration v2) löschen `replaceAll`/`deleteAllUserData` zusätzlich `group_messages`, `group_members`, `groups`
  (in dieser Reihenfolge) und `replaceAll` fügt `groups` → `group_members` → `group_messages` ein (Skill `offgrid-groups`).
- Alle SQL-Statements mit Parametern (`?`), nie String-Verkettung mit Werten.
- Das Löschen eines Kontakts lokal (`ContactRepository.delete`) räumt nur die App auf. Auf dem Gerät löscht `HandshakeService.remove`
  (`contact.delete`).

## 4. Memory-Implementierung (Browser)

- Gleiche abstrakte Klassen, Daten in `Map`s, gleiche Sortierung und Filter, gleiche Lösch-Kaskade. Starten **leer** (wichtig für Tests).
- `MemoryDatabaseService.seedDemo()` füllt Demo-Daten aus `core/data/memory/seed.ts` – wird nur von `AppStartService`
  im Browser aufgerufen (siehe Architektur §6), nie in Tests:
  - Settings: `install_id = 'demo-install-id'`, `display_name = 'HolyG'`, `onboarding_done = '1'`, `bg_receive = '1'`, `vibrate = '0'`.
  - Kontakte und Nachrichten laut Skill `offgrid-screens` §6 „Demo-Verlauf“. Die Kontakte sind **`DEMO_CONTACTS`** (feste, erfundene
    Schlüssel und Fingerabdrücke; `node_id` = SHA-256 des Schlüssels, 2 Bytes). Der Browser-Mock (`MockDevice`) kennt **dieselben**
    Kontakte, sonst ersetzt die Synchronisation sie beim Verbinden. Jonas Keller ist `pending`.
  - **Keine** Standort-Nachrichten im Seed (die erzeugt man im Browser über den Standort-Button bzw. `ogMock.receiveLocation`).
