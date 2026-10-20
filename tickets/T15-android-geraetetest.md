# T15 – Android-Build und Gerätetest

**Abhängig von:** T06, T11, T12, T14
**Skills:** `offgrid-architecture`, `offgrid-antenna-protocol`
**Dateien:** `android/**` (nur Fehlerbehebungen), `test-protokoll/T15.md` (neu, Protokoll)

## Umfang
1. Mensch unter Windows: `scripts/android.ps1`, dann in Android Studio „Run“ (siehe `LIES-MICH.md`).
2. App auf zwei Handys installieren (Mensch, per WLAN-Debugging, weil der USB-C-Anschluss von der Antenne belegt ist). Coder schreibt nur Fehlerbehebungen, die aus dem Protokoll folgen.
3. Checkliste durchgehen und in `test-protokoll/T15.md` mit ok/fehler + Notiz festhalten:
   - [ ] Antenne einstecken → Berechtigungsdialog → „Funkmodul bereit“, FW wird angezeigt
   - [ ] Antenne ausstecken → „Antenne getrennt“ innerhalb 15 s
   - [ ] Handshake A zeigt / B scannt → beide sehen „Schlüssel ausgetauscht“ und das **gleiche Muster**
   - [ ] Nachricht A → B: B empfängt, A sieht „zugestellt“
   - [ ] Signalbalken ändern sich mit Abstand
   - [ ] Nachricht bei getrennter Antenne → Warteschlange → nach Einstecken gesendet
   - [ ] Export auf A, Import auf drittem Gerät (oder nach „Alle Daten löschen“) → Daten wieder da
   - [ ] App-Neustart: Kontakte/Nachrichten bleiben
   - [ ] App-Icon ist das OffGrid-Logo (vorher in Android Studio gesetzt, siehe `LIES-MICH.md` → Logo)

## Hinweis für den Planner
Dieses Ticket braucht einen Menschen mit zwei Geräten. Status `blockiert` mit Notiz „wartet auf Gerätetest“, bis der Mensch das Protokoll liefert.
