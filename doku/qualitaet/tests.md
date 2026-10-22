# Tests

Getestet wird mit **Vitest + jsdom** über den Angular-Builder (`ng test`). Die Testumgebung bringt echtes **WebCrypto**
mit, weil die Krypto-Bausteine ohne Browser-Kryptografie nicht laufen würden.

Stand nach **T00** und **T03**: **11 Testdateien, 72 Tests**, alle grün (`npm run test:ci`). Weitere Testdateien kommen
mit den folgenden Tickets. Was pflichtig ist, steht im Skill `offgrid-testing`.

## Aus T00 – Gerüst und Testumgebung

| Testdatei | Was geprüft wird |
|---|---|
| `src/app/app.component.spec.ts` | Die Wurzelkomponente erzeugt die Ionic-Shell. |
| `src/testing/node-version.spec.ts` | Die Node-Version der Entwicklungsumgebung ist ≥ 24.15. |
| `src/testing/webcrypto.spec.ts` | `globalThis.crypto.subtle` ist vorhanden; Zufallswerte, SHA-256-Digest und ein AES-GCM-Rundlauf mit falschem Schlüssel. |

## Aus T03 – Formate, Krypto, Muster, Signal

| Testdatei | Was geprüft wird |
|---|---|
| `src/app/core/format/time.spec.ts` | `formatTime`, `formatListTime` (heute, gestern, Wochentag, ab dem 7. Tag), `formatLastSeen` (inklusive „noch nie empfangen“) und `formatDay` („HEUTE“, „GESTERN“, Datum). |
| `src/app/core/format/radio.spec.ts` | `formatMHz` rundet immer ab (`868100000` → „868“), auch dreistellig bei 1 GHz. |
| `src/app/core/crypto/hex.spec.ts` | Hin- und Rückweg über `toHex`/`fromHex`, führende Null, leerer Puffer, 16 Byte ergeben 32 Hex-Zeichen, Fehler bei ungerader Länge und bei Nicht-Hex. |
| `src/app/core/crypto/base64.spec.ts` | Bekannte Bytes, Hin- und Rückweg, leere Eingabe, grosse Puffer in Blöcken und alle 256 Bytewerte verlustfrei. |
| `src/app/core/crypto/crypto.service.spec.ts` | `newKey` liefert 32 Kleinbuchstaben-Hex und bei jedem Aufruf einen anderen Schlüssel; `randomHex` liefert die verlangte Länge; `tag` ist 8 Hex-Zeichen, stabil, erste 4 Byte von SHA-256 und je Schlüssel verschieden; `encrypt`/`decrypt` im Rundlauf, neuer IV pro Aufruf; Fehler bei anderem Schlüssel, anderer AAD, beschädigtem Ciphertext und Nicht-Hex-Schlüssel. |
| `src/app/core/crypto/key-pattern.service.spec.ts` | 25 boolesche Werte, Spiegelsymmetrie (Spalte 0 = 4, Spalte 1 = 3), mindestens 5 gesetzte Zellen, gleiches Muster für beide Schlüsselreihenfolgen, gleiche Eingabe liefert dasselbe Muster als Kopie, eigene Muster aus der `install_id`, verschiedene Kontakte haben verschiedene Muster. |
| `src/app/core/messaging/limits.spec.ts` | `contentBytes` zählt ASCII mit 1 Byte, Umlaute und escapte Zeichen (`"` und `\`) mit 2 Byte; `maxContentBytes` rechnet den Frame-Platz und deckelt bei 180 Byte; `isValidDisplayName` nimmt normale Namen, lehnt leere, 41 Zeichen und mehr als 60 Byte ab. |
| `src/app/core/messaging/signal.spec.ts` | `signalLevel` gibt 0 ohne Empfang, ohne RSSI und bei älter als 15 Minuten (genau 15 Minuten zählt noch) und sonst die Stufen ab −80, −95, −105 und −115 dBm; `signalLabel` nennt jeden Level mit seinem Text. |

Ein Test prüft in `key-pattern.service.spec.ts` die Regel aus dem Skill **wörtlich**: SHA-256 über die sortierten
Schlüssel, Spiegelung und die Ausnahme für fast leere Muster. Damit fällt ein Fehler in der Regel selbst sofort auf.

## Befehle

| Zweck | Befehl |
|---|---|
| Tests einmal, headless | `npm run test:ci` |
| Alles wie in CI (Lint, Tests, Build) | `npm run check` |

Die Läufe hängen an den [CI-Checks](ci.md).