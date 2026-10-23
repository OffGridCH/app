# Services

Die Services liegen in `src/app/core/`. Sie haben keine Oberfläche, sondern liefern Daten an die Seiten. Die
Verschlüsselung nutzt nur WebCrypto (`crypto.subtle`, `crypto.getRandomValues`) – es gibt keine Krypto-Bibliothek.

## CryptoService

Datei: `src/app/core/crypto/crypto.service.ts`. Ein Singleton (`providedIn: 'root'`).

| Name | Typ | Beschreibung |
|---|---|---|
| `newKey()` | `string` | 16 Zufallsbytes als 32 Hex-Zeichen in Kleinbuchstaben. |
| `tag(keyHex)` | `Promise<string>` | Erste 4 Bytes von SHA-256 über die 16 Rohbytes, als 8 Hex-Zeichen. Das Ergebnis wird in einer `Map` gecacht. |
| `encrypt(keyHex, plain, aad)` | `Promise<EncryptedData>` | AES-GCM 128 Bit mit zufälligem IV (12 Bytes) und AAD. Liefert `{ iv, data }`. |
| `decrypt(keyHex, iv, data, aad)` | `Promise<Uint8Array>` | Entschlüsselt. Wirft bei falschem Schlüssel oder manipulierten Daten. |
| `randomHex(bytes)` | `string` | Zufallsbytes als Hex-Text, z. B. 4 Bytes für eine `wireId`. |

Der Service hält keine Signals: Er wird aufgerufen, das Ergebnis wird awaited. Der Tag eines Schlüssels ist die
Kennung, über die ein empfangener Frame dem richtigen Kontakt zugeordnet wird.

## KeyPatternService

Datei: `src/app/core/crypto/key-pattern.service.ts`. Ein Singleton (`providedIn: 'root'`).

| Name | Typ | Beschreibung |
|---|---|---|
| `forContact(contact)` | `Promise<boolean[]>` | Muster eines Kontakts: die beiden Schlüssel sortiert, aneinandergehängt → SHA-256 → 25 Zellen. |
| `forInstall(installId)` | `Promise<boolean[]>` | Eigenes Muster: die `install_id` → SHA-256 → 25 Zellen. |

Die Ergebnisse werden pro Eingabe zwischengespeichert. Wie das Muster aussieht, steht in
[Kontakte & Handshake](../funktionen/kontakte-handshake.md).

## DatabaseService

`src/app/core/data/database.service.ts` definiert die abstrakte Klasse. Sie dient zugleich als DI-Token, damit die App
je nach Plattform dieselbe Schnittstelle verwendet.

| Name | Typ | Beschreibung |
|---|---|---|
| `open()` | `Promise<void>` | Datenbank öffnen und offene Migrationen ausführen. |
| `replaceAll(data)` | `Promise<void>` | Alle Nutzdaten ersetzen; die Einstellungen bleiben erhalten. |
| `deleteAllUserData()` | `Promise<void>` | Kontakte, Nachrichten, Koordinaten und Handshakes löschen; die Einstellungen bleiben erhalten. |

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
| `seedDemo()` | `Promise<void>` | Browser mit den Demo-Daten aus `memory/seed.ts` füllen. |

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
Änderungen an Kontakten, Handshakes oder ganzen Datenbeständen.

| Name | Typ | Beschreibung |
|---|---|---|
| `version` | `Signal<number>` | Version der Datenänderungen; beginnt bei 0. |
| `notify()` | `void` | Version um eins erhöhen. |

## AppStartService

Datei: `src/app/core/app-start.service.ts`. Ein Singleton (`providedIn: 'root'`). `AppComponent` ruft `init()` beim
Erstellen der Wurzelkomponente auf.

| Name | Typ | Beschreibung |
|---|---|---|
| `init()` | `Promise<void>` | Datenbank und Einstellungen starten und auf Android Statusleiste und Splashscreen vorbereiten. |

Die Schritte laufen in dieser Reihenfolge:

1. `DatabaseService.open()` öffnet die Datenbank und führt die Migrationen aus.
2. Im Browser ruft der Dienst `MemoryDatabaseService.seedDemo()` auf. Der Schritt entfällt bei
   `localStorage.getItem('og.noseed') === '1'`.
3. `SettingsService.load()` lädt die Einstellungen und legt eine fehlende Install-Id an.
4. Nur nativ setzt der Dienst den Statusleistenstil auf `Dark` und die definierte Hintergrundfarbe.
5. Nur nativ blendet der Dienst den Splashscreen aus.

Der Antennenstart und die Startrouten-Berechnung gehören nicht zu T04. Fehler beim Start werden mit `log.error`
protokolliert.

## Repositories

Die Repositories sind abstrakte Klassen in `src/app/core/data/`. Jede Klasse dient als DI-Token. Für jede gibt es eine
SQLite-Implementierung in derselben Datei und eine Memory-Implementierung unter `src/app/core/data/memory/`.

### ContactRepository

| Name | Rückgabe | Beschreibung |
|---|---|---|
| `all()` | `Promise<Contact[]>` | Alle Kontakte, älteste zuerst. |
| `byId(id)` | `Promise<Contact \| null>` | Ein Kontakt nach Id. |
| `byReceivingKeyTag(tag, tagOf)` | `Promise<Contact \| null>` | Kontakt, dessen Empfangsschlüssel den gesuchten Tag ergibt. Lädt alle Kontakte und vergleicht `await tagOf(c.receivingKey)` mit dem Tag. |
| `insert(contact)` | `Promise<void>` | Kontakt einfügen. |
| `updateNames(id, displayName, firstName, lastName)` | `Promise<void>` | Namen ändern und `updated_at` setzen. |
| `updateSignal(id, rssi, seenAt)` | `Promise<void>` | Letzte Signalstärke und Empfangszeit setzen. |
| `delete(id)` | `Promise<void>` | Kontakt löschen; Nachrichten und Koordinaten des Kontakts fallen mit weg. |
| `count()` | `Promise<number>` | Anzahl der Kontakte. |

### MessageRepository

| Name | Rückgabe | Beschreibung |
|---|---|---|
| `forContact(contactId)` | `Promise<Message[]>` | Nachrichten eines Kontakts, älteste zuerst. |
| `lastPerContact()` | `Promise<Map<string, Message>>` | Letzte Nachricht je Kontakt. |
| `unreadPerContact()` | `Promise<Map<string, number>>` | Anzahl ungelesener eingehender Nachrichten je Kontakt. |
| `queued()` | `Promise<Message[]>` | Ausgehende Nachrichten mit Status 0, älteste zuerst. |
| `byWireId(contactId, wireId)` | `Promise<Message \| null>` | Nachricht nach Kontakt und Funk-Id. |
| `insert(message)` | `Promise<void>` | Nachricht einfügen. |
| `setStatus(id, status)` | `Promise<void>` | Status ändern und `updated_at` setzen. |
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

### HandshakeRepository

| Name | Rückgabe | Beschreibung |
|---|---|---|
| `insert(handshake)` | `Promise<void>` | Handshake einfügen. |
| `open()` | `Promise<Handshake[]>` | Handshakes im Status `waiting` oder `sent`, älteste zuerst. |
| `doneShowers()` | `Promise<Handshake[]>` | Fertige Handshakes mit Rolle `shower`. |
| `update(handshake)` | `Promise<void>` | Handshake ändern und `updated_at` setzen. |

### SettingsRepository

| Name | Rückgabe | Beschreibung |
|---|---|---|
| `get(key)` | `Promise<string \| null>` | Wert eines Schlüssels. |
| `set(key, value)` | `Promise<void>` | Wert eines Schlüssels speichern. |
| `all()` | `Promise<Record<string, string>>` | Alle Schlüssel und Werte. |

Die Memory-Repositories bieten zusätzlich `clear()` und `insertMany(rows)`. Diese Hilfsmethoden braucht
`MemoryDatabaseService` für Import, Löschen und Demo-Daten.

## Plattform-Weiche

`src/app/app.config.ts` stellt die Datenbank und alle Repositories als `dataProviders` bereit. `useExisting` bindet das
abstrakte Token an eine konkrete, in `root` registrierte Instanz.

| Token | Browser | Android |
|---|---|---|
| `DatabaseService` | `MemoryDatabaseService` | `SqliteDatabaseService` |
| `ContactRepository` | `MemoryContactRepository` | `SqliteContactRepository` |
| `MessageRepository` | `MemoryMessageRepository` | `SqliteMessageRepository` |
| `CoordinateRepository` | `MemoryCoordinateRepository` | `SqliteCoordinateRepository` |
| `HandshakeRepository` | `MemoryHandshakeRepository` | `SqliteHandshakeRepository` |
| `SettingsRepository` | `MemorySettingsRepository` | `SqliteSettingsRepository` |

## Hilfsmodule (keine Services)

| Datei | Funktionen | Zweck |
|---|---|---|
| `src/app/core/crypto/hex.ts` | `toHex(bytes)`, `fromHex(hex)` | Bytes als Hex-Text in Kleinbuchstaben. `fromHex` wirft bei ungültigem Hex. |
| `src/app/core/crypto/base64.ts` | `toBase64(bytes)`, `fromBase64(base64)` | Bytes als Base64-Text. `fromBase64` wirft bei ungültigem Base64. |
| `src/app/core/format/time.ts` | `formatTime`, `formatListTime`, `formatLastSeen`, `formatDay` | Zeittexte in der Zeitzone `Europe/Zurich`. |
| `src/app/core/format/radio.ts` | `formatMHz(freqHz)` | Frequenz in Hz als MHz-Text, z. B. `868100000` → „868“. |
| `src/app/core/messaging/limits.ts` | `contentBytes`, `maxContentBytes`, `isValidDisplayName` | UTF-8-Bytelänge von Texten und Anzeigenamen; Grenzwerte aus dem Gerätevertrag „OffGrid Link“. |
| `src/app/core/messaging/signal.ts` | `signalLevel`, `signalLabel` | Signal-Level eines Kontakts und der Text dazu. |

Die Formate und die Signalstärke sind in [Nachrichten](../funktionen/nachrichten.md) beschrieben.

## Wer nutzt was

| Aufrufer | Nutzt |
|---|---|
| `AppComponent` | `AppStartService` |
| `AppStartService` | `DatabaseService`, `SettingsService` und im Browser `MemoryDatabaseService` |
| `SettingsService` | `SettingsRepository` |
| SQLite-Repositories | `SqliteDatabaseService` |
| `MemoryDatabaseService` | alle Memory-Repositories |
