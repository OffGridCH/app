# T10 – Screen Kontakte (inkl. Leerzustand)

**Abhängig von:** T07, T09
**Skills:** `offgrid-screens` (§0, §3), `offgrid-design-system`
**Dateien:** `src/app/features/kontakte/`
**Referenz:** `docs/design/screens/Kontakte.dc.html`, `KontakteLeer.dc.html`

## Umfang
Seite laut Skill: Header, Antennen-Statuszeile, Kontaktzeilen, ausstehende Zeilen, Footer-Button, Leerzustand.
Daten nur aus `MessagingService`, `HandshakeService` (nur `pending`), `SettingsService`, `AntennaPort`, `KeyPatternService`.

## Akzeptanzkriterien
- [ ] Im Browser: Aufbau und Masse wie die Referenz, Texte und Daten laut Skill (Reihenfolge Anna, Luca, Mia, dann Jonas ausstehend).
- [ ] Signalbalken: Anna 3, Luca 2, Mia 0; `aria-label` laut Skill §0.
- [ ] Neue Nachricht via `window.ogMock.receive('Luca Bernasconi', 'Test')` schiebt Luca nach oben, Badge 1.
- [ ] Statuszeile wechselt bei `window.ogMock.drop()` auf „Antenne getrennt“.
- [ ] Leerzustand erscheint ohne Kontakte und ohne ausstehende Handshakes (Browser mit `localStorage og.noseed = '1'`, nach Onboarding).
- [ ] Prüfbefehle grün.
