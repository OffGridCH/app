---
name: offgrid-crypto-handshake
description: Entsperr-Geheimnis im Android Keystore (Token und Einpacken für das Gerät), QR-Handshake über die Host-API (pair.begin/pair.complete), Fingerabdruck und verschlüsseltes Backup der OffGrid-App. Laden bei core/keystore, core/handshake, core/backup und bei den Seiten Handshake, Kontakt benennen, Export, Import.
---

# Entsperr-Geheimnis, Handshake, Backup

> Verbindliche Quelle: Offgrid Host Interface v1 (§6 Sicherheit, §7.4 Pairing). **Das Gerät** besitzt Identitätsschlüssel,
> Kontaktschlüssel, Nonces, Zähler und Replay-Fenster und verschlüsselt jede Nachricht selbst. Die App verschlüsselt
> **keine** Nachrichten und kennt **keine** Kontaktschlüssel. Das Einzige, was die App geheim hält, ist das
> Entsperr-Geheimnis `K_phone` im Android Keystore.
> Nur WebCrypto (`crypto.subtle`, `crypto.getRandomValues`) und ein eigenes X25519 (`core/keystore/x25519.ts`). Keine Bibliotheken.

## 1. Entsperr-Token und Einpacken (`core/keystore/`)

`KeystoreService` (abstrakte Klasse, DI-Token) hält `K_phone`. Der Schlüssel verlässt den Schlüsselspeicher nie; die App darf nur
`HMAC-SHA256` damit rechnen lassen. Implementierungen:

| Klasse | Wo | Schlüssel |
|---|---|---|
| `AndroidKeystoreService` | Android | nicht exportierbarer HMAC-SHA256-Schlüssel im nativen Keystore (Alias `offgrid_unlock`), über das Plugin `OffgridKeystore` (T06) |
| `BrowserKeystoreService` | Browser, Tests, Demo | zufälliger HMAC-Schlüssel im Arbeitsspeicher; **kein Schutz**, nur Ersatz |

Das Plugin `OffgridKeystore` kennt nur `hmac({ data: base64 }) → { mac: base64 }`. X25519, HKDF und AES-GCM laufen in TypeScript.

Ablauf (`KeystoreService.createUnlockEnvelope(session, deviceId)`):

```
unlock_token = HMAC-SHA256(K_phone, "og-unlock-v1" || device_id_bytes)                       32 Bytes, pro Gerät
app_eph      = neues X25519-Schlüsselpaar (einmalig)
shared       = X25519(app_eph_priv, device_eph_pub)                                           aus sys.hello
wrap_key     = HKDF-SHA256(ikm = shared, salt = nonce, info = "og-unlock-wrap-v1" || device_id_bytes, L = 32)
wrapped      = iv (12, zufällig) || AES-256-GCM(wrap_key, iv, plaintext = unlock_token, aad = device_id_bytes)
```

- `device_id_bytes` sind die **6 Rohbytes** der 12 Hex-Zeichen aus `sys.hello`.
- `wrapped_token` (Base64) hat **60 Bytes**: 12 IV, 32 Chiffretext, 16 Tag. `app_eph_pub` (Base64) hat 32 Bytes.
- `sys.hello` liefert pro Sitzung `session { device_eph_pub, nonce }`. Die Sitzung ist **einmalig**: nach **jedem**
  `sec.provision`/`sec.unlock`, auch nach einem Fehlschlag, ein neues `sys.hello`. Der Einmal-Schlüssel `app_eph` und der IV
  werden **bei jedem Versuch neu** erzeugt.
- Das Token geht nie unverpackt über das Kabel; die Einmal-Schlüssel schützen vor Mitlesen und Wiederholen.
- Ohne Android-Keystore (Browser) rechnet `BrowserKeystoreService` genauso, nur mit einem Schlüssel im Arbeitsspeicher.

**X25519** (`x25519.ts`): RFC 7748 mit `BigInt`, damit es auf jedem WebView läuft. Ein Punkt kleiner Ordnung (Ergebnis 0) ist ein Fehler.

**Pflichttest:** Mit `device_id` `7CDFA100ABCD`, `K_phone` `b16d81c5…5185` und den festen Einmal-Werten des Vertrags
(§11.1) muss `wrapped_token` genau
`cHFyc3R1dnd4eXp73iix4tUwvI3SCLdQkDcf6Ipj4SeWMvHCxsuoTYQbFZG8FDO6Y7fb7GfNujVODYXb` sein (`unlock-wrap.spec.ts`).
Das Gerät-Gegenstück `unwrapToken` gibt es nur für den Browser-Mock und die Tests.

## 2. Wer hält was

| Ding | Wo |
|---|---|
| `K_phone` | Android Keystore, nicht exportierbar |
| Identitäts-Schlüsselpaar, Kontaktschlüssel (`k_out`, `k_in`), Zähler, Replay-Fenster | Gerät (Tresor, mit dem Token entschlüsselt, nur im RAM) |
| Kontaktliste (Name, `node_id`, `public_key`, `fingerprint`, Zähler, Signal) | Gerät; die App spiegelt sie lokal ohne Schlüssel |
| Nachrichtenverlauf | App (SQLite), Klartext |

Wer das Handy verliert (Schlüssel weg), kann das Gerät nur noch zurücksetzen (`sys.factory_reset`, mit PRG-Taste am Gerät).
Das ist gewollt. Beim Zurücksetzen verliert das Gerät alle Schlüssel und Kontakte; der lokale Verlauf bleibt, ist aber keinem
Kontakt mehr zuzuordnen (Plätze werden neu vergeben).

## 3. Handshake-Ablauf (`HandshakeService`, `pair.*`)

Beide Personen zeigen ihren QR-Code **und** scannen den des anderen. Das Pairing macht das Gerät.

1. `begin()` → `pair.begin`. Ergebnis `qr` ist der **Text für den QR-Code** (Base64 von `"OG1" ‖ public_key (32) ‖ salt (16) ‖ name`),
   `expires_s` = 300. Es gibt nur ein offenes Pairing; ein neues ersetzt das alte. `cancel()` → `pair.cancel`.
   Den eigenen Code **nicht erneuern**, nachdem das Gegenüber ihn gescannt hat und bevor man selbst gescannt hat.
2. `complete(qrText, { name?, replace? })` → `pair.complete`. Vorher prüft die App nur, ob der Text nach einem OffGrid-Code aussieht
   (`looksLikeOffgridQr`: gültiges Base64, mindestens 51 Bytes, beginnt mit `OG1`); sonst `invalid-qr`. Alles Weitere prüft das Gerät.
   Das Gerät leitet das gemeinsame Geheimnis und beide Richtungsschlüssel ab und legt den Kontakt als `pending` an.
   Ergebnis: der Kontakt samt `fingerprint`. Die App speichert ihn (ohne Schlüssel) und setzt `completedContactId`;
   die Seite navigiert zu „Kontakt benennen“.
3. Der Kontakt bleibt `pending`, bis das erste gültige Paket des Gegenübers eintrifft; dann meldet das Gerät `contact.state` →
   `active`. Solange nichts vom Gegenüber ankommt (z. B. weil es nicht gescannt hat), bleibt er `pending`.
4. `rename(contactId, name)` → `contact.rename` (1–24 Bytes). `remove(contactId)` → `contact.delete` (`confirm: true`) und lokal samt Verlauf.

Kontakte spiegeln: `syncContacts()` holt alle Kontakte mit `contact.list` (Seiten zu 10) und speichert sie; sie läuft bei jedem
Entsperren. `refreshContact(contactId)` holt einen einzelnen (`contact.get`), z. B. wenn eine Nachricht von einem unbekannten
Platz kommt. Hat ein Platz inzwischen einen anderen `public_key`, gehört der alte Verlauf nicht mehr zu ihm und wird gelöscht.

Fehlercodes der Seite (`HandshakeErrorCode`): `invalid-qr`, `antenna-not-ready`, `scan-cancelled`, `scanner-unavailable`, `no-pairing`
(Gerät: `E_NO_PAIRING`), `self-pair` (`E_SELF_PAIR`), `contact-exists` (`E_CONTACT_EXISTS`), `storage-full` (`E_STORAGE_FULL`),
`pairing-failed` (alles andere).

`HandshakeService` hält: `qrText`, `qrExpiresAt`, `error`, `completedContactId`. `startShowing`/`scanned` der alten Fassung
gibt es nicht mehr. Schritte der Seite „Handshake“ (Skill `offgrid-screens`) ergeben sich aus diesen Signals:
Code bereit = `qrText` gesetzt; Gegenüber hat gescannt und ich scanne = `completedContactId` gesetzt.

## 4. Fingerabdruck (statt Schlüssel-Muster)

Der vom Gerät gelieferte `fingerprint` ersetzt das frühere Vergleichsbild. Er besteht aus **drei Vierergruppen** (z. B. „0501 3010 7790“)
und ist auf beiden Handys **gleich**, wenn der Austausch nicht verfälscht wurde. Berechnung (auf dem Gerät):
`SHA256("og1-fp" ‖ pub_low ‖ pub_high)`, Schlüssel bytweise sortiert; die ersten 8 Bytes als Big-Endian-Zahl modulo 10¹².
Die App **zeigt** ihn nur an (Seite „Kontakt benennen“, Kontaktdetails) und bittet beide Personen, ihn zu vergleichen. Sie berechnet
ihn nie selbst (ausser im Browser-Mock, damit er sich wie auf dem Gerät verhält). Er ist optional: wer nicht vergleicht, bleibt
unbemerkt anfällig für einen gefälschten QR-Code.

## 5. Backup (Export/Import) – `BackupService`

Klartext-Inhalt (JSON):
```json
{ "format": "offgrid-backup-data", "v": 1, "createdAt": "<ISO>",
  "displayName": "...", "contacts": [ /* Contact */ ], "messages": [ /* Message */ ],
  "coordinates": [ /* Coordinate */ ],
  "groups": [], "groupMembers": [], "groupMessages": [] }   // Gruppen-Felder erst ab T20, beim Import optional
```
Kontakte werden **ohne Schlüssel** exportiert (die Schlüssel besitzt das Gerät). Ein Backup stellt also Verlauf und Anzeige
wieder her, nicht die Fähigkeit, mit den Kontakten zu schreiben: dafür braucht es dasselbe Gerät. Settings ausser `displayName` werden
**nicht** exportiert. Die genaue Anpassung von Export und Import an den neuen Kontakt-Aufbau gehört zu T14.

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
- Bekannte Grenze (nur Doku, nicht UI): Wer den QR-Code fotografiert und die Gegenseite sofort selbst scannt, kann sich als diese
  Person ausgeben; der Fingerabdruck-Vergleich deckt das auf. Zwischen Handy und Gerät liegen Nachrichten im Klartext auf dem USB-Kabel.
- Aktiver Mann-in-der-Mitte auf dem Kabel beim Entsperren ist nicht abgedeckt (Vertrag §6.9).
