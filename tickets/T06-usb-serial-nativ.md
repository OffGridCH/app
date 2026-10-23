# T06 – Natives USB-Serial-Plugin, UsbSerialTransport und Keystore-Plugin

**Abhängig von:** T23
**Skills:** `offgrid-antenna-protocol` (§2, §3, §4), `offgrid-crypto-handshake` (§1), `offgrid-architecture`
**Dateien:** `android/**` (Plugin-Java-Klassen, MainActivity, Gradle, Manifest), `src/app/core/antenna/usb-serial.plugin.ts`,
`src/app/core/antenna/usb-serial.transport.ts`, `src/app/core/antenna/unavailable-transport.ts` (entfällt),
`src/app/core/keystore/keystore.plugin.ts` (nur bei Abweichung von der Schnittstelle), `src/app/app.config.ts`,
`package.json` (nur Version-Sync nach `cap sync`)

## Umfang
1. Java-Plugin `UsbSerialPlugin` laut Skill §2 (Methoden `listDevices`, `connect`, `write`, `disconnect`; Events `data`, `detached`, `error`).
   JitPack + `usb-serial-for-android`. 115200 Baud, 8N1, **DTR und RTS sofort nach dem Öffnen auf low**. Die Bytes sind UTF-8.
2. Java-Plugin `OffgridKeystorePlugin` (Name `OffgridKeystore`): legt beim ersten Aufruf einen nicht exportierbaren HMAC-SHA256-Schlüssel mit Alias
   `offgrid_unlock` im Android Keystore an und rechnet `hmac({ data: base64 }) → { mac: base64 }` (Schnittstelle in `core/keystore/keystore.plugin.ts`).
   Mehr kann das Plugin nicht: X25519, HKDF und AES-GCM laufen in TypeScript.
3. `AndroidManifest.xml`: `<uses-feature android:name="android.hardware.usb.host" android:required="true" />`.
4. `usb-serial.plugin.ts` (TS-Interface + `registerPlugin`) und `usb-serial.transport.ts`: `UsbSerialTransport extends SerialTransport`
   (`open`, `write`, `close`, `onData`, `onClosed`). Dekodiert mit `TextDecoder` (`stream: true`). Reject-Codes → `TransportError`
   (`PERMISSION_DENIED` → `permission-denied`, `OPEN_FAILED` → `open-failed`, `NO_DRIVER` und kein Gerät → `no-device`). Event `detached` → `onClosed`.
5. Provider-Weiche in `app.config.ts`: `SerialTransport` → `UsbSerialTransport` statt `UnavailableSerialTransport`; `UnavailableSerialTransport` löschen.
   Die Bedingung `useMockAntenna()` bleibt.
6. `@capacitor/app`: bei `resume` → wenn `AntennaPort.state()` `disconnected` ist: `connect()`.

## Akzeptanzkriterien
- [ ] `npx cap sync android` läuft. Ist `ANDROID_HOME` gesetzt: zusätzlich `cd android && ./gradlew assembleDebug` fehlerfrei.
      Ist es nicht gesetzt: im Ergebnis unter OFFENE FRAGEN „Android-Build durch Mensch prüfen“.
- [ ] DTR und RTS stehen nach dem Öffnen auf low; Parameter 115200 8N1.
- [ ] Der HMAC-Schlüssel ist nicht exportierbar (`KeyProperties.PURPOSE_SIGN`, kein `setExtractable`-Ersatz, kein Rohschlüssel im JS).
- [ ] Fehlercodes laut Skill §2 gesetzt; `detached` führt zu `lost`.
- [ ] Prüfbefehle grün.

## Tests
Keine automatischen für das native Plugin (Hardware). Ein kurzer Spec für `UsbSerialTransport` mit gemocktem Plugin (Fehlercodes, UTF-8 über
Chunk-Grenzen, `detached`) ist erwünscht. Manueller Gerätetest ist Teil von T15.

## Hinweis für den Planner
Ohne `ANDROID_HOME` ist das **kein** Blocker: nach PASS von Reviewer und Tester Status `fertig`, Notiz
„Android-Build durch Mensch prüfen“. Wenn Gradle die Bibliothek nicht auflöst und der Coder es nicht lösen kann: `blockiert` und weiter – die App läuft mit dem Mock.
