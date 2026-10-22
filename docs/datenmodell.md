# OffGrid – Datenmodell (Stand Planung + Ergänzungen fürs Frontend)

Grundlage ist das ERD aus der Planung (contacts, messages, coordinates). Die verbindliche SQL-Fassung steht im Skill
`.kilo/skills/offgrid-data/SKILL.md`. Hier die Änderungen gegenüber dem ERD mit Begründung – **bitte mit dem Team bestätigen.**

| Tabelle.Feld | ERD | Neu | Warum |
|---|---|---|---|
| `contacts.created_at` | `NM` | `NN` | Tippfehler im ERD |
| `contacts.last_rssi` | – | `INTEGER NULL` | Signalbalken pro Kontakt in der Kontaktliste |
| `contacts.last_seen_at` | – | `TEXT NULL` | „zuletzt 14:06“ im Chat, Signal veraltet nach 15 min |
| `messages.direction` | `BOOLEAN` | `TEXT 'in'/'out'` | eindeutig lesbar, kein Rätseln was `true` heisst |
| `messages.status` | `INT` | `INT 0–3` mit fixer Bedeutung | 0 Warteschlange · 1 gesendet · 2 zugestellt · 3 fehlgeschlagen |
| `messages.wire_id` | – | `CHAR(8)` | kurze ID im Funkpaket für Zustellbestätigung (GUID wäre zu gross) |
| `messages.rssi` | – | `INTEGER NULL` | Signal beim Empfang |
| `messages.read_at` | – | `TEXT NULL` | Ungelesen-Zähler |
| `handshakes` | – | neue Tabelle | Handshake überlebt App-Neustart, „Schlüssel ausstehend“ in der Liste |
| `settings` | – | neue Tabelle (key/value) | Anzeigename, Install-ID, Schalter |
| `messages.kind` | – | `TEXT 'text'/'location'` | Standort ist eine Nachricht mit Zustellstatus |
| `coordinates` | wie ERD | + `message_id`, `accuracy`, `share_id`, `share_until`; `latitude`/`longitude`/`recorded_at` Pflicht; `context` = `'einmal'`/`'live'` | Standort senden/empfangen, Genauigkeit anzeigen, Live-Standort (optional) |
| `groups`, `group_members`, `group_messages` | – | neue Tabellen (Migration v2, nur optionales T20) | Gruppenchat |

Schlüssel: `CHAR(32)` = 16 Zufallsbytes als Hex → AES-128-GCM.
`sending_key` = damit verschlüssle ich an den Kontakt, `receiving_key` = damit verschlüsselt der Kontakt an mich.
