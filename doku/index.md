# OffGrid

OffGrid ist eine Chat-App für Android, die **ohne Mobilnetz** funktioniert.

Das Handy steckt per **USB-C (Serial)** an einer ESP32-Antenne. Die Nachrichten gehen per **LoRa (868 MHz)** direkt
von Antenne zu Antenne – ohne Server, ohne Internet, ohne SIM-Karte. Kontakte kommen per **QR-Code-Handshake**
hinzu: Zwei Personen treffen sich, scannen sich gegenseitig einen QR-Code, und die Antennen tauschen dabei Schlüssel aus.
Jede Nachricht ist mit einem pro Kontakt abgeleiteten Schlüssel verschlüsselt.

**Die Antenne (Heltec V3) macht Funk und Krypto, die App ist Oberfläche und Verlaufsspeicher.** Die App spricht die Host-API
„Offgrid Link v1“ (JSON Lines über USB-Serial). Schlüssel, Zähler und Kontaktliste liegen auf der Antenne; die App hält nur das
Entsperr-Geheimnis im Android Keystore. Mehr dazu unter [Antenne](funktionen/antenne.md) und
[Serial-Protokoll](protokoll/serial.md).

## Womit die App gebaut ist

| Teil | Technologie |
|---|---|
| Oberfläche | Ionic 9, Angular 22 (Standalone-Komponenten, Signals, zoneless) |
| Native Hülle | Capacitor 8, Zielplattform Android |
| Tests | Vitest + jsdom über den Angular-Builder |
| Doku | MkDocs Material, veröffentlicht auf GitHub Pages |

## Wie die Doku zu lesen ist

Seiten, die noch nicht gebaut sind, tragen den Hinweis **„Geplant“** mit dem Ticket, das sie füllt. Alles, was ohne
Hinweis steht, ist im Code dieses Branches vorhanden.

| Einstieg | Inhalt |
|---|---|
| [Erste Schritte](erste-schritte.md) | Entwicklungsumgebung, Befehle, Browser-Demo |
| [Architektur](architektur/ueberblick.md) | Schichten, Ordner, Plattform-Weiche |
| [CI](qualitaet/ci.md) | Lokale Prüfungen und GitHub Actions |
| [Änderungen](aenderungen.md) | Was zuletzt gebaut wurde |

## Stand der Funktionen

| Funktion | Stand | Ticket |
|---|---|---|
| Projektgerüst, dunkles Theme, Design-Tokens | fertig | T00 |
| CI-Checks (Lint, Tests, Build) und Doku-Website | fertig | T21 |
| UI-Grundkomponenten (Icons, Buttons, Karten, Eingabefeld, Schalter) | fertig | T01 |
| UI-Zustandskomponenten (Avatar, Signalbalken, Banner, Schrittliste, Blase, Composer, QR) | geplant | T02 |
| Zeitformate, Hex/Base64, Signal-Level, Längenregeln für Texte | fertig | T03 |
| Datenbank, Repositories, Settings, App-Start | fertig | T04 |
| Host-API v1: Serial-Client, Antennen-Port, Mock-Gerät, Entsperr-Schlüssel, Nachrichten- und Kontaktdienste (ersetzt T05, T07, T08) | fertig | T23 |
| Natives USB-Serial-Plugin und natives Keystore-Plugin für Android | geplant | T06 |
| Seiten Kontakt hinzufügen und Kontakt benennen | geplant | T11 |
| Screens (Verbinden, Name, Kontakte, Chat, Einstellungen) | geplant | T09 bis T13 |
| Backup (Export und Import) | geplant | T14 |
| Standort (GPS, Entfernung, Richtung) | geplant | T17, T18 |
| Live-Standort (optional) | geplant | T19 |
| Gruppenchat (optional) | geplant | T20 |
