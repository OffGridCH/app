# T23 – Protokoll auf Offgrid Link v1 umstellen

**Abhängig von:** T03, T04
**Skills:** `offgrid-antenna-protocol`, `offgrid-crypto-handshake`, `offgrid-data`, `offgrid-screens`,
`offgrid-location`, `offgrid-testing`, `offgrid-architecture`
**Dateien:** `src/app/core/antenna/**`, `src/app/core/keystore/**`, `src/app/core/cessaging/**`,
`src/app/core/messaging/**`, `src/app/core/handshake/**`, `src/app/core/crypto/**`, `src/app/core/data/**`,
`src/app/app.config.ts`, `src/app/app.component.ts`, `.kilo/skills/offgrid-antenna-protocol/SKILL.md`,
`.kilo/skills/offgrid-crypto-handshake/SKILL.md`, `.kilo/skills/offgrid-data/SKILL.md`,
`.kilo/skills/offgrid-screens/SKILL.md`, `.kilo/skills/offgrid-location/SKILL.md`,
`.kilo/skills/offgrid-testing/SKILL.md`, `docs/esp-schnittstelle.md`, `doku/**`

Ausnahme zu AGENTS.md Regel 8: Dieses Ticket erlaubt ausdrücklich Änderungen an `.kilo/**` und `docs/**`.

## Ziel
Das Gerät (Heltec V3) besitzt Identitätsschlüssel, Kontaktschlüssel, Verschlüsselung, Nonces, Zähler,
Replay-Fenster und die Kontaktliste. Die App ist UI- und Verlaufs-Client: sie spricht die Host-API v1
über USB-Serial (JSON Lines) und hält nur das Entsperr-Geheimnis im Android Keystore.

## Umfang
1. `src/app/core/messaging/limits.ts`: `maxContentBytes(max)` gibt das gemeldete Textlimit unverändert
   zurück (kein 33-Byte-Abzug, keine feste Obergrenze, keine JSON-Escapes); `contentBytes` = UTF-8-Bytes
   des Textes; `isValidDisplayName` = 1–24 UTF-8-Bytes. Tests: 83 → 83 und ein weiteres gemeldetes Limit.
2. `src/app/core/antenna/serial-client.ts`: JSON-Lines. Request `{"id":…,"cmd":"ns.verb","args":{…}}`,
   Response `{"id":…,"ok":true,"result":{…}}` bzw. `{"id":…,"ok":false,"error":{"code","message","field"?}}`,
   Event `{"evt":…,"t":…,"data":{…}}`. IDs eindeutig und monoton; höchstens 4 Requests in Flight;
   Zeilenlimit 2048 Byte inkl. LF; CR am Zeilenende tolerieren; Zeilen ohne führendes `{` verwerfen;
   bis zum ersten `\n` nach dem Öffnen verwerfen; Zeitlimit 2 s, 5 s für `sec.*`, `pair.complete`,
   `contact.delete`; `sys.hello` alle 500 ms wiederholen; `sys.ping` alle 5 s als Heartbeat.
3. `src/app/core/antenna/antenna-port.ts`: Zustandsautomat `unprovisioned` / `locked` / `unlocked` /
   `disconnected` mit den Fehlercodes der Spezifikation (`E_LOCKED`, `E_NOT_PROVISIONED`,
   `E_ALREADY_PROVISIONED`, `E_ALREADY_UNLOCKED`, `E_NO_SESSION`, `E_UNLOCK_FAILED`, `E_RATE_LIMITED`,
   `E_PROTO_MISMATCH`, `E_TOO_LONG`, `E_QUEUE_FULL`, `E_NO_SUCH_CONTACT`, `E_INVALID_ARG`, …).
4. `src/app/core/antenna/mock-device.ts`: simuliertes Gerät für den Browser mit denselben Befehlen,
   Antworten und Events wie das echte Gerät (`sys.hello` mit `limits {max_line 2048, max_contacts 32,
   max_text_bytes 83, pending_queue 8}`, `sys.status`, `sys.ping`, `sec.provision`, `sec.unlock`,
   `sec.lock`, `id.get`, `id.set_name`, `pair.begin`, `pair.complete`, `contact.list`, `contact.get`,
   `contact.rename`, `contact.delete`, `msg.send`, `msg.cancel`, `msg.pending`, `radio.get`, `radio.set`,
   `mesh.get`, `mesh.set`, `led.get`, `led.set`) inklusive Events `sys.boot`, `sec.state`,
   `msg.received`, `msg.status`, `contact.state`.
5. `src/app/core/keystore/`: `KeystoreService` als Schnittstelle mit einer Browser-Implementierung
   (In-Memory-Key, nur für Tests/Demo) und einer Android-Implementierung über das native Keystore
   (`HMAC-SHA256` mit nicht exportierbarem Schlüssel, `X25519`, `HKDF-SHA256`, `AES-256-GCM`).
   Ablauf: `K_phone` → `unlock_token = HMAC-SHA256(K_phone, "og-unlock-v1" || device_id_bytes)`;
   `shared = X25519(app_eph_priv, device_eph_pub)`;
   `wrap_key = HKDF-SHA256(shared, salt = nonce, info = "og-unlock-wrap-v1" || device_id_bytes, L = 32)`;
   `wrapped_token = iv(12) || AES-256-GCM(wrap_key, token, aad = device_id_bytes)` = 60 Byte.
   `sys.hello` liefert je Sitzung `device_eph_pub` + `nonce`; die Sitzung ist einmalig – nach jedem
   Provision-/Unlock-Versuch ein neues `sys.hello`.
   X25519 ohne WebCrypto-Unterstützung: portiere die Referenz aus Appendix B der Host-Spezifikation
   nach TypeScript und prüfe gegen den Testvektor der Spezifikation
   (`wrapped_token = cHFyc3R1dnd4eXp73iix4tUwvI3SCLdQkDcf6Ipj4SeWMvHCxsuoTYQbFZG8FDO6Y7fb7GfNujVODYXb`).
6. `src/app/core/messaging/messaging.service.ts`: Senden über `msg.send` (`type: "text"`), Text auf
   `limits.max_text_bytes` (83 Byte) aufteilen; Status aus `msg.status`
   (`queued`/`sent`/`relayed`/`retrying`/`delivered`/`failed` mit `reason`); Eingang aus `msg.received`.
7. `src/app/core/handshake/handshake.service.ts`: `pair.begin` liefert den QR-Text (Base64 „OG1“ +
   32 Byte Public-Key + 16 Byte Salt + Name) für den QR-Code; `pair.complete` liefert den Kontakt mit
   `fingerprint`; Kontakte über `contact.list`/`contact.get` spiegeln.
8. `src/app/core/data/**`: Schema ohne Kontaktschlüssel – `contacts` nur mit `contact_id`, `name`,
   `node_id`, `public_key`, `state`, `fingerprint`, `last_rssi`, `last_snr`, `tx_ctr`, `rx_highest_ctr`;
   `messages` ohne `wire_id`, stattdessen `ctr` und `msg_ref`. Da noch keine released Version existiert,
   darf Migration v1 angepasst werden (kein Nutzerdatenschutz nötig) – im PR vermerken.
   Bestehende Kontakt-/Nachrichten-Repositories anpassen, Demo-Seed anpassen.
9. Entfernen: `src/app/core/crypto/crypto.service.ts` (app-seitige Nachrichtenverschlüsselung) und
   `src/app/core/crypto/key-pattern.service.ts` (5×5-Schlüsselmuster) samt Spec-Dateien. Der vom Gerät
   gelieferte `fingerprint` ersetzt das Muster.
10. Skills neu schreiben:
    - `offgrid-antenna-protocol`: Envelope, Befehlsgruppen, Zustände, Events, Fehlercodes, Limits
      (83 / 24 / 2048 / 32 / 8 / 5 s Heartbeat / 15 s Auto-Lock / 300 s Pairing), DTR/RTS **low**,
      `sys.hello`-Retry, `msg.*`, `pair.*`, `contact.*`, `radio.*`, `mesh.*`, `led.*`. Kein app-seitiger
      Funk-Frame, kein `hello`/`info`/`tx`/`txdone`/`rx`, kein 33-Byte-Overhead.
    - `offgrid-crypto-handshake`: §1/§4 auf Keystore-Token + Wrap umstellen, Fingerprint statt Muster.
    - `offgrid-data`: Schema ohne Schlüssel, `ctr`/`msg_ref` statt `wire_id`.
    - `offgrid-screens`: betroffene Stellen (Provisioning/Unlock, Fingerprint, Splitting an 83 Byte,
      Reaktionen, Einstellungen) – nur die Stellen anfassen, die der neue Vertrag berührt.
    - `offgrid-location`: Standort als `msg.send` mit `type: "geo"` (`lat`, `lon`, `alt_m`, `age_s`).
    - `offgrid-testing`: Pflichtprüfungen anpassen (Textlimit 83 → 83, kein `(100) = 67`).
11. `docs/esp-schnittstelle.md`: alten Vorschlag durch die verbindlichen Spezifikationen ersetzen
    (Verweis auf die drei Dokumente, Zahlen übernehmen, nichts erfinden).
12. `doku/**`: betroffene Seiten auf den neuen Vertrag umstellen (Architektur, Services, Datenmodell,
    Funktionen, Tests, Änderungen).

## Akzeptanzkriterien
- [ ] `maxContentBytes(83)` = 83; ein weiteres gemeldetes Limit unverändert; `isValidDisplayName` 24 ja / 25 nein.
- [ ] Jeder Request bekommt genau eine Response mit gleicher `id`; Events werden nie beantwortet.
- [ ] höchstens 4 Requests in Flight; Zeilen > 2048 Byte werden abgewiesen.
- [ ] `sys.hello` wird alle 500 ms wiederholt, bis eine Antwort kommt; `sys.ping` alle 5 s.
- [ ] Der Browser-Mock beantwortet dieselben Befehle und erzeugt `msg.status`, `msg.received`,
      `contact.state`, `sec.state`.
- [ ] Der Wrap erzeugt 60 Byte und stimmt mit dem Testvektor der Spezifikation überein.
- [ ] Kein Skill und keine Doku-Seite nennt mehr `hello`/`info`/`tx`/`txdone`/`rx`,
      `min(180, max - 69)`, 33-Byte-Frame-Overhead, app-seitige AES-GCM-Nachrichten oder das
      5×5-Schlüsselmuster.
- [ ] `npm run check` und `npm run docs:build` laufen fehlerfrei.

## Nicht im Umfang
USB-Serial-Plugin (T06), Screens (T09–T13), Standort-UI (T18), Backup (T14), Gruppenchat (T20),
Hardware-Tests (T15).
