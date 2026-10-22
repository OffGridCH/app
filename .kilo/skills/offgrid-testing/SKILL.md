---
name: offgrid-testing
description: Teststrategie für OffGrid im 24-h-Marathon – was getestet wird (Services, Codecs, Formatierung), wie (Angular-Testrunner, Memory-Repos, Mock-Antenne), Befehle und Pflichttests pro Bereich. Laden durch den tester und bei Tickets mit Abschnitt "Tests".
---

# OffGrid Tests – pragmatisch

## Grundsatz

- **Getestet** werden: reine Funktionen und Services in `src/app/core/` (Codec, Krypto, Zeitformate, Signal-Level,
  Messaging-Logik, Handshake-Logik, Backup).
- **Nicht** getestet: Aussehen von Seiten. UI ist gesichert durch Lint + Build + Review. Ausnahme: `og-signal-bars`
  und `og-message-bubble` je 1 Test (siehe unten), weil sie Zustände abbilden.
- Kein Test darf Netz, echte USB-Hardware oder Timer mit echter Wartezeit brauchen.

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
- DI im Test: `TestBed.configureTestingModule({ providers: [...] })` mit **Memory-Repositories** und
  `{ provide: AntennaPort, useClass: FakeAntenna }`.
- `src/testing/fake-antenna.ts` (vom Tester angelegt): implementiert `AntennaPort`, `setState(s)`, `transmit` speichert
  Frames in `sent: Uint8Array[]`, gibt fortlaufende IDs zurück und löst sofort `txdone ok` aus (abschaltbar über
  `autoTxDone = false`); `emit(event)` löst Events aus; `link(other: FakeAntenna)` → jeder gesendete Frame kommt bei
  `other` als `rx` mit `rssi -90`, `snr 7` an (asynchron, nächste Microtask).
- Zwei Geräte in einem Test (Handshake): zwei getrennte Injector-Bäume mit
  `createEnvironmentInjector([...providers], TestBed.inject(EnvironmentInjector))`, je mit eigenen Memory-Repos,
  eigenem `FakeAntenna`, `HandshakeService`, `MessagingService`, `DataChangedService`; die beiden FakeAntennas mit `link` verbinden.
  Vor dem Ablauf je `SettingsService.setDisplayName('A')` bzw. `('B')` und beide FakeAntennas auf `ready` setzen.
- Zeit: `vi.useFakeTimers()` / `vi.advanceTimersByTimeAsync()`. `now` als Parameter übergeben, wo möglich.
- Test-API nur aus `vitest` (`describe`, `it`, `expect`, `vi`). Kein Jasmine/Karma.

## Pflichttests

| Datei | Fälle |
|---|---|
| `core/crypto/hex.spec.ts`, `base64.spec.ts` | Hin- und Rückweg, leere Eingabe |
| `core/crypto/crypto.service.spec.ts` | `newKey` 32 Hex; `encrypt`→`decrypt` gleich; falscher Schlüssel wirft; `tag` 8 Hex und stabil |
| `core/messaging/frame.spec.ts` | encode→peek (type, tag) →decode für alle Typen (ab T17 inkl. `loc`); `too-long` bei zu grossem Frame; zu kurzer Frame → `peek` null; falsche Version verworfen |
| `core/messaging/limits.spec.ts` | `contentBytes` zählt Umlaute (2 Bytes) und `"` (2 Bytes); `maxContentBytes(222)` = 153, `(255)` = 180; `isValidDisplayName`: leer/41 Zeichen/zu viele Bytes → false |
| `core/format/radio.spec.ts` | `formatMHz(868100000)` = „868“ |
| `core/location/geo.spec.ts` (T17) | Distanz (47.05021, 8.30934)→(47.37689, 8.54169) = 40 342 m ±100; (47.05021, 8.30934)→(47.05812, 8.31998) = 1193 m ±5 und Kurs 42.5° ±0.5 (= Demo „1.2 km Nordosten“); Distanz gleicher Punkt = 0; Kurs nach Norden 0, Osten ≈ 90; `compassName` 22.4 → „Norden“, 22.6 → „Nordosten“, 359 → „Norden“; `formatDistance` 849 → „850 m“, 996 → „1.0 km“, 1234 → „1.2 km“, 9990 → „10 km“, 12345 → „12 km“; `formatCoordinate(-33.9, -70.6)` mit „S“ und „W“; `formatAgo` Grenzen |
| `core/location/location.service.spec.ts` (T17) | Geolocation gemockt: Erfolg setzt `myFix`; Ablehnung → `location-denied`; `isFresh` 10-min-Grenze |
| `core/messaging/signal.spec.ts` | Grenzwerte -80/-95/-105/-115; `seenAt` null → 0; älter 15 min → 0 |
| `core/format/time.spec.ts` | heute, gestern, < 7 Tage, älter; `formatLastSeen` null |
| `core/crypto/key-pattern.service.spec.ts` | 25 Werte; Spiegelung Spalte 0=4, 1=3; gleiche Schlüssel in anderer Reihenfolge → gleiches Muster |
| `core/antenna/ndjson.spec.ts` | Zeile über 2 Chunks; 2 Zeilen in 1 Chunk; ungültiges JSON ignoriert |
| `core/messaging/messaging.service.spec.ts` | (ab T17 zusätzlich: `sendLocation` speichert Nachricht `kind 'location'` + Koordinate und sendet `loc`-Frame; eingehendes `loc` erzeugt Nachricht + Koordinate + `ack`; `messages()` liefert `location`) Senden bei `ready` → Frame gesendet, Status Queued→Sent bei `txdone ok`; `txdone !ok` → Failed; Senden bei `disconnected` bleibt Queued und wird bei `ready` gesendet; eingehendes `msg` wird gespeichert und `ack` gesendet; Duplikat wird nicht doppelt gespeichert; `ack` setzt Delivered |
| `core/handshake/handshake.service.spec.ts` | Kompletter Ablauf mit zwei Instanzen (A, B) und FakeAntenna, die Frames von A an B weiterreicht: beide haben am Ende einen Kontakt mit gekreuzten Schlüsseln; ungültiger QR → `invalid-qr` |
| `core/backup/backup.service.spec.ts` | Daten verschlüsseln→entschlüsseln (ohne Filesystem: interne Funktionen `seal`/`open` testen); falsches Passwort → `wrong-password` |
| `ui/signal-bars/signal-bars.component.spec.ts` | Level 2 → genau 2 Balken mit Klasse `on`; `aria-label` gesetzt |
| `ui/message-bubble/message-bubble.component.spec.ts` | `failed` zeigt Button „Erneut senden“ und löst `retry` aus |

## Regeln für den Tester

- Tests prüfen Verhalten aus den Skills, nicht Implementierungsdetails.
- Ein roter Test wegen App-Fehler → `FAIL` mit Mangel für den Coder. Test **nicht** anpassen, damit er grün wird.
- Flaky Tests (zeitabhängig) sind ein Mangel des Tests → mit Fake-Timern lösen.
