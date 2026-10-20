# T06 – Natives USB-Serial-Plugin und SerialAntennaService

**Abhängig von:** T05
**Skills:** `offgrid-antenna-protocol`, `offgrid-architecture`
**Dateien:** `android/**` (Plugin-Java-Klasse, MainActivity, Gradle, Manifest), `src/app/core/antenna/serial-antenna.service.ts`,
`src/app/core/antenna/usb-serial.plugin.ts`, `src/app/app.config.ts`, `src/app/core/app-start.service.ts`,
`package.json` (nur Version-Sync nach `cap sync`)

## Umfang
1. Java-Plugin `UsbSerialPlugin` laut Protokoll §2 (Methoden `listDevices`, `connect`, `write`, `disconnect`;
   Events `data`, `detached`, `error`). JitPack + `usb-serial-for-android`.
2. `AndroidManifest.xml`: `<uses-feature android:name="android.hardware.usb.host" android:required="true" />`.
3. `usb-serial.plugin.ts` (TS-Interface + `registerPlugin`).
4. `SerialAntennaService` laut Protokoll §4 (Zustandsautomat, Heartbeat, Timeouts, `events`).
5. Provider-Weiche: `isNative() && localStorage.getItem('og.mock') !== '1'` → Serial, sonst Mock.
6. `@capacitor/app`: bei `resume` → wenn `state` `disconnected`/`error`: `connect()`.

## Akzeptanzkriterien
- [ ] `npx cap sync android` läuft. Ist `ANDROID_HOME` gesetzt: zusätzlich `cd android && ./gradlew assembleDebug` fehlerfrei.
      Ist es nicht gesetzt: im Ergebnis unter OFFENE FRAGEN „Android-Build durch Mensch prüfen“.
- [ ] Alle Timeouts/Intervalle exakt laut Skill (3 × 3 s auf info, 5 s ping, 15 s Verlust, 10 s txdone).
- [ ] Fehlercodes laut Skill gesetzt.
- [ ] Prüfbefehle grün.

## Tests
Keine automatischen (Hardware). Manueller Gerätetest ist Teil von T15.

## Hinweis für den Planner
Ohne `ANDROID_HOME` ist das **kein** Blocker: nach PASS von Reviewer und Tester Status `fertig`, Notiz
„Android-Build durch Mensch prüfen“. Wenn Gradle die Bibliothek nicht auflöst und der Coder es nicht lösen kann: `blockiert` und weiter – die App läuft mit Mock.
