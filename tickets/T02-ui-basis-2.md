# T02 – UI-Basis 2: Zustandskomponenten

**Abhängig von:** T01
**Skills:** `offgrid-design-system`, `offgrid-testing`
**Dateien:** `src/app/ui/**`, `package.json` (nur `qrcode`, `@types/qrcode`)
**Referenz:** `docs/design/screens/Kontakte.dc.html`, `Main.dc.html`, `ChatGetrennt.dc.html`, `Handshake.dc.html`, `Antenne.dc.html`

## Umfang
`og-avatar`, `og-signal-bars`, `og-banner` + `og-banner-action` + `og-note`, `og-step-list`, `og-message-bubble`,
`og-composer`, `og-qr` (inkl. `ui/qr/qr-colors.ts`). `npm install qrcode` und `npm install -D @types/qrcode`.
Der Composer zählt Bytes **nur** über seinen Input `countBytes` (keine eigene Zählung) und hat den Input `blockOverLimit` (Standard `true`).
`og-avatar` bekommt seine Zellwerte über `avatarPattern(seed)` (`ui/avatar/avatar-pattern.ts`, Skill `offgrid-design-system`); die Komponente selbst hat
weiterhin den Input `pattern`.

## Akzeptanzkriterien
- [ ] Alle Zustände laut Skill: Avatar normal/pending in 5 Grössen; Balken Level 0–4 in md/sm;
      Bubble in/out × queued/sent/delivered/failed inkl. `groupStart`; Step-Liste done/active(pulse|spinner)/todo.
- [ ] `prefers-reduced-motion` schaltet Animationen ab.
- [ ] Composer: Senden deaktiviert bei leerem Text, und bei zu vielen Bytes nur mit `blockOverLimit`; Enter sendet; Zähler rot bei Überschreitung.
- [ ] `avatarPattern`: 25 Werte, spiegelsymmetrisch, gleicher Seed → gleiches Raster, mindestens 5 Zellen an.
- [ ] Prüfbefehle grün.

## Tests
`signal-bars.component.spec.ts`, `message-bubble.component.spec.ts`, `avatar-pattern.spec.ts` laut Skill `offgrid-testing`.
