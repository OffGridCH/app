# Tickets

- Ein Ticket = eine Datei `T<nr>-<kurzname>.md` = ein Branch `feature/T<nr>-<kurzname>` = ein PR gegen `main`.
- Abhängigkeiten stehen in `STATUS.md` (fix), der Live-Status in `STATUS.local.md` (nur lokal).
- Aufbau jedes Tickets: Abhängig von · Skills · Dateien · (Referenz) · Ziel/Umfang · Akzeptanzkriterien · Tests · Nicht im Umfang.
- „Prüfbefehle grün“ heisst: `npm run lint`, `npm run test:ci`, `npm run build` ohne Fehler.
- Neue Tickets schreibt nur der Mensch (oder der Planner auf ausdrücklichen Auftrag), im selben Aufbau.

Kritischer Pfad: T00 → T21 (CI + Doku) → T03 → T04 → T23 (Host-API, Antenne, Nachrichten, Kontakte) → T09 → T10 → T11. Standort (wichtig): T23 → T17 → T18 (braucht T12).
T23 hat T05, T07 und T08 ersetzt (die Dateien bleiben als Verweis liegen).
Optional, nur auf Freigabe des Menschen, in dieser Reihenfolge: T19 Live-Standort → T16 Hintergrund → T20 Gruppenchat.
Parallel möglich (wenn mehrere Sessions laufen): T02 neben T06 und T09; T06 neben den Seiten-Tickets.
