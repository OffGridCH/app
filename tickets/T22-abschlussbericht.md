# T22 – Abschlussbericht (Prozess-Doku)

**Abhängig von:** T15, T18
**Status-Hinweis:** Startet erst, wenn der Mensch es freigibt (M7 in `MEILENSTEINE.md`, in `STATUS.local.md` auf `offen` setzen).
**Ausführung:** Der Planner gibt dieses Ticket **direkt an `@documenter`** (kein Coder, kein Reviewer, kein Tester).
**Skills:** `offgrid-docs` (§7)
**Dateien:** `doku/bericht/**`, `mkdocs.yml` (nur `nav:`), `doku/index.md` (Link auf den Bericht), `doku/aenderungen.md`

## Ziel
Ein nachvollziehbarer Bericht, **wie** die App von Agents unter menschlicher Aufsicht entstanden ist – mit echten Zahlen.

## Quellen (nur diese, nichts erfinden)
- `tickets/PROTOKOLL.local.md` (Planner-Protokoll mit Zeitstempeln)
- `tickets/STATUS.local.md`, `tickets/STATUS.md`, `MEILENSTEINE.md`
- `tickets/FAZIT.local.md` (Text des Menschen, **wörtlich** übernehmen)
- `gh pr list --state all --limit 100 --json number,title,createdAt,mergedAt,state,additions,deletions,url`
- `git log --oneline main` (Anzahl Commits), `npm run test:ci` (Anzahl Tests/Testdateien aus der Ausgabe)

## Umfang
Seiten laut Skill `offgrid-docs` §7, `nav:` um „Abschlussbericht“ ergänzen, Eintrag in `aenderungen.md`.

## Akzeptanzkriterien
- [ ] Jede Zahl im Bericht ist aus einer der Quellen ableitbar (Quelle steht unter jeder Tabelle).
- [ ] Zeitstrahl als Mermaid-Gantt mit allen Tickets, die mindestens begonnen wurden.
- [ ] Meilenstein-Tabelle: Soll-Zeit, Ist-Zeit, eingehalten ja/nein.
- [ ] Fazit des Menschen wörtlich enthalten.
- [ ] `npm run docs:build` fehlerfrei.
