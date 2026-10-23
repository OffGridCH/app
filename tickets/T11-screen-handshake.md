# T11 – Screens Kontakt hinzufügen und Kontakt benennen

**Abhängig von:** T10, T23
**Skills:** `offgrid-screens` (§0, §4, §5), `offgrid-design-system`, `offgrid-crypto-handshake` (§3, §4)
**Dateien:** `src/app/features/handshake/`, `src/app/core/handshake/scanner.ts` (Kapselung des Plugins), `src/app/core/handshake/handshake.service.ts` (nur `scan()`),
`src/app/core/antenna/mock-serial-transport.ts` (nur der Hook `ogMock.peerCode`),
`package.json` (nur `@capacitor-mlkit/barcode-scanning`)
**Referenz:** `docs/design/screens/Handshake.dc.html`, `KontaktBenennen.dc.html`

## Umfang
1. `npm install @capacitor-mlkit/barcode-scanning`, `npx cap sync android`. Keine Kamera-Berechtigung nötig
   (der Google Code Scanner läuft ausserhalb der App).
2. `core/handshake/scanner.ts` mit `scanQr(): Promise<string>` und `HandshakeService.scan()` (ruft `scanQr()`, bei Erfolg `complete(text)`, sonst Fehler in `error`).
   Browser (kein Native): `window.prompt('QR-Text einfügen')`. Dazu im Mock der Hook `ogMock.peerCode(name?)`, der den QR-Text eines erfundenen Gegenübers
   liefert (gültiger `OG1`-Text mit zufälligem Schlüssel). Nativ:
   - `BarcodeScanner.isGoogleBarcodeScannerModuleAvailable()`; wenn nicht: Listener auf
     `googleBarcodeScannerModuleInstallProgress` registrieren, `installGoogleBarcodeScannerModule()` aufrufen und auf
     `state === GoogleBarcodeScannerModuleInstallState.COMPLETED` warten (max. 60 s; `FAILED`/`CANCELED`/Timeout →
     Fehler `scanner-unavailable`). Listener danach entfernen.
   - `BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] })` → erster `rawValue`. Kein Ergebnis/Abbruch → `scan-cancelled`.
3. Seiten laut Skill §4 und §5 inkl. Navigation bei `completedContactId`.

## Akzeptanzkriterien
- [ ] Tab-Wechsel per Query `?tab=scan` und per Segment.
- [ ] Verlassen der Seite verwirft das offene Pairing (`pair.cancel`); der Code wird beim Tabwechsel nicht erneuert.
- [ ] Browser-Ablauf: „Mein Code“ zeigt den Text von `pair.begin`; „Code scannen“ mit `window.ogMock.peerCode()` → Kontakt benennen (zeigt den Fingerabdruck) → Speichern → Chat.
- [ ] Der Kontakt ist nach dem Scan `pending` und wird nach wenigen Sekunden `active` (Mock).
- [ ] „Zahlen stimmen nicht überein“ löscht den Kontakt auf der Antenne und lokal (`HandshakeService.remove`).
- [ ] Fehler `invalid-qr`, `self-pair`, `contact-exists`, `no-pairing` zeigen die Texte aus Skill §0.
- [ ] Der Anzeigename wird nach Bytes geprüft (1–24), es gibt keine Felder Vorname/Nachname mehr.
- [ ] Prüfbefehle grün.
