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

## Hilfsmodule (keine Services)

| Datei | Funktionen | Zweck |
|---|---|---|
| `src/app/core/crypto/hex.ts` | `toHex(bytes)`, `fromHex(hex)` | Bytes als Hex-Text in Kleinbuchstaben. `fromHex` wirft bei ungültigem Hex. |
| `src/app/core/crypto/base64.ts` | `toBase64(bytes)`, `fromBase64(base64)` | Bytes als Base64-Text. `fromBase64` wirft bei ungültigem Base64. |
| `src/app/core/format/time.ts` | `formatTime`, `formatListTime`, `formatLastSeen`, `formatDay` | Zeittexte in der Zeitzone `Europe/Zurich`. |
| `src/app/core/format/radio.ts` | `formatMHz(freqHz)` | Frequenz in Hz als MHz-Text, z. B. `868100000` → „868“. |
| `src/app/core/messaging/limits.ts` | `contentBytes`, `maxContentBytes`, `isValidDisplayName` | Länge von Texten und Anzeigenamen in Bytes. |
| `src/app/core/messaging/signal.ts` | `signalLevel`, `signalLabel` | Signal-Level eines Kontakts und der Text dazu. |

Die Formate und die Signalstärke sind in [Nachrichten](../funktionen/nachrichten.md) beschrieben.

## Wer nutzt was

Im aktuellen Branch rufen nur die Tests diese Services und Module auf. In der App kommen die Aufrufer mit folgenden
Tickets:

| Ticket | Nutzt |
|---|---|
| T07 – Nachrichten senden und empfangen | `CryptoService` (Verschlüsselung), `limits.ts`, `signal.ts`, `format/` |
| T08 – QR-Handshake | `CryptoService`, `KeyPatternService`, `limits.ts` (Namensprüfung) |
| T14 – Backup exportieren und importieren | `CryptoService`, `base64.ts` |

Die Datenbank-Services und die Repositories folgen mit T04.
