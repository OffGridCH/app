# T02 – UI-Basis 2: Zustandskomponenten

**Abhängig von:** T01
**Skills:** `offgrid-design-system`, `offgrid-testing`
**Dateien:** `src/app/ui/**`, `package.json` (nur `qrcode`, `@types/qrcode`)
**Referenz:** `docs/design/screens/Kontakte.dc.html`, `Main.dc.html`, `ChatGetrennt.dc.html`, `Handshake.dc.html`, `Antenne.dc.html`

## Umfang
`og-avatar`, `og-signal-bars`, `og-banner` + `og-banner-action` + `og-note`, `og-step-list`, `og-message-bubble`,
`og-composer`, `og-qr` (inkl. `ui/qr/qr-colors.ts`). `npm install qrcode` und `npm install -D @types/qrcode`.
Der Composer zählt Bytes **nur** über seinen Input `countBytes` (keine eigene Zählung).

## Akzeptanzkriterien
- [ ] Alle Zustände laut Skill: Avatar normal/pending in 5 Grössen; Balken Level 0–4 in md/sm;
      Bubble in/out × queued/sent/delivered/failed inkl. `groupStart`; Step-Liste done/active(pulse|spinner)/todo.
- [ ] `prefers-reduced-motion` schaltet Animationen ab.
- [ ] Composer: Senden deaktiviert bei leerem Text oder zu vielen Bytes; Enter sendet; Zähler rot bei Überschreitung.
- [ ] Prüfbefehle grün.

## Tests
`signal-bars.component.spec.ts`, `message-bubble.component.spec.ts` laut Skill `offgrid-testing`.
