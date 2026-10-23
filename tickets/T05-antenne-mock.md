# T05 – Antennen-Abstraktion, Frame-Codec, Mock-Antenne (ersetzt durch T23)

**Status: erledigt durch T23 (PR #12). Nicht starten.**

Dieses Ticket beschrieb eine Antenne als reines Funkmodem (NDJSON, Frame-Codec, `MockAntennaService`). Der Vertrag hat sich mit
„Offgrid Host Interface v1“ geändert: Die Antenne macht Funk und Krypto selbst. Was dieses Ticket verlangte, steckt jetzt so in T23:

| Früher in T05 | Jetzt (T23) |
|---|---|
| `antenna.port.ts`, `ndjson.ts` | `core/antenna/antenna-port.ts`, `serial-client.ts` (JSON Lines) |
| `frame.ts` (Frame-Codec) | entfällt: die App baut keine Funkpakete |
| `mock-antenna.service.ts`, `window.ogMock` | `core/antenna/mock-device.ts`, `mock-serial-transport.ts`, `ogMock` |
| Provider-Weiche `AntennaPort` | `app.config.ts`: `SerialTransport` und `KeystoreService` |
| `AppStartService` Schritt 3 | `app-start.service.ts` verbindet die Antenne im Hintergrund |

Skills: `offgrid-antenna-protocol`, `offgrid-crypto-handshake`.
