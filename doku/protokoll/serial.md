# Serial (App ↔ Antenne)

Stand: **nach T23**. Verbindlich ist „Offgrid Host Interface v1“ (Firmware-Repo `docs/offgrid-link.md`). Diese Seite fasst zusammen, was die App benutzt.

## Rahmen

JSON Lines über USB-Serial: 115200 Baud, 8N1, DTR/RTS low. Eine Zeile ist ein JSON-Objekt, UTF-8, mit `\n` abgeschlossen (ein `\r` davor wird toleriert),
**höchstens 2048 Bytes inklusive LF**.

| Art | Form |
|---|---|
| Anfrage | `{"id":12,"cmd":"msg.send","args":{"to":1,"type":"text","text":"Hello!"}}` |
| Antwort (Erfolg) | `{"id":12,"ok":true,"result":{"msg_ref":1,"ctr":1,"state":"queued"}}` |
| Antwort (Fehler) | `{"id":12,"ok":false,"error":{"code":"E_TOO_LONG","message":"…","field":"text"}}` |
| Ereignis | `{"evt":"msg.received","t":152340,"data":{"from":1,"type":"text","text":"Hello!"}}` |

- Jede Anfrage bekommt **genau eine** Antwort mit derselben `id`. Ereignisse werden nie beantwortet.
- `id`s sind eindeutig und steigen; höchstens **4** Anfragen gleichzeitig unterwegs.
- Zeitlimit **2 s**, **5 s** für `sec.*`, `pair.complete`, `contact.delete`.
- Zeilen ohne führendes `{` werden verworfen; nach dem Öffnen wird alles bis zum ersten `\n` verworfen.
- `sys.hello` wird alle **500 ms** wiederholt, bis eine Antwort kommt; danach alle **5 s** `sys.ping`.
- Bytes als Base64, `t` ist die Betriebszeit der Antenne in ms (**sie hat keine Uhr**), `contact_id` 1 bis 32, `ctr` 0 bis 16777215.

## Natives Plugin `UsbSerial`

Damit die App auf Android über die Leitung spricht, braucht es ein natives Plugin. Es heisst `UsbSerial` und liegt in
`android/app/src/main/java/ch/offgrid/app/UsbSerialPlugin.java` (`@CapacitorPlugin(name = "UsbSerial")`). `MainActivity` registriert es mit
`registerPlugin(UsbSerialPlugin.class)` **vor** `super.onCreate(...)`. Die TypeScript-Seite ist `src/app/core/antenna/usb-serial.plugin.ts`
(`registerPlugin<UsbSerialPlugin>('UsbSerial')`).

| Methode | Rückgabe | Bedeutung |
|---|---|---|
| `listDevices()` | `{ devices: UsbSerialDevice[] }` | USB-Geräte, für die ein Serial-Treiber gefunden wurde. Je Gerät `deviceId`, `vendorId`, `productId` und `name`. |
| `connect({ deviceId, baudRate })` | – | Berechtigung anfragen, Port öffnen, Serial-Manager starten. |
| `write({ data })` | – | den Text als UTF-8-Bytes schreiben. |
| `disconnect()` | – | Port schliessen und eine wartende Berechtigungsanfrage ablehnen. |

| Ereignis | Nutzlast | Bedeutung |
|---|---|---|
| `data` | `{ data: string }` | empfangene Bytes, Base64-kodiert. |
| `detached` | – | das Gerät wurde abgezogen. |
| `error` | `{ message: string }` | Lesefehler auf der Leitung. |

**Parameter:** 115200 Baud, 8 Datenbits, 1 Stoppbit, keine Parität, kein Flow Control. **DTR und RTS stehen sofort nach dem Öffnen auf low** – sonst
startet der ESP32 durch das Öffnen neu.

**Berechtigung:** `UsbManager.requestPermission` mit einem `PendingIntent` auf die Action `ch.offgrid.app.USB_PERMISSION` (ab Android 12 mit
`FLAG_MUTABLE`). Ein `BroadcastReceiver` hört auf diese Action und auf `UsbManager.ACTION_USB_DEVICE_DETACHED`; er ist mit
`ContextCompat.RECEIVER_NOT_EXPORTED` registriert und wird in `handleOnDestroy()` abgemeldet.

**Treiber:** `UsbSerialProber.getDefaultProber()`, zusätzlich `CdcAcmSerialDriver` für ESP32-S3 mit nativem USB. Die Bibliothek
`com.github.mik3y:usb-serial-for-android:3.9.0` kommt von JitPack: `android/build.gradle` ergänzt `maven { url 'https://jitpack.io' }`,
`android/app/build.gradle` die Abhängigkeit.

**Reject-Codes** des Plugins und ihre Entsprechung in der App (`TransportError`):

| Plugin-Code | App-Code | Wann |
|---|---|---|
| `PERMISSION_DENIED` | `permission-denied` | die Berechtigung wurde verweigert |
| `OPEN_FAILED` | `open-failed` | der Port liess sich nicht öffnen |
| `NO_DRIVER` | `no-device` | kein passender Treiber für das Gerät |

Ein unbekannter Fehler wird wie `OPEN_FAILED` behandelt. Findet `listDevices()` kein Gerät, meldet der Transport `no-device` und ruft `connect` nicht auf.

## Natives Plugin `OffgridKeystore`

Das zweite native Plugin betreut das Entsperr-Geheimnis. Es heisst `OffgridKeystore`
(`android/app/src/main/java/ch/offgrid/app/OffgridKeystorePlugin.java`) und hat genau eine Methode:

| Methode | Eingabe | Ausgabe |
|---|---|---|
| `hmac({ data })` | Base64-Bytes | `{ mac: string }`, Base64 mit 32 Bytes |

Der Schlüssel liegt im **Android Keystore** unter dem Alias `offgrid_unlock`, mit Zweck `PURPOSE_SIGN` und Digest SHA-256. Er ist **nicht
exportierbar**: JavaScript sieht nur den HMAC, nie den Rohschlüssel. Das Plugin kann nichts weiter – X25519, HKDF und AES-256-GCM laufen in
TypeScript.

## Befehle, die die App benutzt

| Gruppe | Befehl | Zweck |
|---|---|---|
| `sys` | `sys.hello` | Gerätedaten, Zustand, einmalige Sitzung, Limits |
| | `sys.status`, `sys.ping`, `sys.reboot` | Status, Heartbeat, Neustart |
| `sec` | `sec.provision`, `sec.unlock`, `sec.lock` | einrichten, entsperren, sperren |
| `id` | `id.get`, `id.set_name` | eigene Kennung und Name |
| `pair` | `pair.begin`, `pair.cancel`, `pair.complete` | QR-Pairing |
| `contact` | `contact.list`, `contact.get`, `contact.rename`, `contact.delete` | Kontakte |
| `msg` | `msg.send`, `msg.cancel`, `msg.pending` | Nachrichten |
| `radio`, `mesh`, `led` | `*.get`, `*.set` | Konfiguration (nur als Dienst, noch ohne Oberfläche) |

Welcher Befehl in welchem Zustand der Antenne erlaubt ist, steht im Skill `offgrid-antenna-protocol` §4. Nicht benutzt werden `sys.factory_reset`,
`sys.set_log_level`, `sec.rotate_token`, `sec.get_policy`, `sec.set_policy`, `radio.stats`, `led.test` und `dbg.*`.

## Ereignisse

| Ereignis | Wann |
|---|---|
| `sys.boot` | nach jedem Start der Antenne |
| `sec.state` | der Zustand wechselt (`unlock`, `provision`, `lock`, `heartbeat_timeout`, `factory_reset`) |
| `msg.received` | eine Nachricht kam an und ist geprüft (Text, Reaktion oder Standort) |
| `msg.status` | eine wartende Nachricht wechselt den Zustand |
| `contact.state` | ein Kontakt wurde `active` |

`log`, `rf.tx`, `rf.rx` und `error` werden ignoriert.

## Fehlercodes

`E_PARSE`, `E_LINE_TOO_LONG`, `E_UNKNOWN_CMD`, `E_INVALID_ARG`, `E_PROTO_MISMATCH`, `E_LOCKED`, `E_NOT_PROVISIONED`, `E_ALREADY_PROVISIONED`,
`E_ALREADY_UNLOCKED`, `E_NO_SESSION`, `E_UNLOCK_FAILED`, `E_RATE_LIMITED`, `E_CONFIRM_REQUIRED`, `E_NO_PAIRING`, `E_INVALID_QR`, `E_SELF_PAIR`,
`E_CONTACT_EXISTS`, `E_NO_SUCH_CONTACT`, `E_STORAGE_FULL`, `E_TOO_LONG`, `E_QUEUE_FULL`, `E_BUSY`, `E_RADIO`, `E_INTERNAL`. Nur in der App entstehen
`E_TIMEOUT`, `E_DISCONNECTED` und `E_INVALID_RESPONSE`.

## Limits

| Wert | Zahl |
|---|---|
| Zeilenlänge | 2048 Bytes |
| Text pro Nachricht | 83 Bytes (aus `limits.max_text_bytes`) |
| Namen | 1 bis 24 Bytes |
| Kontakte | 32 |
| Warteschlange der Antenne | 8 (nur RAM) |
| `contact.list` | höchstens 10 je Seite |
| Heartbeat / Auto-Lock | 5 s / 15 s |
| Pairing läuft ab | 300 s |
| `wrapped_token` | 60 Bytes |

Im Browser läuft anstatt der nativen Plugins das Mock-Gerät, siehe [Antenne](../funktionen/antenne.md).
