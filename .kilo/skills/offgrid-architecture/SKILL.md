---
name: offgrid-architecture
description: Architektur der OffGrid-App – Ordnerstruktur, erlaubte Pakete, Services und ihre Signals, Routen, Start-Logik und Plattform-Weiche (Mock/Browser vs. Android). Laden bei Setup, neuen Services, Routing oder wenn unklar ist, wohin Code gehört.
---

# OffGrid Architektur

## 1. Erlaubte Pakete (abschliessend)

Zusätzlich zu dem, was `ionic start` erzeugt:

| Paket | Zweck | Ticket |
|---|---|---|
| `@fontsource-variable/schibsted-grotesk`, `@fontsource/geist-mono` | Schriften offline | T00 |
| `angular-eslint`, `prettier` (dev) | Lint/Format | T00 |
| `@capacitor/android` | Plattform | T00 |
| `@capacitor-community/sqlite` | Datenbank | T04 |
| `qrcode` + `@types/qrcode` (dev) | QR anzeigen | T02 |
| `@capacitor-mlkit/barcode-scanning` | QR scannen | T11 |
| `@capacitor/haptics` | Vibration | T13 |
| `@capacitor/filesystem`, `@capacitor/share` | Export | T14 |
| `@capawesome/capacitor-file-picker` | Import | T14 |
| `@capacitor/status-bar`, `@capacitor/splash-screen` | Systemleisten | T00 |
| `@capacitor/app` | App wieder im Vordergrund → Antenne neu verbinden, falls getrennt | T00 (Nutzung T06) |
| `@capacitor/geolocation` | Eigener Standort (GPS, offline) | T17 |
| `@capacitor/clipboard` | Koordinaten kopieren | T18 |
| `@capacitor/app-launcher` | Standort in Karten-App öffnen (`geo:`-Link) | T18 |
| USB-Serial: **lokales Capacitor-Plugin** `UsbSerial` (siehe Skill `offgrid-antenna-protocol`) mit Gradle-Dependency `com.github.mik3y:usb-serial-for-android` | Antenne | T06 |

`playwright` (dev, nur für `tools/screens.mjs`, T21).
Python (nur Doku, nicht Teil der App): `mkdocs-material` laut `requirements-docs.txt` in `.venv-docs/` (T21).
GitHub Actions (nur T21): `actions/checkout@v4`, `actions/setup-node@v4`, `actions/setup-python@v5`,
`actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`.

Alles andere ist verboten. Kryptografie nur über **WebCrypto** (`crypto.subtle`, `crypto.getRandomValues`),
UUIDs über `crypto.randomUUID()`.

## 2. Ordnerstruktur (verbindlich)

```
src/
  app/
    app.config.ts            Provider (Router, Ionic, Plattform-Weiche)
    app.routes.ts            Routen (siehe 5)
    app.component.ts         <ion-app><ion-router-outlet/></ion-app>, ruft AppStartService.init()
    core/
      log.ts
      format/time.ts         Zeit-/Datumsformate (Skill offgrid-screens → "Zeitformate")
      format/radio.ts        formatMHz(freqHz)
      models/                contact.ts, message.ts, handshake.ts, settings.ts, antenna.ts, device.ts, errors.ts
      platform.ts            isNative(): boolean  (Capacitor.isNativePlatform())
      app-start.service.ts   DB öffnen, Settings laden, Antenne verbinden, Startroute
      onboarding.guard.ts    funktionaler Guard (T09)
      settings/settings.service.ts
      data/                  database.service.ts (abstrakt + Sqlite), migrations.ts, data-changed.service.ts,
                             contact.repository.ts, message.repository.ts, coordinate.repository.ts, settings.repository.ts,
                             memory/ (Memory-Implementierungen inkl. MemoryDatabaseService, seed.ts)
      antenna/               antenna-port.ts (Zustand, Befehle, Ereignisse), serial-client.ts (JSON Lines), device-parse.ts,
                             device-error.ts, serial-transport.ts (abstrakt), mock-serial-transport.ts, mock-device.ts,
                             unavailable-transport.ts, usb-serial.plugin.ts + usb-serial.transport.ts (T06)
      keystore/              keystore.service.ts (abstrakt), browser-keystore.service.ts, android-keystore.service.ts,
                             keystore.plugin.ts (T06), unlock-wrap.ts, x25519.ts, bytes.ts
      crypto/                hex.ts, base64.ts   (keine Nachrichtenverschlüsselung: das Gerät verschlüsselt)
      messaging/             limits.ts, signal.ts, reactions.ts, messaging.service.ts
      handshake/             handshake.service.ts, scanner.ts (QR-Scanner-Plugin gekapselt)
      backup/                backup.service.ts, file-io.ts (Datei wählen/speichern, nativ + Browser)
      location/              geo.ts (reine Funktionen), location.service.ts, maps.ts (Karten-App/Kopieren) – Skill offgrid-location
      groups/                group.service.ts (nur T20, optional) – Skill offgrid-groups
    ui/                      je Komponente ein Ordner: button/ (og-button + og-link-button), icon/, icon-button/, topbar/,
                             section-label/, card/, info-row/, avatar/, signal-bars/, status-dot/, badge/,
                             banner/ (og-banner + og-banner-action + og-note), step-list/, text-field/,
                             switch/, segmented/, message-bubble/, composer/, qr/
    features/
      verbinden/verbinden.page.ts
      name/name.page.ts
      kontakte/kontakte.page.ts
      handshake/handshake.page.ts, kontakt-benennen.page.ts
      chat/chat.page.ts, location-sheet.component.ts (T18)
      standort/standort.page.ts (T18)
      gruppe/gruppe-neu.page.ts, gruppe-chat.page.ts (nur T20, optional)
      einstellungen/einstellungen.page.ts, export.page.ts, import.page.ts
  theme/ tokens.scss, typography.scss, global.scss
  testing/ Test-Helfer (nur Tester)
  test-setup.ts         WebCrypto für Vitest/jsdom (Skill offgrid-testing)
  environments/         environment.ts / environment.prod.ts vom Starter (+ `version`, T13)
  index.html            lang="de", Titel „OffGrid“ (T00)
scripts/android.ps1    Windows-Skript für den Menschen (nicht ändern)
doku/                  MkDocs-Quellen der Frontend-Doku (Skill offgrid-docs)
tools/screens.mjs      Playwright-Screenshots für die Doku (nicht ändern)
MEILENSTEINE.md        Zeitplan und Wächter-Regeln für den Menschen (nicht ändern)
mkdocs.yml, requirements-docs.txt   Doku-Konfiguration (T21)
.github/workflows/     ci.yml (Checks), pages.yml (Doku veröffentlichen) – T21
android/app/src/main/java/…/UsbSerialPlugin.java   lokales Capacitor-Plugin (T06)
```

## 3. Plattform-Weiche

In `app.config.ts`:

```ts
{ provide: SerialTransport, useExisting: useMockAntenna() ? MockSerialTransport : UsbSerialTransport },
{ provide: KeystoreService, useExisting: useMockAntenna() ? BrowserKeystoreService : AndroidKeystoreService },
// Sqlite- und Memory-Klassen sind @Injectable({ providedIn: 'root' }); Tokens zeigen mit useExisting darauf,
// damit MemoryDatabaseService und die App DIESELBEN Instanzen benutzen:
{ provide: DatabaseService, useExisting: isNative() ? SqliteDatabaseService : MemoryDatabaseService },
{ provide: ContactRepository, useExisting: isNative() ? SqliteContactRepository : MemoryContactRepository },
// gleich für MessageRepository, CoordinateRepository, SettingsRepository
```

- Repositories sind **abstrakte Klassen** (als DI-Token nutzbar) in `core/data/*.repository.ts`, die Sqlite-Implementierung
  daneben (`SqliteContactRepository` in derselben Datei oder `*.sqlite.ts`), Memory-Implementierung in `core/data/memory/`.
- `useMockAntenna()` ist `!isNative() || localStorage.getItem('og.mock') === '1'`: Im Browser, und auf Android zum Vorführen
  ohne Hardware, läuft das simulierte Gerät mit einem Schlüssel im Arbeitsspeicher. Ein-/Ausschalten nur über die
  Entwickler-Konsole, keine UI. Bis T06 steht auf Android `UnavailableSerialTransport` (findet nie ein Gerät).
- `AntennaPort`, `SerialClient`, `MessagingService` und `HandshakeService` sind normale Services (`providedIn: 'root'`);
  die Plattform-Weiche liegt allein im `SerialTransport` und im `KeystoreService`.

## 4. Services und ihre öffentliche Schnittstelle

Alle Services `@Injectable({ providedIn: 'root' })` ausser wo oben anders. Öffentlich sind nur `readonly` Signals und Methoden.

### AntennaPort – Details im Skill `offgrid-antenna-protocol`
- `state: Signal<AntennaState>` – `'disconnected' | 'unprovisioned' | 'locked' | 'unlocked'`
- `connecting: Signal<boolean>`, `connected: Signal<boolean>`
- `device: Signal<DeviceInfo | null>` – Gerätedaten aus `sys.hello`; `identity: Signal<{ nodeId; name } | null>` (nur entsperrt)
- `limits: Signal<DeviceLimits>` – `{ maxLine, maxContacts, maxTextBytes, pendingQueue }` aus `sys.hello` (Standard 2048/32/83/8)
- `error: Signal<AntennaErrorCode | null>`
- `connect()`, `disconnect()`, `provision(name): Promise<boolean>`, `unlock(): Promise<boolean>`, `lock()`
- `request(cmd, args?): Promise<JsonObject>` – ein Befehl der Host-API; wirft `DeviceError`
- `events: Observable<DeviceEvent>` – `sys.boot`, `sec.state`, `msg.received`, `msg.status`, `contact.state`
  (einzige erlaubte Observable-Schnittstelle)

### SettingsService
- `displayName: Signal<string>`, `installId: Signal<string>`, `bgReceive: Signal<boolean>`, `vibrate: Signal<boolean>`,
  `onboardingDone: Signal<boolean>`
- `load()`, `setDisplayName(v)`, `setBgReceive(v)`, `setVibrate(v)`, `completeOnboarding()`

### DataChangedService (`core/data/data-changed.service.ts`)
- `version: Signal<number>`, `notify(): void` (erhöht `version`).
- Jeder Service, der Kontakte, Nachrichten oder ganze Datenbestände ändert, ruft danach `notify()`: HandshakeService
  (Kontakt gespiegelt, umbenannt, gelöscht), MessagingService (Nachricht gespeichert, Status geändert), BackupService (Import).
  Seiten laden ihre Listen per `effect` neu, wenn `version` sich ändert.

### MessagingService – Details im Skill `offgrid-antenna-protocol` §9
- `maxContentBytes: Signal<number>` – `limits.maxTextBytes` des Geräts, unverändert (Standard 83)
- `sendText(contactId, text): Promise<void>` – teilt an `maxContentBytes()` Bytes; jedes Stück eine eigene Nachricht
- `sendLocation(contactId, fix: GeoFix): Promise<void>` (ab T17) – Standort-Nachricht (`type: "geo"`), Details Skill `offgrid-location`
- `sendReaction(contactId, target, emoji | null): Promise<boolean>`; `reactions: Observable<ReactionEvent>` (eingehende Reaktionen)
- `retry(messageId)`, `cancel(messageId)`, `markRead(contactId)`
- Hört auf `AntennaPort.events` (`msg.received`, `msg.status`, `sys.boot`) und leert beim Entsperren die Warteschlange
  (Nachrichten ohne `msg_ref`, älteste zuerst).
- Listen für die Seiten (`contacts`, `messages(contactId)`, `counts`, `unreadCount`) und `deleteAll()` (über
  `DatabaseService.deleteAllUserData()`) kommen mit den Seiten-Tickets (T10, T12, T13) hinzu.
- Darf `HandshakeService` injizieren (nur zum Nachladen eines unbekannten Kontakts); `HandshakeService` injiziert `MessagingService` nicht.

### HandshakeService – Details im Skill `offgrid-crypto-handshake`
- `qrText`, `qrExpiresAt`, `error`, `completedContactId` (Signals)
- `begin(): Promise<string | null>` (`pair.begin`), `cancel()` (`pair.cancel`), `complete(qrText, { name?, replace? }): Promise<Contact | null>` (`pair.complete`)
- `scan(): Promise<void>` (T11) – ruft `scanQr()` aus `core/handshake/scanner.ts`, bei Erfolg `complete(text)`. Die Seite ruft **nur** `scan()`.
- `syncContacts()` (`contact.list`), `refreshContact(contactId)` (`contact.get`), `rename(contactId, name)`, `remove(contactId)`
- `clearCompleted(): void` – setzt `completedContactId` auf null; `looksLikeOffgridQr(text)` prüft die Form des Codes.

### BackupService
- `export(password): Promise<void>` (erstellt Datei + öffnet Teilen-Dialog bzw. Download im Browser)
- `pickFile(): Promise<{ name: string; text: string } | null>` (null = abgebrochen)
- `import(fileText: string, password: string): Promise<void>`
- `error: Signal<BackupErrorCode | null>`

### LocationService (ab T17) – Details im Skill `offgrid-location`
- `myFix: Signal<GeoFix | null>`, `locating: Signal<boolean>`, `error: Signal<LocationErrorCode | null>`
- `locate(): Promise<GeoFix | null>`
- `isFresh(fix, now): boolean` (≤ 10 min alt)

### KeystoreService (`core/keystore/`) – Details im Skill `offgrid-crypto-handshake` §1
- `unlockToken(deviceId): Promise<Uint8Array>`, `createUnlockEnvelope(session, deviceId): Promise<{ appEphPub, wrappedToken }>`

## 5. Routen (`app.routes.ts`, alle Seiten lazy via `loadComponent`)

| Pfad | Seite | Hinweis |
|---|---|---|
| `''` | redirect | auf `kontakte` |
| `verbinden` | VerbindenPage | Onboarding Schritt 1 und „Neu verbinden“ |
| `name` | NamePage | Onboarding Schritt 2 |
| `kontakte` | KontaktePage | zeigt Leerzustand, wenn keine Kontakte und keine ausstehenden |
| `kontakte/neu` | HandshakePage | Query `?tab=scan` öffnet Tab „Code scannen“ |
| `kontakte/neu/fertig/:contactId` | KontaktBenennenPage | |
| `chat/:contactId` | ChatPage | |
| `chat/:contactId/standort/:messageId` | StandortPage | ab T18 |
| `gruppe/neu` | GruppeNeuPage | nur T20 (optional) |
| `gruppe/:groupId` | GruppeChatPage | nur T20 (optional) |
| `einstellungen` | EinstellungenPage | |
| `einstellungen/export` | ExportPage | |
| `einstellungen/import` | ImportPage | |

Guard `onboardingGuard` (funktional) auf `kontakte`, `chat/*`, `einstellungen*`, `kontakte/neu*`, `gruppe/*`:
wenn `SettingsService.onboardingDone()` false → `UrlTree` auf `verbinden`.

## 6. Start (`AppStartService.init()`, aufgerufen in `AppComponent`)

1. `DatabaseService.open()` (führt Migrationen aus; im Browser no-op).
2. `SettingsService.load()`; fehlt `install_id`, erzeuge `crypto.randomUUID()` und speichere.
3. `MessagingService` und `HandshakeService` erzeugen (sie hören auf die Antenne), dann `AntennaPort.connect()` im Hintergrund
   starten (nicht awaiten). Ist das Gerät `locked`, entsperrt der Port es selbst; beim Entsperren spiegelt `HandshakeService` die Kontakte.
4. Nur nativ: StatusBar Stil `Dark`, Hintergrund `STATUS_BAR_COLOR` aus `core/platform.ts`.
5. Nur nativ: `SplashScreen.hide()`.
6. Nur Browser: wenn `localStorage.getItem('og.noseed') !== '1'` → `inject(Injector).get(MemoryDatabaseService).seedDemo()`
   **vor** Schritt 2 (nur im Browser-Zweig auflösen).

## 7. Modelle (`core/models/`)

```ts
export type Direction = 'in' | 'out';
export enum MessageStatus { Queued = 0, Sent = 1, Delivered = 2, Failed = 3 }

export type ContactState = 'pending' | 'active';
export interface Contact {              // Spiegel vom Gerät (`contact.get`), ohne Schlüssel
  contactId: number;                    // Platz 1–32 auf dem Gerät
  name: string; nodeId: string; publicKey: string; state: ContactState; fingerprint: string;
  lastRssi: number | null; lastSnr: number | null; txCtr: number; rxHighestCtr: number | null;
}
export type MessageKind = 'text' | 'location';
export interface Message {
  id: string; contactId: number; ctr: number | null; msgRef: number | null; content: string;
  direction: Direction; kind: MessageKind; sentAt: string; status: MessageStatus; rssi: number | null;
  readAt: string | null; createdAt: string; updatedAt: string | null;
}
export interface Coordinate {
  id: string; contactId: number; messageId: string | null; latitude: number; longitude: number;
  accuracy: number | null; context: 'einmal' | 'live'; shareId: string | null; shareUntil: string | null;
  recordedAt: string; createdAt: string; updatedAt: string | null;
}
export interface MessageView extends Message { location: Coordinate | null; }
export interface GeoFix { latitude: number; longitude: number; accuracy: number; at: string; }
export interface ContactListItem {
  contact: Contact; lastMessage: Message | null; unread: number; signalLevel: 0 | 1 | 2 | 3 | 4;
}

// settings.ts
export type SettingsKey = 'install_id' | 'display_name' | 'onboarding_done' | 'bg_receive' | 'vibrate';

// antenna.ts – AntennaState, DeviceState, DeviceInfo, DeviceLimits, AntennaErrorCode (Skill offgrid-antenna-protocol §4)
// device.ts  – JsonObject, DeviceErrorCode, HelloResult, DeliveryState, ReceivedMessage, DeviceEvent (Skill offgrid-antenna-protocol §5–7)
// handshake.ts – HandshakeErrorCode
```

Alle Zeitstempel sind ISO-8601-Strings in UTC (`new Date().toISOString()`).
