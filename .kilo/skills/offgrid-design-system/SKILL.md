---
name: offgrid-design-system
description: Verbindliches Design-System der OffGrid-App – Tokens, Schriften, Icons und alle og-UI-Komponenten mit exakten Massen. Laden bei jedem Ticket, das UI, Styles oder Komponenten in src/app/ui oder src/app/features berührt.
---

# OffGrid Design-System

Look: dunkles Graphit, ein einziger Akzent **Eisblau**, klare Grotesk-Schrift, technische Meta-Infos in Mono.
Wiedererkennung: **Signalbalken** (Empfang und Zustellstatus) und **Schlüssel-Muster** als Profilbild.
Es gibt nur ein dunkles Theme.

Referenz-Markup mit exakten Werten: `docs/design/screens/*.dc.html` (aus dem Design-Canvas). Diese Dateien sind
**Referenz**, nicht zum Kopieren: Inline-Styles dort entsprechen den Tokens hier.

## 1. Tokens

- Datei `tokens.scss` in diesem Skill-Ordner ist die Quelle. Im Projekt liegt sie unter `src/theme/tokens.scss`.
- In Komponenten **nur** `var(--og-…)`. Keine Hex-Werte, keine `rgba()` ausser in `tokens.scss`.

## 2. Schriften

Pakete (lokal gebündelt, die App läuft offline): `@fontsource-variable/schibsted-grotesk`, `@fontsource/geist-mono`.
In `angular.json` → `styles` vor `global.scss` eintragen:
`node_modules/@fontsource-variable/schibsted-grotesk/index.css`, `node_modules/@fontsource/geist-mono/400.css`,
`node_modules/@fontsource/geist-mono/500.css`.

| Stil-Name | Font | Grösse | Gewicht | Extra | Verwendung |
|---|---|---|---|---|---|
| `display` | `--og-font` | 32px / 1.1 | 800 | letter-spacing -0.03em | Onboarding-Titel |
| `app-title` | `--og-font` | 30px | 800 | -0.03em | „OffGrid“ in Kontakte |
| `hero` | `--og-font` | 24px | 750 | -0.02em | „Schlüssel ausgetauscht“ |
| `empty-title` | `--og-font` | 22px | 700 | -0.01em | Leerzustand |
| `page-title` | `--og-font` | 20px | 700 | -0.01em | Titel in Unterseiten |
| `chat-name` | `--og-font` | 17px / 1.2 | 650 | | Name im Chat-Header |
| `body-strong` | `--og-font` | 16px | 650 | | Kontaktname, Zeilentitel |
| `body` | `--og-font` | 16px / 1.4 | 400 | | Bubble-Text, Inputs |
| `body-2` | `--og-font` | 15px / 1.5 | 400 | Farbe `--og-text-2` | Erklärtexte |
| `row` | `--og-font` | 15px | 400 | | Zeilen in Info-Karten |
| `preview` | `--og-font` | 14px | 400 | 1 Zeile, Ellipsis | Nachrichtenvorschau |
| `help` | `--og-font` | 13px / 1.4 | 400 | `--og-text-3` | Hilfstexte, Labels (Labels in `--og-text-2`) |
| `meta` | `--og-font-mono` | 11px | 400 | `--og-text-3` | Zeiten, Status, technische Werte |
| `section` | `--og-font-mono` | 11px | 500 | GROSSBUCHSTABEN, letter-spacing 0.12em, `--og-text-3` | Abschnittstitel |
| `value` | `--og-font-mono` | 13px | 400 | `--og-text` | Werte rechts in Info-Zeilen |

Lege diese Stile als SCSS-Mixins in `src/theme/typography.scss` an (`@mixin og-type-display` …) und nutze nur diese.

## 3. Icons

Alle Icons sind Inline-SVG mit `fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"`,
`viewBox="0 0 24 24"`, `aria-hidden="true"`. Komponente `og-icon` mit Input `name` rendert genau diese Pfade:

| name | Grösse/Strich | Inhalt |
|---|---|---|
| `back` | 22 / 2 | `<path d="M15 5l-7 7 7 7"/>` |
| `plus` | 20 / 2 | `<path d="M12 5v14"/><path d="M5 12h14"/>` |
| `settings` | 20 / 2 | `<path d="M4 7h10"/><path d="M18 7h2"/><circle cx="16" cy="7" r="2"/><path d="M4 17h2"/><path d="M10 17h10"/><circle cx="8" cy="17" r="2"/>` |
| `send` | 22 / 2.2 | `<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>` |
| `check` | 14 / 3 | `<path d="M5 12l5 5 9-10"/>` |
| `qr` | 20 / 2.2 | `<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3"/><path d="M21 14v7h-7"/>` |
| `antenna` | 22 / 2 | `<path d="M12 13v8"/><circle cx="12" cy="11" r="2"/><path d="M7.8 6.8a6 6 0 0 0 0 8.4"/><path d="M16.2 6.8a6 6 0 0 1 0 8.4"/><path d="M5 4a10 10 0 0 0 0 14"/><path d="M19 4a10 10 0 0 1 0 14"/>` |
| `upload` | 22 / 2 | `<path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>` |
| `download` | 22 / 2 | `<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>` |
| `file` | 20 / 2 | `<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>` |
| `info` | 18 / 2 | `<circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16.5v.01"/>` |
| `warning` | 18 / 2 | `<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4"/><path d="M12 17v.01"/>` |
| `pin` | 22 / 2 | `<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.5"/>` |
| `map` | 20 / 2.2 | `<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14"/><path d="M15 6v14"/>` |
| `copy` | 20 / 2 | `<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>` |
| `refresh` | 18 / 2 | `<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>` |
| `users` | 20 / 2 | `<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>` (nur T20) |

Richtungspfeil (gefüllt, kein Stroke, in `og-location-bubble`/`og-bearing-dial`): `<path d="M12 3l5.5 15L12 15l-5.5 3z"/>` im
`viewBox="0 0 24 24"`, gedreht mit `transform="rotate(<Grad> 12 12)"`, Füllung `--og-accent`.

Inputs von `og-icon`: `name` (required), `size` (px, Default aus Tabelle), `strokeWidth` (Default aus Tabelle).
Keine Emojis, keine Icon-Fonts, keine anderen Icons.

## 4. Komponenten (`src/app/ui/`, Selektor-Präfix `og-`)

Alle Komponenten: Standalone, OnPush, nur Inputs/Outputs, **keine Services injizieren**.

### og-button
Inputs: `variant: 'primary' | 'secondary' | 'danger-text'`, `type` (`button`|`submit`, Default `button`),
`disabled` (bool), `icon` (optional Icon-Name), `fullWidth` (bool, Default true). Output: `pressed`.
Rendert ein `<button>`. Für Navigation gibt es `og-link-button` mit gleichem Aussehen und Input `routerLink`, rendert `<a>`.
- `primary`: Höhe `--og-btn-h` (54), Radius `--og-r-btn`, Grund `--og-accent`, Text `--og-on-accent`, 16px/700, Icon 20px, gap 10px.
- `secondary`: Höhe `--og-btn2-h` (48), Radius `--og-r-btn2`, transparent, Rahmen 1px `--og-border`, Text `--og-text`, 15px/600.
- `danger-text`: Höhe 56, transparent, kein Rahmen, Text `--og-danger` 16px/600, linksbündig, padding 0 16px (für Karten-Zeile).
- `disabled`: Opazität 0.4, kein Klick.

### og-icon-button
Inputs: `icon`, `label` (→ `aria-label`, Pflicht), `shape: 'round' | 'plain'`, optional `routerLink` (dann `<a>`).
- `round`: 44×44, Kreis, Grund `--og-surface`, Rahmen 1px `--og-border`, Icon `--og-text`.
- `plain`: 44×44, Radius 14, kein Grund (für „Zurück“).

### og-topbar (Kopf einer Unterseite)
Inputs: `title`, `backLink` (Route), `backLabel` (aria-label, z. B. „Zurück zu den Kontakten“).
Layout: Zeile, gap 6px, padding `14px 12px 8px 6px`; `og-icon-button plain back` + `<h1>` im Stil `page-title`.
Inhalt-Projektion rechts (`<ng-content>`), falls nötig.

### og-section-label
Text im Stil `section`, padding `26px 28px 8px 28px` (in Einstellungen) – Input `inset: 'card' | 'list'`:
`card` = padding `26px 28px 8px`, `list` = padding `26px 20px 8px`.

### og-card
Container: Margin seitlich `--og-gutter`, Radius `--og-r-card`, Grund `--og-surface`, Rahmen 1px `--og-border`.
Input `padded` (bool): true → padding 16px, flex column gap 14px; false → Kinder sind Zeilen.

### og-info-row (Zeile in og-card)
Inputs: `label`, `value` (optional), `last` (bool). Min-Höhe `--og-row-min`, padding `0 16px`, flex space-between,
Trennlinie unten 1px `--og-line` ausser `last`. Label im Stil `row` in `--og-text-2`, Wert im Stil `value`.
`<ng-content>` ersetzt den Wert, wenn vorhanden (z. B. Signalbalken).

### og-avatar (Schlüssel-Muster)
Inputs: `pattern: boolean[]` (25 Werte, Zeilen von oben, links nach rechts), `size: 40|48|56|72|96`,
`variant: 'normal' | 'pending' | 'square'` (`square` nur T20: Gruppen – Radius 12 bei 40, 14 bei 48, Zellen in `--og-accent`).
- Kreis, Grund `--og-surface`, Rahmen 1px `--og-border`, darin 5×5-Raster zentriert.
- Zellgrösse/Lücke je `size`: 40→4/1px, 48→5/1px, 56→5/1px, 72→7/1.5px, 96→9/2px. Zellradius 1px (96: 2px).
- Zelle an: Grund `--og-text-2`; Zelle aus: transparent.
- `pending`: kein Raster, Kreis-Rahmen 1.5px **gestrichelt** `--og-dashed`, kein Grund.
- `aria-hidden="true"` (der Name steht immer daneben).
- Das Muster wird **nicht** hier berechnet, sondern von `KeyPatternService` geliefert (Skill `offgrid-crypto-handshake`).

### og-signal-bars
Inputs: `level: 0|1|2|3|4`, `size: 'md' | 'sm'`, `label` (Pflicht, → `role="img" aria-label`).
SVG `viewBox="0 0 20 14"`, md = 20×14, sm = 15×11. 4 Balken, `rx="1"`, Breite 3.5:
x=0 y=10 h=4 · x=5.5 y=7 h=7 · x=11 y=4 h=10 · x=16.5 y=0 h=14.
Balken `i < level` → Klasse `on` (Füllung `--og-accent`), sonst Klasse `off` (Füllung `--og-signal-off`).
Mapping und Labels: siehe Skill `offgrid-screens` → „Signal“.

### og-status-dot
Input `state: 'ok' | 'danger'` → 8×8 Kreis, `--og-ok` bzw. `--og-danger`.

### og-badge (Ungelesen)
Input `count`. Min-Breite 18, Höhe 18, padding `0 5px`, Pill, Grund `--og-accent`, Text `--og-on-accent` 11px/700.
Bei `count > 99` Text „99+“. Bei 0 nicht rendern.

### og-banner
Inputs: `tone: 'danger'`, `title`, `text`. Projektion für Aktion rechts.
Margin `12px 14px 0`, padding `12px 12px 12px 16px`, Radius `--og-r-btn`, Grund `--og-danger-bg`,
Rahmen 1px `--og-danger-border`. Titel 15px/650 `--og-danger-title`, Text 13px/1.4 `--og-danger-text`.
`role="status"`. Aktion `og-banner-action` (Input `routerLink`, rendert `<a>`, Inhalt per Projektion): Höhe 40,
padding `0 14px`, Radius 12, Grund `--og-text`, Text `--og-bg` 14px/700.
`og-note` (Input `text`, ohne Titel, Icon `warning` 18px in `--og-danger-title`, gap 12): margin `14px 16px 0`,
padding `14px 16px`, Radius `--og-r-btn`, Grund `--og-danger-bg`, Rahmen 1px `--og-danger-border`,
Text 14px/1.45 `--og-danger-text`, `role="note"`.

### og-step-list
Input `steps: { label: string; state: 'done' | 'active' | 'todo'; meta?: string }[]`.
Container: `<ol>` (oder `<ul>`), Margin `26px 16px 0` (bzw. `24px 16px 0` im Onboarding über Input `compact`),
padding `6px 16px`, Radius `--og-r-card`, Grund `--og-surface-2`, Rahmen 1px `--og-line`.
Zeile: Min-Höhe 52, gap 14, Trennlinie 1px `--og-line` ausser letzte.
- `done`: Kästchen 26×26 Radius `--og-r-xs` Grund `--og-accent`, Icon `check` in `--og-on-accent`; Text 15px; Meta rechts `meta`-Stil.
- `active`: zentrierter Punkt 12×12 `--og-accent` mit Puls-Animation (box-shadow von `0 0 0 0 --og-accent-pulse`
  auf `0 0 0 10px transparent`, 1.6s ease-out infinite) **oder** Spinner (Input `activeStyle: 'pulse' | 'spinner'`;
  Spinner 18×18, Rand 2.5px `--og-border-muted`, oben `--og-accent`, 0.9s linear); Text 15px/600; Meta in `--og-accent`.
- `todo`: Kästchen 26×26 Radius 9, Rahmen 1.5px `--og-border-muted`; Text 15px `--og-text-3`.
- `@media (prefers-reduced-motion: reduce)`: keine Animation.

### og-text-field
Inputs: `id`, `label`, `type` (`text`|`password`), `placeholder`, `hint` (optional), `optional` (bool → hängt
„ (optional)“ in `--og-text-3` ans Label), `maxlength`, `error` (string | null → Text im Stil `help` in `--og-danger`
unter dem Feld). Zwei-Wege-Bindung über `model<string>()` namens `value`. Output `blurred` (beim Verlassen des Feldes).
Label 13px `--og-text-2`, gap 6; Input Höhe `--og-input-h`, Radius `--og-r-input`, Grund `--og-input`, Rahmen 1px
`--og-border`, Text 16px `--og-text`, padding `0 14px`. Fokus: Rahmen `--og-accent`. Hint im Stil `help`.

### og-switch
Inputs: `checked` (model), `labelledBy` (id des Textes). Rendert `<button type="button" role="switch" aria-checked>`.
Track 52×32, padding 3, Pill; an: `--og-accent`, Knopf rechts; aus: `--og-signal-off`, Knopf links.
Knopf 26×26 Kreis; an `--og-on-accent`, aus `--og-text-3`. Übergang 150ms.

### og-segmented
Inputs: `options: {value: string; label: string}[]`, `value` (model), `ariaLabel`.
Container `role="tablist"`, margin `8px 16px 0`, padding 4, Radius 16, Grund `--og-surface`, Rahmen 1px `--og-border`,
Grid 2 Spalten gap 4. Segment: `<button role="tab" aria-selected>`, Höhe 44, Radius 12, 15px.
Aktiv: Grund `--og-text`, Text `--og-bg`, 700. Inaktiv: transparent, Text `--og-text-2`, 500.

### og-message-bubble
Inputs: `direction: 'in' | 'out'`, `status: 'queued' | 'sent' | 'delivered' | 'failed'`, `text`, `meta` (string),
`groupStart` (bool). Output: `retry`.
- Wrapper max-width 78%, flex column gap 4 (bei failed gap 6); `in` links, `out` rechts ausgerichtet.
- Bubble: padding `10px 14px`, 16px/1.4, Radius `20px 20px 20px 6px` (in) bzw. `20px 20px 6px 20px` (out).
  - `in`: Grund `--og-surface`, Rahmen 1px `--og-border`, Text `--og-text`, Gewicht 400.
  - `out` + `sent`/`delivered`: Grund `--og-accent`, Text `--og-on-accent`, 500.
  - `out` + `queued`: transparent, Rahmen **1.5px gestrichelt** `--og-accent`, Text `--og-text`, 500.
  - `out` + `failed`: transparent, Rahmen 1.5px solid `--og-danger`, Text `--og-text`, 500.
- Meta-Zeile (`meta`-Stil): `in` → padding-left 6, nur Zeit. `out` → padding-right 6, Text + `og-signal-bars size="sm"`:
  sent = level 2, delivered = level 4, queued = level 0. `failed` → statt Balken: Text „Nicht gesendet“ in
  `--og-danger` + Button „Erneut senden“ (Höhe 32, padding `0 12px`, Radius 10, Grund `--og-surface`,
  Rahmen 1px `--og-border`, 13px/600) → Output `retry`.
- Abstand: Nachrichten derselben Richtung direkt nacheinander: gap 6px. Richtungswechsel: zusätzlich margin-top 8px
  (über Input `groupStart: boolean`).

### og-composer
Inputs: `placeholder`, `label` (verstecktes Label, Klasse `og-sr-only`), `sendLabel` (aria-label Senden-Button),
`maxBytes` (number), `countBytes: (text: string) => number` (die Seite übergibt `contentBytes` aus `core/messaging/limits.ts`),
`showLocation` (bool, Default false; ab T18 im Einzelchat true).
Outputs: `send(text)`, `location()` (Standort-Button gedrückt). Model `text`. Nach `send` wird `text` geleert.
Leiste: Grund `--og-bar`, Rand oben 1px `--og-line`, padding `10px 14px 22px`, gap 10 (mit Standort-Button gap 8),
Elemente unten ausgerichtet.
Standort-Button (nur bei `showLocation`): ganz links, 48×48, Radius 16, Grund `--og-surface`, Rahmen 1px `--og-border`,
Icon `pin` 22 in `--og-text`, `aria-label` „Standort senden“, margin-bottom 21px.
Input (mit verstecktem Label `Nachricht an <Name>`): Höhe 48, Radius 16, Grund `--og-surface`, Rahmen 1px `--og-border`.
Darunter Zähler im `meta`-Stil, padding-left 4: `<countBytes(text)> / <maxBytes> Zeichen pro Funkspruch`.
Senden-Button 48×48 Radius 16 `--og-accent`, Icon `send` in `--og-on-accent`, `aria-label` aus Input `sendLabel`,
margin-bottom 21px (bündig mit Input). Deaktiviert, wenn Text leer (nach trim) oder Bytes > maxBytes.
Bei Überschreitung: Zähler in `--og-danger`. Enter sendet.

### og-location-bubble (ab T18; Referenz `ChatStandort.dc.html`)
Inputs: `direction`, `status`, `meta`, `groupStart` (wie `og-message-bubble`), `title` (string), `coordinate`
(`Coordinate`), `distance` (string | null), `directionText` (string | null), `bearing` (number | null), `live` (string | null).
Outputs: `open()`, `retry()`.
- Breite fest: out 250px, in 260px. Radius wie Message-Bubble, padding `12px 14px`, flex column.
- `out`: Grund `--og-accent`, Text `--og-on-accent`, gap 6: Zeile Icon `pin` 18 + Titel (15/700) · Zeile Mono 12px/1.5:
  `formatCoordinate` und darunter „Genauigkeit <formatAccuracy>“. queued/failed: Rahmen-Varianten wie Message-Bubble.
- `in`: Grund `--og-surface`, Rahmen 1px `--og-border`, gap 10: Zeile Icon `pin` 18 in `--og-accent` + Titel ·
  wenn `distance`: Zeile mit Kreis 44×44 (Rahmen 1px `--og-border`) und Richtungspfeil 26 (gedreht um `bearing`),
  daneben Entfernung (24/750, letter-spacing -0.02em) und darunter `directionText` (14px `--og-text-2`) ·
  Mono 12px `--og-text-3`: „<formatCoordinate> · <formatAccuracy>“ · Button (`<button>`) „Anzeigen“: Höhe 40, Radius 12,
  Grund `--og-line`, Text 14/650 → `open`.
- `live` (nur T19, z. B. „Live · bis 15:05“): kleines Label über dem Titel, Mono 11px `--og-accent`, letter-spacing 0.08em.
- Meta-Zeile darunter exakt wie `og-message-bubble`.

### og-sheet (ab T18; Referenz `StandortSenden.dc.html`)
Inputs: `open` (bool), `title`. Output: `closed()`. Inhalt per Projektion.
- Abdunkelung: ganzflächig `--og-scrim`; Klick darauf → `closed`.
- Panel unten: Grund `--og-surface`, Rand oben 1px `--og-border`, Radius `28px 28px 0 0`,
  padding `10px 20px calc(28px + env(safe-area-inset-bottom))`, flex column gap 18.
- Griff 36×4 Pill `--og-border-muted`, zentriert. Titel `<h2>` 20/700. `role="dialog"`, `aria-modal="true"`,
  `aria-labelledby` auf den Titel. Escape/Zurück-Taste → `closed`. Fokus beim Öffnen auf den ersten Button.

### og-bearing-dial (ab T18; Referenz `StandortDetail.dc.html`)
Inputs: `bearing` (number | null), `label` (aria-label). SVG `viewBox="0 0 240 240"`, 232×232:
- Kreis r 116 Füllung `--og-surface-2`, Rand 1.5px `--og-border`; innerer Kreis r 78 Rand 1px `--og-line`.
- 8 Striche (alle 30° ausser 0/90/180/270): Linie y 8→16, 2px `--og-border-muted`, rund.
- Buchstaben Mono 13px: „N“ oben (y 34, `--og-accent`, 600), „O“ rechts (x 212), „S“ unten (y 218), „W“ links (x 28), `--og-text-3`.
- Pfeil `M120 54 L148 154 L120 138 L92 154 Z` in `--og-accent`, gedreht um `bearing` um (120,120); Mittelpunkt r 4 `--og-bg`.
- `bearing` null → kein Pfeil, in der Mitte Mono 13px `--og-text-3` „?“.
- `role="img"` mit `aria-label`.

### og-check-row (nur T20; Referenz `GruppeErstellen.dc.html`)
Inputs: `name`, `pattern` (boolean[25]), `checked` (bool), `disabled` (bool), `last` (bool). Output: `toggle()`.
`<button type="button" role="checkbox" aria-checked>`: Min-Höhe 64, padding `0 16px`, gap 14, transparent, Trennlinie
unten 1px `--og-line` ausser `last`. Inhalt: `og-avatar size 40` · Name 16/600 linksbündig (flex 1) · Checkbox 24×24
Radius 7 (an: Grund `--og-accent` + Icon `check` 14 in `--og-on-accent`; aus: Rahmen 1.5px `--og-border-muted`).
`disabled`: Opazität 0.4.

### og-qr
Input `data: string`. Zeichnet QR-Code als SVG (Paket `qrcode`, Funktion `toString(data, {type:'svg', margin:0,
errorCorrectionLevel:'M', color:{dark:'#0F1115', light:'#00000000'}})` – einzige erlaubte Hex-Ausnahme, weil das Paket
Farben als String braucht; Konstante in `src/app/ui/qr/qr-colors.ts` mit Kommentar). Karte: padding 22, Radius `--og-r-qr`,
Grund `--og-text`. QR-Grösse 230×230. `role="img" aria-label="QR-Code mit deinem Schlüssel"`.

## 5. Seiten-Grundlayout

- Hintergrund jeder Seite `--og-bg`, Text `--og-text`, Schrift `--og-font`.
- Safe Areas: `ion-header` erhält `padding-top: env(safe-area-inset-top)`, Footer-Bereiche
  `padding-bottom: calc(<wert> + env(safe-area-inset-bottom))`.
- Primärbutton am Seitenende: Container padding `12px 16px 26px` (bzw. `0 16px 26px`), unten fixiert über `ion-footer`.
- Keine Schatten, keine Verläufe, keine farbigen Linksränder an Karten.

## 6. Logo

- Dateien: `docs/design/logo/offgrid-icon.svg` (App-Icon mit Fläche), `offgrid-mark.svg` (nur Zeichen, eisblaue Blase),
  `offgrid-mark-inv.svg` (für eisblauen Grund). Referenz: `docs/design/screens/LogoFinal.dc.html`.
- Zeichen = Sprechblase mit Signalbalken aus 4×4 Rasterzellen. **Nicht** verändern, umfärben oder nachzeichnen – nur die SVGs einbinden.
- Schriftzug „OffGrid“: `--og-font`, 800, letter-spacing -0.035em, Abstand Zeichen–Schrift = 0.27 × Schriftgrösse.
- In der App wird das Logo **nur** im Splash-Screen verwendet (Android-Ressourcen, kein eigener Screen).
