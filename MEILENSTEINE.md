# Meilensteine und Wächter-Regeln (für den Menschen)

Du bist der **Wächter**: Die Agents bauen, du entscheidest, prüfst und hältst den Zeitplan. Der Planner liest diese
Datei, vergleicht bei jedem Durchlauf den Stand mit dem nächsten fälligen Meilenstein und schreibt alles ins Protokoll.
Der Abschlussbericht (T22) zeigt am Ende, ob die Meilensteine gehalten wurden – auch deine.

**T+0:00** = Zeitpunkt, an dem du dem Planner zum ersten Mal `Start` schreibst. Er notiert ihn als `START` im Protokoll.

---

## Wächter-Regeln (gelten die ganzen 24 h)

| Nr. | Regel | Frist |
|---|---|---|
| W1 | **PR-Review:** Jeden PR ansehen, sobald der Planner „PR offen“ meldet: Abschnitt „Für dich zu prüfen“ lesen, Checks `app-checks` + `docs-check` grün, bei UI-Tickets die Screenshots in der Doku-Vorschau bzw. kurz im Browser (`localhost:4200`) anklicken. Dann **mergen** oder dem Planner `Korrigiere PR T<nr>: …` schreiben. | **≤ 30 Min** nach „PR offen“ |
| W2 | **Blockaden lösen:** Meldet der Planner `blockiert`, Notiz lesen und entscheiden (Frage beantworten, Ticket/Skill präzisieren, oder bewusst überspringen). | **≤ 20 Min** |
| W3 | **Stand-Check:** Alle 2 h dem Planner `Stand-Check` schreiben. Er zeigt Fortschritt gegen den Meilenstein. Du antwortest mit `Stand-Check: im Plan` oder `Stand-Check: Plan angepasst – <was>`. | alle **2 h** |
| W4 | **Kein Code am Planner vorbei:** Fehler gehen als Korrekturwunsch an den Planner, nicht als eigene Commits. Notfall-Ausnahme nur mit Protokolleintrag: dem Planner `Notfall: <was ich selbst geändert habe>` schreiben. | immer |
| W5 | **Scope-Disziplin:** Optionale Tickets (T19, T16, T20) nur freigeben, wenn M5 erreicht ist. Neue Ideen während des Marathons → Notiz in `tickets/IDEEN.local.md`, nicht umsetzen. | immer |
| W6 | **Absprache Firmware:** Mit dem Antennen-Kollegen kurz abgleichen (Schnittstelle, Stand, wann Gerätetest). Ergebnis dem Planner als `Firmware: <Stand>` schreiben. | **T+2 h, T+12 h, T+18 h** |
| W7 | **Pausen:** Zwei Pausen à 20 Min ohne Bildschirm, nicht während ein PR auf dich wartet. Vorher dem Planner `Pause 20` schreiben. | zwischen **T+6–9 h** und **T+15–18 h** |

---

## Meilensteine

Jeder Meilenstein hat Bedingungen. „Gemerged“ heisst: PR auf GitHub gemerged, Checks grün.

### M0 – Startklar · **T+0:00**
- [ ] **Probelauf (T99) am Vorabend bestanden** – alle Prüfpunkte P1–P10 ok, aufgeräumt, Fehler korrigiert
- [ ] `LIES-MICH.md` → „Einmalig einrichten“ komplett erledigt (Node ≥ 24.15, Commit + Push, `gh auth`, `main` gesperrt, Python venv)
- [ ] Kilo: `/reload`, Planner als Standard-Agent sichtbar
- [ ] Windows: Repo geklont, Android Studio öffnet, Handy per WLAN-Debugging gekoppelt
- [ ] Dem Planner `Start` geschrieben

### M1 – Fundament + Doku online · **T+2:00**
- [ ] T00 und T21 gemerged
- [ ] GitHub Pages zeigt die Doku (`https://offgridch.github.io/app/`)
- [ ] Checks `app-checks` und `docs-check` in der Regel für `main` als Pflicht gesetzt
- [ ] W6: Schnittstelle mit Kollegen besprochen, `docs/esp-schnittstelle.md` §7 ausgefüllt
- **Verfehlt?** T00/T21 haben Vorrang vor allem. Bei > 1 h Verspätung: Ursache im Protokoll, ggf. Setup von Hand reparieren (W4-Notfall).

### M2 – Bausteine · **T+6:00**
- [ ] T01, T02, T03, T04, T05 gemerged
- [ ] Im Browser: App startet mit Demo-Daten, Mock-Antenne wird „bereit“
- **Verfehlt?** Keine Massnahme ausser Tempo bei W1. Ab 1,5 h Verspätung: T06 (natives USB) ans Ende verschieben – dem Planner `T06 zurückstellen` schreiben.

### M3 – Kern-Logik · **T+10:00**
- [ ] T06, T07, T08, T09 gemerged (T06 darf bei Zurückstellung fehlen)
- [ ] Onboarding im Browser durchklickbar
- **Verfehlt?** T19/T16/T20 sind damit gestrichen. Bei > 2 h: T14 (Backup) zurückstellen.

### M4 – Erste komplette Demo · **T+14:00**
- [ ] T10, T11, T12, T17 gemerged
- [ ] Browser-Demo: Kontakt hinzufügen (ogMock) → Nachricht senden → „zugestellt“
- [ ] W6 (T+12 h): Firmware-Stand bekannt, Termin für Gerätetest fix
- **Verfehlt?** Ab jetzt nur noch Pflicht. T13 auf das Nötigste prüfen, keine Korrekturwünsche zu Kosmetik.

### M5 – Feature-komplett · **T+17:00**
- [ ] T13, T14, T18 gemerged
- [ ] APK läuft auf beiden Handys (mit `og.mock = 1` oder echter Antenne)
- [ ] Entscheidung über optionale Tickets getroffen und dem Planner mitgeteilt (W5)
- **Verfehlt?** Keine optionalen Tickets. Standort-UI (T18) hat Vorrang vor Backup (T14).

### M6 – Gerätetest · **T+20:00**
- [ ] T15 durchgeführt, `test-protokoll/T15.md` ausgefüllt – oder schriftlich begründet, warum nicht (z. B. Firmware nicht bereit)
- [ ] Gefundene Fehler als Korrekturwünsche an den Planner
- **Verfehlt?** Demo im Browser vorbereiten (Plan B), Gerätetest so weit wie möglich nachholen.

### M7 – Code-Freeze · **T+22:00**
- [ ] Keine neuen Tickets mehr. Nur noch Fixes aus T15.
- [ ] `tickets/FAZIT.local.md` geschrieben (5–10 Sätze, deine Sicht: was lief gut, was nicht, was würdest du ändern)
- [ ] T22 (Abschlussbericht) freigegeben und gestartet
- **Verfehlt?** Freeze trotzdem einhalten. Offene Tickets kommen als „nicht fertig“ in den Bericht – das ist ehrlich und ok.

### M8 – Präsentation bereit · **T+23:00**
- [ ] T22 gemerged, Bericht online
- [ ] Demo-Ablauf zweimal geprobt (Handy mit Antenne **und** Browser-Plan-B)
- [ ] Doku-Startseite, Bericht und Zeitstrahl im Browser offen

### Abgabe · **T+24:00**

---

## Demo-Ablauf (Vorschlag für die Präsentation, 5–7 Min)
1. Problem + Idee (30 s) – Logo, ein Satz.
2. Live: Antenne einstecken → Kontakt per QR hinzufügen → Nachricht → „zugestellt“ → Standort senden → Entfernung/Richtung.
3. Doku-Website: Architektur-Diagramm, Handshake-Sequenz, Screens.
4. Abschlussbericht: Kennzahlen, Zeitstrahl, Review-Statistik, deine Rolle als Wächter.
5. Ehrliche Grenzen + nächste Schritte.
