# T15 – Android-Build und Gerätetest

**Abhängig von:** T06, T11, T12, T14, T18
**Skills:** `offgrid-architecture`, `offgrid-antenna-protocol`, `offgrid-crypto-handshake`
**Dateien:** `android/**` (nur Fehlerbehebungen), `test-protokoll/T15.md` (neu, Protokoll)

## Umfang
1. Mensch unter Windows: `scripts/android.ps1`, dann in Android Studio „Run“ (siehe `LIES-MICH.md`).
2. App auf zwei Handys installieren (Mensch, per WLAN-Debugging, weil der USB-C-Anschluss von der Antenne belegt ist). Coder schreibt nur Fehlerbehebungen, die aus dem Protokoll folgen.
3. Checkliste durchgehen und in `test-protokoll/T15.md` mit ok/fehler + Notiz festhalten:
   - [ ] Frische Antenne einstecken → Berechtigungsdialog → Name eingeben → Antenne ist eingerichtet und „Funkmodul bereit“, FW wird angezeigt
   - [ ] Eingerichtete Antenne einstecken → wird ohne Eingabe entsperrt (Keystore-Schlüssel), „Funkmodul bereit“
   - [ ] Antenne bleibt entsperrt; nach 15 s ohne App (App schliessen) sperrt sie sich, beim Öffnen entsperrt die App sie wieder
   - [ ] Antenne anderes Handy: Entsperren schlägt fehl (`unlock-failed`), nach drei Versuchen `rate-limited`
   - [ ] Antenne ausstecken → „Antenne getrennt“ innerhalb 15 s
   - [ ] Pairing: A zeigt / B scannt und umgekehrt → beide sehen „Schlüssel ausgetauscht“ und den **gleichen Fingerabdruck**; der Kontakt wird nach der ersten Nachricht `active`
   - [ ] Nachricht A → B: B empfängt, A sieht „zugestellt“; ein Text über 83 Bytes kommt als mehrere Nachrichten an
   - [ ] Signalbalken ändern sich mit Abstand
   - [ ] Nachricht bei getrennter Antenne → Warteschlange → nach Einstecken gesendet
   - [ ] Export auf A, Import auf drittem Gerät (oder nach „Alle Daten löschen“) → Daten wieder da
   - [ ] Standort: Berechtigungsdialog erscheint; im Freien Fix mit Genauigkeit < 30 m
   - [ ] Standort A → B: B sieht Entfernung und Richtung, die zur Realität passen (z. B. 200 m Abstand testen)
   - [ ] „In Karten-App öffnen“ öffnet die installierte Offline-Karten-App an der richtigen Stelle
   - [ ] App-Neustart: Kontakte/Nachrichten bleiben
   - [ ] App-Icon ist das OffGrid-Logo (vorher in Android Studio gesetzt, siehe `LIES-MICH.md` → Logo)

## Hinweis für den Planner
Dieses Ticket braucht einen Menschen mit zwei Geräten. Status `blockiert` mit Notiz „wartet auf Gerätetest“, bis der Mensch das Protokoll liefert.
