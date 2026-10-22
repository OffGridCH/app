# OffGrid – Setup und Arbeitsweise (für dich, nicht für die Agents)

## Was drin ist

```
AGENTS.md                  Grundregeln, liest Kilo automatisch
kilo.jsonc                 lädt .kilo/rules/*
.kilo/rules/               Projekt/Umgebung, Code-Konventionen, Ablauf + Definition of Done
.kilo/agents/              planner (primär), coder, reviewer, tester, documenter (Subagents, eigene Sessions)
.kilo/skills/              8 Skills (Design-System + tokens.scss, Screens, Architektur, Daten,
                           Antennen-Protokoll, Krypto/Handshake, Tests, Review)
docs/design/               Design-Referenz (Screens + Logo)
docs/esp-schnittstelle.md  Vorschlag für deinen Kollegen (Serial-Protokoll)
docs/datenmodell.md        Änderungen am ERD mit Begründung
scripts/android.ps1        baut unter Windows und öffnet Android Studio
tickets/                   T00–T22, STATUS.md (Abhängigkeiten), STATUS.local.md / PROTOKOLL.local.md (nur lokal)
MEILENSTEINE.md            deine Meilensteine und Wächter-Regeln
tools/screens.mjs          Playwright-Screenshots für die Doku
```

## Deine Umgebung – so spielt alles zusammen

```
 Linux-VM (VS Code Remote-SSH)                 Windows-PC                         Handy
 ─────────────────────────────                 ──────────                         ─────
 Repo + Kilo-Agents                            2. Klon desselben Repos            App läuft hier,
 Code, Lint, Tests, Web-Build    ── git push ─▶ scripts/android.ps1   ── WLAN ──▶ Antenne steckt
 npm start (Browser + Mock)         GitHub     Android Studio → Run     Debugging   im USB-C-Port
```

- **Entwickeln** passiert nur auf der VM. Die Agents brauchen dort kein Android.
- **Aufs Handy** geht es über Windows: Repo dort ein zweites Mal klonen, `scripts/android.ps1` ausführen, in Android Studio „Run“.
- **WLAN-Debugging statt Kabel:** Der USB-C-Anschluss des Handys ist von der Antenne belegt. Darum verbindet sich
  Android Studio per WLAN mit dem Handy (Handy und PC im selben WLAN).

## Einmalig einrichten

### VM
1. `node -v` muss **≥ 24.15** sein (Angular 22 verlangt das). Sonst z. B. mit nvm: `nvm install 24 && nvm alias default 24`.
2. Inhalt dieses Pakets ins Repo kopieren und **zuerst committen und pushen** – **bevor** du `main` sperrst:
   `git add -A && git commit -m "Planung, Regeln, Skills, Tickets" && git push -u origin main`
   (Ist `main` schon gesperrt: auf einen Branch `setup/planung` pushen und per PR mergen.)
3. **GitHub CLI** auf der VM: `gh` installieren, dann `gh auth login` (GitHub.com, HTTPS, mit Browser oder Token mit
   Rechten *repo*). Prüfen: `gh auth status`. Damit eröffnet der Planner die PRs.
4. **`main` sperren** (GitHub → Settings → Branches/Rulesets → Regel für `main`): *Require a pull request before merging*,
   *Block force pushes*, *Restrict deletions*. Optional *Require approvals: 1* – dann musst du selbst approven.
   Ist dein geschützter Branch nicht `main`, sondern `master`: in `.kilo/rules/30-workflow.md` und
   `.kilo/agents/planner.md` überall `main` durch `master` ersetzen.
5. **Berechtigungen:** In der globalen Kilo-Konfiguration (`~/.config/kilo/kilo.jsonc`) darf `permission.bash` nicht
   pauschal `deny` sein – sonst überstimmt das die Agent-Dateien und der Planner kann nicht committen.
   Global z. B. `"permission": { "bash": "ask" }`; die feinen Regeln stehen bereits in `.kilo/agents/*.md`.
   Danach in Kilo `/reload` → Agent `planner` muss auswählbar sein, `@coder` in der Erwähnungsliste erscheinen.
   Falls Kilo die Befehls-Muster unter `permission.bash` in `.kilo/agents/*.md` nicht akzeptiert: dort auf `bash: ask`
   (Reviewer: `bash: deny`) vereinfachen.
6. Optional: `docs/esp-schnittstelle.md` mit dem Kollegen durchgehen und Abschnitt 7 ausfüllen.

### Windows
1. **Node 24 LTS** (≥ 24.15) von nodejs.org und **Git** installieren.
2. Repo klonen, z. B. `git clone https://github.com/OffGridCH/app.git C:\dev\offgrid`.
3. PowerShell darf Skripte ausführen: einmal `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
4. Android Studio (deine Version *2026.2.1* passt). Beim ersten Öffnen des Projekts:
   - Fragt Studio nach einem **AGP-/Gradle-Upgrade: ablehnen** („Don't ask for this project“). Capacitor gibt die Versionen vor.
   - Fehler wie *Unsupported class file major version* → *Settings → Build, Execution, Deployment → Build Tools → Gradle →
     Gradle JDK* auf ein **JDK 21** stellen (im Dropdown „Download JDK…“ → Version 21).

### Handy (einmal)
1. *Einstellungen → Über das Telefon → Build-Nummer* 7× antippen → Entwickleroptionen sind an.
2. *Entwickleroptionen → Kabelloses Debugging* einschalten.
3. Android Studio: oben in der Geräteauswahl → **Pair Devices Using Wi-Fi** → QR-Code mit dem Handy scannen
   (*Kabelloses Debugging → Gerät mit QR-Code koppeln*).

## Probelauf (am Abend vor dem Marathon, Pflicht)

Ziel: Alles einmal echt testen, ohne dass etwas auf `main` kommt. Dauer ca. 1,5–3 h.

1. Einrichtung oben komplett erledigt (inkl. `gh auth login`, `main` gesperrt, GitHub Pages auf „GitHub Actions“).
2. In Kilo Agent `planner` → **`Probelauf`** schreiben. Er arbeitet `tickets/T99-probelauf.md` ab: Rechte-Test der Agents,
   dann T00, T21 und T03 auf dem Branch `feature/probelauf`, mit einem **Draft-PR** „PROBELAUF – nicht mergen“.
3. Während er läuft, du (Prüfpunkte P8/P9):
   - Windows: `.\scripts\android.ps1 -Branch feature/probelauf` → Android Studio → Handy wählen → Run → dunkle App startet.
   - VM: `npm run docs:serve` → Windows-Browser `http://localhost:8000` → Doku sichtbar.
4. Bericht lesen: `tickets/PROBELAUF.local.md`. Alles ok? Sonst Skills/Tickets korrigieren (Branch `setup/fix-…` + PR) und
   den Probelauf wiederholen.
5. **Aufräumen** (wichtig, damit der Marathon sauber startet):
   - GitHub: Draft-PR **schliessen** (nicht mergen), Branch `feature/probelauf` löschen.
   - VM: `git switch main && git pull --ff-only && git branch -D feature/probelauf && git clean -fdx`
     (`clean -fdx` entfernt alles Ungetrackte inkl. `node_modules`, `.venv-docs` und der lokalen Protokolle).
   - Windows: `git switch main && git branch -D feature/probelauf && git clean -fdx`.

### Agent-Rechte (wenn du sie anpasst)
- In jeder Agent-Datei steht `"*"` als **erste** Zeile im `bash:`-Block (`deny`, beim Coder `allow`), darunter die
  Ausnahmen. So greift die Agent-Regel, egal ob Kilo „spezifisch vor Wildcard“ oder „letzte Zeile gewinnt“ auswertet.
- Rückfallebene: `kilo.jsonc` → `"permission": { "bash": "ask" }` (nur dieses Projekt). Die globale
  `~/.config/kilo/kilo.json` bleibt, wie sie ist.
- Fragt Kilo dich während des Marathons nach einer Freigabe, fehlt in der Agent-Datei eine Allow-Zeile. Einmal freigeben,
  nach dem Marathon (oder im nächsten Setup-PR) ergänzen.
- Planner, Reviewer, Tester und Documenter dürfen nur lesende Befehle zusätzlich (`ls`, `wc`, `head`, `tail`, `grep`, `rg`,
  `git show`/`log`). Bewusst **nicht**: `cat` (`cat > datei`), `sed` (`-i`), `find` (`-delete`), `python3`.

### Setup-Änderungen committen
Nie direkt auf `main` (gesperrt – der Commit liesse sich nicht pushen und `git pull --ff-only` bricht später ab).
Immer: `git switch -c setup/<thema>` → commit → `git push -u origin setup/<thema>` → `gh pr create --base main` → selbst
mergen → `git switch main && git pull --ff-only`. Liegt ein Commit schon versehentlich auf dem lokalen `main`:
`git switch -c setup/<thema>` (nimmt ihn mit), pushen, PR, mergen, dann `git switch main && git fetch && git reset --hard origin/main`.

## Täglicher Ablauf

### Agents arbeiten lassen (VM)
Agent **planner** wählen und schreiben:
> Start – arbeite die Tickets laut .kilo/rules/30-workflow.md ab.

Das Wort **`Start`** setzt T+0:00 für die Meilensteine. **Lies vorher `MEILENSTEINE.md`** – dort stehen deine
Fristen (PR-Review Ziel ≤ 30 Min, Mahnung ab 60 Min, Blockaden ≤ 20 Min, Stand-Check alle 2 h …) und die Meilensteine M0–M8. Der Planner
erinnert dich, wenn du eine Frist reisst, und alles landet im Protokoll für den Abschlussbericht.

Weitere Befehle an den Planner: `weiter`, `Stand-Check`, `Stand-Check: im Plan`, `Korrigiere PR T<nr>: …`,
`T<nr> zurückstellen`, `Firmware: …`, `Pause 20`, `Notfall: …`.

**So läuft es mit PRs:** Pro Ticket legt der Planner `feature/T<nr>-…` an, lässt Coder/Reviewer/Tester arbeiten,
committet, pusht und eröffnet einen PR gegen `main`. Hängt das nächste Ticket von einem noch nicht gemergten PR ab,
stoppt er mit „Warte auf Merge: …“ und den Links. Dann:
1. PR auf GitHub ansehen (Abschnitt „Für dich zu prüfen“), ggf. im Browser oder auf dem Handy testen (siehe unten).
2. Passt → **Merge** auf GitHub. Passt nicht → dem Planner schreiben: `Korrigiere PR T03: <was>` oder
   `Arbeite die Review-Kommentare von PR T03 ab` (wenn du auf GitHub kommentiert hast).
3. Dem Planner `weiter` schreiben – er erkennt gemergte PRs selbst und macht mit dem nächsten Ticket weiter.

Tipp für den Marathon: T01/T02 und T03 hängen beide nur von T00 ab – nach dem Merge von T00 laufen sie nacheinander,
ohne dass du dazwischen mergen musst. Den aktuellen Stand siehst du in `tickets/STATUS.local.md`.

Einzelnes Ticket: Agent `coder` → `Setze Ticket tickets/T10-screen-kontakte.md um. Lade zuerst alle Skills aus dem Abschnitt "Skills".`
Review von Hand: `@reviewer Prüfe Ticket tickets/T10-screen-kontakte.md`.

### Im Browser ansehen (VM → Windows-Browser)
`npm start` auf der VM. VS Code leitet den Port automatisch weiter → unter Windows `http://localhost:4200` öffnen.
Mit F12 → Gerätesymbol auf Handy-Grösse stellen. Mock steuern in der Browser-Konsole:
`ogMock.receive('Anna Meier', 'Hallo')`, `ogMock.receiveLocation('Anna Meier')`, `ogMock.completeShowing()`, `ogMock.drop()`,
`ogMock.restore()`, `ogMock.failNext()`.
Onboarding/Leerzustand testen: `localStorage.setItem('og.noseed','1')` und neu laden (zurück: `removeItem`).

### Aufs Handy (Windows)
1. Der Planner pusht jeden Ticket-Branch selbst.
2. Windows-PowerShell im Repo: `.\scripts\android.ps1` (holt `main`, baut, kopiert, öffnet Android Studio).
   Einen **PR vor dem Merge** auf dem Handy testen: `.\scripts\android.ps1 -Branch feature/T12-screen-chat`.
3. In Android Studio oben dein Handy wählen → **Run** (grünes Dreieck). Fertig.
   Nur Code geändert, Studio schon offen? `.\scripts\android.ps1 -NoOpen`, dann wieder Run.
4. Fehlersuche auf dem Handy: in Chrome unter Windows `chrome://inspect` → die OffGrid-WebView → Konsole wie im Browser.
   Native Meldungen (USB-Plugin): Android Studio → *Logcat*, Filter `UsbSerial`.

Ohne Antenne auf dem Handy testen: in `chrome://inspect` Konsole `localStorage.setItem('og.mock','1')`, App neu starten.

### Optional: Android SDK auch auf der VM
Nur nötig, wenn die Agents den Java-Teil (T06) selbst kompilieren sollen. JDK 17 ist auf der VM vorhanden.
„Command line tools only“ (Linux) von developer.android.com/studio laden, nach `~/Android/cmdline-tools/latest` entpacken, dann:
```
export ANDROID_HOME=~/Android && export PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$PATH
sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" && yes | sdkmanager --licenses
```
`ANDROID_HOME` in `~/.bashrc` eintragen. Ohne SDK markiert der Planner T06 mit „Android-Build durch Mensch prüfen“ –
dann einmal unter Windows bauen und schauen, ob es kompiliert.

## Logo / App-Icon
`docs/design/logo/` enthält die SVGs. In Android Studio im Projektbaum `app → res` Rechtsklick → *New → Image Asset* →
*Launcher Icons (Adaptive and Legacy)*: Foreground = `offgrid-mark.svg` (Resize ~80 %), Background = Farbe `#0F1115`.
Danach unter Windows auf einem eigenen Branch committen (`git switch -c feature/app-icon`, `git add -A`, `git commit`,
`git push -u origin feature/app-icon`) und auf GitHub einen PR öffnen und mergen.

## Doku-Website und Checks (ab T21)

**Einmalig auf der VM:** `python3 --version` (≥ 3.10) und `sudo apt install python3-venv`, falls `venv` fehlt.
Nach dem Merge von T21: `npm run docs:install`.

**Einmalig auf GitHub** (Repo `OffGridCH/app`, öffentlich, Free-Plan reicht):
1. *Settings → Pages → Build and deployment → Source:* **GitHub Actions**.
2. *Settings → Rules/Branches* → Regel für `main` ergänzen: **Require status checks to pass** mit den Checks
   `app-checks` und `docs-check` (erscheinen in der Liste, sobald der erste PR nach T21 gelaufen ist).
3. Beim ersten Lauf von „Doku veröffentlichen“ ggf. unter *Settings → Environments → github-pages* erlauben,
   dass `main` deployen darf (ist normalerweise schon so eingestellt).

**Ansehen:**
- Live nach jedem Merge: `https://offgridch.github.io/app/`
- Lokal während der Arbeit: `npm run docs:serve` auf der VM → unter Windows `http://localhost:8000`.

**Ablauf:** Nach dem Tester schreibt der `documenter` die Doku für das Ticket in denselben PR. Im PR siehst du Code und
Doku zusammen; die Checks `app-checks` und `docs-check` müssen grün sein, bevor du mergen kannst.
Ist ein Check rot, markiert der Planner das Ticket als `blockiert` („CI rot“). Dann z. B. `Korrigiere PR T07: CI rot`.

## Standort und Karten
Die App hat keine eigene Karte (ohne Internet keine Kartenkacheln). Sie zeigt Entfernung und Richtung und übergibt die
Koordinaten an eine Karten-App. Damit das im Gelände geht: auf beiden Test-Handys eine **Offline-Karten-App**
(z. B. Organic Maps oder OsmAnd) installieren und das Gebiet **vorher** herunterladen.

## Optionale Tickets freigeben
T19 (Live-Standort), T16 (Hintergrund) und T20 (Gruppenchat) stehen auf `blockiert`. Freigeben: in
`tickets/STATUS.local.md` den Status auf `offen` setzen und dem Planner `weiter` schreiben. Empfohlene Reihenfolge:
T19 → T16 → T20 (Gruppenchat ganz am Schluss).

## Was die Agents nicht können
- Firmware/Antenne: Ohne zwei Antennen mit Firmware ist der echte Funktest (T15) nicht möglich. Bis dahin läuft alles mit Mock.
- T15 und T16 brauchen dich (Geräte, Freigabe).

## Wenn etwas hakt
- Agent erfindet Dinge → die Info fehlt in einem Skill. Skill ergänzen, nicht im Chat erklären.
- Ticket `blockiert` → Notiz in `tickets/STATUS.local.md` lesen, Frage beantworten (Skill/Ticket ergänzen – das selbst per
  Branch + PR, da `main` gesperrt ist), Status dort auf `offen` setzen.
- Merge-Konflikt in einem PR → auf GitHub „Resolve conflicts“ oder lokal lösen, dann dem Planner `weiter`.
- Design ändern → zuerst im Canvas, dann `docs/design/screens/` und den Skill aktualisieren.
- Änderungen unter Windows (z. B. App-Icon) immer über Branch + PR nach `main` bringen, damit VM und Windows gleich bleiben.
