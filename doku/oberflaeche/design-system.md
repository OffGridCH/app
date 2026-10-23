# Design-System

Stand: **nach T01**. Farben, Radien, Grössen und Schriften stehen in den Design-Tokens unter `src/theme/`.
Die 13 Grundkomponenten aus T01 sind gebaut und liegen in `src/app/ui/`. Die Zustandskomponenten
(Avatar, Signalbalken, Banner, Schrittliste, Nachrichtenblase, Composer, QR) folgen mit T02.

Regeln für alle Komponenten:

- Farben, Radien und Grössen kommen ausschliesslich aus `var(--og-…)`. In Komponenten stehen keine Hex-Werte.
- Die Typografie kommt aus den Mixins in `src/theme/typography.scss` (`og-type-…`), nicht aus eigenen Angaben.
- Alle Komponenten sind Standalone, nutzen `ChangeDetectionStrategy.OnPush` und haben nur Inputs und Outputs.
  Sie injizieren keine Services.
- Sichtbare Texte sind Deutsch (Schweiz).

## Farben

Quelle: `src/theme/tokens.scss`. In Komponenten wird der Token benutzt, nie der Hex-Wert.

### Flächen

| Token | Wert | Verwendung |
|---|---|---|
| `--og-bg` | `#0F1115` | Seitenhintergrund |
| `--og-surface` | `#1A1D24` | Karten, eingehende Bubbles, Icon-Buttons |
| `--og-surface-2` | `#15181E` | Schrittlisten, Avatar-Grund „ausser Reichweite“ |
| `--og-bar` | `#13161B` | Composer-Leiste unten im Chat |
| `--og-input` | `#0F1115` | Eingabefeld innerhalb einer Karte |
| `--og-scrim` | `rgba(10, 12, 15, 0.72)` | Abdunklung hinter einem Sheet |

### Linien

| Token | Wert | Verwendung |
|---|---|---|
| `--og-line` | `#262A33` | Trennlinien in Listen und Karten, Header-Unterkante |
| `--og-border` | `#2C313B` | Rahmen von Karten, Eingabefeldern, Icon-Buttons |
| `--og-border-muted` | `#3D4350` | leeres Schritt-Kästchen, Punkte im Leerzustand |
| `--og-dashed` | `#4A5060` | gestrichelter Avatar (Kontakt ausstehend) |

### Text

| Token | Wert | Verwendung |
|---|---|---|
| `--og-text` | `#EEF0F5` | Haupttext |
| `--og-text-2` | `#C5CAD6` | Fliesstext, Labels, Vorschau ungelesen |
| `--og-text-3` | `#959CAB` | Meta, Zeiten, Hilfstexte, Abschnittstitel |
| `--og-placeholder` | `#8A91A0` | Platzhalter im Eingabefeld |

### Akzent (Eisblau)

| Token | Wert | Verwendung |
|---|---|---|
| `--og-accent` | `#9DB4FF` | Primärbutton, eigene Bubble, Signalbalken an, Ungelesen-Badge |
| `--og-accent-hover` | `#C2D0FF` | Hover-Zustand des Akzents |
| `--og-on-accent` | `#0B1020` | Text und Icon auf Akzentfläche |
| `--og-accent-soft` | `#232B45` | Icon-Kachel hinter einem Akzent-Icon |
| `--og-accent-pulse` | `rgba(157, 180, 255, 0.55)` | Puls-Animation der aktiven Schrittzeile |

### Signal und Gefahr

| Token | Wert | Verwendung |
|---|---|---|
| `--og-signal-off` | `#2E3440` | Signalbalken aus, Schalter aus |
| `--og-ok` | `#7FD6A4` | Statuspunkt „verbunden“, Erfolgs-Badge |
| `--og-danger` | `#FF8F87` | „Nicht gesendet“, Rahmen einer fehlgeschlagenen Bubble |
| `--og-danger-title` | `#FFB4AD` | Titel im Fehler-Banner |
| `--og-danger-text` | `#E8D6D3` | Fliesstext im Fehler-Banner |
| `--og-danger-bg` | `#2A2220` | Banner-Hintergrund |
| `--og-danger-border` | `#4A3330` | Banner-Rahmen |

## Radien, Grössen und Abstände

Quelle: `src/theme/tokens.scss`.

| Token | Wert | Verwendung |
|---|---|---|
| `--og-r-xs` | `9px` | Schritt-Kästchen |
| `--og-r-sm` | `10px` | kleiner Inline-Button („Erneut senden“) |
| `--og-r-md` | `12px` | Segment im Umschalter, Banner-Button |
| `--og-r-input` | `14px` | Eingabefelder, quadratische Icon-Kachel |
| `--og-r-btn2` | `16px` | Sekundärbutton, Tab-Umschalter |
| `--og-r-btn` | `18px` | Primärbutton, Listenzeile, Banner |
| `--og-r-card` | `20px` | Karten |
| `--og-r-qr` | `28px` | QR-Karte, Kamera-Rahmen, Hero-Icon |
| `--og-r-pill` | `999px` | Badge, Schalter |
| `--og-gutter` | `16px` | Seitenrand für Karten und Umschalter |
| `--og-gutter-text` | `24px` | Seitenrand für Fliesstext |
| `--og-gutter-title` | `20px` | Seitenrand für Seitentitel und Abschnitte |
| `--og-section-gap` | `26px` | Abstand vor einem Abschnittstitel |
| `--og-touch` | `44px` | Mindestgrösse eines Touch-Ziels |
| `--og-btn-h` | `54px` | Höhe des Primärbuttons |
| `--og-btn2-h` | `48px` | Höhe des Sekundärbuttons |
| `--og-input-h` | `46px` | Höhe des Eingabefeldes in der Formularkarte |
| `--og-composer-h` | `48px` | Eingabefeld und Senden-Button im Chat |
| `--og-row-min` | `52px` | Höhe einer Zeile in der Info-Karte |

## Schriften

Zwei Familien: **Schibsted Grotesk** für die Oberfläche, **Geist Mono** für technische Meta-Angaben.
Beide sind lokal gebündelt, die App läuft offline. Quelle der Stile: `src/theme/typography.scss`.

| Stil | Mixin | Font | Grösse | Gewicht | Verwendung |
|---|---|---|---|---|---|
| `display` | `og-type-display` | `--og-font` | 32px / 1.1 | 800 | Onboarding-Titel |
| `app-title` | `og-type-app-title` | `--og-font` | 30px | 800 | „OffGrid“ in den Kontakten |
| `hero` | `og-type-hero` | `--og-font` | 24px | 750 | „Schlüssel ausgetauscht“ |
| `empty-title` | `og-type-empty-title` | `--og-font` | 22px | 700 | Leerzustand |
| `page-title` | `og-type-page-title` | `--og-font` | 20px | 700 | Titel einer Unterseite |
| `chat-name` | `og-type-chat-name` | `--og-font` | 17px / 1.2 | 650 | Name im Chat-Header |
| `body-strong` | `og-type-body-strong` | `--og-font` | 16px | 650 | Kontaktname, Zeilentitel |
| `body` | `og-type-body` | `--og-font` | 16px / 1.4 | 400 | Bubble-Text, Eingabefelder |
| `body-2` | `og-type-body-2` | `--og-font` | 15px / 1.5 | 400 | Erklärtexte |
| `row` | `og-type-row` | `--og-font` | 15px | 400 | Zeilen in Info-Karten |
| `preview` | `og-type-preview` | `--og-font` | 14px | 400 | Nachrichtenvorschau (eine Zeile, Ellipsis) |
| `help` | `og-type-help` | `--og-font` | 13px / 1.4 | 400 | Hilfstexte und Labels |
| `meta` | `og-type-meta` | `--og-font-mono` | 11px | 400 | Zeiten, Status, technische Werte |
| `section` | `og-type-section` | `--og-font-mono` | 11px | 500 | Abschnittstitel (Grossbuchstaben, `letter-spacing: 0.12em`) |
| `value` | `og-type-value` | `--og-font-mono` | 13px | 400 | Werte rechts in Info-Zeilen |

## Icons

`og-icon` rendert ein Inline-SVG mit `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`,
runden Enden und `aria-hidden="true"`. Es gibt keine Icon-Fonts und keine Emojis.
Die Pfade sind fest in der Komponente hinterlegt (`src/app/ui/icon/icon.component.ts`).

| `name` | Grösse | Strichstärke |
|---|---|---|
| `back` | 22 | 2 |
| `plus` | 20 | 2 |
| `settings` | 20 | 2 |
| `send` | 22 | 2.2 |
| `check` | 14 | 3 |
| `qr` | 20 | 2.2 |
| `antenna` | 22 | 2 |
| `upload` | 22 | 2 |
| `download` | 22 | 2 |
| `file` | 20 | 2 |
| `info` | 18 | 2 |
| `warning` | 18 | 2 |
| `pin` | 22 | 2 |
| `map` | 20 | 2.2 |
| `copy` | 20 | 2 |
| `refresh` | 18 | 2 |
| `users` | 20 | 2 |

Das Icon `users` wird erst mit dem Gruppenchat (T20) gebraucht.

## Grundkomponenten (T01)

Jede Komponente liegt in einem eigenen Ordner unter `src/app/ui/`, die Klasse heisst `Og<Name>Component`,
der Selektor `og-<name>`. `src/app/ui/index.ts` exportiert alle Komponenten und ihre Typen.

| Selektor | Datei | Inputs | Outputs |
|---|---|---|---|
| `og-icon` | `ui/icon/icon.component.ts` | `name` (Pflicht), `size`, `strokeWidth` | – |
| `og-button` | `ui/button/button.component.ts` | `variant`, `type`, `disabled`, `icon`, `fullWidth` | `pressed` |
| `og-link-button` | `ui/button/link-button.component.ts` | `variant`, `routerLink`, `disabled`, `icon`, `fullWidth` | `pressed` |
| `og-icon-button` | `ui/icon-button/icon-button.component.ts` | `icon` (Pflicht), `label` (Pflicht), `shape`, `routerLink` | – |
| `og-topbar` | `ui/topbar/topbar.component.ts` | `title` (Pflicht), `backLink`, `backLabel` (Pflicht) | – |
| `og-section-label` | `ui/section-label/section-label.component.ts` | `inset` | – |
| `og-card` | `ui/card/card.component.ts` | `padded` | – |
| `og-info-row` | `ui/info-row/info-row.component.ts` | `label` (Pflicht), `value`, `last` | – |
| `og-status-dot` | `ui/status-dot/status-dot.component.ts` | `state` | – |
| `og-badge` | `ui/badge/badge.component.ts` | `count` | – |
| `og-text-field` | `ui/text-field/text-field.component.ts` | `id` (Pflicht), `label` (Pflicht), `type`, `placeholder`, `hint`, `optional`, `maxlength`, `error`, `value` (Model) | `blurred` |
| `og-switch` | `ui/switch/switch.component.ts` | `checked` (Model), `labelledBy` (Pflicht) | – |
| `og-segmented` | `ui/segmented/segmented.component.ts` | `options` (Pflicht), `value` (Model), `ariaLabel` (Pflicht) | – |

### og-icon

Ein Icon in der Standardgrösse des Namens. `size` (Kantenlänge in px) und `strokeWidth` überschreiben die
Standardwerte aus der Tabelle oben.

### og-button

Ein `<button>` für Aktionen. `variant` wählt das Aussehen, `type` (`button` oder `submit`, Default `button`)
legt den Typ fest, `icon` setzt ein Icon vor den Text,
`fullWidth` (Default `true`) spannt den Button über die volle Breite. Bei `disabled` ist die Opazität 0.4 und
der Button löst keinen Klick aus.

| `variant` | Höhe | Radius | Grund | Text | Typografie |
|---|---|---|---|---|---|
| `primary` | `--og-btn-h` (54px) | `--og-r-btn` | `--og-accent` | `--og-on-accent` | 16px / 700 |
| `secondary` | `--og-btn2-h` (48px) | `--og-r-btn2` | transparent, Rahmen 1px `--og-border` | `--og-text` | 15px / 600 |
| `danger-text` | 56px | – | transparent, kein Rahmen | `--og-danger` | 16px / 600 |

Weitere Masse: Abstand Icon zu Text 10px, Innenabstand links und rechts 16px. Der Primärbutton zeigt sein Icon
mit 20px. Die Variante `danger-text` ist linksbündig und für eine Zeile in einer Karte gedacht.

### og-link-button

Gleiches Aussehen wie `og-button`, rendert aber ein `<a>` mit `routerLink` – für die Navigation.
Bei `disabled` ist die Route null, das Element trägt `aria-disabled="true"` und reagiert nicht auf Zeiger.

### og-icon-button

Ein Icon-Button mit 44 × 44 px. `label` ist Pflicht und wird als `aria-label` gesetzt. Mit `routerLink` rendert
die Komponente ein `<a>`, ohne Route ein `<button>`.

| `shape` | Form | Grund | Rahmen |
|---|---|---|---|
| `round` | Kreis | `--og-surface` | 1px `--og-border` |
| `plain` | Radius `--og-r-input` (14px) | transparent | – |

### og-topbar

Der Kopf einer Unterseite: ein `og-icon-button` mit dem Icon `back` in der Form `plain`, der Titel als `<h1>`
im Stil `page-title` (20px / 700) und rechts ein Bereich für projizierten Inhalt.
Masse: Zeile mit Abstand 6px, Innenabstand `14px 12px 8px 6px`.
`backLabel` ist die Beschriftung des Zurück-Buttons für Screenreader, zum Beispiel „Zurück zu den Kontakten“.

### og-section-label

Ein Abschnittstitel im Stil `section` (Mono 11px / 500, Grossbuchstaben, `--og-text-3`).
Der Einzug `inset` steuert den Innenabstand: `card` = `26px 28px 8px`, `list` = `26px 20px 8px`.

### og-card

Ein Container für Formulare und Listen. Seitenrand `--og-gutter` (16px), Radius `--og-r-card` (20px),
Grund `--og-surface`, Rahmen 1px `--og-border`. Mit `padded` (true) bekommt die Karte 16px Innenabstand und
14px Abstand zwischen den Kindern. Ohne `padded` sind die Kinder Zeilen.

### og-info-row

Eine Zeile in der Karte: Beschriftung links, Wert rechts. Mindesthöhe `--og-row-min` (52px), Innenabstand `0 16px`,
Abstand 12px zwischen Label und Wert, Trennlinie 1px `--og-line`. Mit `last` entfällt die Trennlinie.
Das Label steht im Stil `row` (15px) in `--og-text-2`, der Wert im Stil `value` (Mono 13px).
Projizierter Inhalt ersetzt den Wert, zum Beispiel durch Signalbalken.

### og-status-dot

Ein Punkt mit 8 × 8 px: `ok` in `--og-ok`, `danger` in `--og-danger`.

### og-badge

Die Anzahl der ungelesenen Nachrichten. Mindestbreite 18px, Höhe 18px, Innenabstand `0 5px`, Pill-Form,
Grund `--og-accent`, Text `--og-on-accent` im Meta-Stil (11px / 700). Ab 100 steht dort „99+“.
Bei `count` 0 wird nichts gerendert.

### og-text-field

Ein Eingabefeld mit Label, optionalem Hinweis und optionaler Fehlermeldung.
Das `value` ist ein Model (Zwei-Wege-Bindung `[(value)]`), `blurred` wird beim Verlassen des Feldes ausgelöst.

| Teil | Grösse und Farbe |
|---|---|
| Label | Stil `help` (13px) in `--og-text-2`, Abstand 6px zum Feld |
| Eingabefeld | Höhe `--og-input-h` (46px), Radius `--og-r-input` (14px), Grund `--og-input`, Rahmen 1px `--og-border`, Text 16px, Innenabstand `0 14px` |
| Fokus | Rahmen `--og-accent` |
| Hinweis | Stil `help` unter dem Feld |
| Fehler | Stil `help` in `--og-danger` unter dem Feld |

Mit `optional` hängt die Komponente „ (optional)“ in `--og-text-3` an das Label.

### og-switch

Ein Schalter als `<button type="button">` mit `role="switch"` und `aria-checked`.
`labelledBy` verweist auf die Id des Textes, der den Schalter beschriftet.
Die Spur ist 52 × 32 px mit 3px Innenabstand und Pill-Form: an `--og-accent` mit dem Knopf rechts,
aus `--og-signal-off` mit dem Knopf links. Der Knopf ist ein Kreis mit 26 × 26 px, an `--og-on-accent`,
aus `--og-text-3`. Der Übergang dauert 150ms.

### og-segmented

Ein Umschalter mit Segmenten als `role="tablist"` mit `aria-label`.
`options` liefert die Segmente als `{ value, label }`, `value` ist das gewählte Segment (Model).

| Teil | Grösse und Farbe |
|---|---|
| Leiste | Aussenabstand `8px 16px 0`, Innenabstand 4px, Radius `--og-r-btn2` (16px), Grund `--og-surface`, Rahmen 1px `--og-border`, Raster mit 2 Spalten und 4px Abstand |
| Segment | `<button role="tab" aria-selected>`, Höhe 44px, Radius `--og-r-md` (12px), 15px |
| Segment aktiv | Grund `--og-text`, Text `--og-bg`, 700 |
| Segment inaktiv | transparent, Text `--og-text-2`, 500 |

## Zustandskomponenten (T02)

!!! info "Geplant"

    Diese Komponenten folgen mit T02 und sind im aktuellen Branch noch nicht vorhanden:
    `og-avatar` (Raster-Profilbild; die Quelle der Zellwerte entscheidet T02), `og-signal-bars` (Signalstärke),
    `og-banner` (Fehlerhinweis), `og-step-list` (Schrittliste), `og-message-bubble` (Nachrichtenblase),
    `og-composer` (Eingabeleiste im Chat) und `og-qr` (QR-Code).

Siehe dazu auch [Screens](screens.md) und [Überblick](../architektur/ueberblick.md).
