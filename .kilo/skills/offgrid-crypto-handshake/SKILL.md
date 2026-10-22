---
name: offgrid-crypto-handshake
description: Schlüssel, Verschlüsselung, QR-Handshake-Ablauf (beide Rollen), Schlüssel-Muster (Profilbild) und verschlüsseltes Backup der OffGrid-App. Laden bei core/crypto, core/handshake, core/backup und bei den Seiten Handshake, Kontakt benennen, Export, Import.
---

# Krypto, Handshake, Backup

Nur WebCrypto (`crypto.subtle`, `crypto.getRandomValues`). Keine Bibliotheken.

## 1. CryptoService (`core/crypto/crypto.service.ts`)

| Methode | Verhalten |
|---|---|
| `newKey(): string` | 16 Zufallsbytes → 32 Zeichen **Kleinbuchstaben-Hex** (passt zu `CHAR(32)` im ERD) |
| `tag(keyHex): Promise<string>` | SHA-256 der 16 Rohbytes, erste 4 Bytes als 8 Hex-Zeichen. Ergebnis cachen (Map). |
| `encrypt(keyHex, plain: Uint8Array, aad: Uint8Array)` | AES-GCM 128 Bit, IV 12 Zufallsbytes, Tag 128 Bit → `{ iv, data }` |
| `decrypt(keyHex, iv, data, aad)` | wirft bei Fehler |
| `randomHex(bytes): string` | z. B. `wireId` (4 Bytes) |

Hilfsfunktionen in `hex.ts` (`toHex`, `fromHex`) und `base64.ts` (`toBase64`, `fromBase64`) – mit Tests.

## 2. Rollen der Schlüssel pro Kontakt

- `sending_key`: damit verschlüssele **ich** Frames an diesen Kontakt.
- `receiving_key`: damit verschlüsselt **der Kontakt** Frames an mich. Eingehende Frames werden über `tag(receiving_key)` zugeordnet.

## 3. Handshake-Ablauf

Begriffe: **A** zeigt den QR-Code (Tab „Mein Code“), **B** scannt (Tab „Code scannen“).

1. **A** `startShowing()`: `K_A = newKey()`. Handshake speichern: `role 'shower'`, `local_key K_A`, `state 'waiting'`.
   QR-Text: `JSON.stringify({ v: 1, k: K_A, n: <mein Anzeigename> })`. Ein neuer Aufruf bricht offene `shower`-Handshakes ab
   (`state 'cancelled'`).
2. **B** `scanned(qrText)`: JSON parsen und prüfen (`v === 1`, `k` = 32 Hex, `n` erfüllt `isValidDisplayName` aus `core/messaging/limits.ts`); sonst Fehler `invalid-qr`.
   `K_B = newKey()`. Handshake speichern: `role 'scanner'`, `local_key K_B`, `remote_key K_A`, `peer_name n`, `state 'sent'`.
   Frame `hs` mit Schlüssel **K_A**, Klartext `{ k: K_B, n: <mein Anzeigename> }` → senden.
   Ist die Antenne nicht `ready`: Fehler `antenna-not-ready` (Seite zeigt Hinweis), Handshake bleibt `sent` und wird bei
   `ready` erneut gesendet – **nur** Handshakes, die in dieser App-Sitzung per `scanned()` entstanden sind
   (IDs in einem `Set` im Service merken). Ältere `sent`-Handshakes (z. B. aus dem Demo-Seed) werden nie automatisch gesendet.
3. **A** empfängt `hs`: offenen `shower`-Handshake suchen, dessen `tag(local_key)` dem Frame-Tag entspricht; entschlüsseln.
   Kontakt anlegen: `sending_key = K_A`, `receiving_key = K_B`, `display_name = n` (von B), `handshake_at = jetzt`.
   Handshake `state 'done'`, `contact_id` setzen. Frame `hsa` mit Schlüssel **K_A**, Klartext `{ ok: 1 }` senden.
   `completedContactId` setzen → Seite navigiert zu `kontakte/neu/fertig/:id`. `DataChangedService.notify()`.
   Passt ein `hs` zu keinem offenen, aber zu einem Handshake aus `HandshakeRepository.doneShowers()` (gleicher Tag,
   entschlüsselbar): **nur** `hsa` erneut senden
   (B hat das erste `hsa` verpasst). Kein zweiter Kontakt.
4. **B** empfängt `hsa`: offenen `scanner`-Handshake suchen, dessen `tag(remote_key)` dem Frame-Tag entspricht; entschlüsseln.
   Kontakt anlegen: `sending_key = K_B`, `receiving_key = K_A`, `display_name = peer_name`, `handshake_at = jetzt`.
   Handshake `state 'done'`. `completedContactId` setzen → Navigation wie oben. `DataChangedService.notify()`.

`startShowing()`, `scanned()`, `cancel()` und `clearCompleted()` setzen `completedContactId` auf null.
Die Seite „Kontakt benennen“ ruft beim Öffnen `clearCompleted()` auf.

Ergebnis: A sendet mit K_A, B empfängt mit K_A; B sendet mit K_B, A empfängt mit K_B.

`HandshakeView` (für die Seite):
```ts
{ role: 'shower' | 'scanner'; step: 1 | 2 | 3; qrText?: string; peerName?: string; error?: HandshakeErrorCode }
```
- shower: step 1 = Code bereit (done), step 2 = Gegenüber scannt (active), step 3 = Antwort per Funk empfangen (todo).
- scanner nach Scan: step 1 = Code gescannt (done), step 2 = Schlüssel per Funk gesendet (active bis `txdone ok`, dann done),
  step 3 = Bestätigung empfangen (active nach `txdone`).
`HandshakeErrorCode = 'invalid-qr' | 'antenna-not-ready' | 'scan-cancelled' | 'scanner-unavailable'`

## 4. Schlüssel-Muster (`KeyPatternService`)

Gleiches Muster auf beiden Handys → Menschen können vergleichen, ob der Austausch stimmt.

- Kontakt: Eingabe = die beiden Schlüssel **sortiert** (String-Vergleich), aneinandergehängt, als UTF-8 → SHA-256 → 32 Bytes.
- Eigenes Muster (Einstellungen, Leerzustand): Eingabe = `install_id` als UTF-8 → SHA-256.
- 5×5 Raster, spiegelsymmetrisch: für Zeile `y` 0–4 und Spalte `x` 0–2: `an = (bytes[y*3 + x] & 1) === 1`.
  Spalte 3 = Spalte 1, Spalte 4 = Spalte 0. Ergebnis `boolean[25]` zeilenweise.
- Ausnahme: hat ein Muster weniger als 5 „an“-Zellen, wird zusätzlich die Mittelzelle (Index 12) und Zeile 2 Spalte 1/3 gesetzt
  (damit nie ein fast leeres Bild entsteht).

## 5. Backup (Export/Import) – `BackupService`

Klartext-Inhalt (JSON):
```json
{ "format": "offgrid-backup-data", "v": 1, "createdAt": "<ISO>",
  "displayName": "...", "contacts": [ /* Contact */ ], "messages": [ /* Message */ ],
  "coordinates": [ /* Coordinate */ ],
  "groups": [], "groupMembers": [], "groupMessages": [] }   // Gruppen-Felder erst ab T20, beim Import optional
```
Handshakes und Settings ausser `displayName` werden **nicht** exportiert.

Verschlüsselung: PBKDF2-SHA-256, 210 000 Iterationen, Salt 16 Bytes → AES-256-GCM, IV 12 Bytes.
Datei (JSON, UTF-8), Name `offgrid-backup-YYYY-MM-DD.ogx`:
```json
{ "format": "offgrid-backup", "v": 1, "kdf": "pbkdf2-sha256", "iter": 210000,
  "salt": "<b64>", "iv": "<b64>", "data": "<b64>" }
```

Export: Passwort mind. 8 Zeichen, beide Felder gleich. Datei mit
`Filesystem.writeFile({ path, data, directory: Directory.Cache, encoding: Encoding.UTF8 })`, danach mit der `uri` aus dem
Ergebnis `Share.share({ files: [uri], title: 'OffGrid-Backup' })`.
Browser-Export: Datei als Blob über ein erzeugtes `<a download>` herunterladen (in `core/backup/file-io.ts`).
Import `pickFile()`: nativ `FilePicker.pickFiles({ limit: 1, readData: true })` → `files[0].name` und `files[0].data`
(Base64) → als UTF-8-Text dekodieren. Browser: erzeugtes `<input type="file" accept=".ogx">` → `File.text()`;
Event `cancel` des Inputs → `null`.
Abbruch → `null` (kein Fehler, kein Text).
`import(fileText, password)`: JSON parsen, prüfen `format`, `v`, `kdf` (sonst `invalid-file`). Falsches Passwort → `wrong-password`.
Erfolg → `DatabaseService.replaceAll(...)`, `DataChangedService.notify()`, danach navigiert die Seite zu `kontakte`.
`BackupErrorCode = 'wrong-password' | 'invalid-file' | 'write-failed'` (Passwort-Prüfungen sind `FormErrorCode`, siehe `offgrid-screens` §0)

## 6. Ehrlich bleiben

- Die App verspricht nirgends „sicher“ oder „Ende-zu-Ende“. Texte nur aus Skill `offgrid-screens`.
- Bekannte Grenze (nur Doku, nicht UI): Wer den QR-Code fotografiert, kann den Handshake mitlesen.
