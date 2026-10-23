# Nachrichten

## Signalstärke

Zu jedem Kontakt gehören die letzte Feldstärke in dBm (`last_rssi`, im Typ `Contact` das Feld `lastRssi`) und der
Zeitpunkt des letzten empfangenen Frames (`last_seen_at` / `lastSeenAt`). Daraus berechnet
`src/app/core/messaging/signal.ts` den Level für die Signal-Balken (`og-signal-bars`).

`signalLevel(rssi, seenAt, now)`:

| Bedingung | Level |
|---|---|
| kein `rssi` oder kein `seenAt` | 0 |
| Signal älter als 15 Minuten | 0 |
| `rssi ≥ -80` dBm | 4 |
| `rssi ≥ -95` dBm | 3 |
| `rssi ≥ -105` dBm | 2 |
| `rssi ≥ -115` dBm | 1 |
| alles andere | 0 |

`signalLabel(level)` liefert den Text zum Level (das `aria-label` der Balken):

| Level | Text |
|---|---|
| 4 | Signal sehr gut |
| 3 | Signal gut |
| 2 | Signal mittel |
| 1 | Signal schwach |
| 0 | Ausser Reichweite |

## Zeit- und Funkformate

Alle Zeitfunktionen liegen in `src/app/core/format/time.ts` und benutzen
`Intl.DateTimeFormat('de-CH', { timeZone: 'Europe/Zurich' })`. Die Seite übergibt `new Date()` als `now`.

| Funktion | Ergebnis |
|---|---|
| `formatTime(iso)` | Uhrzeit `HH:mm` im 24-Stunden-Format. |
| `formatListTime(iso, now)` | heute `HH:mm`; gestern „Gestern“; innerhalb von 7 Tagen der kurze Wochentag („Mo.“); sonst `dd.MM.yy`. |
| `formatLastSeen(iso, now)` | heute „zuletzt `HH:mm`“; gestern „zuletzt gestern“; sonst „zuletzt `dd.MM.`“; `null` → „noch nie empfangen“. |
| `formatDay(iso, now)` | heute „HEUTE“, gestern „GESTERN“, sonst `dd.MM.yyyy`. |
| `formatMHz(freqHz)` (`src/app/core/format/radio.ts`) | Frequenz in MHz, z. B. `868100000` → „868“. |

„Heute“ und „Gestern“ richten sich nach dem Kalendertag in Zürich, nicht nach UTC. Die Zeitumstellung ändert die
Zuordnung des Tages deshalb nicht.

## Länge der Texte

`src/app/core/messaging/limits.ts` rechnet die Länge in UTF-8-Bytes, weil eine Funk-Nachricht eine feste Grösse hat:

| Funktion | Bedeutung |
|---|---|
| `contentBytes(text)` | UTF-8-Bytelänge des Textes: `new TextEncoder().encode(text).length`. JSON-Escapes werden nicht mitgezählt. |
| `maxContentBytes(max)` | `Math.min(83, max - 33)`. Das Geräte-Textlimit beträgt 83 Bytes. Der Frame-Overhead von 33 Bytes besteht aus 1 Byte Version/Typ, 4 Byte Empfänger-Tag, 12 Byte IV und 16 Byte Auth-Tag. |
| `isValidDisplayName(name)` | Anzeigename: getrimmt mindestens 1 und höchstens 24 UTF-8-Bytes. |

!!! note

    Die Grenzwerte stammen aus dem Gerätevertrag „OffGrid Link“ (§7.2/§7.3 für Anzeigenamen, §7.5 für
    Textinhalte). Der lokale Skill `offgrid-antenna-protocol` §5 beschreibt noch die alte Fassung und wird
    nachgezogen.

!!! info "Geplant"

    Senden, Empfangen, die Warteschlange und der Status-Ablauf der Nachrichten folgen mit T07.
