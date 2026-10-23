# Services

Die Services liegen in `src/app/core/`. Sie haben keine Oberfläche, sondern liefern Daten an die Seiten. Die App verschlüsselt keine
Nachrichten (das macht die Antenne); für das Entsperren der Antenne nutzt sie nur WebCrypto (`crypto.subtle`, `crypto.getRandomValues`)
und ein eigenes X25519 – es gibt keine Krypto-Bibliothek.

## AntennaPort

Datei: `src/app/core/antenna/antenna-port.ts`. Ein Singleton (`providedIn: 'root'`). Die Antenne aus Sicht der App: Verbindung, Zustand,
Befehle und Ereignisse. Details in [Antenne](../funktionen/antenne.md).

| Name | Typ | Beschreibung |
|---|---|---|
| `state` | `Signal<AntennaState>` | `disconnected`, `unprovisioned`, `locked` oder `unlocked`. |
| `connecting` | `Signal<boolean>` | `true`, solange `connect()` läuft. |
| `connected` | `Signal<boolean>` | Verbunden, in jedem Gerätezustand. |
| `device` | `Signal<DeviceInfo \| null>` | Gerätedaten aus `sys.hello` (Name, Chip, `deviceId`, Firmware, Protokoll). |
| `identity` | `Signal<{ nodeId, name } \| null>` | Eigene Kennung, solange entsperrt. |
| `limits` | `Signal<DeviceLimits>` | Grenzen des Geräts; Standard 2048 / 32 / 83 / 8, bis `sys.hello` geantwortet hat. |
| `error` | `Signal<AntennaErrorCode \| null>` | Letzter Fehler der Verbindung oder des Entsperrens. |
| `events` | `Observable<DeviceEvent>` | Typisierte Ereignisse: `sys.boot`, `sec.state`, `msg.received`, `msg.status`, `contact.state`. |
| `connect()` | `Promise<void>` | Leitung öffnen, `sys.hello`, ein gesperrtes Gerät von selbst entsperren, Heartbeat starten. |
| `disconnect()` | `Promise<void>` | Verbindung beenden. |
| `provision(name)` | `Promise<boolean>` | Frisches Gerät einrichten (`sec.provision`). |
| `unlock()` | `Promise<boolean>` | Gesperrtes Gerät entsperren (`sec.unlock`). |
| `lock()` | `Promise<void>` | Sofort sperren (`sec.lock`). |
| `request(cmd, args?)` | `Promise<JsonObject>` | Ein Befehl der Host-API. Wirft `DeviceError` mit dem Fehlercode des Geräts. |

## SerialClient

Datei: `src/app/core/antenna/serial-client.ts`. Eine Klasse (kein Service). Spricht JSON Lines: setzt Zeilen zusammen, vergibt `id`s, hält höchstens
4 Anfragen in Flight, prüft die Zeilenlänge (2048 Bytes) und die Zeitlimits (2 s, 5 s für `sec.*`, `pair.complete`, `contact.delete`), wiederholt
`sys.hello` alle 500 ms und sendet alle 5 s `sys.ping`. Er kennt weder USB noch einzelne Befehle.

## SerialTransport

Datei: `src/app/core/antenna/serial-transport.ts`. Abstrakte Klasse und DI-Token: die Leitung zur Antenne (Text hinein, Text heraus).
`MockSerialTransport` hängt das simulierte Gerät `MockDevice` an; `UnavailableSerialTransport` ist der Platzhalter auf Android bis T06.

## KeystoreService

Datei: `src/app/core/keystore/keystore.service.ts`. Abstrakte Klasse und DI-Token: das Entsperr-Geheimnis `K_phone`.

| Name | Typ | Beschreibung |
|---|---|---|
| `unlockToken(deviceId)` | `Promise<Uint8Array>` | `HMAC-SHA256(K_phone, "og-unlock-v1" ‖ device_id_bytes)`, 32 Bytes, pro Gerät. |
| `createUnlockEnvelope(session, deviceId)` | `Promise<{ appEphPub, wrappedToken }>` | Neuer Einmal-Schlüssel und das eingepackte Token (60 Bytes) für `sec.provision` und `sec.unlock`. |

`BrowserKeystoreService` hält einen zufälligen Schlüssel im Arbeitsspeicher; `AndroidKeystoreService` rechnet den HMAC über das native
Plugin `OffgridKeystore` (T06). X25519 steckt in `x25519.ts`, HKDF und AES-GCM in `unlock-wrap.ts` (WebCrypto).

## MessagingService

Datei: `src/app/core/messaging/messaging.service.ts`. Ein Singleton (`providedIn: 'root'`). Senden und Empfangen über die Host-API; die App
verschlüsselt nichts. Details in [Nachrichten](../funktionen/nachrichten.md).

| Name | Typ | Beschreibung |
|---|---|---|
| `maxContentBytes` | `Signal<number>` | Textlimit des Geräts (`limits.maxTextBytes`), unverändert; 83. |
| `reactions` | `Observable<ReactionEvent>` | Eingehende Reaktionen (werden nicht gespeichert). |
| `sendText(contactId, text)` | `Promise<void>` | Teilt den Text an `maxContentBytes()` Bytes; jedes Stück ist eine eigene Nachricht. |
| `sendLocation(contactId, fix)` | `Promise<void>` | Standort als Nachricht (`type: "geo"`). |
| `sendReaction(contactId, target, emoji)` | `Promise<boolean>` | Reaktion senden; `emoji = null` nimmt sie zurück. |
| `retry(messageId)` | `Promise<void>` | Gescheiterte Nachricht noch einmal senden. |
| `cancel(messageId)` | `Promise<void>` | Nachricht abbrechen (`msg.cancel`). |
| `markRead(contactId)` | `Promise<void>` | Eingehende Nachrichten eines Kontakts als gelesen markieren. |

## HandshakeService

Datei: `src/app/core/handshake/handshake.service.ts`. Ein Singleton (`providedIn: 'root'`). Das Pairing macht das Gerät; der Dienst
spiegelt die Kontakte. Details in [Kontakte & Handshake](../funktionen/kontakte-handshake.md).

| Name | Typ | Beschreibung |
|---|---|---|
| `qrText` | `Signal<string \| null>` | Text für den eigenen QR-Code. |
| `qrExpiresAt` | `Signal<number \| null>` | Ablaufzeit des Codes (ms seit 1970). |
| `error` | `Signal<HandshakeErrorCode \| null>` | Letzter Fehler. |
| `completedContactId` | `Signal<number \| null>` | Platz des gerade hinzugefügten Kontakts. |
| `begin()` | `Promise<string \| null>` | `pair.begin`: liefert den QR-Text. |
| `cancel()` | `Promise<void>` | `pair.cancel`. |
| `complete(qrText, options?)` | `Promise<Contact \| null>` | `pair.complete`: legt den Kontakt (`pending`, mit `fingerprint`) an. |
| `syncContacts()` | `Promise<void>` | Alle Kontakte vom Gerät holen (`contact.list`) und lokal speichern. Läuft bei jedem Entsperren. |
| `refreshContact(contactId)` | `Promise<Contact \| null>` | Einen Kontakt holen (`contact.get`). |
| `rename(contactId, name)` | `Promise<boolean>` | `contact.rename` (1–24 Bytes). |
| `remove(contactId)` | `Promise<boolean>` | `contact.delete` und lokal samt Verlauf. |
| `clearCompleted()` | `void` | `completedContactId` zurücksetzen. |

## DatabaseService

`src/app/core/data/database.service.ts` definiert die abstrakte Klasse. Sie dient zugleich als DI-Token, damit die App
je nach Plattform dieselbe Schnittstelle verwendet.

| Name | Typ | Beschreibung |
|---|---|---|
| `open()` | `Promise<void>` | Datenbank öffnen und offene Migrationen ausführen. |
| `replaceAll(data)` | `Promise<void>` | Alle Nutzdaten ersetzen; die Einstellungen bleiben erhalten. |
| `deleteAllUserData()` | `Promise<void>` | Kontakte, Nachrichten und Koordinaten löschen; die Einstellungen bleiben erhalten. |

### SqliteDatabaseService

Die native Implementierung nutzt `@capacitor-community/sqlite`. Sie öffnet die unverschlüsselte Datenbank `offgrid`,
aktiviert Fremdschlüssel und führt die Migrationen aus.

| Name | Typ | Beschreibung |
|---|---|---|
| `open()` | `Promise<void>` | Verbindung öffnen, `PRAGMA foreign_keys = ON` setzen und Migrationen ausführen. |
| `replaceAll(data)` | `Promise<void>` | Nutzdaten in einer Transaktion ersetzen. |
| `deleteAllUserData()` | `Promise<void>` | Nutzdaten in einer Transaktion löschen. |
| `query(statement, values?)` | `Promise<Record<string, unknown>[]>` | Abfrage mit gebundenen Parametern ausführen. |
| `run(statement, values?)` | `Promise<void>` | Schreibstatement mit gebundenen Parametern ausführen. |

### MemoryDatabaseService

`src/app/core/data/memory/memory-database.service.ts` ist die Browser-Implementierung. Ihre Daten liegen in `Map`s der
Memory-Repositories. `open()` hat im Browser nichts zu öffnen.

| Name | Typ | Beschreibung |
|---|---|---|
| `open()` | `Promise<void>` | No-op im Browser. |
| `replaceAll(data)` | `Promise<void>` | Nutzdaten ersetzen und `display_name` speichern. |
| `deleteAllUserData()` | `Promise<void>` | Nutzdaten löschen; die Einstellungen bleiben erhalten. |
| `seedDemo()` | `Promise<void>` | Browser mit den Demo-Daten aus `memory/seed.ts` füllen (`DEMO_CONTACTS`, dieselben Kontakte kennt das Mock-Gerät). |

## SettingsService

Datei: `src/app/core/settings/settings.service.ts`. Ein Singleton (`providedIn: 'root'`). Die gespeicherten Werte
kommen aus dem `SettingsRepository`; die Signale sind der schnelle Lesezugriff.

| Name | Typ | Beschreibung |
|---|---|---|
| `displayName` | `Signal<string>` | Anzeigename; standardmässig leer. |
| `installId` | `Signal<string>` | Install-Id; beim ersten Laden mit `crypto.randomUUID()` erzeugt und gespeichert. |
| `bgReceive` | `Signal<boolean>` | Hintergrundempfang; Standard `true`. |
| `vibrate` | `Signal<boolean>` | Vibration; Standard `false`. |
| `onboardingDone` | `Signal<boolean>` | Onboarding abgeschlossen; Standard `false`. |
| `load()` | `Promise<void>` | Einstellungen laden, fehlende `install_id` erzeugen und Speicherwerte übernehmen. |
| `setDisplayName(value)` | `Promise<void>` | Anzeigename speichern. |
| `setBgReceive(value)` | `Promise<void>` | Hintergrundempfang als `1` oder `0` speichern. |
| `setVibrate(value)` | `Promise<void>` | Vibration als `1` oder `0` speichern. |
| `completeOnboarding()` | `Promise<void>` | `onboarding_done` auf `1` setzen. |

## DataChangedService

Datei: `src/app/core/data/data-changed.service.ts`. Ein Singleton (`providedIn: 'root'`). Der Service meldet
Änderungen an Kontakten, Nachrichten oder ganzen Datenbeständen.

| Name | Typ | Beschreibung |
|---|---|---|
| `version` | `Signal<number>` | Version der Datenänderungen; beginnt bei 0. |
| `notify()` | `void` | Version um eins erhöhen. |

## AppStartService

Datei: `src/app/core/app-start.service.ts`. Ein Singleton (`providedIn: 'root'`). `AppComponent` ruft `init()` beim
Erstellen der Wurzelkomponente auf.

| Name | Typ | Beschreibung |
|---|---|---|
| `init()` | `Promise<void>` | Datenbank und Einstellungen starten, die Antenne im Hintergrund verbinden und auf Android Statusleiste und Splashscreen vorbereiten. |

Die Schritte laufen in dieser Reihenfolge:

1. `DatabaseService.open()` öffnet die Datenbank und führt die Migrationen aus.
2. Im Browser ruft der Dienst `MemoryDatabaseService.seedDemo()` auf. Der Schritt entfällt bei
   `localStorage.getItem('og.noseed') === '1'`.
3. `SettingsService.load()` lädt die Einstellungen und legt eine fehlende Install-Id an.
4. `MessagingService` und `HandshakeService` werden erzeugt (sie hören auf die Antenne), dann startet `AntennaPort.connect()` im Hintergrund.
   Der Aufruf wird nicht abgewartet: Fehler stehen in `AntennaPort.error`. Ein gesperrtes Gerät entsperrt der Port selbst.
5. Nur nativ setzt der Dienst den Statusleistenstil auf `Dark` und die definierte Hintergrundfarbe.
6. Nur nativ blendet der Dienst den Splashscreen aus.

Die Startrouten-Berechnung gehört nicht dazu. Fehler beim Start werden mit `log.error` protokolliert.

## Repositories

Die Repositories sind abstrakte Klassen in `src/app/core/data/`. Jede Klasse dient als DI-Token. Für jede gibt es eine
SQLite-Implementierung in derselben Datei und eine Memory-Implementierung unter `src/app/core/data/memory/`.

### ContactRepository

Die Kontakte gehören der Antenne; die App spiegelt sie (ohne Schlüssel).

| Name | Rückgabe | Beschreibung |
|---|---|---|
| `all()` | `Promise<Contact[]>` | Alle Kontakte nach Platz (`contactId`). |
| `byId(contactId)` | `Promise<Contact \| null>` | Ein Kontakt nach Platz. |
| `upsert(contact)` | `Promise<void>` | Kontakt einfügen oder aktualisieren; der Verlauf des Kontakts bleibt dabei erhalten. |
| `updateName(contactId, name)` | `Promise<void>` | Namen ändern. |
| `updateLink(contactId, rssi, snr)` | `Promise<void>` | Signalwerte des letzten empfangenen Pakets. |
| `setState(contactId, state)` | `Promise<void>` | Zustand ändern (`pending` → `active`). |
| `delete(contactId)` | `Promise<void>` | Kontakt löschen; Nachrichten und Koordinaten des Kontakts fallen mit weg. |
| `count()` | `Promise<number>` | Anzahl der Kontakte. |

### MessageRepository

| Name | Rückgabe | Beschreibung |
|---|---|---|
| `byId(id)` | `Promise<Message \| null>` | Eine Nachricht nach Id. |
| `forContact(contactId)` | `Promise<Message[]>` | Nachrichten eines Kontakts, älteste zuerst. |
| `lastPerContact()` | `Promise<Map<number, Message>>` | Letzte Nachricht je Kontakt. |
| `unreadPerContact()` | `Promise<Map<number, number>>` | Anzahl ungelesener eingehender Nachrichten je Kontakt. |
| `queued()` | `Promise<Message[]>` | Ausgehende Nachrichten, die noch nicht beim Gerät sind (Status 0, kein `msgRef`), älteste zuerst. |
| `byMsgRef(msgRef)` | `Promise<Message \| null>` | Offene ausgehende Nachricht mit diesem Handle des Geräts. |
| `byCtr(contactId, direction, ctr)` | `Promise<Message \| null>` | Nachricht nach Kontakt, Richtung und Zähler. |
| `insert(message)` | `Promise<void>` | Nachricht einfügen. |
| `setStatus(id, status)` | `Promise<void>` | Status ändern und `updated_at` setzen. |
| `assignRef(id, ctr, msgRef, status)` | `Promise<void>` | Zähler und Handle aus der Antwort auf `msg.send` eintragen. |
| `requeue(id)` | `Promise<void>` | Gescheiterte Nachricht ohne Zähler und Handle wieder in die Warteschlange legen. |
| `failPending()` | `Promise<number>` | Nach einem Neustart des Geräts alles als gescheitert markieren, was dort wartete. |
| `markRead(contactId, at)` | `Promise<void>` | Alle ungelesenen eingehenden Nachrichten des Kontakts als gelesen markieren. |
| `count()` | `Promise<number>` | Anzahl der Nachrichten. |

### CoordinateRepository

| Name | Rückgabe | Beschreibung |
|---|---|---|
| `insert(coordinate)` | `Promise<void>` | Koordinate einfügen. |
| `latestForMessage(messageId)` | `Promise<Coordinate \| null>` | Neueste Koordinate der Nachricht. |
| `latestForMessages(messageIds)` | `Promise<Map<string, Coordinate>>` | Neueste Koordinate je Nachricht. |
| `messageIdForShare(contactId, shareId)` | `Promise<string \| null>` | Nachricht-Id zu einer Freigabe-Id. |
| `count()` | `Promise<number>` | Anzahl der Koordinaten. |

### SettingsRepository

| Name | Rückgabe | Beschreibung |
|---|---|---|
| `get(key)` | `Promise<string \| null>` | Wert eines Schlüssels. |
| `set(key, value)` | `Promise<void>` | Wert eines Schlüssels speichern. |
| `all()` | `Promise<Record<string, string>>` | Alle Schlüssel und Werte. |

Die Memory-Repositories bieten zusätzlich `clear()` und `insertMany(rows)`. Diese Hilfsmethoden braucht
`MemoryDatabaseService` für Import, Löschen und Demo-Daten.

## Plattform-Weiche

`src/app/app.config.ts` stellt die Datenbank und alle Repositories als `dataProviders` bereit, die Leitung zur Antenne und den
Entsperr-Schlüssel als `antennaProviders`. `useExisting` bindet das abstrakte Token an eine konkrete, in `root` registrierte Instanz.

| Token | Browser | Android |
|---|---|---|
| `DatabaseService` | `MemoryDatabaseService` | `SqliteDatabaseService` |
| `ContactRepository` | `MemoryContactRepository` | `SqliteContactRepository` |
| `MessageRepository` | `MemoryMessageRepository` | `SqliteMessageRepository` |
| `CoordinateRepository` | `MemoryCoordinateRepository` | `SqliteCoordinateRepository` |
| `SettingsRepository` | `MemorySettingsRepository` | `SqliteSettingsRepository` |
| `SerialTransport` | `MockSerialTransport` | `UnavailableSerialTransport` (bis T06) |
| `KeystoreService` | `BrowserKeystoreService` | `AndroidKeystoreService` |

## Hilfsmodule (keine Services)

| Datei | Funktionen | Zweck |
|---|---|---|
| `src/app/core/crypto/hex.ts` | `toHex(bytes)`, `fromHex(hex)` | Bytes als Hex-Text in Kleinbuchstaben. `fromHex` wirft bei ungültigem Hex. |
| `src/app/core/crypto/base64.ts` | `toBase64(bytes)`, `fromBase64(base64)` | Bytes als Base64-Text. `fromBase64` wirft bei ungültigem Base64. |
| `src/app/core/format/time.ts` | `formatTime`, `formatListTime`, `formatLastSeen`, `formatDay` | Zeittexte in der Zeitzone `Europe/Zurich`. |
| `src/app/core/format/radio.ts` | `formatMHz(freqHz)` | Frequenz in Hz als MHz-Text, z. B. `868100000` → „868“. |
| `src/app/core/messaging/limits.ts` | `contentBytes`, `maxContentBytes`, `isValidDisplayName`, `splitText` | UTF-8-Bytelänge von Texten und Anzeigenamen, das gemeldete Textlimit und das Teilen langer Texte. |
| `src/app/core/messaging/reactions.ts` | `REACTION_EMOJIS`, `isReactionEmoji` | Emoji-Tabelle der Reaktionen (Offgrid Protocol, Appendix B). |
| `src/app/core/antenna/device-parse.ts` | `parseHello`, `parseContact`, `parseEvent`, … | Prüft Antworten und Ereignisse des Geräts und macht daraus Typen. |
| `src/app/core/keystore/unlock-wrap.ts`, `x25519.ts` | `wrapToken`, `unwrapToken`, `x25519` | Einpacken des Entsperr-Tokens (WebCrypto) und X25519 (RFC 7748). |
| `src/app/core/messaging/signal.ts` | `signalLevel`, `signalLabel` | Signal-Level eines Kontakts und der Text dazu. |

Die Formate und die Signalstärke sind in [Nachrichten](../funktionen/nachrichten.md) beschrieben.

## Wer nutzt was

| Aufrufer | Nutzt |
|---|---|
| `AppComponent` | `AppStartService` |
| `AppStartService` | `DatabaseService`, `SettingsService`, `AntennaPort`, `MessagingService`, `HandshakeService` und im Browser `MemoryDatabaseService` |
| `AntennaPort` | `SerialTransport`, `KeystoreService`, `SerialClient` |
| `MessagingService` | `AntennaPort`, `ContactRepository`, `MessageRepository`, `CoordinateRepository`, `HandshakeService`, `DataChangedService` |
| `HandshakeService` | `AntennaPort`, `ContactRepository`, `DataChangedService` |
| `SettingsService` | `SettingsRepository` |
| SQLite-Repositories | `SqliteDatabaseService` |
| `MemoryDatabaseService` | alle Memory-Repositories |
