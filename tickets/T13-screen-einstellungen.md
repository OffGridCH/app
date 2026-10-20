# T13 – Screen Einstellungen und Vibration

**Abhängig von:** T07, T09
**Skills:** `offgrid-screens` (§0, §7), `offgrid-design-system`, `offgrid-architecture`
**Dateien:** `src/app/features/einstellungen/einstellungen.page.*`, `src/app/core/messaging/messaging.service.ts`
(nur Vibration), `src/environments/*` (nur `version`), `tsconfig.json` (nur `resolveJsonModule`, falls nötig),
`package.json` (nur `@capacitor/haptics`)
**Referenz:** `docs/design/screens/Einstellungen.dc.html`

## Umfang
1. `npm install @capacitor/haptics`, `npx cap sync android`.
2. Seite laut Skill §7 inkl. Zählern, Schaltern, Trennen, Alle Daten löschen.
3. `environment.version` aus `package.json`.
4. `MessagingService`: bei eingehender `msg` und `vibrate() === true` → `Haptics.vibrate({ duration: 200 })` (nur nativ).

## Akzeptanzkriterien
- [ ] Anzeigename speichert bei blur, nur wenn `isValidDisplayName`; sonst Fehlertext `name-invalid`.
- [ ] Schalter speichern sofort; Werte bleiben nach Neustart.
- [ ] „Trennen“ setzt Antenne auf `disconnected`; Statuspunkt wechselt.
- [ ] Prüfbefehle grün.

## Hinweis
Der Schalter „Im Hintergrund empfangen“ speichert hier nur die Einstellung. Die Funktion folgt in T16 (Stretch).
