# Tickets

- Ein Ticket = eine Datei `T<nr>-<kurzname>.md` = ein Branch `feature/T<nr>-<kurzname>` = ein PR gegen `main`.
- Abhängigkeiten stehen in `STATUS.md` (fix), der Live-Status in `STATUS.local.md` (nur lokal).
- Aufbau jedes Tickets: Abhängig von · Skills · Dateien · (Referenz) · Ziel/Umfang · Akzeptanzkriterien · Tests · Nicht im Umfang.
- „Prüfbefehle grün“ heisst: `npm run lint`, `npm run test:ci`, `npm run build` ohne Fehler.
- Neue Tickets schreibt nur der Mensch (oder der Planner auf ausdrücklichen Auftrag), im selben Aufbau.

Kritischer Pfad: T00 → T21 (CI + Doku) → T03 → T04 → T05 → T07 → T08 → T11. Standort (wichtig): T07 → T17 → T18 (braucht T12).
Optional, nur auf Freigabe des Menschen, in dieser Reihenfolge: T19 Live-Standort → T16 Hintergrund → T20 Gruppenchat.
Parallel möglich (wenn mehrere Sessions laufen): T01/T02 neben T03–T05; T06 neben T07.
