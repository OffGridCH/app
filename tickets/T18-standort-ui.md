# T18 – Standort: Oberfläche (Senden-Sheet, Standort-Bubble, Standort-Seite)

**Abhängig von:** T12, T17
**Skills:** `offgrid-screens` (§0, §3, §6, §10, §11), `offgrid-design-system`, `offgrid-location` (§1, §4, §6), `offgrid-architecture`
**Dateien:** `src/app/ui/**` (neu: `location-bubble/`, `sheet/`, `bearing-dial/`; Composer-Erweiterung; neue Icons),
`src/app/features/chat/`, `src/app/features/standort/`, `src/app/features/kontakte/` (nur Vorschautext „Standort“),
`src/app/core/location/maps.ts`, `src/app/app.routes.ts`,
`package.json` (nur `@capacitor/clipboard`, `@capacitor/app-launcher`)
**Referenz:** `docs/design/screens/ChatStandort.dc.html`, `StandortSenden.dc.html`, `StandortDetail.dc.html`

## Umfang
1. Pakete installieren, `npx cap sync android`.
2. Icons `pin`, `map`, `copy`, `refresh`; Komponenten `og-location-bubble`, `og-sheet`, `og-bearing-dial`;
   `og-composer` mit `showLocation`/`location`.
3. Chat: Standort-Button, Sheet (§10), Standort-Bubbles (§6 Punkt 5).
4. Route und Seite `/chat/:contactId/standort/:messageId` (§11), `maps.ts` (§4).
5. Kontakte: Vorschau „Standort“ / „Du: Standort“.

## Akzeptanzkriterien
- [ ] Browser: Standort-Button → Sheet zeigt Demo-Fix → „An Anna Meier senden“ → Bubble „Mein Standort“ → nach ~0,3 s „gesendet“ (Standorte werden standardmässig nicht quittiert, es gibt kein „zugestellt“).
- [ ] Browser: `ogMock.receiveLocation('Anna Meier')` → eingehende Bubble mit „1.2 km“ und „Richtung Nordosten“
      (nachdem der eigene Demo-Fix bestimmt wurde), „Anzeigen“ öffnet die Standort-Seite mit Pfeil auf 42°.
- [ ] „Koordinaten kopieren“ zeigt 2 s lang den Haken; „In Karten-App öffnen“ öffnet im Browser OpenStreetMap.
- [ ] Sheet: Escape und Klick auf Abdunkelung schliessen; Fokus liegt beim Öffnen auf dem ersten Button.
- [ ] Ohne frischen eigenen Standort zeigt die eingehende Bubble keine Entfernung.
- [ ] Prüfbefehle grün.

## Tests
Keine zusätzlichen Pflichttests (Logik ist in T17 getestet).
