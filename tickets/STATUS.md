# Tickets und Abhängigkeiten

Diese Datei ist fix und wird **nicht** geändert. Der Live-Status steht in `tickets/STATUS.local.md`
(nicht im Repo, nur auf der VM; der Planner legt sie an). „fertig“ heisst dort: PR gemerged.

| Ticket | Titel | Abhängig von | Status | Datum | Notiz |
|---|---|---|---|---|---|
| T00 | Projekt-Setup und Theme | – | offen | | |
| T01 | UI-Basis 1: Grundkomponenten | T00 | offen | | |
| T02 | UI-Basis 2: Zustandskomponenten | T01 | offen | | |
| T03 | Zeitformate, Krypto-Basis, Schlüssel-Muster, Signal-Level | T00 | offen | | |
| T04 | Datenbank, Repositories, Settings, App-Start | T03 | offen | | |
| T05 | Antennen-Abstraktion, Frame-Codec, Mock-Antenne | T04 | offen | | |
| T06 | Natives USB-Serial-Plugin und SerialAntennaService | T05 | offen | | |
| T07 | MessagingService | T05 | offen | | |
| T08 | HandshakeService | T07 | offen | | |
| T09 | Screens Verbinden und Name, Onboarding-Guard | T02, T05 | offen | | |
| T10 | Screen Kontakte | T07, T09 | offen | | |
| T11 | Screens Kontakt hinzufügen und Kontakt benennen | T08, T10 | offen | | |
| T12 | Screen Chat | T07, T10 | offen | | |
| T13 | Screen Einstellungen und Vibration | T07, T09 | offen | | |
| T14 | Backup: Export und Import | T13 | offen | | |
| T15 | Android-Build und Gerätetest | T06, T11, T12, T14 | offen | | |
| T16 | (Stretch) Empfang im Hintergrund | T15 | blockiert | | wartet auf Freigabe durch Mensch |
