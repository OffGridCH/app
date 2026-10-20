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
| USB-Serial: **lokales Capacitor-Plugin** `UsbSerial` (siehe Skill `offgrid-antenna-protocol`) mit Gradle-Dependency `com.github.mik3y:usb-serial-for-android` | Antenne | T06 |

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
      models/                contact.ts, message.ts, handshake.ts, settings.ts, antenna.ts, errors.ts
      platform.ts            isNative(): boolean  (Capacitor.isNativePlatform())
      app-start.service.ts   DB öffnen, Settings laden, Antenne verbinden, Startroute
      onboarding.guard.ts    funktionaler Guard (T09)
      settings/settings.service.ts
      data/                  database.service.ts (abstrakt + Sqlite), migrations.ts, data-changed.service.ts,
                             contact.repository.ts, message.repository.ts, handshake.repository.ts, settings.repository.ts,
                             memory/ (Memory-Implementierungen inkl. MemoryDatabaseService, seed.ts)
      antenna/               antenna.port.ts (abstrakte Klasse), ndjson.ts,
                             serial-antenna.service.ts, mock-antenna.service.ts, usb-serial.plugin.ts
      crypto/                crypto.service.ts, key-pattern.service.ts, hex.ts, base64.ts
      messaging/             frame.ts (LoRa-Paket-Codec), limits.ts, signal.ts, messaging.service.ts,
                             handshake-frame-handler.ts (Token HANDSHAKE_FRAME_HANDLER)
      handshake/             handshake.service.ts, scanner.ts (QR-Scanner-Plugin gekapselt)
      backup/                backup.service.ts, file-io.ts (Datei wählen/speichern, nativ + Browser)
    ui/                      je Komponente ein Ordner: button/ (og-button + og-link-button), icon/, icon-button/, topbar/,
                             section-label/, card/, info-row/, avatar/, signal-bars/, status-dot/, badge/,
                             banner/ (og-banner + og-banner-action + og-note), step-list/, text-field/,
                             switch/, segmented/, message-bubble/, composer/, qr/
    features/
      verbinden/verbinden.page.ts
      name/name.page.ts
      kontakte/kontakte.page.ts
      handshake/handshake.page.ts, kontakt-benennen.page.ts
      chat/chat.page.ts
      einstellungen/einstellungen.page.ts, export.page.ts, import.page.ts
  theme/ tokens.scss, typography.scss, global.scss
  testing/ Test-Helfer (nur Tester)
  test-setup.ts         WebCrypto für Vitest/jsdom (Skill offgrid-testing)
  environments/         environment.ts / environment.prod.ts vom Starter (+ `version`, T13)
  index.html            lang="de", Titel „OffGrid“ (T00)
scripts/android.ps1    Windows-Skript für den Menschen (nicht ändern)
android/app/src/main/java/…/UsbSerialPlugin.java   lokales Capacitor-Plugin (T06)
```

## 3. Plattform-Weiche

In `app.config.ts`:

```ts
{ provide: AntennaPort, useClass: isNative() ? SerialAntennaService : MockAntennaService },
// Sqlite- und Memory-Klassen sind @Injectable({ providedIn: 'root' }); Tokens zeigen mit useExisting darauf,
// damit MemoryDatabaseService und die App DIESELBEN Instanzen benutzen:
{ provide: DatabaseService, useExisting: isNative() ? SqliteDatabaseService : MemoryDatabaseService },
{ provide: ContactRepository, useExisting: isNative() ? SqliteContactRepository : MemoryContactRepository },
// gleich für MessageRepository, HandshakeRepository, SettingsRepository
{ provide: HANDSHAKE_FRAME_HANDLER, useExisting: HandshakeService },   // ab T08
```

- Repositories sind **abstrakte Klassen** (als DI-Token nutzbar) in `core/data/*.repository.ts`, die Sqlite-Implementierung
  daneben (`SqliteContactRepository` in derselben Datei oder `*.sqlite.ts`), Memory-Implementierung in `core/data/memory/`.
- Zusätzlich gilt: Wenn `localStorage.getItem('og.mock') === '1'`, wird auch auf Android die Mock-Antenne genutzt
  (zum Vorführen ohne Hardware). Ein-/Ausschalten nur über die Entwickler-Konsole, keine UI.

## 4. Services und ihre öffentliche Schnittstelle

Alle Services `@Injectable({ providedIn: 'root' })` ausser wo oben anders. Öffentlich sind nur `readonly` Signals und Methoden.

### AntennaPort (abstrakt) – Details im Skill `offgrid-antenna-protocol`
- `state: Signal<AntennaState>` – `'disconnected' | 'searching' | 'device-found' | 'connecting' | 'ready' | 'error'`
- `deviceName: Signal<string | null>` – Name des USB-Geräts (Mock: `'Mock-Antenne'`)
- `info: Signal<AntennaInfo | null>` – `{ proto: number; fw: string; freq: number; max: number }`
- `error: Signal<AntennaErrorCode | null>`
- `connect(): Promise<void>`, `disconnect(): Promise<void>`
- `transmit(frame: Uint8Array): Promise<string>` – gibt die `id` des Sendeauftrags zurück
- `events: Observable<AntennaEvent>` – `rx` und `txdone` (einzige erlaubte Observable-Schnittstelle)

### SettingsService
- `displayName: Signal<string>`, `installId: Signal<string>`, `bgReceive: Signal<boolean>`, `vibrate: Signal<boolean>`,
  `onboardingDone: Signal<boolean>`
- `load()`, `setDisplayName(v)`, `setBgReceive(v)`, `setVibrate(v)`, `completeOnboarding()`

### DataChangedService (`core/data/data-changed.service.ts`)
- `version: Signal<number>`, `notify(): void` (erhöht `version`).
- Jeder Service, der Kontakte, Handshakes oder ganze Datenbestände ändert, ruft danach `notify()`: HandshakeService
  (neuer Kontakt), BackupService (Import), MessagingService (`deleteContact`, `deleteAll`). MessagingService und HandshakeService laden ihre Listen per `effect` neu, wenn `version` sich ändert.

### MessagingService
- `contacts: Signal<ContactListItem[]>` – sortiert nach letzter Nachricht absteigend; Kontakte ohne Nachricht nach `created_at`.
- `counts: Signal<{ contacts: number; messages: number }>`
- `unreadCount(contactId): Signal<number>`
- `messages(contactId): Signal<Message[]>` – aufsteigend nach `sent_at`.
- `maxContentBytes: Signal<number>` – laut Skill `offgrid-antenna-protocol` §5
- `send(contactId, text): Promise<void>`, `retry(messageId): Promise<void>`, `markRead(contactId): void`
- `renameContact(id, displayName, firstName, lastName): Promise<void>`, `deleteContact(id): Promise<void>`,
  `deleteAll(): Promise<void>` (über `DatabaseService.deleteAllUserData()`), `reload(): Promise<void>`
- Darf **nicht** `HandshakeService` injizieren, nur das Token `HANDSHAKE_FRAME_HANDLER`
  (`InjectionToken<{ onFrame(bytes: Uint8Array, rssi: number): Promise<void> }>`, Default-Factory = no-op).
- Verarbeitet eingehende Frames (`msg`, `ack`) und leitet `hs`/`hsa` an `HandshakeService` weiter.
- Leert die Warteschlange (`queued`) in Reihenfolge `sent_at`, sobald `AntennaPort.state` auf `ready` wechselt.

### HandshakeService – Details im Skill `offgrid-crypto-handshake`
- Darf **nicht** `MessagingService` injizieren. Sendet Frames selbst über `AntennaPort` + `frame.ts`.
- `current: Signal<HandshakeView | null>`
- `pending: Signal<PendingHandshakeItem[]>` – offene Handshakes mit Rolle `scanner`, Status `sent`.
- `startShowing(): Promise<string /* QR-Text */>`, `scanned(qrText): Promise<void>`, `cancel(): void`
- `scan(): Promise<void>` – ruft `scanQr()` aus `core/handshake/scanner.ts`, bei Erfolg `scanned(text)`, sonst Fehler in
  `current` (ist `current` null: `{ role: 'scanner', step: 1, error }`). Die Seite ruft **nur** `scan()`, nie `scanned()` direkt.
- `completedContactId: Signal<string | null>` – wird gesetzt, wenn ein Kontakt entstanden ist (Seite navigiert dann).
- `onFrame(bytes: Uint8Array, rssi: number): Promise<void>` – vom MessagingService für `hs`/`hsa` aufgerufen.
- `clearCompleted(): void` – setzt `completedContactId` auf null.

### BackupService
- `export(password): Promise<void>` (erstellt Datei + öffnet Teilen-Dialog bzw. Download im Browser)
- `pickFile(): Promise<{ name: string; text: string } | null>` (null = abgebrochen)
- `import(fileText: string, password: string): Promise<void>`
- `error: Signal<BackupErrorCode | null>`

### KeyPatternService
- `forContact(contact): Promise<boolean[]>`, `forInstall(installId): Promise<boolean[]>` (mit Cache pro Eingabe)

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
| `einstellungen` | EinstellungenPage | |
| `einstellungen/export` | ExportPage | |
| `einstellungen/import` | ImportPage | |

Guard `onboardingGuard` (funktional) auf `kontakte`, `chat/*`, `einstellungen*`, `kontakte/neu*`:
wenn `SettingsService.onboardingDone()` false → `UrlTree` auf `verbinden`.

## 6. Start (`AppStartService.init()`, aufgerufen in `AppComponent`)

1. `DatabaseService.open()` (führt Migrationen aus; im Browser no-op).
2. `SettingsService.load()`; fehlt `install_id`, erzeuge `crypto.randomUUID()` und speichere.
3. `AntennaPort.connect()` im Hintergrund starten (nicht awaiten).
4. Nur nativ: StatusBar Stil `Dark`, Hintergrund `STATUS_BAR_COLOR` aus `core/platform.ts`.
5. Nur nativ: `SplashScreen.hide()`.
6. Nur Browser: wenn `localStorage.getItem('og.noseed') !== '1'` → `inject(Injector).get(MemoryDatabaseService).seedDemo()`
   **vor** Schritt 2 (nur im Browser-Zweig auflösen).

## 7. Modelle (`core/models/`)

```ts
export type Direction = 'in' | 'out';
export enum MessageStatus { Queued = 0, Sent = 1, Delivered = 2, Failed = 3 }

export interface Contact {
  id: string; sendingKey: string; receivingKey: string; displayName: string;
  firstName: string | null; lastName: string | null; handshakeAt: string;
  lastRssi: number | null; lastSeenAt: string | null; createdAt: string; updatedAt: string | null;
}
export interface Message {
  id: string; contactId: string; wireId: string; content: string; direction: Direction;
  sentAt: string; status: MessageStatus; rssi: number | null; readAt: string | null;
  createdAt: string; updatedAt: string | null;
}
export interface ContactListItem {
  contact: Contact; lastMessage: Message | null; unread: number; signalLevel: 0 | 1 | 2 | 3 | 4;
}
export interface PendingHandshakeItem { handshakeId: string; peerName: string; }

export interface Handshake {
  id: string; role: 'shower' | 'scanner'; localKey: string; remoteKey: string | null; peerName: string | null;
  state: 'waiting' | 'sent' | 'done' | 'cancelled'; contactId: string | null; createdAt: string; updatedAt: string | null;
}

// settings.ts
export type SettingsKey = 'install_id' | 'display_name' | 'onboarding_done' | 'bg_receive' | 'vibrate';

// antenna.ts – AntennaState, AntennaInfo, AntennaEvent, AntennaErrorCode laut Skill offgrid-antenna-protocol §4
// frame.ts-Typ (in models/antenna.ts): export type FrameType = 'msg' | 'ack' | 'hs' | 'hsa';
```

Alle Zeitstempel sind ISO-8601-Strings in UTC (`new Date().toISOString()`).
