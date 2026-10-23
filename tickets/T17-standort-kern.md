# T17 – Standort: Kern (GPS, Geo-Funktionen)

**Abhängig von:** T23
**Skills:** `offgrid-location` (§1–3), `offgrid-antenna-protocol` (§5, §9), `offgrid-data`, `offgrid-architecture`, `offgrid-testing`
**Dateien:** `src/app/core/location/geo.ts`, `src/app/core/location/location.service.ts`, `src/app/core/models/errors.ts` (nur `LocationErrorCode`),
`android/app/src/main/AndroidManifest.xml` (nur Standort-Berechtigungen), `package.json` (nur `@capacitor/geolocation`)

## Ziel
Den eigenen Standort bestimmen und Entfernung und Richtung zu einem empfangenen Standort berechnen. Noch keine UI.
Das Senden und Empfangen von Standort-Nachrichten (`msg.send` mit `type: "geo"`, `msg.received` mit `type: "geo"`, Koordinate speichern) **gibt es schon**
(`MessagingService.sendLocation` und der Empfang, T23); die App baut keinen Funk-Frame mehr.

## Umfang
1. `npm install @capacitor/geolocation`, `npx cap sync android`, Manifest laut Skill §2.
2. `geo.ts` mit allen Funktionen aus §1.
3. `LocationService` laut §2 inkl. Demo-Fix im Browser.
4. Prüfen, dass `MessagingService.sendLocation` mit einem `GeoFix` aus `LocationService` zusammenpasst (`GeoFix` liegt in `core/models/message.ts`); nur bei Lücken ändern.

## Akzeptanzkriterien
- [ ] Alle Funktionen aus Skill §1 liefern die dort genannten Werte (Pflichttests in `offgrid-testing`).
- [ ] `LocationService.locate()` setzt `myFix` bzw. den Fehlercode laut Skill §2 (Browser: Demo-Fix nach 600 ms).
- [ ] Browser-Konsole: `ogMock.receiveLocation('Anna Meier')` erzeugt eine Standort-Nachricht mit Koordinate (funktioniert schon seit T23; hier nur prüfen).
- [ ] Prüfbefehle grün.

## Tests
`geo.spec.ts`, `location.service.spec.ts` laut Skill `offgrid-testing`. Die Tests für `sendLocation` und den Empfang stehen schon in `messaging.service.spec.ts`.

## Nicht im Umfang
UI (T18), Live-Standort (T19).
