# OffGrid – Projektanweisungen für alle Agents

OffGrid ist eine Android-Chat-App, die ohne Mobilnetz funktioniert. Das Handy ist per **USB-C (Serial)** mit einer
ESP32-Antenne verbunden, die Nachrichten per **LoRa (868 MHz)** sendet und empfängt. Kontakte werden per
QR-Code-Handshake hinzugefügt, jede Nachricht ist mit einem pro Kontakt ausgetauschten Schlüssel verschlüsselt.

Dieses Repo enthält **nur die App** (Ionic + Angular + Capacitor). Die Firmware der Antenne liegt in einem anderen Repo.

## Die 7 Grundregeln (immer gültig)

1. **Arbeite nur am aktuellen Ticket.** Ein Ticket liegt in `tickets/`. Mach nichts, was dort nicht verlangt ist.
   Keine „Verbesserungen“ nebenbei, keine zusätzlichen Features, keine Umbenennungen ausserhalb des Tickets.
2. **Lade vor dem Arbeiten die Skills, die im Ticket unter „Skills“ stehen.** Die Skills sind verbindlich.
   Wenn Ticket und Skill sich widersprechen, gilt der Skill und du meldest den Widerspruch.
3. **Erfinde nichts.** Keine Farben, Abstände, Texte, Icons, Pakete, Datenbankfelder oder Protokollfelder,
   die nicht in einem Skill oder Ticket stehen. Fehlt etwas: stoppen und im Ergebnis unter „Offene Fragen“ melden.
4. **Alle sichtbaren Texte sind Deutsch (Schweiz):** kein „ß“, immer „ss“ (z. B. „anschliessen“, „Grüsse“).
   Texte stehen wörtlich im Skill `offgrid-screens` – exakt übernehmen.
5. **Keine neuen npm-Pakete** ausser denen in Skill `offgrid-architecture` → „Erlaubte Pakete“.
6. **Fertig heisst:** `npm run lint`, `npm run test:ci` und `npm run build` laufen ohne Fehler (siehe Skill `offgrid-testing`).
7. **Git:** `main` ist geschützt. Ein Ticket = ein Branch `feature/<ticket>` = ein PR. Nur der Planner committet,
   pusht und eröffnet PRs; gemerged wird nur vom Menschen (Details `.kilo/rules/30-workflow.md`).
8. **Ändere nie** `AGENTS.md`, `kilo.jsonc`, `LIES-MICH.md`, `.kilo/**`, `docs/**`, `scripts/**` – ausser ein Ticket verlangt es ausdrücklich.

## Wo was steht

| Thema | Ort |
|---|---|
| Ablauf, Rollen, Definition of Done | `.kilo/rules/30-workflow.md` |
| Stack, Ordner, Befehle | `.kilo/rules/00-projekt.md` und Skill `offgrid-architecture` |
| Code-Konventionen Angular/Ionic | `.kilo/rules/10-angular-ionic.md` |
| Farben, Schriften, Komponenten | Skill `offgrid-design-system` |
| Jeder Screen inkl. Texte und Zustände | Skill `offgrid-screens` |
| Datenbank | Skill `offgrid-data` |
| Antenne / Serial / LoRa-Pakete | Skill `offgrid-antenna-protocol` |
| Schlüssel, Handshake, Verschlüsselung, Backup | Skill `offgrid-crypto-handshake` |
| Tests | Skill `offgrid-testing` |
| Review-Checkliste | Skill `offgrid-review` |
| Design-Referenz (HTML aus dem Canvas) | `docs/design/screens/*.dc.html` |
| Tickets, Abhängigkeiten, Live-Status | `tickets/`, `tickets/STATUS.md`, `tickets/STATUS.local.md` (lokal) |

## Agents

- `planner` (primär): wählt das nächste Ticket, legt den Branch an, delegiert, committet, pusht, eröffnet den PR,
  pflegt `tickets/STATUS.local.md`. Schreibt keinen App-Code, merged nie.
- `coder` (Subagent): setzt genau ein Ticket um.
- `reviewer` (Subagent): prüft read-only gegen `offgrid-review`. Ergebnis `PASS` oder `FAIL` mit Liste.
- `tester` (Subagent): schreibt/führt Tests aus, prüft Lint und Build. Ergebnis `PASS` oder `FAIL`.
