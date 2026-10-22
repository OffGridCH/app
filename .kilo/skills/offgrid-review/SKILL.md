---
name: offgrid-review
description: Review-Checkliste für OffGrid – prüft Umfang, Architektur, Design-Tokens, Texte, Barrierefreiheit, Angular-Konventionen und Sicherheit. Laden durch den reviewer bei jedem Ticket.
---

# OffGrid Review-Checkliste

Prüfe jeden Punkt. Jeder Verstoss ist ein Mangel mit `Datei:Zeile`, Punkt-Nummer und konkreter Korrektur.

## A. Umfang
- A1 Nur Dateien in den im Ticket genannten Bereichen geändert.
- A2 Jedes Akzeptanzkriterium ist sichtbar erfüllt (einzeln abhaken).
- A3 Nichts umgesetzt, was nicht im Ticket steht (keine Extra-Features, keine Umbenennungen).
- A4 Keine Änderungen an `.kilo/`, `docs/`, `tickets/`, `scripts/`, `tools/`, `MEILENSTEINE.md`, `.github/`, `doku/`, `mkdocs.yml`, `requirements-docs.txt`,
  `AGENTS.md`, `kilo.jsonc`, `LIES-MICH.md` (Ausnahme: Ticket T21).
- A5 Keine neuen Pakete ausser „Erlaubte Pakete“ (Skill `offgrid-architecture`) – `package.json` diffen.

## B. Architektur
- B1 Dateien liegen im Ordner laut `offgrid-architecture` §2, Namen in kebab-case mit richtiger Endung.
- B2 `ui/`-Komponenten injizieren keine Services.
- B3 Seiten greifen auf Daten nur über Services zu, nie direkt auf Repositories oder Plugins.
- B4 Plugins (`UsbSerial`, `BarcodeScanner`, `Filesystem`, …) nur in `core/`.
- B5 Öffentliche Service-API entspricht exakt `offgrid-architecture` §4 (Namen, Signaturen).

## C. Angular/Ionic
- C1 Standalone, `OnPush`, `inject()`, `input()/output()/model()`; Ionic-Imports nur aus `@ionic/angular`; zoneless (kein `zone.js`).
- C2 Control Flow `@if/@for` mit `track`. Kein `*ngIf/*ngFor`.
- C3 Kein `any`, kein `as unknown as`, keine `// @ts-ignore`.
- C4 Nur erlaubte Ionic-Komponenten; `ion-header/ion-footer` mit `ion-no-border`; kein `color=`-Attribut.
- C5 Keine Subscriptions ohne Aufräumen (`takeUntilDestroyed` oder `toSignal`).

## D. Design
- D1 Keine Hex-/rgb-Farben ausserhalb `tokens.scss` (Ausnahmen: `ui/qr/qr-colors.ts`, `core/platform.ts` StatusBar, `src/index.html` theme-color).
- D2 Masse, Radien, Schriftgrössen entsprechen `offgrid-design-system` bzw. der Referenz `docs/design/screens/`.
- D3 Nur Icons aus der Icon-Tabelle; keine Emojis.
- D4 Typografie nur über die Mixins aus `typography.scss`.
- D5 Kein Schatten, kein Verlauf, kein farbiger Linksrand.

## E. Texte
- E1 Jeder sichtbare Text steht wörtlich in `offgrid-screens` (inkl. Satzzeichen, „…“ als ein Zeichen).
- E2 Kein „ß“. Keine englischen UI-Texte.
- E3 Keine Sicherheitsversprechen („sicher“, „verschlüsselt“ als Werbeaussage, „Ende-zu-Ende“).

## F. Barrierefreiheit
- F1 Klickbares ist `<button>`/`<a>`; kein `(click)` auf `div`/`span`.
- F2 Icon-Buttons haben `aria-label` mit Text aus dem Skill.
- F3 Inputs haben `<label for>`; Schalter `role="switch"` + `aria-checked`; Tabs `role="tab"` + `aria-selected`.
- F4 Touch-Ziele ≥ 44 px.
- F5 Dekorative SVGs `aria-hidden="true"`; informative SVGs `role="img"` + `aria-label`.

## G. Daten & Sicherheit
- G1 SQL nur mit Parametern.
- G2 Schlüssel, Passwörter und Klartexte werden nie geloggt.
- G3 Zeitstempel als ISO-UTF-Strings; Status als `MessageStatus`-Enum, nicht als Zahl-Literal.
- G4 Frame-/Protokollfelder exakt laut `offgrid-antenna-protocol`.
