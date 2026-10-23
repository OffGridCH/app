# Funk-Protokoll

Das Funk-Protokoll zwischen den Antennen („Offgrid Protocol v1“, Firmware-Repo `docs/offgrid-protocol.md`) setzt die **Antenne** um. Die App baut keine Funkpakete,
verschlüsselt keine Nachrichten und kennt keine Kontaktschlüssel: Sie schickt Klartext über die [Host-API](serial.md) und bekommt geprüfte Nachrichten zurück.

Was die App davon wissen muss:

| Thema | Für die App |
|---|---|
| Nachrichtentypen | `text`, `reaction`, `geo` (Standort). Gruppen kennt Version 1 nicht |
| Textgrösse | 83 Bytes pro Nachricht (empfohlene Paketgrösse etwa 100 Bytes); längere Texte teilt die App |
| Zähler | Jede Nachricht hat in ihrer Unterhaltung einen Zähler `ctr` (0 bis 16777215); er dient als Nachrichten-Id und für Reaktionen (`ctr & 0xFFFF`) |
| Quittungen | Text wird standardmässig quittiert (`delivered`), Reaktion und Standort nicht |
| Weiterleiten | Das Netz leitet Pakete über Nachbarn weiter (Mesh); `relayed` heisst: ein Nachbar wurde beim Weitergeben gehört |
| Wiederholungen | Bis zu drei Wiederholungen ohne Quittung; danach `failed` mit Grund `timeout` |
| Geräte ohne Uhr | Die Antenne hat keine Zeit; Zeitstempel setzt die App |
| Reaktionen | Emoji-Tabelle in Appendix B des Protokolls; auf der Host-API steht das Emoji selbst |

Die Zahlen der Spezifikation stehen auf der Seite [Serial-Protokoll](serial.md). Alles Weitere (Paketformat, Verschlüsselung, Mesh-Regeln) gehört in die Doku des Firmware-Repos.
