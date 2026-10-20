---
name: offgrid-screens
description: Spezifikation jedes OffGrid-Screens – Aufbau von oben nach unten, verwendete og-Komponenten, Datenquellen, Zustände, Navigation und alle Texte wörtlich (Deutsch/Schweiz). Laden bei jedem Ticket, das eine Seite in src/app/features baut oder ändert.
---

# OffGrid Screens

Jeder Screen hat eine Design-Referenz in `docs/design/screens/` (Datei in Klammern). Die Referenz zeigt den
Normalzustand mit Beispieldaten; **Struktur, Abstände und Texte** übernimmst du von dort und von hier,
**Farben/Grössen** nur über Tokens/Komponenten (Skill `offgrid-design-system`).
Texte in „…“ sind **wörtlich** zu übernehmen. `<…>` sind Platzhalter für Daten.

## 0. Gemeinsames

### Zeit- und Funkformate (`core/format/time.ts`, `core/format/radio.ts`, mit Tests)
Alle Zeitfunktionen nutzen `Intl.DateTimeFormat('de-CH', { timeZone: 'Europe/Zurich', … })`. Signaturen exakt:
`formatTime(iso: string)`, `formatListTime(iso: string, now: Date)`, `formatLastSeen(iso: string | null, now: Date)`,
`formatDay(iso: string, now: Date)`, `formatMHz(freqHz: number)`. Seiten übergeben `new Date()` als `now`.
- `formatTime(iso)`: `HH:mm` (24 h).
- `formatListTime(iso, now)`: heute → `HH:mm`; gestern → „Gestern“; innerhalb 7 Tagen → Wochentag kurz („Mo.“);
  sonst `dd.MM.yy`.
- `formatLastSeen(iso, now)`: heute → „zuletzt <HH:mm>“; gestern → „zuletzt gestern“; sonst „zuletzt <dd.MM.>“; null → „noch nie empfangen“.
- `formatDay(iso, now)` für Tagestrenner im Chat: heute → „HEUTE“, gestern → „GESTERN“, sonst `dd.MM.yyyy`.
- `formatMHz(freqHz)`: `Math.floor(freqHz / 1e6)` als Text, z. B. `868100000` → „868“. Überall verwenden, wo „MHz“ steht.

### Signal-Labels (`aria-label` von `og-signal-bars`)
Level 4 → „Signal sehr gut“, 3 → „Signal gut“, 2 → „Signal mittel“, 1 → „Signal schwach“, 0 → „Ausser Reichweite“.
Kontakt mit ausstehendem Handshake: Balken Level 0, `aria-hidden` (keine Ansage).

### Antennen-Statuszeile (Kontakte, Leerzustand)
Link (`<a>`) auf `/verbinden`, Min-Höhe 44, gap 8, 14px `--og-text-2`, margin `0 20px`:
- `ready`: `og-status-dot ok` + „Antenne verbunden“ + Meta „· USB-C · <formatMHz(freq)> MHz“.
- sonst: `og-status-dot danger` + „Antenne getrennt“ + Meta „· Tippen zum Verbinden“.
Darunter Trennlinie 1px `--og-line`, margin `6px 20px 8px`.

### Fehlertexte
| Code | Text |
|---|---|
| `no-device` | „Keine Antenne gefunden. Prüfe das USB-C-Kabel.“ |
| `permission-denied` | „Zugriff auf die Antenne wurde nicht erlaubt.“ |
| `open-failed` | „Die Antenne liess sich nicht öffnen. Steck sie neu ein.“ |
| `no-info` | „Die Antenne antwortet nicht.“ |
| `proto-mismatch` | „Die Firmware der Antenne passt nicht zu dieser App-Version.“ |
| `lost` | „Verbindung zur Antenne verloren.“ |
| `invalid-qr` | „Das ist kein OffGrid-Code.“ |
| `antenna-not-ready` | „Antenne nicht verbunden. Der Schlüssel wird gesendet, sobald sie verbunden ist.“ |
| `scanner-unavailable` | „Der QR-Scanner ist auf diesem Handy nicht verfügbar.“ |
| `scan-cancelled` | (kein Text, einfach zurück zum Tab) |
| `name-invalid` | „Der Name muss 1 bis 40 Zeichen lang sein.“ |
| `password-too-short` | „Mindestens 8 Zeichen.“ |
| `password-mismatch` | „Die Passwörter stimmen nicht überein.“ |
| `wrong-password` | „Falsches Passwort oder beschädigte Datei.“ |
| `invalid-file` | „Das ist keine OffGrid-Export-Datei.“ |
| `write-failed` | „Die Datei konnte nicht gespeichert werden.“ |

Typ für Formularfehler (in `core/models/errors.ts`): `FormErrorCode = 'name-invalid' | 'password-too-short' | 'password-mismatch'`.
Fehler unter Formularfeldern: Stil `help` in `--og-danger`. Fehler auf Seitenebene: `og-banner` bzw. `og-note`.

---

## 1. Verbinden (`/verbinden`, Referenz `Antenne.dc.html`)

Zweck: Onboarding Schritt 1 und „Neu verbinden“ aus Einstellungen. Ruft beim Öffnen `AntennaPort.connect()` auf,
falls `state` `disconnected` oder `error` ist.

Aufbau (von oben):
1. Hero 330px hoch, zentriert: drei konzentrische Ringe 300/220/140px (Rahmen 1px `--og-line`, 1px `--og-border-muted`,
   1.5px `--og-accent-soft`), mittig Kachel 84×84, Radius 28, Grund `--og-accent`, Icon `antenna` 40px `--og-on-accent`.
   Komplett `aria-hidden`.
2. Textblock padding `0 24px`, gap 10:
   - Nur Onboarding (Onboarding nicht abgeschlossen): Section-Label in `--og-accent`: „SCHRITT 1 VON 2“
   - `<h1>` Stil `display`: „Antenne anschliessen“
   - Stil `body-2`: „Verbinde die OffGrid-Antenne per USB-C mit deinem Handy. Danach schreibst du auch ohne Mobilnetz.“
3. `og-step-list` (compact, activeStyle spinner):
   - „USB-Gerät erkannt“ – done ab `device-found` (Meta: `deviceName()`), active bei `searching`, sonst todo
   - „Verbindung wird aufgebaut“ – done ab `ready`, active bei `connecting`/`device-found`, sonst todo
   - „Funkmodul bereit“ – done bei `ready` (Meta: „FW <fw>“), sonst todo
4. Bei `error`/`disconnected` mit Fehlercode: `og-note` mit Fehlertext (Tabelle oben), margin wie Skill.
5. Footer (padding `0 16px 26px`, gap 10):
   - `og-button primary` „Weiter“, nur aktiv bei `ready`. Onboarding nicht abgeschlossen → `/name`; sonst → `/einstellungen`.
   - `og-button secondary` „Erneut suchen“ → `connect()`. Deaktiviert während `searching`/`connecting`.

## 2. Name (`/name`, keine eigene Referenz – aus Bausteinen von Verbinden und Kontakt benennen)

Aufbau: kein Hero. padding-top 56.
- Section-Label `--og-accent`: „SCHRITT 2 VON 2“
- `<h1>` `display`: „Wie heisst du?“
- `body-2`: „Dieser Name wird beim Hinzufügen an deine Kontakte übertragen.“
- `og-card padded` mit `og-text-field` id `dn`, Label „Anzeigename“, maxlength 40, Vorschlag leer.
- Footer: `og-button primary` „Los gehts“ – aktiv, wenn `isValidDisplayName(name)`. Speichert Name (getrimmt),
  `completeOnboarding()`, navigiert `replaceUrl` zu `/kontakte`.

## 3. Kontakte (`/kontakte`, Referenz `Kontakte.dc.html`, Leerzustand `KontakteLeer.dc.html`)

Aufbau:
1. Header: padding `22px 20px 6px`, Zeile space-between. Links „OffGrid“ (`app-title`).
   Rechts gap 8: `og-icon-button round settings` Label „Einstellungen“ → `/einstellungen`;
   `og-icon-button round plus` Label „Kontakt hinzufügen“ → `/kontakte/neu`. (Im Leerzustand nur Einstellungen.)
2. Antennen-Statuszeile (siehe 0).
3. Liste `<nav aria-label="Kontakte">`, padding `0 8px`, Zeilen untereinander, ohne Trennlinien:
   **Kontaktzeile** = `<a>` auf `/chat/:id`, padding 12, Radius `--og-r-btn`, gap 14, Ausrichtung center:
   - `og-avatar size 48`
   - Spalte gap 5, flex 1, min-width 0:
     - Zeile 1 (space-between, gap 12): Name `body-strong` (`display_name`) | `og-signal-bars md` mit Level des Kontakts.
     - Zeile 2 (space-between, gap 12): Vorschau `preview` (1 Zeile, Ellipsis) | rechts gap 6: `og-badge` (wenn ungelesen) + Zeit `meta`.
       - Vorschau: letzter Text; bei eigener Nachricht mit Präfix „Du: “. Keine Nachricht → „Noch keine Nachrichten“.
       - Farbe Vorschau: ungelesen > 0 → `--og-text-2`, sonst `--og-text-3`.
       - Zeit: `formatListTime(lastMessage.sentAt)`; ohne Nachricht leer.
   **Ausstehende Zeile** (aus `HandshakeService.pending`) = `<div>` (nicht klickbar), gleiche Masse:
   `og-avatar pending 48`; Name; Balken Level 0 (aria-hidden); Zeile 2 Text „Schlüssel ausstehend“ 14px `--og-accent`.
   Ausstehende Zeilen stehen **nach** den Kontakten.
4. Footer padding `12px 16px 26px`: `og-link-button primary` mit Icon `qr`: „Kontakt hinzufügen“ → `/kontakte/neu`.

**Leerzustand** (keine Kontakte und keine ausstehenden): statt Liste zentrierter Block (flex 1, gap 22, padding `0 36px`):
- Illustration `aria-hidden`: eigenes `og-avatar 56` (Muster aus `install_id`) · drei Punkte 5×5 `--og-border-muted` gap 6 ·
  `og-avatar pending 56`; Zeile gap 10.
- `<h1>` `empty-title`: „Noch keine Kontakte“
- `body-2` zentriert: „Triff dich mit jemandem, der OffGrid nutzt, und scannt gegenseitig eure Codes. Danach könnt ihr ohne Mobilnetz schreiben.“
- Footer-Button Text: „Ersten Kontakt hinzufügen“.

## 4. Kontakt hinzufügen (`/kontakte/neu`, Referenz `Handshake.dc.html`)

Beim Öffnen: Tab aus Query (`tab=scan`) sonst „Mein Code“ → `HandshakeService.startShowing()`.
Beim Verlassen ohne Abschluss: `cancel()` für eigene `shower`-Handshakes.

Aufbau:
1. `og-topbar` Titel „Kontakt hinzufügen“, back `/kontakte`, backLabel „Zurück zu den Kontakten“.
2. `og-segmented` ariaLabel „Art des Hinzufügens“, Optionen `mine` „Mein Code“, `scan` „Code scannen“.
3. Tab **Mein Code**: Block zentriert, padding `28px 24px 0`, gap 18:
   - `og-qr` mit `qrText`.
   - `body-2` zentriert, max-width 290: „Lass dein Gegenüber diesen Code mit der OffGrid-App scannen.“
   - `og-step-list` (pulse): „Code bereit“ (done, Meta „erledigt“) · „Gegenüber scannt“ (active, Meta „wartet …“) ·
     „Antwort per Funk empfangen“ (todo).
4. Tab **Code scannen**, vor dem Scan: `<button>` 298×298 Radius 28, Grund `--og-bg` mit 1px `--og-border`, vier Eck-Winkel
   46×46 (4px `--og-accent`, äusserer Radius 14, 34px vom Rand), Mitte Meta-Text „KAMERA STARTEN“; `aria-label`
   „Kamera starten und Code scannen“. Klick → `HandshakeService.scan()` (sonst nichts).
   Darunter `body-2`: „Halte die Kamera auf den Code, den dein Gegenüber anzeigt.“
   Nach erfolgreichem Scan: Kamera-Fläche ersetzt durch `og-avatar pending 96` + Name `<peer_name>` (`hero`) und
   `og-step-list` (pulse): „Code gescannt“ (done) · „Schlüssel per Funk gesendet“ · „Bestätigung empfangen“.
   Im Browser (kein Native): Klick öffnet `window.prompt('QR-Text einfügen')` (nur Entwicklung).
5. Fehler aus `HandshakeView.error` als `og-note` unter dem Tab-Inhalt.
6. Seitenende: `<p>` 13px/1.45 `--og-text-3` zentriert, padding `0 28px 28px`:
   „Der Code enthält deinen Schlüssel. Zeig ihn nur Personen, mit denen du schreiben willst.“ (nur Tab „Mein Code“)
7. Wenn `completedContactId` gesetzt → `navigateByUrl('/kontakte/neu/fertig/<id>', { replaceUrl: true })`.

## 5. Kontakt benennen (`/kontakte/neu/fertig/:contactId`, Referenz `KontaktBenennen.dc.html`)

1. Block padding `56px 24px 0`, zentriert, gap 16:
   - `og-avatar 96` mit Muster des Kontakts; unten rechts Erfolgs-Badge 32×32 Kreis `--og-ok`, Rand 3px `--og-bg`,
     Icon `check` 14px `--og-on-accent` (aria-hidden).
   - `<h1>` `hero`: „Schlüssel ausgetauscht“
   - `body-2` max-width 300: „Vergleicht das Muster auf beiden Handys. Sieht es gleich aus, hat alles geklappt.“
Beim Öffnen: `HandshakeService.clearCompleted()`. Kontakt fehlt → `/kontakte` (replaceUrl).
2. `og-card padded` (margin-top 32): `og-text-field` „Anzeigename“ (vorbelegt mit `display_name`, maxlength 40,
   Fehler `name-invalid` wenn nicht `isValidDisplayName`); Vorname/Nachname maxlength 100;
   Grid 2 Spalten gap 10: „Vorname“ (optional), „Nachname“ (optional), Platzhalter „Vorname“/„Nachname“.
3. Footer gap 10:
   - `og-button primary` „Speichern und schreiben“ → `MessagingService.renameContact(...)` (leere Vor-/Nachnamen → null),
     dann `/chat/:id` (replaceUrl).
   - `og-button secondary` „Muster stimmt nicht überein“ → `MessagingService.deleteContact(id)`, `/kontakte/neu` (replaceUrl).

## 6. Chat (`/chat/:contactId`, Referenzen `Main.dc.html` und `ChatGetrennt.dc.html`)

Beim Öffnen und bei neuen Nachrichten: `markRead(contactId)`.

1. `ion-header` mit Kopfzeile: padding `14px 12px 12px 6px`, gap 10, Unterkante 1px `--og-line`:
   `og-icon-button plain back` („Zurück zu den Kontakten“, → `/kontakte`) · `og-avatar 40` ·
   Spalte gap 2: Name `chat-name` + Meta `formatLastSeen(last_seen_at)` (bei `ready` mit Präfix „über Funk · “) ·
   rechts Box 44×44 mit `og-signal-bars md` (Level des Kontakts; bei Antenne nicht `ready` → 0).
2. Wenn Antenne nicht `ready`: `og-banner` Titel „Antenne getrennt“, Text „Nachrichten werden gesendet, sobald sie wieder
   verbunden ist.“, Aktion `<a>` „Verbinden“ → `/verbinden`.
3. `ion-content`: Nachrichtenliste unten ausgerichtet (flex column, justify-end, gap 6, padding `16px 14px 10px`),
   scrollt automatisch ans Ende bei Öffnen und neuer Nachricht.
   - Tagestrenner vor der ersten Nachricht eines Tages: Linie–Text–Linie, gap 10, margin `4px 0 10px`, Text `formatDay`
     im `section`-Stil (letter-spacing 0.12em), Linien 1px `--og-line`.
   - `og-message-bubble` je Nachricht. `meta`:
     - in: `formatTime(sentAt)`
     - out sent: „<HH:mm> · gesendet“; delivered: „<HH:mm> · zugestellt“
     - out queued: Antenne `ready` → „wartet auf Funk …“, sonst „in Warteschlange“
     - out failed: (Bubble zeigt „Nicht gesendet“ + „Erneut senden“) → `retry(id)`
   - Leerer Chat: zentriert `body-2` `--og-text-3`: „Noch keine Nachrichten. Schreib die erste.“
4. `ion-footer`: `og-composer` mit `placeholder` „Nachricht an <display_name>“ (bei nicht `ready`: „Wird später gesendet“),
   `label` „Nachricht an <display_name>“, `sendLabel` „Senden“ (bei nicht `ready`: „In Warteschlange legen“),
   `maxBytes` = `MessagingService.maxContentBytes()`, `countBytes` = `contentBytes`.

**Demo-Verlauf (nur `seedDemo()`, Zeiten relativ zu „jetzt“):**
- Anna Meier (`last_rssi -92`, `last_seen_at` jetzt − 1 min):
  1. in, jetzt − 12 min, gelesen: „Bin oben beim Gipfelkreuz. Hier gibt es keinen Handyempfang.“
  2. out, jetzt − 11 min, Delivered: „Wir sind bei der Hütte und kommen in etwa 20 Minuten.“
  3. out, jetzt − 9 min, Sent: „Wartest du dort auf uns?“
  4. in, jetzt − 2 min, **ungelesen**: „Ja, ich warte hier. Es ist ziemlich windig.“
- Luca Bernasconi (`last_rssi -100`, `last_seen_at` jetzt − 5 min): in, jetzt − 3 h, gelesen: „Basislager erreicht.“
- Mia Frei (`last_rssi -110`, `last_seen_at` gestern 19:12): out, gestern 19:12, Delivered: „Wir starten morgen um 7 Uhr.“
- Handshake: Rolle `scanner`, Status `sent`, `peer_name` „Jonas Keller“, Schlüssel zufällig.

## 7. Einstellungen (`/einstellungen`, Referenz `Einstellungen.dc.html`)

Seite scrollt (`ion-content`), padding-bottom 32.
1. `og-topbar` „Einstellungen“, back `/kontakte`.
2. Block zentriert padding `20px 16px 8px`, gap 12: `og-avatar 72` (eigenes Muster) + Meta-Label „DEIN MUSTER“ (letter-spacing 0.08em).
3. `og-section-label card` „PROFIL“ · `og-card padded` (gap 8): `og-text-field` „Anzeigename“ (maxlength 40) + Hint
   „Wird beim Hinzufügen an neue Kontakte übertragen.“ Bei `blurred`: wenn `isValidDisplayName` → speichern, sonst Fehler `name-invalid`.
4. „ANTENNE“ · `og-card`:
   - Zeile (Min-Höhe 60, gap 12): `og-status-dot` + „Verbunden“ / „Getrennt“ (16px) + rechts `og-signal-bars md`.
   - `og-info-row` „Anschluss“ – „USB-C · Serial“
   - `og-info-row` „Frequenz“ – „<formatMHz(freq)> MHz“ (ohne `info`: „–“)
   - `og-info-row` „Firmware“ – `info.fw` (ohne: „–“)
   - Grid 2 Spalten gap 10, padding `14px 16px`: `og-link-button secondary` „Neu verbinden“ → `/verbinden`;
     `og-button secondary` „Trennen“ → `disconnect()` (deaktiviert, wenn nicht `ready`).
5. „EMPFANG“ · `og-card`:
   - Zeile (Min-Höhe 68, padding `10px 16px`): Titel „Im Hintergrund empfangen“ + Hilfstext
     „Nachrichten kommen an, auch wenn die App geschlossen ist.“ + `og-switch` (bgReceive).
   - Zeile (Min-Höhe 60): „Vibration bei Nachricht“ + `og-switch` (vibrate).
6. „HANDYWECHSEL“ · `og-card`: zwei Zeilen-Links (Min-Höhe 72, padding `12px 16px`, gap 14, Icon 22 `--og-accent`):
   - `upload` „Daten exportieren“ / „Kontakte, Schlüssel und Nachrichten als Datei, mit Passwort geschützt.“ → `/einstellungen/export`
   - `download` „Daten importieren“ / „Export-Datei vom alten Handy einlesen.“ → `/einstellungen/import`
7. „DATEN“ · `og-card`: `og-info-row` „Kontakte“ – `counts().contacts`; „Nachrichten“ – `counts().messages`;
   `og-button danger-text` „Alle Daten löschen“ → Bestätigung mit
   `window.confirm('Alle Kontakte und Nachrichten auf diesem Handy löschen? Das lässt sich nicht rückgängig machen.')`
   → `MessagingService.deleteAll()` (Settings bleiben) → `/kontakte`.
8. Meta zentriert padding-top 28: „OffGrid <App-Version>“ (Version aus `package.json` über `environment.version`).

## 8. Daten exportieren (`/einstellungen/export`, Referenz `Export.dc.html`)

1. `og-topbar` „Daten exportieren“, back `/einstellungen`, backLabel „Zurück zu den Einstellungen“.
2. `body-2`, margin `8px 24px 0`: „Für den Wechsel auf ein neues Handy. Die Datei enthält deine Schlüssel, darum wird sie mit einem Passwort verschlüsselt.“
3. `og-card` (margin-top 22): `og-info-row` „Kontakte und Schlüssel“ – `counts().contacts`; „Nachrichten“ – `counts().messages`.
4. `og-card padded` (margin-top 14): `og-text-field password` „Passwort“; „Passwort wiederholen“;
   Hinweis-Zeile gap 10: Icon `info` `--og-text-3` + `help`: „Ohne Passwort lässt sich die Datei nicht mehr öffnen. Es gibt keine Wiederherstellung.“
   Validierungsfehler unter dem jeweiligen Feld.
5. Footer: `og-button primary` Icon `upload` „Datei erstellen und teilen“ → `BackupService.export`. Während der Arbeit
   Text „Wird erstellt …“ und deaktiviert. Erfolg: zurück zu `/einstellungen`.

## 9. Daten importieren (`/einstellungen/import`, Referenz `Import.dc.html`)

1. `og-topbar` „Daten importieren“, back `/einstellungen`.
2. `body-2`: „Wähle die Export-Datei von deinem alten Handy und gib das Passwort ein.“
3. Datei-Auswahl `<button>` → `BackupService.pickFile()` (margin `22px 16px 0`, Min-Höhe 72, Radius 20, Karte-Stil, gap 14): Kachel 44×44 Radius 14
   `--og-accent-soft` mit Icon `file` `--og-accent`; Text: ohne Datei → Titel „Datei wählen“ (16px/600), mit Datei →
   Dateiname (Mono 14px, Ellipsis) + Unterzeile „Andere Datei wählen“ (13px `--og-text-3`).
4. `og-card padded`: `og-text-field password` „Passwort der Export-Datei“.
5. `og-note` (warning): „Der Import ersetzt alle Kontakte und Nachrichten auf diesem Handy.“
6. Footer: `og-button primary` „Importieren“ → `BackupService.import(text, password)` – aktiv mit Datei und Passwort;
   während Arbeit „Wird importiert …“.
   Erfolg → `/kontakte` (replaceUrl). Fehler unter dem Passwortfeld.
