# T17 – Standort: Kern (GPS, Geo-Funktionen, Funk-Frame)

**Abhängig von:** T07
**Skills:** `offgrid-location` (§1–3), `offgrid-antenna-protocol` (§5, §6, §8), `offgrid-data`, `offgrid-architecture`, `offgrid-testing`
**Dateien:** `src/app/core/location/geo.ts`, `src/app/core/location/location.service.ts`, `src/app/core/messaging/frame.ts`,
`src/app/core/messaging/messaging.service.ts`, `src/app/core/antenna/mock-antenna.service.ts`, `src/app/core/antenna/og-mock.d.ts`,
`src/app/core/models/errors.ts`, `src/app/core/models/antenna.ts` (nur `FrameType` + `'loc'`), `android/app/src/main/AndroidManifest.xml` (nur Standort-Berechtigungen),
`package.json` (nur `@capacitor/geolocation`), `src/testing/**` (nur Tester)

## Ziel
Standort bestimmen, als `loc`-Frame senden und empfangen, mit Zustellstatus wie bei Text. Noch keine UI.

## Umfang
1. `npm install @capacitor/geolocation`, `npx cap sync android`, Manifest laut Skill §2.
2. `geo.ts` mit allen Funktionen aus §1.
3. `LocationService` laut §2 inkl. Demo-Fix im Browser.
4. `frame.ts`: Typ 5 `loc`.
5. `MessagingService.sendLocation` und Empfang `loc` laut §3; `messages()` liefert `MessageView` mit `location`;
   Vorschau-Daten für `kind 'location'` (die Texte setzt die UI).
6. Mock: `ogMock.receiveLocation(...)`; gesendete `loc`-Frames bekommen `ack`.

## Akzeptanzkriterien
- [ ] `loc`-Frame exakt laut Protokoll §5 (Feldnamen, 6 Nachkommastellen, ganzzahlige Genauigkeit).
- [ ] Status-Übergänge für Standort-Nachrichten identisch zu Text (Queued → Sent → Delivered, Failed, Retry).
- [ ] Browser-Konsole: `ogMock.receiveLocation('Anna Meier')` erzeugt eine Standort-Nachricht mit Koordinate.
- [ ] Prüfbefehle grün.

## Tests
`geo.spec.ts`, `location.service.spec.ts`, Ergänzungen in `frame.spec.ts` und `messaging.service.spec.ts` laut Skill `offgrid-testing`.

## Nicht im Umfang
UI (T18), Live-Standort (T19).
