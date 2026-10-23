# Tickets und Abhängigkeiten

Diese Datei enthält die Abhängigkeiten. Der Live-Status steht in `tickets/STATUS.local.md`
(nicht im Repo, nur auf der VM; der Planner legt sie an). „fertig“ heisst dort: PR gemerged.
Die Status-Spalte hier ist ein Stand vom 2026-10-24 (nach T23); weiter gepflegt wird nur `STATUS.local.md`.

| Ticket | Titel | Abhängig von | Status | Datum | Notiz |
|---|---|---|---|---|---|
| T00 | Projekt-Setup und Theme | – | fertig | 2026-10-23 | PR #5 gemerged |
| T21 | CI-Checks und Doku-Grundgerüst (MkDocs, GitHub Pages) | T00 | fertig | 2026-10-23 | PR #6 gemerged |
| T01 | UI-Basis 1: Grundkomponenten | T00, T21 | fertig | 2026-10-23 | PR #7 gemerged |
| T02 | UI-Basis 2: Zustandskomponenten | T01 | offen |  |  |
| T03 | Zeitformate, Hex/Base64, Signal-Level, Längenregeln | T00, T21 | fertig | 2026-10-23 | PR #8 gemerged (Krypto-Dienste und Schlüssel-Muster mit T23 entfallen) |
| T04 | Datenbank, Repositories, Settings, App-Start | T03 | fertig | 2026-10-24 | PR #11 gemerged |
| T23 | Protokoll auf Offgrid Link v1 umstellen | T03, T04 | fertig | 2026-10-24 | PR #12 gemerged; ersetzt T05, T07, T08 |
| T05 | Antennen-Abstraktion, Frame-Codec, Mock-Antenne – **ersetzt durch T23** | T04 | fertig | 2026-10-24 | nicht starten: durch T23 erledigt (PR #12) |
| T06 | Natives USB-Serial-Plugin, UsbSerialTransport und Keystore-Plugin | T23 | offen |  |  |
| T07 | MessagingService – **ersetzt durch T23** | T05 | fertig | 2026-10-24 | nicht starten: Kern durch T23 erledigt (PR #12); Listen für die Seiten kommen in T10, T12, T13 |
| T08 | HandshakeService – **ersetzt durch T23** | T07 | fertig | 2026-10-24 | nicht starten: Kern durch T23 erledigt (PR #12); Scanner und `scan()` kommen in T11 |
| T09 | Screens Verbinden und Name, Onboarding-Guard | T02, T23 | offen |  |  |
| T10 | Screen Kontakte | T09, T23 | offen |  |  |
| T11 | Screens Kontakt hinzufügen und Kontakt benennen | T10, T23 | offen |  |  |
| T12 | Screen Chat | T10, T23 | offen |  |  |
| T13 | Screen Einstellungen und Vibration | T09, T23 | offen |  |  |
| T14 | Backup: Export und Import | T13 | offen | | |
| T17 | Standort: Kern (GPS, Geo-Funktionen) | T23 | offen |  |  |
| T18 | Standort: Oberfläche (Sheet, Bubble, Standort-Seite) | T12, T17 | offen | | |
| T15 | Android-Build und Gerätetest | T06, T11, T12, T14, T18 | offen | | |
| T19 | (Optional) Live-Standort | T18 | blockiert | | optional – wartet auf Freigabe durch Mensch |
| T16 | (Optional) Empfang im Hintergrund | T15 | blockiert | | optional – wartet auf Freigabe durch Mensch |
| T20 | (Optional, zuletzt) Gruppenchat | T15 | blockiert | | optional – wartet auf Freigabe durch Mensch |
| T22 | Abschlussbericht (Prozess-Doku) | T15, T18 | blockiert | | startet bei M7 – Freigabe durch Mensch |
