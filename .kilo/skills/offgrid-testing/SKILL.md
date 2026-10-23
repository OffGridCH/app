---
name: offgrid-testing
description: Teststrategie für OffGrid im 24-h-Marathon – was getestet wird (Services, Serial-Client, Mock-Gerät, Keystore, Formatierung), wie (Angular-Testrunner, Memory-Repos, Mock-Gerät über die echte Host-API), Befehle und Pflichttests pro Bereich. Laden durch den tester und bei Tickets mit Abschnitt "Tests".
---

# OffGrid Tests – pragmatisch

## Grundsatz

- **Getestet** werden: reine Funktionen und Services in `src/app/core/` (Serial-Client, Gerätezustände, Entsperr-Wrap, Zeitformate,
  Signal-Level, Messaging-Logik, Handshake-Logik, Backup).
- **Nicht** getestet: Aussehen von Seiten. UI ist gesichert durch Lint + Build + Review. Ausnahme: `og-signal-bars`
  und `og-message-bubble` je 1 Test (siehe unten), weil sie Zustände abbilden.
- Kein Test darf Netz oder echte USB-Hardware brauchen. Wartezeiten über Fake-Timer lösen; wo ein Test das simulierte Gerät laufen lässt,
  nutzt er die kurzen Zeiten `FAST_TIMING` (Millisekunden) und `vi.waitFor`.

## Befehle (in T00 so eingerichtet)

- `npm run test:ci` = `ng test --configuration=ci --watch=false` (Vitest + jsdom, kein Browser nötig).
  Hat `angular.json` unter `test` keine Konfiguration `ci`: `ng test --watch=false`.

## WebCrypto im Test (Pflicht, T00)

jsdom hat **kein** `crypto.subtle`. Deshalb setzt `src/test-setup.ts` die WebCrypto von Node ein (oberste Zeilen):

```ts
import { webcrypto } from 'node:crypto';
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
```

Damit ist WebCrypto in allen Tests echt vorhanden – **nicht** mocken. Fehlt `src/test-setup.ts` in `angular.json`
(`test.options.setupFiles`), dort eintragen.
- `npm run lint`, `npm run build`.

## Werkzeuge

- Testdateien neben der Datei: `x.service.ts` → `x.service.spec.ts`.
- DI im Test: `TestBed.configureTestingModule({ providers: [...] })` mit **Memory-Repositories** (`dataProviders` aus `app.config.ts`).
- `src/app/core/antenna/antenna-harness.testing.ts`: `setupAntennaHarness(options?)` richtet den **echten** `AntennaPort` mit einem `LoopbackTransport`,
  einem `MockDevice` (simuliertes Gerät, spricht die Host-API v1) und `BrowserKeystoreService` ein; liefert `{ transport, keystore, antenna, device }`.
  `provisionedDevice()` ist ein eingerichtetes, gesperrtes Gerät mit zwei Kontakten (`TEST_CONTACTS`), das das erste Token annimmt;
  ohne Optionen ist das Gerät `unprovisioned`. Hooks des Geräts: `injectText`, `injectReaction`, `injectGeo`, `failNext`, `lockNow`, `reboot`,
  `detach`; `LoopbackTransport.unplug()` zieht das Kabel. Nach dem Test `antenna.disconnect()` (stoppt Heartbeat und Timer).
- Zwei Geräte (Handshake, Fingerabdruck): zwei `MockDevice` mit je eigener `SerialClient`; `pair.begin` des einen ist `pair.complete` des anderen.
- Eine eigene Drehbuch-Leitung (`SerialTransport`) für Fehlerfälle, die das Mock-Gerät nicht erzeugt (kein Hello, falsche Version, kaputte Antwort).
- Zeit: `vi.useFakeTimers()` / `vi.advanceTimersByTimeAsync()`. `now` als Parameter übergeben, wo möglich.
- Test-API nur aus `vitest` (`describe`, `it`, `expect`, `vi`). Kein Jasmine/Karma.

## Pflichttests

| Datei | Fälle |
|---|---|
| `core/crypto/hex.spec.ts`, `base64.spec.ts` | Hin- und Rückweg, leere Eingabe |
| `core/keystore/x25519.spec.ts` | RFC-7748-Vektoren (§5.2, §6.1); falsche Länge und Punkt kleiner Ordnung werden abgewiesen |
| `core/keystore/unlock-wrap.spec.ts` | Token = HMAC-SHA256(`K_phone`, `"og-unlock-v1"` ‖ `device_id_bytes`) = `40ed8815…ebe0`; `wrapped_token` hat **60 Bytes** und ist **genau** `cHFyc3R1…YXb` (Testvektor des Vertrags §11.1); das Gerät packt es wieder aus; falsches Gerät, andere Nonce und verfälschte Bytes werden abgelehnt |
| `core/keystore/keystore.service.spec.ts` | Token pro Gerät verschieden; gleicher Schlüssel → gleiches Token; bei jedem Versuch neue Einmal-Schlüssel und neuer IV |
| `core/messaging/limits.spec.ts` | `contentBytes` zählt UTF-8-Bytes (Umlaute 2); `maxContentBytes(83)` = **83**, `(100)` = 100, `(40)` = 40, `(222)` = 222 (unverändert, kein Abzug, kein `(100) = 67`); `isValidDisplayName`: 24 Bytes ja, 25 nein, leer nein; `splitText`: 83 Bytes ein Teil, 84 zwei, nie mitten in einem Zeichen, Emoji bleiben ganz |
| `core/format/radio.spec.ts` | `formatMHz(868100000)` = „868“ |
| `core/location/geo.spec.ts` (T17) | Distanz (47.05021, 8.30934)→(47.37689, 8.54169) = 40 342 m ±100; (47.05021, 8.30934)→(47.05812, 8.31998) = 1193 m ±5 und Kurs 42.5° ±0.5 (= Demo „1.2 km Nordosten“); Distanz gleicher Punkt = 0; Kurs nach Norden 0, Osten ≈ 90; `compassName` 22.4 → „Norden“, 22.6 → „Nordosten“, 359 → „Norden“; `formatDistance` 849 → „850 m“, 996 → „1.0 km“, 1234 → „1.2 km“, 9990 → „10 km“, 12345 → „12 km“; `formatCoordinate(-33.9, -70.6)` mit „S“ und „W“; `formatAgo` Grenzen |
| `core/location/location.service.spec.ts` (T17) | Geolocation gemockt: Erfolg setzt `myFix`; Ablehnung → `location-denied`; `isFresh` 10-min-Grenze |
| `core/messaging/signal.spec.ts` | Grenzwerte -80/-95/-105/-115; `seenAt` null → 0; älter 15 min → 0 |
| `core/format/time.spec.ts` | heute, gestern, < 7 Tage, älter; `formatLastSeen` null |
| `core/antenna/serial-client.spec.ts` | Anfrage `{id, cmd, args}` mit LF; `id`s eindeutig und steigend; genau **eine** Antwort pro `id`, Ereignisse nie beantwortet; höchstens **4** in Flight; Zeile über **2048** Bytes (inkl. LF) verworfen, 2048 angenommen; CR toleriert; Zeilen ohne `{` verworfen; bis zum ersten LF nach dem Öffnen verworfen; Zeitlimit **2 s**, **5 s** für `sec.*`, `pair.complete`, `contact.delete`; `sys.hello` alle **500 ms** bis zur Antwort; `sys.ping` alle **5 s**; `close` weist offene Anfragen ab |
| `core/antenna/mock-device.spec.ts` | Das Mock-Gerät beantwortet **alle** Befehle der Host-API wie der Vertrag (`sys.*`, `sec.*`, `id.*`, `pair.*`, `contact.*`, `msg.*`, `radio.*`, `mesh.*`, `led.*`) mit den Fehlercodes des Vertrags; erzeugt `sys.boot`, `sec.state`, `msg.status`, `msg.received`, `contact.state`; Limits 2048/32/83/8; Sitzung einmalig, Ratenbegrenzung, Auto-Lock; Beispiele des Vertrags (23 Byte → 206 ms, Fingerabdruck „0501 3010 7790“, `node_id` `E841`) |
| `core/antenna/antenna-port.spec.ts` | Zustände `disconnected`/`unprovisioned`/`locked`/`unlocked`; Entsperren von selbst; `provision`; Fehler (`no-device`, `no-hello`, `proto-mismatch`, `lost`, `unlock-failed`, `rate-limited`, `keystore-failed`); Neustart und Auto-Lock entsperren wieder; zwei verpasste Heartbeats → `lost` |
| `core/messaging/messaging.service.spec.ts` | Text wird gespeichert und mit `msg.send` (`type: "text"`) übergeben, `ctr` und `msg_ref` eingetragen; Status aus `msg.status` (`sent`/`relayed` → Gesendet, `delivered` → Zugestellt, `failed` → Fehlgeschlagen); langer Text wird an **83 Bytes** geteilt (jedes Stück eine Nachricht, nichts geht verloren); nicht entsperrt → bleibt Queued und geht beim Entsperren in Reihenfolge hinaus; volle Warteschlange (`E_QUEUE_FULL`) → wartet; `sys.boot` lässt alles Wartende scheitern; `retry`, `cancel`; Eingang: gespeichert, Duplikat (`ctr`) nicht doppelt, unbekannter Kontakt wird geholt, Standort mit Koordinate, Reaktion nur als Ereignis; Reaktion senden (`target {author, ref}`); `sendLocation` sendet `type: "geo"` |
| `core/handshake/handshake.service.spec.ts` | `contact.list`/`contact.get` werden ohne Schlüssel gespiegelt (mehrere Seiten, wiederholt, Platz mit neuem Schlüssel löscht den Verlauf); `pair.begin` liefert den QR-Text; `pair.complete` liefert den Kontakt mit `fingerprint`, `pending` wird `active`; Fehler `invalid-qr`, `no-pairing`, `self-pair`, `contact-exists`, `storage-full`; umbenennen und löschen. Gleicher Fingerabdruck auf beiden Seiten steht in `mock-device.spec.ts` |
| `core/backup/backup.service.spec.ts` | Daten verschlüsseln→entschlüsseln (ohne Filesystem: interne Funktionen `seal`/`open` testen); falsches Passwort → `wrong-password` |
| `ui/signal-bars/signal-bars.component.spec.ts` | Level 2 → genau 2 Balken mit Klasse `on`; `aria-label` gesetzt |
| `ui/message-bubble/message-bubble.component.spec.ts` | `failed` zeigt Button „Erneut senden“ und löst `retry` aus |

## Regeln für den Tester

- Tests prüfen Verhalten aus den Skills, nicht Implementierungsdetails.
- Ein roter Test wegen App-Fehler → `FAIL` mit Mangel für den Coder. Test **nicht** anpassen, damit er grün wird.
- Flaky Tests (zeitabhängig) sind ein Mangel des Tests → mit Fake-Timern lösen.
