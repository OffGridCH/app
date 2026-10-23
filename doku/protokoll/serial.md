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

!!! info "Geplant"

    Das native USB-Serial-Plugin (`UsbSerial`) und das native Keystore-Plugin (`OffgridKeystore`) folgen mit T06. Im Browser läuft das Mock-Gerät,
    siehe [Antenne](../funktionen/antenne.md).
