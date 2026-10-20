---
name: offgrid-antenna-protocol
description: Kommunikation App ↔ ESP32-Antenne – USB-Serial-Plugin (Android), NDJSON-Serial-Protokoll, Zustandsautomat von AntennaPort, LoRa-Paketformat (Frame-Codec), Signalstärke und Mock-Antenne für den Browser. Laden bei allem in core/antenna, core/messaging/frame.ts oder beim nativen USB-Plugin.
---

# Antenne: Serial-Protokoll, Frames, Mock

> Status: **Vorschlag v1**, mit dem Firmware-Verantwortlichen abzustimmen (`docs/esp-schnittstelle.md`).
> Alles hängt an `AntennaPort` – wenn sich das Protokoll ändert, ändern sich nur `serial-antenna.service.ts` und `ndjson.ts`.

## 1. Schichten

```
UI ── MessagingService / HandshakeService ── frame.ts (LoRa-Paket bauen/lesen, verschlüsselt)
                                    │
                              AntennaPort (abstrakt)
                     ┌──────────────┴──────────────┐
          SerialAntennaService                MockAntennaService (Browser)
                     │
              ndjson.ts (Zeilen)  ── UsbSerial (lokales Capacitor-Plugin, Java) ── USB-C ── ESP32
```

## 2. Natives Plugin `UsbSerial` (T06)

- Java-Klasse `android/app/src/main/java/<appId-Pfad>/UsbSerialPlugin.java`, `@CapacitorPlugin(name = "UsbSerial")`,
  registriert in `MainActivity` mit `registerPlugin(UsbSerialPlugin.class);` **vor** `super.onCreate(...)`.
- Gradle: in `android/build.gradle` (allprojects.repositories) `maven { url 'https://jitpack.io' }`;
  in `android/app/build.gradle` `implementation 'com.github.mik3y:usb-serial-for-android:3.9.0'`.
  Lässt sich die Version nicht auflösen: neueste `3.x` von JitPack nehmen und unter OFFENE FRAGEN melden.
- Treiber: `UsbSerialProber.getDefaultProber()`, zusätzlich `CdcAcmSerialDriver` für ESP32-S3 mit nativem USB.
- Parameter: 115200 Baud, 8 Datenbits, 1 Stoppbit, keine Parität. DTR und RTS auf `true` nach dem Öffnen.
- Berechtigung: `UsbManager.requestPermission` mit `PendingIntent` (explizites Intent mit eigener Action
  `ch.offgrid.app.USB_PERMISSION` und `setPackage(getContext().getPackageName())`, `FLAG_MUTABLE` ab API 31).
- BroadcastReceiver für diese Action **und** für `UsbManager.ACTION_USB_DEVICE_DETACHED` registrieren mit
  `ContextCompat.registerReceiver(getContext(), receiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)` (Pflicht ab Android 14).
  Detached für das verbundene Gerät → Event `detached`. In `handleOnDestroy()` abmelden.
- Reject-Code `NO_DRIVER` (kein passender Treiber) wird in der App als `no-device` behandelt.
- Lesen über `SerialInputOutputManager`, Daten als String (ASCII) an JS.

JS-Schnittstelle (`core/antenna/usb-serial.plugin.ts`, mit `registerPlugin<UsbSerialPlugin>('UsbSerial')`):

```ts
interface UsbSerialPlugin {
  listDevices(): Promise<{ devices: { deviceId: number; vendorId: number; productId: number; name: string }[] }>;
  connect(opts: { deviceId: number; baudRate: number }): Promise<void>;   // fragt Berechtigung an; reject-Codes:
                                                                          // 'PERMISSION_DENIED' | 'OPEN_FAILED' | 'NO_DRIVER'
  write(opts: { data: string }): Promise<void>;                           // ASCII, inkl. '\n'
  disconnect(): Promise<void>;
  addListener(event: 'data', cb: (e: { data: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'detached', cb: () => void): Promise<PluginListenerHandle>;
  addListener(event: 'error', cb: (e: { message: string }) => void): Promise<PluginListenerHandle>;
}
```

## 3. Serial-Protokoll (NDJSON)

- Jede Nachricht ist **eine Zeile** JSON, abgeschlossen mit `\n`. Nur ASCII. Maximal 512 Zeichen pro Zeile.
- `ndjson.ts`: puffert eingehende Chunks, trennt an `\n`, ignoriert leere Zeilen und Zeilen, die kein gültiges JSON
  mit Feld `t` sind (→ `log.warn`).

### App → ESP

| t | Felder | Wann |
|---|---|---|
| `hello` | `proto: 1` | direkt nach dem Öffnen |
| `tx` | `id`: 8 Hex-Zeichen (Sendeauftrag), `p`: Base64 des Frames | Paket senden |
| `ping` | – | alle 5 s, solange verbunden |

### ESP → App

| t | Felder | Bedeutung |
|---|---|---|
| `info` | `proto`, `fw` (String), `freq` (Hz), `max` (max. Frame-Bytes) | Antwort auf `hello` |
| `txdone` | `id`, `ok` (bool), `err?` (`busy`\|`too_long`\|`radio`) | Paket wurde gefunkt (oder nicht) |
| `rx` | `p` (Base64), `rssi` (dBm, int), `snr` (float) | Paket empfangen |
| `pong` | – | Antwort auf `ping` |
| `log` | `msg` | nur `log.debug` |

Beispiele:
```
→ {"t":"hello","proto":1}
← {"t":"info","proto":1,"fw":"1.0.0","freq":868100000,"max":222}
→ {"t":"tx","id":"a1b2c3d4","p":"Ea1b2c3d4..."}
← {"t":"txdone","id":"a1b2c3d4","ok":true}
← {"t":"rx","p":"Eb9...","rssi":-92,"snr":7.25}
```

## 4. Zustandsautomat `SerialAntennaService`

`connect()`:
0. Läuft schon (`searching`, `device-found`, `connecting`, `ready`) → sofort zurück.
1. `state = 'searching'`, `listDevices()`. Kein Gerät → `state = 'disconnected'`, `error = 'no-device'`, Ende.
2. `state = 'device-found'` (erstes Gerät, `deviceName` setzen), dann `state = 'connecting'`, `connect({deviceId, baudRate: 115200})`.
   Reject → `state = 'error'`, `error` = `'permission-denied'` (PERMISSION_DENIED) bzw. `'open-failed'` (OPEN_FAILED)
   bzw. `'no-device'` (NO_DRIVER).
3. `hello` senden; auf `info` max. 3 s warten. Keine Antwort → `hello` erneut senden, **insgesamt 3 Versuche**
   (deckt einen ESP32-Neustart durch DTR/RTS beim Öffnen ab). Nach dem 3. Versuch ohne `info` → `state='error'`, `error='no-info'`.
   `info.proto !== 1` → `state='error'`, `error='proto-mismatch'`.
4. `info` speichern, `state = 'ready'`, `error = null`, Heartbeat starten.

Heartbeat: alle 5 s `ping`. Kommt 15 s lang **keine** Zeile vom ESP → `disconnect()`, `state='disconnected'`, `error='lost'`.
Event `detached` → gleich. `disconnect()` → `state='disconnected'`, `error=null`.

`transmit(frame)`: nur wenn `state==='ready'`, sonst `throw new Error('not-ready')` (Aufrufer prüfen `state` vorher, das ist ein Programmierfehler). Erzeugt `id` (4 Zufallsbytes hex),
schreibt `tx`-Zeile, gibt `id` zurück. Kommt innerhalb 10 s kein `txdone` mit dieser `id` → eigenes Event
`{ type: 'txdone', id, ok: false, err: 'timeout' }`.

`events` (Observable `AntennaEvent`):
```ts
type AntennaEvent =
  | { type: 'rx'; frame: Uint8Array; rssi: number; snr: number }
  | { type: 'txdone'; id: string; ok: boolean; err?: string };
```

`AntennaErrorCode = 'no-device' | 'permission-denied' | 'open-failed' | 'no-info' | 'proto-mismatch' | 'lost'`

## 5. LoRa-Frame (`core/messaging/frame.ts`)

Binär, Gesamtlänge ≤ `info.max` (Default 222, wenn `info` fehlt).

| Byte | Inhalt |
|---|---|
| 0 | `(version << 4) | type` – version = 1; type: 1 = `msg`, 2 = `ack`, 3 = `hs`, 4 = `hsa` |
| 1–4 | `tag` = erste 4 Bytes von SHA-256(Schlüssel, mit dem verschlüsselt wurde; 16 Rohbytes) |
| 5–16 | IV (12 Zufallsbytes) |
| 17–… | AES-128-GCM-Ciphertext inkl. 16 Byte Auth-Tag; **AAD = Bytes 0–4** |

Klartext ist UTF-8-JSON:

| type | Klartext |
|---|---|
| `msg` | `{"i":"<wireId 8 hex>","b":"<Text>","t":<Unix-Sekunden>}` |
| `ack` | `{"i":"<wireId>"}` |
| `hs` | `{"k":"<32 hex>","n":"<Anzeigename>"}` |
| `hsa` | `{"ok":1}` |

API:
```ts
encodeFrame(type: FrameType, keyHex: string, plain: object, max = 222): Promise<Uint8Array>
peekFrame(bytes: Uint8Array): { version: number; type: FrameType; tag: string } | null   // ohne Entschlüsseln
decodeFrame(bytes: Uint8Array, keyHex: string): Promise<object>                             // wirft bei falschem Schlüssel
```
Frames mit `version !== 1`, unbekanntem `type` oder Länge < 33 Bytes werden verworfen (`log.warn`).
`encodeFrame` wirft `Error('too-long')`, wenn der fertige Frame länger als `max` ist (max als 4. Parameter, Default 222).

**Längen (`core/messaging/limits.ts`):**
- `contentBytes(text) = new TextEncoder().encode(JSON.stringify(text)).length - 2` (zählt JSON-Escapes mit).
- `maxContentBytes(max) = Math.min(180, max - 69)` (69 = 33 Frame-Overhead + 36 JSON-Hülle ohne Text).
  `MessagingService.maxContentBytes` ist das als `computed` aus `info().max ?? 222`.
- Anzeigename: höchstens 40 Zeichen **und** `contentBytes(name) <= 60` (damit `hs`-Frames immer passen).
  Prüffunktion `isValidDisplayName(name)` (trim, 1–40 Zeichen, ≤ 60 Bytes).

## 6. Empfangen und Senden (in `MessagingService`)

Empfang `rx`:
1. `peekFrame`. Für `msg`/`ack`: Kontakt suchen, dessen `receivingKey` den `tag` hat. Keiner → verwerfen.
2. Entschlüsseln. Fehler → verwerfen.
3. `contacts.updateSignal(id, rssi, now)`.
4. `msg`: Duplikat (`byWireId`) → nur erneut `ack` senden. Sonst Nachricht speichern (`direction 'in'`, `status 2`,
   `rssi`, `sent_at` = jetzt) und `ack` senden (verschlüsselt mit `contact.sendingKey`). Vibration, falls Einstellung an.
5. `ack`: eigene Nachricht mit dieser `wireId` auf `Delivered` setzen (egal ob Queued/Sent/Failed).
6. `hs`/`hsa`: an `HandshakeService.onFrame(bytes, rssi)`.

Senden `send(contactId, text)`:
1. Text trimmen; leer → nichts. Bytes > `maxContentBytes` → nichts (UI verhindert das).
2. Nachricht speichern: `wireId` = 4 Zufallsbytes hex, `status Queued`, `sent_at` = jetzt.
3. Wenn `state === 'ready'`: Frame bauen, `transmit`, Zuordnung `txId → messageId` merken.
4. `txdone ok` → `Sent`, **nur wenn** Status noch `Queued`. `txdone !ok` → `Failed`, **nur wenn** Status noch `Queued`.
   (Ein Status geht nie zurück; einzige Ausnahme: `retry` setzt `Failed` → `Queued`.)
5. Wechsel auf `ready` → alle `queued()` der Reihe nach senden (je 250 ms Abstand).
`retry(id)`: Status auf `Queued` setzen, dann wie Schritt 3.

## 7. Signalstärke

Pro Kontakt: `last_rssi` + `last_seen_at` aus dem letzten empfangenen Frame dieses Kontakts.
Level (für `og-signal-bars`): `last_seen_at` älter als 15 min oder null → 0. Sonst
`rssi ≥ -80` → 4, `≥ -95` → 3, `≥ -105` → 2, `≥ -115` → 1, sonst 0.
Die Funktion heisst `signalLevel(rssi, seenAt, now)` in `core/messaging/signal.ts` und ist zu testen.
Antenne allgemein (Einstellungen, Chat-Header ohne Kontaktdaten): Level des Kontakts mit dem jüngsten `last_seen_at`.

## 8. Mock-Antenne (`MockAntennaService`, Browser)

Darf `ContactRepository`, `HandshakeRepository`, `CryptoService` und `frame.ts` nutzen, um realistische Frames zu bauen.
- `connect()`: `searching` (400 ms) → `device-found` (400 ms, `deviceName = 'Mock-Antenne'`) → `connecting` (600 ms) → `ready`,
  `info = { proto: 1, fw: 'mock-1.0.0', freq: 868100000, max: 222 }`.
- `transmit`: nach 300 ms `txdone ok:true` (ausser `failNext` gesetzt → `ok:false, err:'radio'`).
  - War es ein `msg`-Frame: nach weiteren 1500 ms ein `rx`-Frame `ack` mit dieser `wireId`, verschlüsselt mit dem
    `receivingKey` des Kontakts, `rssi: -92`, `snr: 7.25`.
  - War es ein `hs`-Frame: nach 2000 ms ein `rx`-Frame `hsa`, verschlüsselt mit dem `remote_key` des offenen
    Handshakes (Rolle `scanner`), `rssi: -88`.
- Entwickler-Hooks auf `window.ogMock` (nur im Mock). Typisierung in `core/antenna/og-mock.d.ts` mit
  `declare global { interface Window { ogMock?: OgMock } }` und `interface OgMock` mit den Methoden unten.
  - `receive(displayName: string, text: string)` – simuliert eingehende Nachricht dieses Kontakts.
  - `completeShowing(peerName = 'Demo-Kontakt')` – simuliert, dass jemand meinen angezeigten QR gescannt hat (`hs`-Frame).
  - `drop()` – simuliert Trennung (`state='disconnected'`, `error='lost'`). `restore()` – erneut `connect()`.
  - `failNext()` – nächster `txdone` schlägt fehl.
