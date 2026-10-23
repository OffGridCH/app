# Kontakte & Handshake

## Schlüssel-Muster

Zwei Personen treffen sich und scannen gegenseitig ihre QR-Codes. Jedes Handy berechnet daraus ein Muster. Ist das
Muster auf beiden Handys gleich, war der Austausch der Schlüssel erfolgreich. Das Muster verrät nichts über die
Schlüssel selbst – es ist nur ein Vergleichsbild.

Berechnung in `src/app/core/crypto/key-pattern.service.ts` (`KeyPatternService`):

| Muster | Eingabe | Schritt |
|---|---|---|
| eines Kontakts | die beiden Schlüssel des Kontakts, **sortiert** und aneinandergehängt | SHA-256 über die UTF-8-Bytes |
| eigenes Muster (Einstellungen) | die `install_id` | SHA-256 über die UTF-8-Bytes |

Weil die Schlüssel sortiert werden, macht es keinen Unterschied, wer welchen Schlüssel zuerst erzeugt hat: Beide
Handys kommen zum selben Muster.

Aus dem SHA-256 entsteht ein **5×5-Raster mit 25 Zellen** (`boolean[]`, zeilenweise). Das Muster ist
**spiegelsymmetrisch**: In `src/app/core/crypto/key-pattern.service.ts` steht

```ts
const on = (bytes[y * HALF_COLUMNS + x] & 1) === 1;
```

`HALF_COLUMNS` ist 3: Für jede Zeile `y` und Spalte `x` von 0 bis 2 wird so eine Zelle gesetzt. Spalte 3 spiegelt
Spalte 1, Spalte 4 spiegelt Spalte 0. Durch die Spiegelung sieht das Bild auf beiden Handys gleich aus.

Hat ein Muster weniger als 5 „an“-Zellen, setzt der Service zusätzlich die Mittelzelle (Index 12) und die Zellen 11
und 13 (Zeile 2, Spalte 1 und 3). So entsteht nie ein fast leeres Bild.

Die gleichen Eingaben liefern immer das gleiche Muster; die Ergebnisse werden pro Eingabe zwischengespeichert.

!!! info "Geplant"

    Der QR-Handshake selbst (A zeigt seinen Code, B scannt, beide tauschen die Schlüssel per Funk) folgt mit T08,
    die Screens mit T11.
