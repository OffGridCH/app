# OffGrid – Schnittstelle App ↔ Antenne (Offgrid Link v1)

Diese Seite ersetzt den früheren Vorschlag („Funkmodem“). **Verbindlich** sind die drei Spezifikationen des Firmware-Teams
im Firmware-Repo `OffGridCH/firmware`:

| Dokument | Datei | Inhalt |
|---|---|---|
| Offgrid Host Interface v1 | `docs/offgrid-link.md` | Serial-API Android ⇄ Heltec V3: Rahmen, Befehle, Ereignisse, Fehlercodes, Limits, Provisioning und Entsperren |
| Offgrid Protocol v1 | `docs/offgrid-protocol.md` | Funk-Protokoll zwischen den Geräten (Paketformat, Verschlüsselung, Mesh). Das **Gerät** setzt es um; die App baut es nicht |
| Firmware Architecture v1 | `docs/offgrid-firmware-architecture_v1.md` | Modulaufteilung des Geräts |

Bei Widerspruch gilt die Spezifikation. Diese Seite fasst nur zusammen, was die App davon braucht, und nennt die Stellen im App-Code.
Die App-Skills (`.kilo/skills/offgrid-antenna-protocol`, `offgrid-crypto-handshake`) beschreiben die Umsetzung in der App.

## 1. Aufgabenteilung

| Das Gerät (Heltec V3) | Die App |
|---|---|
| Identitätsschlüssel, Kontaktschlüssel, Verschlüsselung, Nonces, Zähler, Replay-Fenster | zeigt Oberfläche, speichert den Nachrichtenverlauf |
| Kontaktliste (Name, `node_id`, `public_key`, `fingerprint`, Zähler, Signal) | spiegelt die Kontakte lokal, ohne Schlüssel |
| Funk, Mesh, Wiederholungen, Quittungen | schickt Klartext mit `msg.send`, bekommt `msg.received` und `msg.status` |
| Tresor in Flash, nur mit dem Entsperr-Token lesbar | hält das Entsperr-Geheimnis `K_phone` im Android Keystore |

## 2. Verbindung und Rahmen

| Wert | Spezifikation |
|---|---|
| Link | USB-Serial, 115200 Baud, 8N1, kein Flow Control |
| DTR/RTS | die App setzt beide **sofort nach dem Öffnen auf low**, sonst setzt sich der ESP32 zurück |
| Format | JSON Lines: ein JSON-Objekt pro Zeile, UTF-8, mit `\n` abgeschlossen (ein `\r` davor wird toleriert) |
| Zeilenlänge | höchstens **2048 Bytes** inklusive LF, in beide Richtungen |
| Anfrage | `{"id":…,"cmd":"namespace.verb","args":{…}}` |
| Antwort | `{"id":…,"ok":true,"result":{…}}` oder `{"id":…,"ok":false,"error":{"code","message","field"?}}` |
| Ereignis | `{"evt":…,"t":…,"data":{…}}`; wird nie beantwortet |
| Anfragen in Flight | höchstens 4 |
| Zeitlimit | 2 s; 5 s für `sec.*`, `pair.complete`, `contact.delete` |
| Boot | die App ignoriert Zeilen ohne führendes `{`, verwirft alles bis zum ersten `\n` nach dem Öffnen und wiederholt `sys.hello` alle 500 ms |
| Heartbeat | die App sendet alle 5 s `sys.ping`; ohne gültige Zeile sperrt sich das Gerät nach 15 s selbst |

## 3. Zustände

`unprovisioned` (frisch, kein Tresor) → `sec.provision` → `unlocked`. `locked` (Tresor da, verschlüsselt) → `sec.unlock` → `unlocked`.
Ein Neustart führt immer zu `locked`. Welcher Befehl in welchem Zustand geht, steht in Host Interface §5.1.

## 4. Befehle und Ereignisse, die die App benutzt

| Gruppe | Befehle |
|---|---|
| `sys.*` | `sys.hello`, `sys.status`, `sys.ping`, `sys.reboot` |
| `sec.*` | `sec.provision`, `sec.unlock`, `sec.lock` |
| `id.*` | `id.get`, `id.set_name` |
| `pair.*` | `pair.begin`, `pair.cancel`, `pair.complete` |
| `contact.*` | `contact.list`, `contact.get`, `contact.rename`, `contact.delete` |
| `msg.*` | `msg.send` (`text`, `reaction`, `geo`), `msg.cancel`, `msg.pending` |
| `radio.*`, `mesh.*`, `led.*` | `radio.get`, `radio.set`, `mesh.get`, `mesh.set`, `led.get`, `led.set` (nur als Dienst, noch ohne Oberfläche) |

Die App wertet die Ereignisse `sys.boot`, `sec.state`, `msg.received`, `msg.status` und `contact.state` aus.
**Nicht benutzt:** `sys.factory_reset`, `sys.set_log_level`, `sec.rotate_token`, `sec.get_policy`, `sec.set_policy`, `radio.stats`, `led.test`,
`dbg.*`, die Ereignisse `rf.tx`, `rf.rx`, `log`, `error`.

## 5. Zahlen

| Wert | Zahl |
|---|---|
| Text pro Nachricht | **83 Bytes** (`limits.max_text_bytes`; längere Texte teilt die App) |
| Namen (eigener Name, Kontaktname) | 1–24 Bytes UTF-8 |
| Kontakte | 32 |
| Warteschlange im Gerät | 8 (nur RAM) |
| `contact.list` | höchstens 10 je Seite |
| Auto-Lock | 15 s |
| Pairing läuft ab | 300 s |
| Entsperr-Token / `wrapped_token` | 32 Bytes / 60 Bytes |
| Fehlversuche beim Entsperren | nach 3 in Folge 2 s Sperre, doppelt, höchstens 60 s |

## 6. Entsperren (Kurzfassung)

1. `sys.hello` liefert `device_id`, `session { device_eph_pub, nonce }` und den Zustand.
2. Die App rechnet `unlock_token = HMAC-SHA256(K_phone, "og-unlock-v1" ‖ device_id_bytes)` mit dem Schlüssel aus dem Android Keystore.
3. Sie packt das Token ein: X25519 mit `device_eph_pub`, HKDF-SHA256 (`salt = nonce`, `info = "og-unlock-wrap-v1" ‖ device_id_bytes`),
   AES-256-GCM (`aad = device_id_bytes`) → `wrapped_token` = IV (12) ‖ Chiffretext (32) ‖ Tag (16) = 60 Bytes.
4. `sec.provision` (frisches Gerät, mit `name`) oder `sec.unlock`. Die Sitzung ist einmalig: nach jedem Versuch ein neues `sys.hello`.

Der Testvektor (`device_id` `7CDFA100ABCD`) steht in Host Interface §11.1; die App prüft ihn in `src/app/core/keystore/unlock-wrap.spec.ts`.

## 7. Pairing (Kurzfassung)

`pair.begin` liefert `qr` = Base64 von `"OG1" ‖ public_key (32) ‖ salt (16) ‖ name`; die App zeigt diesen Text als QR-Code. Beide Personen scannen
den Code des anderen und rufen `pair.complete`. Das Gerät antwortet mit dem Kontakt (`state: pending`, `fingerprint`); nach dem ersten gültigen
Paket des Gegenübers meldet es `contact.state` → `active`. Der Fingerabdruck ist auf beiden Handys gleich, wenn nichts verfälscht wurde.

## 8. Offene Punkte an das Firmware-Team

Die frühere Fragenliste (Payload, SF/BW/CR, Duty-Cycle, USB-Chip) ist durch die Spezifikationen beantwortet. Offen aus Sicht der App:

| Frage | Grund |
|---|---|
| Kann `geo` Live-Updates zu **einer** Nachricht kennzeichnen (Freigabe-Id, Ende)? | Live-Standort (T19) braucht das; Host Interface §7.5 kennt es nicht |
| Gruppenchat (T20): Die Spezifikationen stellen Gruppen „out of scope“ (Host Interface §13, Protocol §1). Soll die App Gruppen aus Einzelnachrichten bauen, oder entfällt T20? | Gruppenchat wurde für das alte Funkmodem entworfen |
