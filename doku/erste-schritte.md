# Erste Schritte

## Entwicklungsumgebung

Die Entwicklung läuft auf einer **Linux-VM** (VS Code Remote-SSH). Dort laufen Code, Lint, Tests und der Web-Build.
Die Android-App baut und installiert der Mensch unter **Windows in Android Studio**, das Handy hängt per USB-C an der
Antenne.

| Voraussetzung | Version |
|---|---|
| Node | ≥ 24.15 (Angular 22 verlangt `^22.22.3 \|\| ^24.15.0 \|\| ^26`) |
| npm | mit Node geliefert |
| Python | ≥ 3.10 mit `venv` – nur für die Doku (`sudo apt install python3-venv`) |

## Einmalig einrichten

```bash
npm install
```

Für die Doku zusätzlich:

```bash
npm run docs:install
```

Der Befehl legt das virtuelle Python-Umfeld `.venv-docs/` an und installiert daraus MkDocs Material
(`requirements-docs.txt`).

## Befehle

| Befehl | Wirkung |
|---|---|
| `npm start` | Dev-Server im Browser (Port 4200) |
| `npm run lint` | ESLint über das Projekt |
| `npm run test:ci` | Tests einmal und headless (Vitest + jsdom, kein Browser nötig) |
| `npm run build` | Produktions-Build |
| `npm run check` | Lint, Tests und Build in einem Durchgang |
| `npm run docs:install` | `.venv-docs/` anlegen, MkDocs Material installieren |
| `npm run docs:build` | Doku bauen (`mkdocs build --strict`) |
| `npm run docs:serve` | Doku-Server auf Port 8000 |
| `npm run docs:screens` | Screenshots der Screens für die Doku (Playwright) |

## Browser-Demo

`npm start` startet den Dev-Server. Im Browser öffnen und in den DevTools das Gerätesymbol auf Handy-Grösse stellen.
Nach T00 zeigen die Routen noch leere Seiten: `/kontakte` und `/verbinden` sind Stubs, ihr Inhalt kommt mit T09 und T10.

Der Browser hat Demo-Daten und ein **simuliertes Gerät** (`MockDevice`), das dieselbe Host-API spricht wie die echte Antenne. Es startet als
schon eingerichtetes, gesperrtes Gerät mit den Demo-Kontakten und nimmt das erste Entsperr-Token an. Die Entwickler-Konsole bietet:

| Befehl | Wirkung |
|---|---|
| `ogMock.receive('Anna Meier', 'Hallo')` | eingehende Nachricht simulieren (Kontakt als Name oder Platz) |
| `ogMock.react('Anna Meier', { author: 'me', ref: 1 }, '👍')` | eingehende Reaktion simulieren |
| `ogMock.receiveLocation('Anna Meier')` | eingehenden Standort simulieren |
| `ogMock.failNext('timeout')` | nächste gesendete Nachricht scheitern lassen (`timeout` oder `radio_error`) |
| `ogMock.lock()` | das Gerät sperrt sich (Auto-Lock); die App entsperrt es wieder |
| `ogMock.reboot()` | das Gerät startet neu (`sys.boot`) |
| `ogMock.drop()` | Kabel ziehen (Verbindung geht verloren) |

Auf Android läuft derselbe Mock mit `localStorage.setItem('og.mock', '1')`, zum Vorführen ohne Hardware.

Onboarding und Leerzustand ohne Demo-Daten (das simulierte Gerät ist dann ein frisches, noch nicht eingerichtetes Gerät):

```js
localStorage.setItem('og.noseed', '1'); // neu laden
localStorage.removeItem('og.noseed');   // zurück
```

## Doku ansehen

```bash
npm run docs:serve
```

Die Doku läuft dann unter `http://localhost:8000`. Nach jedem Merge auf `main` wird sie von GitHub Actions auf
GitHub Pages veröffentlicht: `https://offgridch.github.io/app/`.

## Auf das Handy

1. Auf der VM: `npx cap sync android` – das überträgt den Web-Build in das Android-Projekt.
2. Unter Windows: `.\scripts\android.ps1` holt `main`, baut, kopiert und öffnet Android Studio.
3. In Android Studio das Handy wählen und **Run** drücken.

Der USB-C-Port des Handys steckt an der Antenne. Darum verbindet sich Android Studio per WLAN mit dem Handy
(kabelloses Debugging). Native Meldungen der Antenne erscheinen im Logcat unter dem Filter `UsbSerial`.
