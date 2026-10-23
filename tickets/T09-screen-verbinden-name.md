# T09 – Screens Verbinden und Name, Onboarding-Guard

**Abhängig von:** T02, T23
**Skills:** `offgrid-screens` (§0, §1, §2), `offgrid-design-system`, `offgrid-architecture` (§5, §6)
**Dateien:** `src/app/features/verbinden/`, `src/app/features/name/`, `src/app/app.routes.ts`, `src/app/core/onboarding.guard.ts`
**Referenz:** `docs/design/screens/Antenne.dc.html`

## Umfang
Seiten laut Skill inkl. aller Zustände und Fehlertexte. Funktionaler Guard `onboardingGuard` laut Architektur §5.
Zustände der Antenne: `disconnected`, `unprovisioned`, `locked`, `unlocked` (Skill `offgrid-antenna-protocol` §4). Die Seite „Name“ richtet ein frisches
Gerät mit `AntennaPort.provision(name)` ein (Skill `offgrid-screens` §2).

## Akzeptanzkriterien
- [ ] Ohne abgeschlossenes Onboarding führt jede geschützte Route auf `/verbinden`.
- [ ] Schritt-Liste reagiert live auf `AntennaPort.state` und `connecting`.
- [ ] „SCHRITT 1 VON 2“ nur im Onboarding; bei abgeschlossenem Onboarding führt „Weiter“ zu `/einstellungen`.
- [ ] Onboarding im Browser testbar mit `localStorage og.noseed = '1'`.
- [ ] „Los gehts“ speichert den Namen und landet mit `replaceUrl` auf `/kontakte`; bei einem frischen Gerät (`localStorage og.noseed = '1'`) richtet es vorher das Gerät ein (`state` wird `unlocked`).
- [ ] Der Name wird nach Bytes geprüft (1–24 Bytes, `isValidDisplayName`), nicht nach Zeichen; es gibt kein `maxlength`.
- [ ] Mit `window.ogMock.drop()` erscheint der Fehlertext „Verbindung zur Antenne verloren.“
- [ ] Prüfbefehle grün.
