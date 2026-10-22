# T99 – Probelauf (vor dem Marathon, kommt nie auf `main`)

**Start:** nur durch den Menschen mit dem Befehl `Probelauf` an den Planner. Steht **nicht** in `STATUS.md`.
**Dauer:** ca. 1,5–3 h, am Abend vor dem Marathon.
**Branch:** `feature/probelauf` (ein einziger Branch für alles).
**PR:** ein **Draft-PR** „PROBELAUF – nicht mergen“ gegen `main` – nur damit GitHub Actions laufen. Wird nie gemerged.

## Ziel
Die ganze Kette einmal echt durchspielen, damit am Marathon nichts Neues schiefgeht:
Kilo-Agents und ihre Rechte, Git-Ablauf, `gh`, Node/Angular-Starter, Tests mit WebCrypto, MkDocs, Playwright,
GitHub-Actions-Checks, Protokoll/Meilenstein-Check und der Weg aufs Handy (Windows + Android Studio).

## Ablauf (Planner)

1. **Vorbereitung:** `gh auth status`, `git status` (sauber, auf `main`), `git pull --ff-only`,
   `git switch -c feature/probelauf`. Eigene Dateien: `tickets/STATUS.probelauf.local.md` und
   `tickets/PROTOKOLL.probelauf.local.md` (statt der normalen). `START` protokollieren.
2. **Rechte-Test** (Ergebnis jeweils protokollieren). Es gibt zwei richtige Ergebnisse: `verweigert` bei A,
   `erlaubt` bei B. Ein Agent darf nichts können, was er nicht braucht – und muss alles können, was er braucht.
   Jeden Subagent-Auftrag so formulieren: „Führe `<befehl>` aus und melde nur das Ergebnis. Ändere nichts.“

   **A – Verweigerungen**

   | Wer | Befehl / Aktion | Erwartet |
   |---|---|---|
   | Planner selbst | `gh pr merge --help` | verweigert |
   | Planner selbst | `npm --version` | verweigert |
   | `@coder` | `git commit --allow-empty -m rechte-test` | verweigert |
   | `@reviewer` | Datei `rechte-test.txt` anlegen | verweigert |
   | `@tester` | `git push` | verweigert |
   | `@documenter` | `npm --version` | verweigert |

   **B – Positivkontrolle (diese Befehle müssen ohne Rückfrage laufen)**

   | Wer | Befehl | Erwartet |
   |---|---|---|
   | Planner selbst | `gh auth status` | erlaubt |
   | Planner selbst | `date -Iseconds` | erlaubt |
   | Planner selbst | `git fetch` | erlaubt |
   | Planner selbst | `ls tickets` | erlaubt |
   | `@coder` | `npm --version` | erlaubt |
   | `@reviewer` | `git status --short` | erlaubt |
   | `@reviewer` | `git diff main --stat` | erlaubt |
   | `@tester` | `npm run lint` | erlaubt |
   | `@tester` | `npm run test:ci` | erlaubt |
   | `@documenter` | `git status --short` | erlaubt |
   | `@documenter` | `npm run docs:build` | erlaubt |

   Hinweis: Vor T00 bzw. T21 gibt es `package.json` bzw. `mkdocs.yml` noch nicht. Dann zählt nur, dass der Befehl
   **gestartet** wurde (Fehler wie „Missing script“ oder „Config file not found“ = erlaubt). „Verweigert“ oder eine
   Rückfrage an den Menschen = Befund.

   Kommt bei B eine **Rückfrage** statt einer Ausführung, fehlt die Allow-Zeile in der Agent-Datei (die Rückfrage stammt
   aus der Rückfallebene `"bash": "ask"` in `kilo.jsonc`).

   Wird etwas **erlaubt**, das verweigert sein müsste, **oder** etwas verweigert bzw. nachgefragt, das erlaubt sein
   müsste: sofort stoppen und dem Menschen melden (Rechte reparieren).
3. **T00** komplett mit Coder → Reviewer → Tester (normaler Ablauf, aber **ohne** Warten auf Merge).
   Danach `git add -A`, `git commit -m "PROBELAUF T00"`, `git push -u origin feature/probelauf`,
   `gh pr create --draft --base main --head feature/probelauf --title "PROBELAUF – nicht mergen" --body "Probelauf vor dem Marathon. Nicht mergen, wird geschlossen."`.
4. **T21** auf demselben Branch (Coder → Reviewer → Tester), commit `PROBELAUF T21`, push.
   Danach zusätzlich `npm run docs:screens` über `@documenter` ausführen lassen (darf „übersprungen“ melden – es gibt noch keine Screens;
   wichtig ist, dass Playwright startet).
5. **T03** auf demselben Branch mit Coder → Reviewer → Tester → **Documenter** (testet die Krypto-Tests mit WebCrypto
   und den Doku-Schritt). Commit `PROBELAUF T03`, push.
6. **CI prüfen:** `gh pr checks feature/probelauf` – warten, bis `app-checks` und `docs-check` fertig sind (erneut abfragen).
7. **Meilenstein-Check** einmal ausführen (Mechanik testen; „Rückstand“ ist im Probelauf egal).
8. **Bericht:** `tickets/PROBELAUF.local.md` schreiben – Tabelle aller Prüfpunkte unten mit ok/fehler + Notiz, Dauer pro Ticket,
   Anzahl Review-/Test-Runden, alle OFFENEN FRAGEN der Agents. Dann `git switch main` und melden:
   `Probelauf fertig – Bericht in tickets/PROBELAUF.local.md`.

## Prüfpunkte (alle müssen ok sein)

| # | Prüfpunkt |
|---|---|
| P1 | Alle Rechte-Tests korrekt: jede Verweigerung verweigert **und** jede Positivkontrolle ohne Rückfrage ausgeführt |
| P2 | T00: Starter erzeugt, `npm run lint`/`test:ci`/`build` grün, `npx cap sync android` ok |
| P3 | T21: `npm run check` und `npm run docs:build` grün; Playwright startet |
| P4 | T03: alle Krypto-/Format-Tests grün (WebCrypto in Vitest funktioniert) |
| P5 | Documenter hat Doku für T03 geschrieben, `docs:build` grün |
| P6 | Draft-PR existiert; GitHub-Checks `app-checks` und `docs-check` grün |
| P7 | Protokoll enthält alle Schritte mit Zeitstempeln; Meilenstein-Check-Zeile vorhanden |
| P8 | Mensch: Windows `.\scripts\android.ps1 -Branch feature/probelauf` → App startet auf dem Handy (dunkle leere Seite) |
| P9 | Mensch: `npm run docs:serve` → Doku unter Windows `localhost:8000` sichtbar, Mermaid/Theme ok |
| P10 | Keine Agent-Rückfrage, die eine Skill-Lücke zeigt (sonst Skill vor dem Marathon ergänzen) |

## Aufräumen (Mensch, danach)
Siehe `LIES-MICH.md` → „Probelauf“. Kurz: Draft-PR schliessen, Branch löschen, lokal `git switch main` und `git clean -fdx`.
Gefundene Fehler in Skills/Tickets über einen eigenen Branch + PR korrigieren – **bevor** der Marathon startet.
