# T11 – Screens Kontakt hinzufügen und Kontakt benennen

**Abhängig von:** T08, T10
**Skills:** `offgrid-screens` (§0, §4, §5), `offgrid-design-system`, `offgrid-crypto-handshake` (§3)
**Dateien:** `src/app/features/handshake/`, `src/app/core/handshake/scanner.ts` (Kapselung des Plugins),
`package.json` (nur `@capacitor-mlkit/barcode-scanning`)
**Referenz:** `docs/design/screens/Handshake.dc.html`, `KontaktBenennen.dc.html`

## Umfang
1. `npm install @capacitor-mlkit/barcode-scanning`, `npx cap sync android`. Keine Kamera-Berechtigung nötig
   (der Google Code Scanner läuft ausserhalb der App).
2. `core/handshake/scanner.ts` nativ ergänzen: `scanQr(): Promise<string>`:
   - `BarcodeScanner.isGoogleBarcodeScannerModuleAvailable()`; wenn nicht: Listener auf
     `googleBarcodeScannerModuleInstallProgress` registrieren, `installGoogleBarcodeScannerModule()` aufrufen und auf
     `state === GoogleBarcodeScannerModuleInstallState.COMPLETED` warten (max. 60 s; `FAILED`/`CANCELED`/Timeout →
     Fehler `scanner-unavailable`). Listener danach entfernen.
   - `BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] })` → erster `rawValue`. Kein Ergebnis/Abbruch → `scan-cancelled`.
3. Seiten laut Skill §4 und §5 inkl. Navigation bei `completedContactId`.

## Akzeptanzkriterien
- [ ] Tab-Wechsel per Query `?tab=scan` und per Segment.
- [ ] Verlassen der Seite bricht eigenen `shower`-Handshake ab.
- [ ] Browser-Ablauf: „Mein Code“ + `window.ogMock.completeShowing()` → Kontakt benennen → Speichern → Chat.
- [ ] „Muster stimmt nicht überein“ löscht den Kontakt.
- [ ] Prüfbefehle grün.
