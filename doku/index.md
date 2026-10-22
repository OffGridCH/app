# OffGrid

OffGrid ist eine Android-Chat-App, die ohne Mobilnetz funktioniert. Das Handy steckt per **USB-C (Serial)** an
einer ESP32-Antenne. Die App schreibt Nachrichten als Funk-Frames über **LoRa (868 MHz)**; die Antenne sendet sie
und empfängt Frames der Gegenstelle.

Kontakte kommen per **QR-Code-Handshake** hinzu: Beide Apps treffen sich einmal von Angesicht zu Angesicht und
tauschen dabei ihre Schlüssel aus. Jede Nachricht ist mit einem **pro Kontakt ausgetauschten Schlüssel**
verschlüsselt. Ohne Schlüssel kann niemand mitlesen – auch nicht, wenn jemand den Funkverkehr mitschneidet.

Dies ist das Zielbild der App. Gebaut sind bisher das Projektgerüst (T00), die CI mit der Doku (T21) und die erste
Logik-Welle: Zeitformate, Krypto-Basis, Schlüssel-Muster und Signal-Level (T03). Was sonst noch fehlt, steht in der
Tabelle [Stand der Funktionen](#stand-der-funktionen).

Dieses Repository enthält **nur die App** (Ionic + Angular + Capacitor). Die Firmware der Antenne liegt in einem
anderen Repository.

## Wie die App aufgebaut ist

Stand nach T00 und T03:

- **Oberfläche:** Angular-Standalone-Komponenten mit Signals, eingebunden in eine Ionic-Shell (Modus `md`).
- **Logik:** `src/app/core/` – Dienste ohne Oberfläche. Auf diesem Branch: `log.ts`, `platform.ts`, die Typen in
  `core/models/` sowie aus T03 `format/` (Zeit- und Funktexte), `crypto/` (AES-GCM, Hex, Base64, Schlüssel-Muster) und
  `messaging/` (Textlängen, Signal-Level).
- **Plattform-Weiche:** `isNative()` in `core/platform.ts` unterscheidet Browser und Android. Die Auswahl der
  passenden Implementierungen ist noch nicht eingebaut. Mehr dazu unter [Überblick](architektur/ueberblick.md).

!!! info "Geplant"
    Weitere Bausteine, die noch fehlen:

    - **Oberfläche:** eigene `og-`-Komponenten in `src/app/ui/` für jedes sichtbare Bedienelement (ab **T01**, **T02**).
    - **Logik:** Dienste für Datenbank und Einstellungen (ab **T04**), Antenne (ab **T05**), Nachrichten (ab **T07**),
      Handshake (ab **T08**), Backup (ab **T14**), Standort (ab **T17**).
    - **Plattform-Weiche:** Mock-Antenne und Datenbank im Speicher im Browser (ab **T04**, **T05**), auf Android
      das USB-Serial-Plugin und SQLite (ab **T06**).

## Stand der Funktionen

| Funktion | Stand | Ticket |
|---|---|---|
| Projekt-Setup, Design-Tokens, Schriften, Android-Gerüst | gebaut (Branch, nicht gemerged) | T00 |
| CI-Checks (lokal + GitHub Actions), Doku-Website | gebaut (Branch, nicht gemerged) | T21 |
| UI-Grundkomponenten (`og-button`, `og-card`, `og-text-field`, …) | geplant | T01, T02 |
| Zeitformate, Krypto-Basis, Schlüssel-Muster, Signal-Level | gebaut (Branch, nicht gemerged) | T03 |
| Datenbank, Repositories, Einstellungen, App-Start | geplant | T04 |
| Antennen-Abstraktion, Frame-Codec, Mock-Antenne | geplant | T05 |
| USB-Serial-Plugin und `SerialAntennaService` | geplant | T06 |
| Nachrichten: Senden, Empfangen, Warteschlange, Zustellstatus | geplant | T07 |
| Handshake: QR-Ablauf und Schlüsselaustausch | geplant | T08 |
| Screen „Verbinden“ und „Name“ (Onboarding) | geplant | T09 |
| Screen „Kontakte“ | geplant | T10 |
| Screens „Kontakt hinzufügen“ und „Kontakt benennen“ | geplant | T11 |
| Screen „Chat“ | geplant | T12 |
| Screen „Einstellungen“, Vibration | geplant | T13 |
| Backup: Export und Import | geplant | T14 |
| Standort: GPS-Kern und Oberfläche | geplant | T17, T18 |
| Android-Build und Gerätestest | geplant | T15 |
| Live-Standort (optional) | geplant | T19 |
| Empfang im Hintergrund (optional) | geplant | T16 |
| Gruppenchat (optional) | geplant | T20 |
| Abschlussbericht | geplant | T22 |

Die Werte in der Spalte **Stand**:

| Wert | Bedeutung |
|---|---|
| gebaut (Branch, nicht gemerged) | Der Code liegt auf einem Ticket-Branch, der PR ist aber noch nicht auf `main` gemerged. |
| geplant | Noch nicht gebaut. Das Ticket in der letzten Spalte nennt, was die Seite füllt. |
| fertig (gemerged) | Der PR des Tickets ist auf `main` gemerged. |

## Nächste Seiten

- [Erste Schritte](erste-schritte.md) – VM, Windows, Handy und die Befehle.
- [Services](architektur/services.md) – was in `src/app/core/` schon drin ist und was noch kommt.
- [Tests](qualitaet/tests.md) und [CI](qualitaet/ci.md) – was geprüft wird.
- [Änderungen](aenderungen.md) – was zuletzt gebaut wurde.