---
name: offgrid-antenna-protocol
description: Kommunikation App ↔ ESP32-Antenne nach Offgrid Host Interface v1 – USB-Serial-Plugin (Android), JSON-Lines-Protokoll, Zustandsautomat von AntennaPort (unprovisioned/locked/unlocked), Befehle, Ereignisse, Fehlercodes, Limits und Mock-Gerät für den Browser. Laden bei allem in core/antenna, core/messaging und beim nativen USB-Plugin.
---

# Antenne: Host-API v1, Zustände, Mock

> Verbindliche Quelle: **Offgrid Host Interface v1** (`firmware/docs/offgrid-link.md` im Firmware-Repo), dazu
> **Offgrid Protocol v1** (Funk) und **Firmware Architecture v1**. Bei Widerspruch gilt die Spezifikation.
> Die App baut **kein** Funkpaket und verschlüsselt **keine** Nachrichten: Das Gerät besitzt Identität, Kontaktschlüssel,
> Nonces, Zähler, Replay-Fenster und Kontaktliste. Die App ist UI- und Verlaufs-Client.

## 1. Schichten

```
UI ── MessagingService / HandshakeService
                │
           AntennaPort            Zustand, Befehle (request), Ereignisse (events), Entsperren
                │
           SerialClient           JSON Lines: Zeilen, ids, Zeitlimits, Heartbeat
                │
         SerialTransport (abstrakt)
      ┌─────────┴──────────┐
 UsbSerialTransport     MockSerialTransport ── MockDevice (simuliertes Gerät, Browser)
 (T06, Android)
      │
 UsbSerial (lokales Capacitor-Plugin, Java) ── USB-C ── Heltec V3
```

`KeystoreService` (Skill `offgrid-crypto-handshake`) liefert das Entsperr-Token; `AntennaPort` benutzt es beim Entsperren.

## 2. Natives Plugin `UsbSerial` (T06)

- Java-Klasse `android/app/src/main/java/<appId-Pfad>/UsbSerialPlugin.java`, `@CapacitorPlugin(name = "UsbSerial")`,
  registriert in `MainActivity` mit `registerPlugin(UsbSerialPlugin.class);` **vor** `super.onCreate(...)`.
- Gradle: in `android/build.gradle` (allprojects.repositories) `maven { url 'https://jitpack.io' }`;
  in `android/app/build.gradle` `implementation 'com.github.mik3y:usb-serial-for-android:3.9.0'`.
  Lässt sich die Version nicht auflösen: neueste `3.x` von JitPack nehmen und unter OFFENE FRAGEN melden.
- Treiber: `UsbSerialProber.getDefaultProber()`, zusätzlich `CdcAcmSerialDriver` für ESP32-S3 mit nativem USB.
- Parameter: **115200 Baud, 8N1, kein Flow Control**. **DTR und RTS sofort nach dem Öffnen auf `false` (low)** – sonst
  setzt der ESP32 sich beim Öffnen zurück. Kommt trotzdem ein Neustart, meldet das Gerät `sys.boot`.
- Berechtigung: `UsbManager.requestPermission` mit `PendingIntent` (explizites Intent mit eigener Action
  `ch.offgrid.app.USB_PERMISSION` und `setPackage(getContext().getPackageName())`, `FLAG_MUTABLE` ab API 31).
- BroadcastReceiver für diese Action **und** für `UsbManager.ACTION_USB_DEVICE_DETACHED` registrieren mit
  `ContextCompat.registerReceiver(getContext(), receiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)` (Pflicht ab Android 14).
  Detached für das verbundene Gerät → Event `detached`. In `handleOnDestroy()` abmelden.
- Reject-Code `NO_DRIVER` (kein passender Treiber) wird in der App als `no-device` behandelt.
- Lesen über `SerialInputOutputManager`. Die Bytes sind **UTF-8**: Der Transport dekodiert mit einem `TextDecoder`
  (`stream: true`), damit Mehrbyte-Zeichen über Chunk-Grenzen hinweg ganz bleiben, und gibt Text an JS.

JS-Schnittstelle (`core/antenna/usb-serial.plugin.ts`, mit `registerPlugin<UsbSerialPlugin>('UsbSerial')`):

```ts
interface UsbSerialPlugin {
  listDevices(): Promise<{ devices: { deviceId: number; vendorId: number; productId: number; name: string }[] }>;
  connect(opts: { deviceId: number; baudRate: number }): Promise<void>;   // fragt Berechtigung an; reject-Codes:
                                                                          // 'PERMISSION_DENIED' | 'OPEN_FAILED' | 'NO_DRIVER'
  write(opts: { data: string }): Promise<void>;                           // UTF-8, inkl. '\n'
  disconnect(): Promise<void>;
  addListener(event: 'data', cb: (e: { data: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'detached', cb: () => void): Promise<PluginListenerHandle>;
  addListener(event: 'error', cb: (e: { message: string }) => void): Promise<PluginListenerHandle>;
}
```

`UsbSerialTransport` (`core/antenna/usb-serial.transport.ts`, T06) implementiert `SerialTransport` auf diesem Plugin und
ersetzt `UnavailableSerialTransport` in `app.config.ts`. Reject-Codes → `TransportError`: `PERMISSION_DENIED` →
`permission-denied`, `OPEN_FAILED` → `open-failed`, `NO_DRIVER` und kein Gerät → `no-device`.

## 3. Rahmen: JSON Lines (`SerialClient`)

- Eine Zeile = ein JSON-Objekt, UTF-8, abgeschlossen mit `\n` (LF). Das Gerät toleriert ein `\r` davor, die App auch.
- **Höchstens 2048 Bytes pro Zeile inklusive LF**, in beide Richtungen. Zu lange eingehende Zeilen werden bis zum
  nächsten LF verworfen; eine zu lange Anfrage wird gar nicht erst gesendet (`E_LINE_TOO_LONG`).
- **Zeilen ohne führendes `{` verwerfen** (Boot-Text des ESP32-ROM, verirrte Debug-Ausgaben).
- **Nach dem Öffnen alles bis zum ersten `\n` verwerfen** (die App kann mitten in einer Zeile einsteigen). Das Gerät
  sendet beim Start ein leeres `\n`.
- Kein JSON mit Zeilenumbruch im String, kein Pretty-Printing.

Drei Arten von Zeilen:

```json
{"id":12,"cmd":"msg.send","args":{"to":1,"type":"text","text":"Hello!"}}
{"id":12,"ok":true,"result":{"msg_ref":1,"state":"queued"}}
{"id":12,"ok":false,"error":{"code":"E_TOO_LONG","message":"text is 91 bytes, max is 83","field":"text"}}
{"evt":"msg.received","t":152340,"data":{"from":1,"type":"text","text":"Hello!"}}
```

Regeln:

| Regel | Wert |
|---|---|
| `id` | ganze Zahl, eindeutig und monoton steigend (der Client zählt ab 1) |
| Antwort | **genau eine** pro Anfrage, gleiche `id`. Ereignisse (`evt`) werden **nie** beantwortet |
| Reihenfolge | Das Gerät führt Befehle strikt in der Reihenfolge des Eingangs aus |
| Anfragen in Flight | **höchstens 4**; weitere warten im Client |
| Zeitlimit | **2 s**; **5 s** für `sec.*`, `pair.complete`, `contact.delete`. Danach `E_TIMEOUT` (nur lokal) |
| Unbekannte Felder | ignorieren |
| `error.message` | nur für Logs, nie auswerten. `error.code` und `error.field` sind stabil |
| Zeit | `t` ist die Betriebszeit des Geräts in ms. **Das Gerät hat keine Uhr**: die App stempelt Nachrichten selbst |
| Daten | Rohbytes Base64 (Standard-Alphabet, mit Padding); Node-ID 4 Hex-Zeichen gross; Device-ID 12 Hex gross; `contact_id` 1–32; `ctr` 0–16777215; Emoji als Zeichen; fehlender Wert `null` |
| `*.set` | beliebige Teilmenge, alles-oder-nichts, Ergebnis ist die ganze neue Konfiguration; `persist` (Standard `true`) |

**Verbinden** (`SerialClient.hello`): Nach dem Öffnen `sys.hello` senden und **alle 500 ms wiederholen**, bis eine
Antwort kommt (Boot-Rennen: Befehle während des Starts gehen verloren). Die erste Antwort gewinnt. Nach 10 Versuchen
ohne Antwort: Fehler `no-hello`. Antwortet das Gerät mit einem Fehler, bricht der Aufruf sofort ab.

**Heartbeat:** alle **5 s `sys.ping`**. Jede gültige Zeile der App zählt dem Gerät als Lebenszeichen; bleibt sie
`lock_timeout_s` aus (Standard **15 s**), sperrt es sich. Zwei Pings in Folge ohne Antwort → Verbindung gilt als verloren.

## 4. Zustandsautomat `AntennaPort`

`state`: `disconnected` · `unprovisioned` · `locked` · `unlocked`.

| Zustand | Bedeutung | Funk |
|---|---|---|
| `disconnected` | keine Verbindung | – |
| `unprovisioned` | frisches Gerät, keine Identität, kein Tresor | aus |
| `locked` | Tresor da, aber verschlüsselt; kein Schlüssel im RAM | aus |
| `unlocked` | Tresor entschlüsselt, Gerät arbeitet | an |

Übergänge: `connect()` → `sys.hello` → Zustand des Geräts. Ist es `locked`, entsperrt der Port **von selbst** mit dem
Token aus dem Schlüsselspeicher. `unprovisioned` → `provision(name)` → `unlocked`. `unlocked` → `lock()` oder
Auto-Lock → `locked` (Ereignis `sec.state` mit Grund `lock` / `heartbeat_timeout`). Ein Neustart (`sys.boot`) oder ein
Auto-Lock führt zu `locked`; der Port holt ein neues `sys.hello` und entsperrt wieder. Nach `lock()` entsperrt er **nicht**
von selbst. Kabel ziehen oder zwei verpasste Heartbeats → `disconnected` mit Fehler `lost`.

Befehle nach Zustand:

| Befehl | unprovisioned | locked | unlocked |
|---|:-:|:-:|:-:|
| `sys.hello`, `sys.status`, `sys.ping`, `sys.reboot`, `sys.factory_reset`, `sys.set_log_level` | ✅ | ✅ | ✅ |
| `sec.provision` | ✅ | ❌ | ❌ |
| `sec.unlock` | ❌ | ✅ | ❌ |
| `sec.lock`, `sec.rotate_token`, `sec.get_policy`, `sec.set_policy` | ❌ | ❌ | ✅ |
| `id.*`, `pair.*`, `contact.*`, `msg.*` | ❌ | ❌ | ✅ |
| `radio.get`, `mesh.get`, `led.get` | ✅ | ✅ | ✅ |
| `radio.set`, `radio.stats`, `mesh.set`, `led.set`, `led.test`, `dbg.rf_trace` | ❌ | ❌ | ✅ |

API (Signals nur lesen):

```ts
state: Signal<AntennaState>;           connecting: Signal<boolean>;        error: Signal<AntennaErrorCode | null>;
device: Signal<DeviceInfo | null>;     identity: Signal<{ nodeId; name } | null>;
limits: Signal<DeviceLimits>;          // Standard {2048, 32, 83, 8}, bis sys.hello geantwortet hat
events: Observable<DeviceEvent>;       // typisiert: sys.boot, sec.state, msg.received, msg.status, contact.state
connect(); disconnect(); provision(name): Promise<boolean>; unlock(): Promise<boolean>; lock();
request(cmd, args?): Promise<JsonObject>;      // wirft DeviceError { code, message, field }
```

`AntennaErrorCode = 'no-device' | 'permission-denied' | 'open-failed' | 'no-hello' | 'proto-mismatch' | 'lost' | 'unlock-failed' | 'rate-limited' | 'keystore-failed'`

### Sitzung und Entsperren

`sys.hello` liefert `session { device_eph_pub, nonce }`. Die Sitzung ist **einmalig**: jeder Versuch mit `sec.provision`
oder `sec.unlock`, ob erfolgreich oder nicht, verbraucht sie. Nach jedem Versuch braucht es ein neues `sys.hello`.
Das Token und sein Einpacken beschreibt der Skill `offgrid-crypto-handshake` §1. Falsches Token, falsches Gerät und
kaputter Umschlag ergeben alle `E_UNLOCK_FAILED`; nach 3 Fehlversuchen in Folge `E_RATE_LIMITED` (2 s, danach doppelt,
höchstens 60 s). Kein Löschen bei Fehlversuchen.

## 5. Befehle

### `sys.*`

| Befehl | Args | Ergebnis |
|---|---|---|
| `sys.hello` | `app`, `app_proto` (`"1.0"`) | `device`, `chip`, `device_id`, `fw {version, build}`, `proto`, `state`, `session {device_eph_pub, nonce}`, `limits {max_line, max_contacts, max_text_bytes, pending_queue}` |
| `sys.status` | – | `state`, `uptime_ms`, `reset_reason`, `heap_free`, `battery_mv`, `radio {running, relay_only}`, `security`; nur entsperrt zusätzlich `queue {pending, capacity}`, `contacts {used, capacity}` |
| `sys.ping` | – | `uptime_ms` |
| `sys.reboot` | – | antwortet, startet neu, kommt `locked` zurück, dann `sys.boot` |
| `sys.factory_reset` | `confirm: "ERASE"` | `armed`, `expires_s`; danach 3 s PRG-Taste am Gerät halten |

### `sec.*`

`sec.provision` (`app_eph_pub`, `wrapped_token`, `name?`) → `node_id`, `public_key`, `name`, `state`.
`sec.unlock` (`app_eph_pub`, `wrapped_token`) → `state`, `node_id`, `name`, `contacts`, `radio`.
`sec.lock` → `{state: "locked"}`. Daneben `sec.rotate_token`, `sec.get_policy`, `sec.set_policy` (`lock_timeout_s` 0–3600, Standard 15) –
vorerst nicht benutzt.

### `id.*`

`id.get` → `node_id`, `public_key`, `name`. `id.set_name` (`name` 1–24 Bytes UTF-8).

### `pair.*` und `contact.*`

| Befehl | Args | Ergebnis |
|---|---|---|
| `pair.begin` | – | `qr`, `qr_bytes`, `expires_s` (300). `qr` = Base64 von `"OG1" ‖ public_key (32) ‖ salt (16) ‖ name`. **Diesen Text als QR-Code zeigen** |
| `pair.cancel` | – | `cancelled: true` |
| `pair.complete` | `qr`, `name?`, `replace?` | `contact`, `warnings` (`node_id_collision`). Fehler `E_NO_PAIRING`, `E_INVALID_QR`, `E_SELF_PAIR`, `E_CONTACT_EXISTS`, `E_STORAGE_FULL` |
| `contact.list` | `offset` (0), `limit` (10, höchstens 10) | `total`, `offset`, `contacts[]` |
| `contact.get` | `contact_id` | `contact` oder `E_NO_SUCH_CONTACT` |
| `contact.rename` | `contact_id`, `name` (≤ 24 Bytes) | `contact` |
| `contact.delete` | `contact_id`, `confirm: true` | löscht Schlüssel, Zähler, Replay-Zustand; wartende Nachrichten scheitern mit `contact_deleted` |

Kontakt-Objekt: `contact_id` (Platz 1–32, stabil), `name`, `node_id`, `public_key`, `state` (`pending` bis das erste gültige
Paket des Gegenübers eintrifft, dann `active`), `fingerprint` (drei Vierergruppen, z. B. „0501 3010 7790“), `tx_ctr`,
`rx_highest_ctr`, `last_rssi`, `last_snr` (`null` wenn noch nichts empfangen). **Schlüssel sind nie Teil des Objekts.**
`pair.begin` nicht zwischen „wurde gescannt“ und „scannt selbst“ erneuern: das Salz muss zum Code passen, den das
Gegenüber hat.

**Fingerabdruck:** `SHA256("og1-fp" ‖ pub_low ‖ pub_high)` mit bytweise sortierten Schlüsseln; die ersten 8 Bytes als
Big-Endian-Zahl modulo 10¹², in drei Gruppen zu vier Ziffern. Beide Handys zeigen dieselben Ziffern, wenn nichts
verfälscht wurde.

### `msg.*`

`msg.send` – gemeinsam: `to` (= `contact_id`), `type` (`text` | `reaction` | `geo`), `ack?` (Standard aus `mesh.ack_default`),
`hops?` (0–7, Standard `mesh.hop_default`).

| Typ | Args |
|---|---|
| `text` | `text` – UTF-8, höchstens `limits.max_text_bytes` **Bytes** (83). Länger → `E_TOO_LONG`; die App teilt vorher |
| `reaction` | `target {author: "me"\|"peer", ref}`, `emoji` (Emoji aus der Tabelle oder `null` = entfernen). `author: "me"`: die Ziel-Nachricht habe **ich** geschrieben; `ref` = `ctr & 0xFFFF` |
| `geo` | `lat`, `lon`, `alt_m?`, `age_s?` (0–2550) |

Ergebnis: `msg_ref` (lokaler Handle für Statusereignisse, gilt nur bis zum nächsten Gerätestart), `ctr` (Zähler dieser
Nachricht in der Unterhaltung), `ack_requested`, `hops`, `state: "queued"`, `bytes_on_air`, `est_airtime_ms`.
Fehler: `E_NO_SUCH_CONTACT`, `E_TOO_LONG`, `E_QUEUE_FULL`, `E_INVALID_ARG`, `E_LOCKED`.
`msg.cancel` (`msg_ref`) → `{state: "cancelled"}`. `msg.pending` → `pending[] {msg_ref, to, type, ctr, state, retry}`.
Die Warteschlange liegt nur im RAM: nach einem Neustart ist alles Unfertige verloren; die App behandelt alles, was bei
`sys.boot` noch aussteht, als gescheitert.

Emoji-Tabelle der Reaktionen (Offgrid Protocol Appendix B): `👍` `❤️` `😂` `😮` `😢` `🙏`; `null` entfernt die eigene Reaktion.
In `core/messaging/reactions.ts`.

### `radio.*`, `mesh.*`, `led.*`

Nur als Dienst durchgereicht (`AntennaPort.request`), **noch ohne Oberfläche**.

- `radio.get` (jeder Zustand), `radio.set` (entsperrt): `freq_mhz` 150–960 (869.525), `bw_khz` 62.5/125/250/500 (125), `sf` 5–12 (9),
  `cr` 5–8 (5), `tx_power_dbm` −9–22 (14), `preamble` 6–64 (8), `sync_word` 0–255 (79), `preset` (`lab_default`, `fast`, `long_range`).
  Ergebnis mit `est_airtime_ms_23b`, `max_text_bytes`, `warnings` (`outside_eu868`, `above_eu868_power_limit`, `reserved_sync_word`, `mesh_incompatible`).
  `radio.stats` zählt Pakete.
- `mesh.get`/`mesh.set`: `hop_default` (3), `relay_enabled` (true), `relay_when_locked` (false), `cad_enabled` (true), `backoff_slots` (8),
  `retries` (3), `retry_base_ms` (0), `rate_limit_per_src` (20), `ack_default {text: true, reaction: false, geo: false}`.
- `led.get`/`led.set`/`led.test`: `enabled`, `quiet`, `brightness` 0–255, `state_patterns` (`unprovisioned`, `locked`, `unlocked`),
  `event_patterns` (`tx`, `rx`, `msg_received`, `delivered`, `failed`, `error`, `pairing`); Muster als Name (`off`, `on`, `flash`, `blink_slow`,
  `blink_fast`, `double`, `heartbeat`, `pulse`) oder `{steps: [on_ms, off_ms, …], repeat}`.
- `dbg.*` und `mock.*` des echten Geräts benutzt die App **nicht**.

## 6. Ereignisse

Ereignisse werden nie beantwortet. Die App wertet nur diese aus; `log`, `rf.tx`, `rf.rx`, `error` werden ignoriert.

| Ereignis | `data` | Wann |
|---|---|---|
| `sys.boot` | `device_id`, `fw`, `proto`, `state`, `reset_reason` | nach jedem Start; einmal beim Verbinden |
| `sec.state` | `state`, `reason` (`unlock`, `provision`, `lock`, `heartbeat_timeout`, `factory_reset`) | Zustand wechselt |
| `msg.received` | `from`, `type`, `ctr`, `hops`, `retry`, `rssi`, `snr` + `text` \| `target`, `emoji` \| `lat`, `lon`, `alt_m`, `age_s` | eine Nachricht kam an und ist geprüft. Eine Wiederholung wird **nicht** noch einmal geliefert |
| `msg.status` | `msg_ref`, `to`, `state`, `retry`, `reason?`, `hops?`, `rtt_ms?` | eine wartende Nachricht wechselt den Zustand |
| `contact.state` | `contact_id`, `state` | ein Kontakt wurde `active` |

`msg.status.state`: `queued` ⏳ · `sent` ✓ · `relayed` ✓ (Nachbar hat sie weitergegeben) · `retrying` ✓ (`retry` 1–3) ·
`delivered` ✓✓ (Quittung geprüft) · `failed` ✗ (`reason`: `timeout`, `locked`, `contact_deleted`, `radio_error`) · `cancelled`.
Abbildung auf `MessageStatus` der App: `queued` → Queued; `sent`, `relayed`, `retrying` → Sent; `delivered` → Delivered;
`failed`, `cancelled` → Failed.

## 7. Fehlercodes

`E_PARSE`, `E_LINE_TOO_LONG`, `E_UNKNOWN_CMD`, `E_INVALID_ARG` (mit `field`), `E_PROTO_MISMATCH`, `E_LOCKED`, `E_NOT_PROVISIONED`,
`E_ALREADY_PROVISIONED`, `E_ALREADY_UNLOCKED`, `E_NO_SESSION`, `E_UNLOCK_FAILED`, `E_RATE_LIMITED`, `E_CONFIRM_REQUIRED`, `E_NO_PAIRING`,
`E_INVALID_QR`, `E_SELF_PAIR`, `E_CONTACT_EXISTS`, `E_NO_SUCH_CONTACT`, `E_STORAGE_FULL`, `E_TOO_LONG`, `E_QUEUE_FULL`, `E_BUSY`, `E_RADIO`,
`E_INTERNAL`. Nur in der App entstehen `E_TIMEOUT`, `E_DISCONNECTED`, `E_INVALID_RESPONSE`. Typen in `core/models/device.ts`,
Fehlerklasse `DeviceError` in `core/antenna/device-error.ts`. Die Oberfläche zeigt Fehlertexte aus dem Skill `offgrid-screens`, nie `error.message`.

## 8. Limits und Konstanten

| Konstante | Wert |
|---|---|
| Protokollversion | `1.0` (die App prüft nur die Hauptversion) |
| Serial | 115200 Baud, 8N1, DTR/RTS **low** |
| Zeilenlänge | 2048 Bytes inkl. LF |
| Anfragen in Flight | 4 |
| Zeitlimit | 2 s; 5 s für `sec.*`, `pair.complete`, `contact.delete` |
| `sys.hello`-Wiederholung | alle 500 ms |
| Heartbeat (`sys.ping`) | alle 5 s |
| Auto-Lock | 15 s ohne gültige Zeile |
| Kontakte | höchstens 32 |
| Warteschlange | 8 (nur RAM) |
| Text pro Nachricht | **83 Bytes** (`limits.max_text_bytes`; die App liest den Wert aus `sys.hello`) |
| Name (eigener Name, Kontaktname) | 1–24 Bytes UTF-8 |
| `contact.list` | höchstens 10 je Seite |
| Pairing läuft ab | 300 s |
| Entsperr-Token | 32 Bytes; `wrapped_token` 60 Bytes |
| Entsperren: Fehlversuche | nach 3 in Folge 2 s Sperre, doppelt, höchstens 60 s |

`maxContentBytes(max)` (`core/messaging/limits.ts`) gibt das gemeldete Limit **unverändert** zurück – kein Abzug, keine
feste Obergrenze, keine JSON-Escapes. `contentBytes(text)` = UTF-8-Bytes des Textes. `isValidDisplayName(name)` = getrimmt
1–24 UTF-8-Bytes. `splitText(text, maxBytes)` teilt in Stücke ≤ `maxBytes`, nie mitten in einem Zeichen (Emoji bleiben ganz).

## 9. Empfangen und Senden (`MessagingService`)

Empfang (`msg.received`):
1. `from` ist der `contact_id`. Kennt die App ihn nicht, holt sie ihn mit `contact.get` (`HandshakeService.refreshContact`).
2. `text` und `geo`: Es gibt schon eine eingehende Nachricht mit demselben `ctr`? Dann verwerfen (Schutz vor Doppelten).
   Sonst speichern: `direction 'in'`, `status Delivered`, `ctr`, `rssi`, `sent_at` = jetzt (die App stempelt selbst),
   Kontakt-Signal aktualisieren (`rssi`, `snr`). `geo` zusätzlich als Koordinate (`recorded_at` = jetzt − `age_s`).
3. `reaction`: nicht speichern, als Ereignis weitergeben (`MessagingService.reactions`).

Senden (`sendText(contactId, text)`):
1. Trimmen; leer → nichts. In Stücke ≤ `limits.max_text_bytes` teilen (`splitText`); **jedes Stück ist eine eigene Nachricht**.
2. Je Stück speichern (`status Queued`, `ctr`/`msg_ref` leer, `sent_at` = jetzt), dann `msg.send`. Antwort: `ctr` und `msg_ref` eintragen.
3. Ist das Gerät nicht entsperrt oder die Warteschlange voll (`E_QUEUE_FULL`): Nachricht bleibt `Queued` ohne Handle und geht,
   sobald das Gerät entsperrt ist bzw. ein Platz frei wird, der Reihe nach hinaus. Alle anderen Fehler → `Failed`.
4. `msg.status` über `msg_ref` zuordnen (nur offene ausgehende Nachrichten). Ein Status geht nie zurück; einzige Ausnahme:
   `retry` legt `Failed` wieder in die Warteschlange (ohne `ctr`/`msg_ref`).
5. Bei `sys.boot` ist die Warteschlange des Geräts leer: alles mit Handle, das noch `Queued`/`Sent` war, wird `Failed`.

Alle Änderungen laufen nacheinander (ein Status-Ereignis darf nie vor der Antwort auf `msg.send` verarbeitet werden).

## 10. Signalstärke

Pro Kontakt: `last_rssi` und `last_snr` aus dem letzten gültigen Paket dieses Kontakts (vom Gerät, `null` wenn noch nichts).
Level für `og-signal-bars`: `rssi ≥ -80` → 4, `≥ -95` → 3, `≥ -105` → 2, `≥ -115` → 1, sonst 0; kein `rssi` → 0.
Die Funktion `signalLevel(rssi, seenAt, now)` in `core/messaging/signal.ts` bleibt wie in T03 (sie nimmt noch einen Zeitpunkt
`seenAt`; die App stempelt ihn beim Empfang selbst, weil das Gerät keine Uhr hat).

## 11. Mock-Gerät (`MockDevice`, Browser)

Das Mock-Gerät spricht **dieselbe Host-API** wie das echte (alle Befehle aus §5 ausser `sys.factory_reset`, `sys.set_log_level`,
`sec.rotate_token`, `sec.get/set_policy`, `led.test`, `radio.stats`, `dbg.*`, `mock.*`) mit denselben Antworten, Fehlercodes und Ereignissen.
Es prüft das Entsperr-Token wirklich (X25519, HKDF, AES-GCM wie auf dem Gerät) und sperrt sich nach 15 s ohne Zeile selbst.
`MockSerialTransport` hängt es als `SerialTransport` an den Browser (Verzögerung beim Öffnen 50 ms).

- Standard im Browser: ein **schon eingerichtetes, gesperrtes** Gerät mit den Demo-Kontakten (`DEMO_CONTACTS`), das das erste Token
  annimmt und behält (`adoptFirstToken`). Mit `localStorage og.noseed = '1'`: ein **frisches** Gerät (`unprovisioned`).
- `msg.send` → nach 300 ms `sent`, 700 ms `relayed`, 1500 ms `delivered` (nur mit `ack`; sonst nur `sent`); der Kontakt wird `active`.
- `pair.begin`/`pair.complete` rechnen `node_id` (SHA-256 des Schlüssels, 2 Bytes) und `fingerprint` wie im Vertrag;
  der Kontakt wird nach 3 s `active` (das Gegenüber „antwortet“).
- Fehlerinjektion: `failNext('timeout' | 'radio_error')` – die nächste Nachricht scheitert.
- Entwickler-Hooks auf `window.ogMock` (nur im Mock; Typen in `mock-serial-transport.ts` per `declare global`):
  - `receive(kontakt, text)` – eingehende Nachricht (Kontakt als Platz oder Name).
  - `react(kontakt, {author, ref}, emoji | null)` – eingehende Reaktion.
  - `receiveLocation(kontakt, lat = 47.05812, lon = 8.31998)` – eingehender Standort.
  - `failNext(reason?)` – nächste Nachricht scheitert.
  - `lock()` – das Gerät sperrt sich (Auto-Lock); `reboot()` – Neustart; `drop()` – Kabel ziehen.
- Auf Android mit `localStorage og.mock = '1'` läuft derselbe Mock mit Schlüssel im Arbeitsspeicher (Vorführen ohne Hardware).
