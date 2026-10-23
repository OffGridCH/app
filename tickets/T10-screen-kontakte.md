# T10 – Screen Kontakte (inkl. Leerzustand)

**Abhängig von:** T09, T23
**Skills:** `offgrid-screens` (§0, §3), `offgrid-design-system`
**Dateien:** `src/app/features/kontakte/`, `src/app/core/messaging/messaging.service.ts` (nur die Listen-Signals unten), `src/app/ui/avatar/` (nur Nutzung)
**Referenz:** `docs/design/screens/Kontakte.dc.html`, `KontakteLeer.dc.html`

## Umfang
Seite laut Skill: Header, Antennen-Statuszeile, Kontaktzeilen, ausstehende Zeilen, Footer-Button, Leerzustand.
Daten nur aus `MessagingService`, `SettingsService`, `AntennaPort` und `ContactRepository` (über `MessagingService`); Profilbild über `avatarPattern`.
Das Ticket ergänzt im `MessagingService` (Rest aus dem früheren T07): `contacts: Signal<ContactListItem[]>` (sortiert nach letzter Nachricht absteigend; Kontakte ohne
Nachricht nach Platz), `unreadCount(contactId)`, `signalLevel` pro Kontakt aus `lastRssi` und der `sentAt` der letzten eingehenden Nachricht (Skill `offgrid-screens` §0),
Neuladen per `effect` auf `DataChangedService.version`. Ausstehende Zeilen sind Kontakte mit `state === 'pending'`.

## Akzeptanzkriterien
- [ ] Im Browser: Aufbau und Masse wie die Referenz, Texte und Daten laut Skill (Reihenfolge Anna, Luca, Mia, dann Jonas ausstehend).
- [ ] Signalbalken: Anna 3, Luca 0, Mia 0 (Luca: letzte eingehende Nachricht älter als 15 min, Mia: nur ausgehende; die Antenne liefert keinen Zeitpunkt, die App stempelt selbst); `aria-label` laut Skill §0.
- [ ] Neue Nachricht via `window.ogMock.receive('Luca Bernasconi', 'Test')` schiebt Luca nach oben, Badge 1.
- [ ] Statuszeile wechselt bei `window.ogMock.drop()` auf „Antenne getrennt“.
- [ ] Leerzustand erscheint ohne Kontakte (Browser mit `localStorage og.noseed = '1'`, nach Onboarding).
- [ ] Beim Entsperren der Antenne erscheinen die Kontakte des Geräts (`syncContacts`).
- [ ] Prüfbefehle grün.
