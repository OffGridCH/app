---
name: offgrid-groups
description: Optionaler Gruppenchat für OffGrid (nur Ticket T20) – Gruppenschlüssel, Einladung per Funk, Gruppen-Frames, Datenbank-Migration v2, GroupService und Gruppen-Screens. Nur laden, wenn ein Ticket es ausdrücklich verlangt.
---

# Gruppenchat (optional, ganz am Schluss)

## 1. Prinzip

- Der Ersteller wählt Kontakte (mit abgeschlossenem Handshake) und erzeugt einen **Gruppenschlüssel** `K_G = newKey()`.
- Jedes Mitglied bekommt `K_G` per **`gki`-Frame**, verschlüsselt mit dem normalen Kontakt-Schlüssel (`sendingKey`).
- Gruppen-Nachrichten werden **einmal** mit `K_G` verschlüsselt und als **ein** `gmsg`-Frame gefunkt. Alle Mitglieder
  in Reichweite entschlüsseln ihn. Das spart Funkzeit (1 Frame statt 1 pro Mitglied).
- Keine Zustellbestätigung (`ack`) in Gruppen: Status endet bei `Sent` („gesendet“).
- Grenzen (nur Doku): Der Absendername im Frame ist nicht signiert; jedes Mitglied könnte ihn fälschen.
  Wer nur Gruppenmitglied ist, aber nicht direkt mit dem Ersteller befreundet, kann nicht eingeladen werden.
- Max. **8** ausgewählte Mitglieder + Ersteller.

## 2. Frames (Ergänzung zu `offgrid-antenna-protocol` §5)

| type | Schlüssel / Tag | Klartext |
|---|---|---|
| 6 `gki` | `sendingKey` des eingeladenen Kontakts | `{"g":"<K_G 32 hex>","n":"<Gruppenname>","m":["<Name>", …]}` – `m` = alle Mitglieder inkl. Ersteller |
| 7 `gmsg` | `K_G` | `{"i":"<wireId>","b":"<Text>","f":"<Anzeigename Absender>","t":<Unix-Sek.>}` |

- Passt ein `gki` nicht in `max` (zu viele/lange Namen) → `encodeFrame` wirft `too-long` → Fehler `group-too-large`.
- `maxGroupContentBytes(max, myName) = Math.min(120, max - 33 - 45 - contentBytes(myName))` in `core/messaging/limits.ts`
  (45 = leere JSON-Hülle `{"i":"xxxxxxxx","b":"","f":"","t":1761140000}`).
- Empfang `gki` (über Kontakt-Tag): Gruppe mit `tag(g)` schon bekannt → ignorieren. Sonst anlegen: Name `n`,
  Mitglieder aus `m` (doppelte Namen nur einmal übernehmen; `contact_id` setzen, wenn ein Kontakt denselben
  `display_name` hat; eigener Name → `is_me = 1`).
- Empfang `gmsg`: Gruppe über `tag(K_G)` finden; Duplikat über `(group_id, wire_id)` ignorieren; speichern mit
  `sender_name = f`, `direction 'in'`, Status `Delivered` (nur für die Anzeige-Logik „eingehend“). Signal des Kontakts mit
  `display_name = f` aktualisieren, falls vorhanden. Vibration wie bei Einzelchat.
- Senden `gmsg`: wie Einzelnachricht mit Warteschlange; `txdone ok` → `Sent`, `!ok` → `Failed`, Retry möglich.
- `gki`, die nicht gesendet werden konnten, kommen in eine In-Memory-Warteschlange und werden bei `ready` erneut gesendet.

## 3. Migration v2 (`core/data/migrations.ts`, als zweiter Eintrag)

```sql
CREATE TABLE IF NOT EXISTS groups (
  id          TEXT PRIMARY KEY NOT NULL,
  name        TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  group_key   TEXT NOT NULL UNIQUE CHECK (length(group_key) = 32),
  created_at  TEXT NOT NULL,
  updated_at  TEXT
);
CREATE TABLE IF NOT EXISTS group_members (
  group_id     TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  contact_id   TEXT,
  is_me        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (group_id, display_name)
);
CREATE TABLE IF NOT EXISTS group_messages (
  id          TEXT PRIMARY KEY NOT NULL,
  group_id    TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  wire_id     TEXT NOT NULL CHECK (length(wire_id) = 8),
  sender_name TEXT,
  content     TEXT NOT NULL,
  direction   TEXT NOT NULL CHECK (direction IN ('in','out')),
  sent_at     TEXT NOT NULL,
  status      INTEGER NOT NULL CHECK (status BETWEEN 0 AND 3),
  rssi        INTEGER,
  read_at     TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_group_messages_group_sent ON group_messages(group_id, sent_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_messages_wire ON group_messages(group_id, wire_id);
```

`deleteAllUserData()` und `replaceAll()` löschen zusätzlich `group_messages`, `group_members`, `groups`.
Backup (`offgrid-crypto-handshake` §5): Klartext bekommt optional `groups`, `groupMembers`, `groupMessages`.

### Modelle (`core/models/group.ts`)

```ts
export interface Group { id: string; name: string; groupKey: string; createdAt: string; updatedAt: string | null; }
export interface GroupMember { groupId: string; displayName: string; contactId: string | null; isMe: boolean; }
export interface GroupMessage {
  id: string; groupId: string; wireId: string; senderName: string | null; content: string; direction: Direction;
  sentAt: string; status: MessageStatus; rssi: number | null; readAt: string | null; createdAt: string; updatedAt: string | null;
}
export interface GroupListItem { group: Group; memberCount: number; lastMessage: GroupMessage | null; unread: number; }
```
`memberCount` zählt **mich mit**. `GroupErrorCode` steht in `core/models/errors.ts`.

### Repository (`core/data/group.repository.ts`, abstrakt + Sqlite; Memory in `core/data/memory/`)

```ts
abstract class GroupRepository {
  abstract all(): Promise<Group[]>;
  abstract byId(id: string): Promise<Group | null>;
  abstract byKeyTag(tag: string, tagOf: (key: string) => Promise<string>): Promise<Group | null>;
  abstract insert(g: Group, members: GroupMember[]): Promise<void>;           // eine Transaktion
  abstract members(groupId: string): Promise<GroupMember[]>;
  abstract delete(groupId: string): Promise<void>;
  abstract messages(groupId: string): Promise<GroupMessage[]>;               // ORDER BY sent_at ASC
  abstract lastPerGroup(): Promise<Map<string, GroupMessage>>;
  abstract unreadPerGroup(): Promise<Map<string, number>>;
  abstract queued(): Promise<GroupMessage[]>;
  abstract byWireId(groupId: string, wireId: string): Promise<GroupMessage | null>;
  abstract insertMessage(m: GroupMessage): Promise<void>;
  abstract setStatus(id: string, status: MessageStatus): Promise<void>;
  abstract markRead(groupId: string, at: string): Promise<void>;
}
```
Plattform-Weiche in `app.config.ts` wie bei den anderen Repositories (`useExisting`). Memory: `MemoryGroupRepository`
mit denselben Methoden plus `clear()`/`insertMany()`.

## 4. GroupService (`core/groups/group.service.ts`)

Darf `MessagingService` und `HandshakeService` **nicht** injizieren. Bekommt Frames über das Token
`GROUP_FRAME_HANDLER` in `core/messaging/group-frame-handler.ts` (gleiches Muster wie `HANDSHAKE_FRAME_HANDLER`:
`providedIn: 'root'`-Factory = no-op; `app.config.ts` setzt `useExisting: GroupService`).

- `groups: Signal<GroupListItem[]>` – `{ group, memberCount, lastMessage, unread }`, sortiert nach letzter Aktivität.
- `messages(groupId): Signal<GroupMessage[]>`
- `create(name: string, contactIds: string[]): Promise<string /* groupId */>` – speichert, sendet `gki` an alle.
- `send(groupId, text)`, `retry(messageId)`, `markRead(groupId)`, `leave(groupId)` (löscht nur lokal).
- `onFrame(bytes, rssi)`; `error: Signal<GroupErrorCode | null>`;
  `GroupErrorCode = 'group-name-invalid' | 'group-no-members' | 'group-too-many' | 'group-too-large' | 'group-duplicate-names'`.
- `create` prüft: Name 1–40 Zeichen; 1–8 Kontakte; keine zwei gleichen `display_name` unter den Gewählten und keiner gleich
  meinem Namen (sonst `group-duplicate-names`).
- Gruppen-Avatar: Muster aus SHA-256(`group_key`) (gleiches Verfahren wie `KeyPatternService`), Darstellung siehe §5.

## 5. Screens (Referenzen `docs/design/screens/GruppeErstellen.dc.html`, `GruppenChat.dc.html`)

**Kontakte (Ergänzung):**
- Header rechts drei Icon-Buttons: `settings` „Einstellungen“, `users` „Gruppe erstellen“ → `/gruppe/neu`, `plus` „Kontakt hinzufügen“.
- Gruppen stehen in derselben Liste wie Kontakte, sortiert nach letzter Aktivität. Gruppenzeile = `<a>` auf `/gruppe/:id`:
  Avatar **quadratisch** (48×48, Radius 14, Grund `--og-surface`, Rahmen 1px `--og-border`, Zellen in `--og-accent`),
  Name, **keine** Signalbalken, Zeile 2: letzte Nachricht als „<Absender>: <Text>“ bzw. „Du: <Text>“, ohne Nachricht
  „Gruppe · <n> Mitglieder“.

**Neue Gruppe (`/gruppe/neu`):**
1. `og-topbar` „Neue Gruppe“, back `/kontakte`, backLabel „Zurück zu den Kontakten“.
2. `og-card padded`: `og-text-field` „Gruppenname“ (maxlength 40).
3. Section-Label „MITGLIEDER · <n> VON 8“.
4. `og-card` mit `role="group" aria-label="Mitglieder auswählen"` und einer `og-check-row` pro Kontakt (Design-System).
   Sind 8 gewählt, werden die übrigen Zeilen `disabled`.
5. Hilfstext (13px `--og-text-3`): „Nur Kontakte mit abgeschlossenem Handshake. Jedes Mitglied bekommt den Gruppenschlüssel per Funk.“
6. Footer: `og-button primary` „Gruppe erstellen“ – aktiv bei gültigem Namen und ≥ 1 Mitglied → `create` → `/gruppe/:id` (replaceUrl).

**Gruppenchat (`/gruppe/:id`):**
- Header wie Chat, aber quadratischer Avatar 40 (Radius 12), Name, Meta „Gruppe · <n> Mitglieder“, **keine** Signalbalken.
- Eingehende Bubble: darüber Absendername (12px/650 `--og-text-2`, padding-left 6), nur wenn der vorherige Absender anders war.
- Ausgehend: `og-message-bubble` wie im Einzelchat mit Status `sent`/`queued`/`failed` (also Meta „<HH:mm> · gesendet“
  mit Balken Level 2, „in Warteschlange“, „Nicht gesendet“ + „Erneut senden“). `delivered` kommt in Gruppen nie vor.
- Composer **ohne** Standort-Button; Placeholder/Label „Nachricht an <Gruppenname>“, `maxBytes` = `maxGroupContentBytes`.
- Fehlertexte: `group-name-invalid` „Der Gruppenname muss 1 bis 40 Zeichen lang sein.“ · `group-no-members`
  „Wähle mindestens ein Mitglied.“ · `group-too-many` „Höchstens 8 Mitglieder.“ · `group-too-large`
  „Zu viele oder zu lange Namen für einen Funkspruch. Wähle weniger Mitglieder.“ · `group-duplicate-names`
  „Zwei Mitglieder haben denselben Namen. Benenne einen Kontakt um.“

## 6. Tests (T20)

`group.service.spec.ts`: zwei Geräte (wie Handshake-Test) mit bestehendem Kontakt → A erstellt Gruppe → B erhält
Gruppe mit gleichem Namen → A sendet `gmsg` → B speichert mit `sender_name` = A; Duplikat wird ignoriert;
`maxGroupContentBytes(222, 'HolyG')` = 120.
