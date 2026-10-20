# T09 – Screens Verbinden und Name, Onboarding-Guard

**Abhängig von:** T02, T05
**Skills:** `offgrid-screens` (§0, §1, §2), `offgrid-design-system`, `offgrid-architecture` (§5, §6)
**Dateien:** `src/app/features/verbinden/`, `src/app/features/name/`, `src/app/app.routes.ts`, `src/app/core/onboarding.guard.ts`
**Referenz:** `docs/design/screens/Antenne.dc.html`

## Umfang
Seiten laut Skill inkl. aller Zustände und Fehlertexte. Funktionaler Guard `onboardingGuard` laut Architektur §5.

## Akzeptanzkriterien
- [ ] Ohne abgeschlossenes Onboarding führt jede geschützte Route auf `/verbinden`.
- [ ] Schritt-Liste reagiert live auf `AntennaPort.state`.
- [ ] „SCHRITT 1 VON 2“ nur im Onboarding; bei abgeschlossenem Onboarding führt „Weiter“ zu `/einstellungen`.
- [ ] Onboarding im Browser testbar mit `localStorage og.noseed = '1'`.
- [ ] „Los gehts“ speichert den Namen und landet mit `replaceUrl` auf `/kontakte`.
- [ ] Mit `window.ogMock.drop()` erscheint der Fehlertext „Verbindung zur Antenne verloren.“
- [ ] Prüfbefehle grün.
