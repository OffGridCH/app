# 30 – Ablauf, Git, Rollen, Definition of Done

## Git-Regeln (gelten für alle)

- **Basis-Branch ist `main`.** Er ist geschützt: Niemand pusht oder committet dort. Änderungen kommen nur per
  Pull Request, und **nur der Mensch merged**.
- **Ein Ticket = ein Branch = ein PR.** Branch-Name: `feature/<Ticket-Dateiname ohne .md>`,
  z. B. `feature/T03-format-krypto`. Immer frisch ab aktuellem `main`.
- **Nur der `planner` macht Git-Operationen** (Branch anlegen, committen, pushen, PR eröffnen).
  Coder, Reviewer und Tester committen, pushen und wechseln nie den Branch.
- Commit-Nachricht: `T<nr>: <Ticket-Titel>`; Korrekturen nach PR-Feedback: `T<nr>: <kurz, was korrigiert wurde>`.
- Verboten: `git push` auf `main`, `--force`, `git rebase`, `git reset --hard`, `gh pr merge`, Branches löschen.

## Status

- `tickets/STATUS.md` (im Repo, fix): Liste der Tickets mit Abhängigkeiten. Wird **nicht** verändert.
- `tickets/STATUS.local.md` (**nicht** im Repo, steht in `.gitignore`): der Live-Status. Nur der `planner` schreibt sie.
  Fehlt sie, erzeugt der Planner sie aus `STATUS.md` mit allen Tickets auf `offen` (T16 `blockiert`).
- Status-Werte: `offen` · `in Arbeit` · `PR offen` · `fertig` · `blockiert`
  - `PR offen` = PR existiert, Mensch hat noch nicht gemerged.
  - `fertig` = **PR ist gemerged** (`gh pr view <branch> --json state` liefert `MERGED`). Nur dann gilt eine Abhängigkeit als erfüllt.

## Ablauf pro Ticket

0. **Synchronisieren:** Für jedes Ticket mit `PR offen` den PR-Status abfragen. `MERGED` → `fertig`.
   `CLOSED` (ohne Merge) → `blockiert`, Notiz „PR geschlossen – Mensch fragen“.
1. Erstes Ticket mit Status `offen` wählen, dessen Abhängigkeiten **alle `fertig`** sind.
   Keines da → melden, welche PRs auf einen Merge warten (mit Link), und **stoppen**.
2. `git switch main` → `git pull --ff-only` → `git switch -c feature/<ticket>`. Status `in Arbeit`.
3. `@coder` setzt um → `@reviewer` prüft → `@tester` testet (Details in `.kilo/agents/planner.md`).
   Bei FAIL zurück an den Coder, **maximal 2 Runden**, danach `blockiert`.
4. Alles `PASS`: `git add -A` → `git commit -m "T<nr>: <Titel>"` → `git push -u origin feature/<ticket>`
   → `gh pr create --base main --head feature/<ticket> --title "T<nr>: <Titel>" --body-file <datei>`.
   Status `PR offen`, PR-Link in die Notiz. Weiter mit Schritt 0.

## Änderungswünsche des Menschen an einem PR

Der Mensch schreibt z. B. „Korrigiere PR T03: <Wünsche>“ (oder Review-Kommentare, abrufbar mit `gh pr view <branch> --comments`):
`git switch feature/<ticket>` → `git pull --ff-only` → `@coder` mit den Wünschen → `@reviewer` → `@tester`
→ `git commit` → `git push`. Kein neuer PR. Status bleibt `PR offen`.

## Konflikte

Meldet `gh pr view <branch> --json mergeable` den Wert `CONFLICTING`: Status `blockiert`, Notiz
„Merge-Konflikt mit main – Mensch löst“. Der Planner löst Konflikte nicht selbst.

## Ergebnis-Format (Coder, Reviewer und Tester antworten immer so)

```
ERGEBNIS: PASS | FAIL | ERLEDIGT
TICKET: T<nr>
DATEIEN:
- <pfad> (neu | geändert | gelöscht)
PRÜFUNGEN:
- npm run lint: ok | fehler (<kurz>)
- npm run test:ci: ok | fehler (<kurz>)
- npm run build: ok | fehler (<kurz>)
MÄNGEL:            (nur Reviewer/Tester bei FAIL, nummeriert, mit Datei:Zeile und Regel/Skill-Abschnitt)
OFFENE FRAGEN:     (alles, was fehlte oder unklar war – sonst "keine")
```

## PR-Beschreibung (vom Planner, Datei unter `/tmp/offgrid-pr-<nr>.md`)

```
## T<nr> – <Titel>
Ticket: tickets/<datei>.md

### Ergebnis
- Reviewer: PASS (Runde <n>)
- Tester: PASS – lint ok · test:ci ok · build ok

### Geänderte Dateien
<Liste aus dem Coder-Ergebnis>

### Für dich zu prüfen
<OFFENE FRAGEN aller Agents, oder "nichts">
```

## Definition of Done (gilt für jedes Ticket)

- Alle Akzeptanzkriterien im Ticket sind erfüllt.
- `npm run lint`, `npm run test:ci`, `npm run build` ohne Fehler.
- Keine Dateien ausserhalb der im Ticket genannten Bereiche geändert.
- Keine Hex-Farben, keine erfundenen Texte, keine neuen Pakete (ausser erlaubt).
- Im Browser (`npm start`) mit Mock-Antenne bedienbar, sofern das Ticket UI enthält.
- Auf eigenem Branch committet, gepusht, PR gegen `main` eröffnet.
