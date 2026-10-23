# T13 – Screen Einstellungen und Vibration

**Abhängig von:** T09, T23
**Skills:** `offgrid-screens` (§0, §7), `offgrid-design-system`, `offgrid-architecture`
**Dateien:** `src/app/features/einstellungen/einstellungen.page.*`, `src/app/core/messaging/messaging.service.ts`
(nur `counts`, `deleteAll`, Vibration), `src/app/core/handshake/handshake.service.ts` (nur, falls `deleteAll` sie braucht), `src/environments/*` (nur `version`), `tsconfig.json` (nur `resolveJsonModule`, falls nötig),
`package.json` (nur `@capacitor/haptics`)
**Referenz:** `docs/design/screens/Einstellungen.dc.html`

## Umfang
1. `npm install @capacitor/haptics`, `npx cap sync android`.
2. Seite laut Skill §7 inkl. Zählern, Schaltern, Trennen, Alle Daten löschen. `MessagingService.counts` (Kontakte, Nachrichten) und `deleteAll()` kommen hier dazu
   (Rest aus dem früheren T07). `deleteAll()` löscht jeden Kontakt **auch auf der Antenne** (`HandshakeService.remove`, `contact.delete`) und danach lokal alles
   (`DatabaseService.deleteAllUserData()`), sonst kämen die Kontakte beim nächsten Entsperren zurück (Der Bestätigungstext sagt „auf diesem Handy“; ob er angepasst wird, entscheidet der Mensch).
   Anzeigename speichern: `SettingsService.setDisplayName` **und** `id.set_name`. Frequenz aus `radio.get` (`freq_mhz` × 10⁶), Firmware aus `AntennaPort.device()`.
3. `environment.version` aus `package.json`.
4. `MessagingService`: bei eingehender Nachricht (`msg.received`, Text oder Standort) und `vibrate() === true` → `Haptics.vibrate({ duration: 200 })` (nur nativ).

## Akzeptanzkriterien
- [ ] Anzeigename speichert bei blur, nur wenn `isValidDisplayName`; sonst Fehlertext `name-invalid`.
- [ ] Schalter speichern sofort; Werte bleiben nach Neustart.
- [ ] „Trennen“ setzt Antenne auf `disconnected`; Statuspunkt wechselt.
- [ ] „Alle Daten löschen“ entfernt auch die Kontakte auf der Antenne; nach `ogMock.reboot()` sind sie nicht wieder da.
- [ ] Prüfbefehle grün.

## Hinweis
Der Schalter „Im Hintergrund empfangen“ speichert hier nur die Einstellung. Die Funktion folgt in T16 (Stretch).
