---
name: offgrid-docs
description: Regeln und Struktur für die Frontend-Dokumentation von OffGrid mit MkDocs Material (Ordner doku/) – Seitenaufbau, Diagramme, Änderungsverlauf, was pro Ticket zu dokumentieren ist. Laden durch den documenter und bei Ticket T21.
---

# OffGrid-Dokumentation (MkDocs Material)

Die Doku ist eine Website, gebaut mit **MkDocs + Material-Theme**, Quelle im Ordner **`doku/`**, Konfiguration
`mkdocs.yml`. Sie wird bei jedem Merge auf `main` per GitHub Actions auf GitHub Pages veröffentlicht.
**Achtung:** `docs/` ist ein anderer Ordner (Vorgaben für Agents) und wird nie verändert.

## 1. Grundsätze

1. **Nur Wahres:** Dokumentiert wird, was im Code auf dem aktuellen Branch existiert (`git diff main`, Dateien lesen)
   und was die Skills vorgeben. Nichts erfinden, nichts schönen.
2. **Geplantes kennzeichnen:** Noch nicht gebaute Teile nur als `!!! info "Geplant"` mit Ticket-Nummer erwähnen.
3. **Deutsch (Schweiz)**, kein „ß“. Kurze Sätze. Fachbegriffe beim ersten Auftreten kurz erklären.
4. **Nie App-Code ändern.** Der Documenter schreibt nur in `doku/**` und im Abschnitt `nav:` von `mkdocs.yml`.
5. `npm run docs:build` (= `mkdocs build --strict`) muss fehlerfrei laufen (keine toten Links, keine fehlenden Seiten).

## 2. Struktur (fix)

```
doku/
  index.md                      Was ist OffGrid, Funktionsumfang, Tabelle „Stand der Funktionen“ (fertig / geplant + Ticket)
  erste-schritte.md             Entwicklungsumgebung (VM, Windows, Handy), Befehle, Browser-Demo mit ogMock
  architektur/
    ueberblick.md               Schichten-Diagramm, Ordnerstruktur, Plattform-Weiche (Browser/Mock vs. Android)
    datenmodell.md              ER-Diagramm + Tabellenbeschreibung aus den Migrationen
    services.md                 Pro Service: Zweck, öffentliche Signals/Methoden (Tabelle), wer ihn nutzt
  funktionen/
    antenne.md                  Verbinden, Zustände (stateDiagram), Heartbeat, Fehler
    nachrichten.md              Senden/Empfangen, Status-Ablauf (stateDiagram), Warteschlange, Signalstärke
    kontakte-handshake.md       QR-Handshake (sequenceDiagram A ↔ B), Schlüssel-Muster
    standort.md                 GPS, Entfernung/Richtung, Karten-App, (Live-Standort falls gebaut)
    backup.md                   Export/Import, Dateiformat
  oberflaeche/
    design-system.md            Farben (Tabelle mit Token + Hex), Schriften, Komponenten (Name, Inputs, Outputs)
    screens.md                  Pro Screen: Route, Zweck, Zustände, wichtigste Texte
  protokoll/
    serial.md                   NDJSON-Befehle App ↔ Antenne
    funk-frames.md              Frame-Aufbau (Byte-Tabelle), Frame-Typen, Grössen
  qualitaet/
    tests.md                    Welche Testdateien was prüfen
    ci.md                       Lokale Checks und GitHub-Actions-Workflows
  aenderungen.md                Änderungsverlauf, neuester Eintrag oben
  assets/logo.svg               (aus docs/design/logo/offgrid-mark.svg, T21)
  stylesheets/extra.css         OffGrid-Farben für das Material-Theme (T21)
```

`gruppen.md` unter `funktionen/` kommt erst mit T20 dazu (dann auch in `nav:`).

## 3. Formate

- Diagramme mit Mermaid in Code-Blöcken ` ```mermaid ` (flowchart, sequenceDiagram, stateDiagram-v2, erDiagram).
  Diagramme zeigen den echten Ablauf aus Code/Skill – keine Fantasie-Kästen.
- Hinweise: `!!! note`, `!!! warning`, `!!! info "Geplant"`. Aufklappbar: `??? note "Details"`.
- Tabellen für APIs: `| Name | Typ | Beschreibung |`.
- Code-Ausschnitte nur kurz (≤ 15 Zeilen) und **wörtlich** aus dem Code, mit Pfad darüber: `` `src/app/core/…` ``.
- Links relativ zwischen Seiten (`../funktionen/antenne.md`). Keine externen Bilder.

## 4. Pro Ticket (Aufgabe des documenter)

1. `git diff main` und `git status` lesen; Ticket lesen.
2. Betroffene Seiten aus §2 aktualisieren bzw. ergänzen (Tabelle unten). Geplant-Hinweise entfernen, wenn jetzt gebaut.
3. In `index.md` die Tabelle „Stand der Funktionen“ nachführen.
4. In `aenderungen.md` oben einen Eintrag:
   ```
   ## T<nr> – <Ticket-Titel>
   *<YYYY-MM-DD>*

   - <was neu/anders ist, 2–6 Punkte, aus Sicht der App>
   ```
5. Bei Tickets mit Oberfläche (T09–T14, T18, T19, T20): `npm run docs:screens` und die Bilder in
   `oberflaeche/screens.md` einbinden (§6).
6. `npm run docs:build` – Fehler selbst beheben (max. 2 Versuche), sonst FAIL melden.

| Ticket | Seiten |
|---|---|
| T00, T21 | index, erste-schritte, architektur/ueberblick, qualitaet/ci |
| T01, T02 | oberflaeche/design-system |
| T03 | architektur/services, funktionen/kontakte-handshake (Schlüssel-Muster), funktionen/nachrichten (Signalstärke) |
| T04 | architektur/datenmodell, architektur/services |
| T05, T06 | funktionen/antenne, protokoll/serial, protokoll/funk-frames |
| T07 | funktionen/nachrichten, architektur/services |
| T08, T11 | funktionen/kontakte-handshake |
| T09, T10, T12, T13 | oberflaeche/screens |
| T14 | funktionen/backup |
| T17, T18, T19 | funktionen/standort, protokoll/funk-frames, oberflaeche/screens |
| T20 | funktionen/gruppen (neu), protokoll/funk-frames, architektur/datenmodell |
| alle mit Tests | qualitaet/tests |

## 6. Screenshots (Playwright)

- `npm run docs:screens` startet die App im Browser (Mock-Antenne, Demo-Daten) und speichert Handy-Screenshots
  (390×844, 2×) nach `doku/assets/screens/<name>.png`. Noch nicht gebaute Screens werden übersprungen.
- Namen: `verbinden`, `kontakte`, `kontakt-hinzufuegen`, `chat`, `chat-getrennt`, `standort-senden`, `standort-ansehen`,
  `einstellungen`, `export`, `import`.
- Einbinden in `oberflaeche/screens.md` je Screen-Abschnitt: `![Chat](../assets/screens/chat.png){ width="260" }`
  (nur Bilder, die existieren – sonst schlägt `--strict` fehl).
- `tools/screens.mjs` wird nie verändert.

## 7. Abschlussbericht (nur T22)

Ordner `doku/bericht/`, Navigation „Abschlussbericht“ mit diesen Seiten:

| Datei | Inhalt |
|---|---|
| `index.md` | Zusammenfassung in 5 Sätzen + Kennzahlen-Tabelle: Tickets fertig/gesamt, PRs gemerged, Commits auf `main`, Testdateien/Tests, Doku-Seiten, Gesamtdauer (START → letzter Merge), Ø Zeit pro Ticket |
| `zeitstrahl.md` | Mermaid `gantt` (`dateFormat YYYY-MM-DDTHH:mm`, `axisFormat %H:%M`): pro Ticket ein Balken von „in Arbeit“ bis Merge; Meilensteine als `milestone` |
| `meilensteine.md` | Tabelle M0–M8: Soll (T+h), Ist (Uhrzeit), eingehalten ja/nein, Bemerkung aus dem Protokoll |
| `qualitaet.md` | Review-Statistik: pro Ticket Runden Reviewer/Tester, Anzahl Mängel; häufigste verletzte Checklistenpunkte (A1–G4) als Tabelle; CI-Ergebnisse |
| `mensch-im-loop.md` | Rolle des Menschen: Merges, Ø Reaktionszeit (PR erstellt → gemerged), Korrekturwünsche, Entscheidungen, Stand-Checks, Notfälle (alles aus dem Protokoll) |
| `fazit.md` | Abschnitt „Fazit des Menschen“ = `tickets/FAZIT.local.md` **wörtlich**; danach „Beobachtungen aus dem Protokoll“ (nur belegbare Muster, je mit Ticket-Bezug) |

Unter jeder Tabelle in kursiv die Quelle, z. B. *Quelle: gh pr list, Stand <Datum>*.

## 8. Ergebnis-Format

Wie in `.kilo/rules/30-workflow.md`, mit `PRÜFUNGEN: - npm run docs:build: ok | fehler`.
