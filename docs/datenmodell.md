# OffGrid – Datenmodell (Stand Planung + Ergänzungen fürs Frontend)

Grundlage ist das ERD aus der Planung (contacts, messages, coordinates). Die verbindliche SQL-Fassung steht im Skill
`.kilo/skills/offgrid-data/SKILL.md`. Hier die Änderungen gegenüber dem ERD mit Begründung – **bitte mit dem Team bestätigen.**

| Tabelle.Feld | ERD | Neu | Warum |
|---|---|---|---|
| `contacts` | `id`, Schlüssel, Namen, … | `contact_id` (Platz 1–32 auf dem Gerät), `name`, `node_id`, `public_key`, `state`, `fingerprint`, `last_rssi`, `last_snr`, `tx_ctr`, `rx_highest_ctr` | Das **Gerät** besitzt die Kontakte und alle Schlüssel (Offgrid Host Interface v1); die App spiegelt sie ohne Schlüssel |
| `messages.direction` | `BOOLEAN` | `TEXT 'in'/'out'` | eindeutig lesbar, kein Rätseln was `true` heisst |
| `messages.status` | `INT` | `INT 0–3` mit fixer Bedeutung | 0 Warteschlange · 1 gesendet · 2 zugestellt · 3 fehlgeschlagen |
| `messages.ctr` | – | `INTEGER NULL` | Zähler der Nachricht in der Unterhaltung (vom Gerät); Ziel einer Reaktion (`ctr & 0xFFFF`) und Schutz vor Doppelten |
| `messages.msg_ref` | – | `INTEGER NULL` | lokaler Handle des Geräts für `msg.status`, nur bis zum nächsten Gerätestart gültig |
| `messages.rssi` | – | `INTEGER NULL` | Signal beim Empfang |
| `messages.read_at` | – | `TEXT NULL` | Ungelesen-Zähler |
| `settings` | – | neue Tabelle (key/value) | Anzeigename, Install-ID, Schalter |
| `messages.kind` | – | `TEXT 'text'/'location'` | Standort ist eine Nachricht mit Zustellstatus |
| `coordinates` | wie ERD | + `message_id`, `accuracy`, `share_id`, `share_until`; `latitude`/`longitude`/`recorded_at` Pflicht; `context` = `'einmal'`/`'live'` | Standort senden/empfangen, Genauigkeit anzeigen, Live-Standort (optional) |
| `groups`, `group_members`, `group_messages` | – | neue Tabellen (Migration v2, nur optionales T20) | Gruppenchat |

Es gibt **keine** Tabelle `handshakes` und **keine** Schlüsselspalten: Pairing und Schlüsselableitung macht das Gerät (`pair.begin`, `pair.complete`).
Migration v1 wurde mit T23 einmalig umgeschrieben (noch keine veröffentlichte App, keine Nutzerdaten).
