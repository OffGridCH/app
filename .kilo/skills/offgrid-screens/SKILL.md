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
Kontakt mit Zustand `pending` (noch kein Paket vom Gegenüber empfangen): Balken Level 0, `aria-hidden` (keine Ansage).
`signalLevel(rssi, seenAt, now)`: `rssi` ist `contact.lastRssi`; `seenAt` ist die `sentAt` der letzten **eingehenden** Nachricht dieses Kontakts
(das Gerät hat keine Uhr und liefert keinen Zeitpunkt; die App stempelt beim Empfang selbst). Ohne eingehende Nachricht: `null` → Level 0.

### Antennen-Statuszeile (Kontakte, Leerzustand)
Link (`<a>`) auf `/verbinden`, Min-Höhe 44, gap 8, 14px `--og-text-2`, margin `0 20px`:
- `unlocked`: `og-status-dot ok` + „Antenne verbunden“ + Meta „· USB-C · <formatMHz(freq)> MHz“ (`freq` = `radio.get` → `freq_mhz` × 10⁶).
- sonst: `og-status-dot danger` + „Antenne getrennt“ + Meta „· Tippen zum Verbinden“.
Darunter Trennlinie 1px `--og-line`, margin `6px 20px 8px`.

### Fehlertexte
| Code | Text |
|---|---|
| `no-device` | „Keine Antenne gefunden. Prüfe das USB-C-Kabel.“ |
| `permission-denied` | „Zugriff auf die Antenne wurde nicht erlaubt.“ |
| `open-failed` | „Die Antenne liess sich nicht öffnen. Steck sie neu ein.“ |
| `no-hello` | „Die Antenne antwortet nicht.“ |
| `proto-mismatch` | „Die Firmware der Antenne passt nicht zu dieser App-Version.“ |
| `lost` | „Verbindung zur Antenne verloren.“ |
| `invalid-qr` | „Das ist kein OffGrid-Code.“ |
| `unlock-failed` | „Die Antenne lässt sich mit diesem Handy nicht entsperren.“ ¹ |
| `rate-limited` | „Zu viele Versuche. Warte kurz und versuch es erneut.“ ¹ |
| `keystore-failed` | „Der Schlüsselspeicher des Handys ist nicht verfügbar.“ ¹ |
| `antenna-not-ready` | „Antenne nicht bereit. Verbinde sie zuerst.“ ¹ |
| `no-pairing` | „Der eigene Code ist abgelaufen. Zeig ihn erneut an.“ ¹ |
| `self-pair` | „Das ist dein eigener Code.“ ¹ |
| `contact-exists` | „Diesen Kontakt hast du schon.“ ¹ |
| `storage-full` | „Die Antenne kann keine weiteren Kontakte speichern.“ ¹ |
| `pairing-failed` | „Der Kontakt konnte nicht hinzugefügt werden.“ ¹ |
| `scanner-unavailable` | „Der QR-Scanner ist auf diesem Handy nicht verfügbar.“ |
| `scan-cancelled` | (kein Text, einfach zurück zum Tab) |
| `name-invalid` | „Der Name muss 1 bis 24 Bytes lang sein (Umlaute zählen doppelt).“ ¹ |
| `password-too-short` | „Mindestens 8 Zeichen.“ |
| `password-mismatch` | „Die Passwörter stimmen nicht überein.“ |
| `wrong-password` | „Falsches Passwort oder beschädigte Datei.“ |
| `invalid-file` | „Das ist keine OffGrid-Export-Datei.“ |
| `write-failed` | „Die Datei konnte nicht gespeichert werden.“ |
| `location-denied` | „Standortzugriff fehlt. Erlaube ihn in den Android-Einstellungen.“ |
| `location-timeout` | „Kein GPS-Signal. Geh ins Freie und versuch es erneut.“ |
| `location-unavailable` | „Der Standort ist gerade nicht verfügbar.“ |
| `no-maps-app` | „Keine Karten-App gefunden. Die Koordinaten sind kopiert.“ |

¹ **Neu mit T23, Vorschlag**: Die Texte gab es im alten Entwurf nicht (bzw. der Vertrag hat die Grenze geändert: Namen sind 1–24 **Bytes**, nicht
1–40 Zeichen). Der Mensch bestätigt sie; bis dahin gelten diese Wörter.

Typ für Formularfehler (in `core/models/errors.ts`): `FormErrorCode = 'name-invalid' | 'password-too-short' | 'password-mismatch'`.
Fehler unter Formularfeldern: Stil `help` in `--og-danger`. Fehler auf Seitenebene: `og-banner` bzw. `og-note`.

---

## 1. Verbinden (`/verbinden`, Referenz `Antenne.dc.html`)

Zweck: Onboarding Schritt 1 und „Neu verbinden“ aus Einstellungen. Ruft beim Öffnen `AntennaPort.connect()` auf,
falls `state` `disconnected` ist. Zustände der Antenne siehe Skill `offgrid-antenna-protocol` §4: `disconnected` · `unprovisioned` · `locked` · `unlocked`.

Aufbau (von oben):
1. Hero 330px hoch, zentriert: drei konzentrische Ringe 300/220/140px (Rahmen 1px `--og-line`, 1px `--og-border-muted`,
   1.5px `--og-accent-soft`), mittig Kachel 84×84, Radius 28, Grund `--og-accent`, Icon `antenna` 40px `--og-on-accent`.
   Komplett `aria-hidden`.
2. Textblock padding `0 24px`, gap 10:
   - Nur Onboarding (Onboarding nicht abgeschlossen): Section-Label in `--og-accent`: „SCHRITT 1 VON 2“
   - `<h1>` Stil `display`: „Antenne anschliessen“
   - Stil `body-2`: „Verbinde die OffGrid-Antenne per USB-C mit deinem Handy. Danach schreibst du auch ohne Mobilnetz.“
3. `og-step-list` (compact, activeStyle spinner):
   - „USB-Gerät erkannt“ – done, sobald das Gerät auf `sys.hello` geantwortet hat (`device()` gesetzt; Meta: `device().device`), active bei `connecting`, sonst todo
   - „Verbindung wird aufgebaut“ – done bei `unprovisioned`, `locked` und `unlocked`, active bei `connecting`, sonst todo
   - „Funkmodul bereit“ – done bei `unlocked` (Meta: „FW <device().fwVersion>“), sonst todo
   Ist das Gerät `unprovisioned` (frisch), ist es **noch nicht** entsperrt: Es wird im Schritt „Name“ eingerichtet (§2). Ist es `locked`,
   entsperrt der Port es selbst; schlägt das fehl, steht der Fehler in `error` (`unlock-failed`, `rate-limited`, `keystore-failed`).
4. Bei `error` (Fehlercode aus `AntennaPort.error()`): `og-note` mit Fehlertext (Tabelle oben), margin wie Skill.
5. Footer (padding `0 16px 26px`, gap 10):
   - `og-button primary` „Weiter“, aktiv bei `unlocked`, im Onboarding auch bei `unprovisioned`. Onboarding nicht abgeschlossen → `/name`; sonst → `/einstellungen`.
   - `og-button secondary` „Erneut suchen“ → `connect()`. Deaktiviert während `connecting`.

## 2. Name (`/name`, keine eigene Referenz – aus Bausteinen von Verbinden und Kontakt benennen)

Aufbau: kein Hero. padding-top 56.
- Section-Label `--og-accent`: „SCHRITT 2 VON 2“
- `<h1>` `display`: „Wie heisst du?“
- `body-2`: „Dieser Name wird beim Hinzufügen an deine Kontakte übertragen.“
- `og-card padded` mit `og-text-field` id `dn`, Label „Anzeigename“, **kein** `maxlength` (die Grenze sind 24 **Bytes**, nicht Zeichen; Prüfung über
  `isValidDisplayName`, Fehler `name-invalid`), Vorschlag leer.
- Footer: `og-button primary` „Los gehts“ – aktiv, wenn `isValidDisplayName(name)`. Der Name geht an das Gerät:
  - `AntennaPort.state() === 'unprovisioned'` (frisches Gerät): `AntennaPort.provision(name)` (`sec.provision`) richtet das Gerät ein und sperrt
    es an dieses Handy (Skill `offgrid-crypto-handshake` §1). Bei Fehler Fehlertext (`unlock-failed`, `rate-limited`, `keystore-failed`) als `og-note`.
  - sonst (`unlocked`): `id.set_name`.
  Danach den getrimmten Namen in `SettingsService.setDisplayName` speichern, `completeOnboarding()`, `replaceUrl` zu `/kontakte`.

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
     - Zeile 1 (space-between, gap 12): Name `body-strong` (`name`) | `og-signal-bars md` mit Level des Kontakts.
     - Zeile 2 (space-between, gap 12): Vorschau `preview` (1 Zeile, Ellipsis) | rechts gap 6: `og-badge` (wenn ungelesen) + Zeit `meta`.
       - Vorschau: letzter Text; bei eigener Nachricht mit Präfix „Du: “. Standort-Nachricht → „Standort“ bzw. „Du: Standort“.
         Keine Nachricht → „Noch keine Nachrichten“.
       - Farbe Vorschau: ungelesen > 0 → `--og-text-2`, sonst `--og-text-3`.
       - Zeit: `formatListTime(lastMessage.sentAt)`; ohne Nachricht leer.
   **Ausstehende Zeile** (Kontakt mit `state === 'pending'`) = `<div>` (nicht klickbar), gleiche Masse:
   `og-avatar pending 48`; Name; Balken Level 0 (aria-hidden); Zeile 2 Text „Schlüssel ausstehend“ 14px `--og-accent`.
   Ausstehende Zeilen stehen **nach** den Kontakten. (T23-Hinweis: Mit dem Gerät als Besitzer der Schlüssel heisst `pending` „Pairing fertig,
   erstes Paket des Gegenübers noch nicht angekommen“. Ob die Zeile dann klickbar sein soll und ob der Text stimmt, ist offen.)
4. Footer padding `12px 16px 26px`: `og-link-button primary` mit Icon `qr`: „Kontakt hinzufügen“ → `/kontakte/neu`.

**Leerzustand** (keine Kontakte und keine ausstehenden): statt Liste zentrierter Block (flex 1, gap 22, padding `0 36px`):
- Illustration `aria-hidden`: eigenes `og-avatar 56` (Quelle der Zellwerte offen, Skill `offgrid-design-system`) · drei Punkte 5×5 `--og-border-muted` gap 6 ·
  `og-avatar pending 56`; Zeile gap 10.
- `<h1>` `empty-title`: „Noch keine Kontakte“
- `body-2` zentriert: „Triff dich mit jemandem, der OffGrid nutzt, und scannt gegenseitig eure Codes. Danach könnt ihr ohne Mobilnetz schreiben.“
- Footer-Button Text: „Ersten Kontakt hinzufügen“.

## 4. Kontakt hinzufügen (`/kontakte/neu`, Referenz `Handshake.dc.html`)

Beim Öffnen: Tab aus Query (`tab=scan`) sonst „Mein Code“ → `HandshakeService.begin()` (`pair.begin`), sofern noch kein gültiger `qrText` da ist
(Tabwechsel erneuert den Code **nicht**: das Salz muss zum Code passen, den das Gegenüber gescannt hat; neu holen erst nach Ablauf `qrExpiresAt`).
Beide Personen zeigen ihren Code und scannen den des anderen. Beim Verlassen ohne Abschluss: `cancel()` (`pair.cancel`).
Die Antenne muss `unlocked` sein, sonst `og-note` „antenna-not-ready“.

Aufbau:
1. `og-topbar` Titel „Kontakt hinzufügen“, back `/kontakte`, backLabel „Zurück zu den Kontakten“.
2. `og-segmented` ariaLabel „Art des Hinzufügens“, Optionen `mine` „Mein Code“, `scan` „Code scannen“.
3. Tab **Mein Code**: Block zentriert, padding `28px 24px 0`, gap 18:
   - `og-qr` mit `qrText`.
   - `body-2` zentriert, max-width 290: „Lass dein Gegenüber diesen Code mit der OffGrid-App scannen.“
   - `og-step-list` (pulse): „Code bereit“ (done, Meta „erledigt“) · „Gegenüber scannt“ (active, Meta „wartet …“) ·
     „Antwort per Funk empfangen“ (todo; done, sobald das Gerät `contact.state` → `active` meldet, also das erste Paket des Gegenübers da ist).
4. Tab **Code scannen**, vor dem Scan: `<button>` 298×298 Radius 28, Grund `--og-bg` mit 1px `--og-border`, vier Eck-Winkel
   46×46 (4px `--og-accent`, äusserer Radius 14, 34px vom Rand), Mitte Meta-Text „KAMERA STARTEN“; `aria-label`
   „Kamera starten und Code scannen“. Klick → `HandshakeService.scan()` (sonst nichts).
   Darunter `body-2`: „Halte die Kamera auf den Code, den dein Gegenüber anzeigt.“
   Nach dem Scan ruft die Seite `HandshakeService.complete(text)` (`pair.complete`, bis 5 s). Es gibt **keinen** Zwischenzustand „per Funk gesendet“
   mehr: Das Pairing läuft ohne Funk, bei Erfolg geht es sofort weiter (Punkt 7).
   Im Browser (kein Native): Klick öffnet `window.prompt('QR-Text einfügen')` (nur Entwicklung); der Text von `ogMock` stammt aus `pair.begin` des Mock-Geräts.
5. Fehler aus `HandshakeService.error()` als `og-note` unter dem Tab-Inhalt (Texte in §0).
6. Seitenende: `<p>` 13px/1.45 `--og-text-3` zentriert, padding `0 28px 28px`:
   „Der Code enthält deinen Schlüssel. Zeig ihn nur Personen, mit denen du schreiben willst.“ (nur Tab „Mein Code“)
7. Wenn `completedContactId` gesetzt → `navigateByUrl('/kontakte/neu/fertig/<id>', { replaceUrl: true })`. Der Kontakt ist dann `pending`.

## 5. Kontakt benennen (`/kontakte/neu/fertig/:contactId`, Referenz `KontaktBenennen.dc.html`)

1. Block padding `56px 24px 0`, zentriert, gap 16:
   - `og-avatar 96` (Quelle der Zellwerte offen, Skill `offgrid-design-system`); unten rechts Erfolgs-Badge 32×32 Kreis `--og-ok`, Rand 3px `--og-bg`,
     Icon `check` 14px `--og-on-accent` (aria-hidden).
   - `<h1>` `hero`: „Schlüssel ausgetauscht“
   - `body-2` max-width 300: „Vergleicht die Zahlen auf beiden Handys. Sind sie gleich, hat alles geklappt.“ ¹
   - darunter der **Fingerabdruck** `contact.fingerprint` (drei Vierergruppen, z. B. „0501 3010 7790“), zentriert, im Stil `value` (Mono).
     Er ist auf beiden Handys gleich, wenn der Austausch nicht verfälscht wurde; die Seite zeigt ihn nur an.
Beim Öffnen: `HandshakeService.clearCompleted()`. Kontakt fehlt → `/kontakte` (replaceUrl).
2. `og-card padded` (margin-top 32): `og-text-field` „Anzeigename“ (vorbelegt mit `name`, **kein** `maxlength`, Fehler `name-invalid` wenn nicht
   `isValidDisplayName`: 1–24 Bytes). Es gibt **keine** Felder „Vorname“/„Nachname“ mehr: ein Kontakt hat nur einen Namen (`contact.rename`).
3. Footer gap 10:
   - `og-button primary` „Speichern und schreiben“ → `HandshakeService.rename(id, name)`, dann `/chat/:id` (replaceUrl).
   - `og-button secondary` „Zahlen stimmen nicht überein“ ¹ → `HandshakeService.remove(id)` (`contact.delete`), `/kontakte/neu` (replaceUrl).

## 6. Chat (`/chat/:contactId`, Referenzen `Main.dc.html` und `ChatGetrennt.dc.html`)

Beim Öffnen und bei neuen Nachrichten: `markRead(contactId)`.

1. `ion-header` mit Kopfzeile: padding `14px 12px 12px 6px`, gap 10, Unterkante 1px `--og-line`:
   `og-icon-button plain back` („Zurück zu den Kontakten“, → `/kontakte`) · `og-avatar 40` ·
   Spalte gap 2: Name `chat-name` + Meta `formatLastSeen(<sentAt der letzten eingehenden Nachricht>)` (bei `unlocked` mit Präfix „über Funk · “) ·
   rechts Box 44×44 mit `og-signal-bars md` (Level des Kontakts; bei Antenne nicht `unlocked` → 0).
2. Wenn Antenne nicht `unlocked`: `og-banner` Titel „Antenne getrennt“, Text „Nachrichten werden gesendet, sobald sie wieder
   verbunden ist.“, Aktion `<a>` „Verbinden“ → `/verbinden`.
3. `ion-content`: Nachrichtenliste unten ausgerichtet (flex column, justify-end, gap 6, padding `16px 14px 10px`),
   scrollt automatisch ans Ende bei Öffnen und neuer Nachricht.
   - Tagestrenner vor der ersten Nachricht eines Tages: Linie–Text–Linie, gap 10, margin `4px 0 10px`, Text `formatDay`
     im `section`-Stil (letter-spacing 0.12em), Linien 1px `--og-line`.
   - `og-message-bubble` je Nachricht. `meta`:
     - in: `formatTime(sentAt)`
     - out sent: „<HH:mm> · gesendet“; delivered: „<HH:mm> · zugestellt“
     - out queued: Antenne `unlocked` → „wartet auf Funk …“, sonst „in Warteschlange“
     - out sent deckt auch `relayed` und `retrying` des Geräts ab (Skill `offgrid-antenna-protocol` §6)
     - out failed: (Bubble zeigt „Nicht gesendet“ + „Erneut senden“) → `retry(id)`
   - Leerer Chat: zentriert `body-2` `--og-text-3`: „Noch keine Nachrichten. Schreib die erste.“
4. `ion-footer`: `og-composer` mit `placeholder` „Nachricht an <name>“ (bei nicht `unlocked`: „Wird später gesendet“),
   `label` „Nachricht an <name>“, `sendLabel` „Senden“ (bei nicht `unlocked`: „In Warteschlange legen“),
   `maxBytes` = `MessagingService.maxContentBytes()` (**83**, aus `sys.hello`), `countBytes` = `contentBytes`.
   **Lange Texte werden geteilt:** `MessagingService.sendText` zerlegt einen Text über `maxContentBytes()` Bytes in Stücke (nie mitten in einem
   Zeichen); jedes Stück ist eine eigene Nachricht im Verlauf. Der Composer darf das Senden deshalb **nicht** bei Überschreitung sperren.
   Wie der Zähler bei Überschreitung aussieht, legt T02/T12 fest (offen; bisher: Zähler rot und Senden gesperrt).
   Ab T18: `showLocation` true → Output `location` öffnet das Standort-Sheet (§10).
5. Ab T18 – Standort-Nachrichten (`kind 'location'`) werden mit `og-location-bubble` statt `og-message-bubble` gezeigt:
   - out: Titel „Mein Standort“; Meta wie Text-Nachrichten.
   - in: Titel „Standort von <name>“; `distance`/`directionText`/`bearing` nur, wenn
     `LocationService.myFix()` frisch ist (`isFresh`), sonst null; `directionText` = „Richtung <compassName>“.
     „Anzeigen“ → `/chat/:contactId/standort/:messageId`. Meta = `formatTime(sentAt)`.
   - Live (nur T19): `live` = „Live · bis <HH:mm>“, solange `share_until` in der Zukunft liegt; sonst „Live beendet“.
     Bei eigener aktiver Live-Freigabe zusätzlich Button „Beenden“ (Stil wie „Anzeigen“).

6. **Reaktionen** (Vertrag `msg.send` `type: "reaction"`, `msg.received` `type: "reaction"`): Die Dienste sind da
   (`MessagingService.sendReaction`, `MessagingService.reactions`), eine **Oberfläche gibt es noch nicht**. Emoji-Tabelle (Offgrid Protocol Appendix B):
   👍 ❤️ 😂 😮 😢 🙏, `null` nimmt die eigene Reaktion zurück. `target` = `{ author: "me" | "peer", ref }`: `me`, wenn die Ziel-Nachricht **ich** geschrieben habe;
   `ref` = `ctr & 0xFFFF` der Ziel-Nachricht (die App kennt das volle `ctr` aus `msg.send` bzw. `msg.received`). Reaktionen werden nicht als Nachricht gespeichert.

**Demo-Verlauf (nur `seedDemo()`, Zeiten relativ zu „jetzt“; Kontakte und Schlüssel stehen in `DEMO_CONTACTS`):**
- Anna Meier (`last_rssi -92`; Nachrichten mit Zähler `ctr`, ohne `msg_ref`):
  1. in, jetzt − 12 min, gelesen: „Bin oben beim Gipfelkreuz. Hier gibt es keinen Handyempfang.“
  2. out, jetzt − 11 min, Delivered: „Wir sind bei der Hütte und kommen in etwa 20 Minuten.“
  3. out, jetzt − 9 min, Sent: „Wartest du dort auf uns?“
  4. in, jetzt − 2 min, **ungelesen**: „Ja, ich warte hier. Es ist ziemlich windig.“
- Luca Bernasconi (`last_rssi -100`): in, jetzt − 3 h, gelesen: „Basislager erreicht.“
- Mia Frei (`last_rssi -110`): out, gestern 19:12, Delivered: „Wir starten morgen um 7 Uhr.“
- Jonas Keller: Kontakt mit `state` `pending`, keine Nachrichten.
- Alle vier Kontakte kennt das Mock-Gerät ebenfalls (`MockDevice`), sonst überschreibt die Synchronisation sie beim Verbinden.

## 7. Einstellungen (`/einstellungen`, Referenz `Einstellungen.dc.html`)

(Hinweis: Der Abschnitt Standort steht in §10 und §11.)

Seite scrollt (`ion-content`), padding-bottom 32.
1. `og-topbar` „Einstellungen“, back `/kontakte`.
2. Block zentriert padding `20px 16px 8px`, gap 12: `og-avatar 72` (Quelle der Zellwerte offen, Skill `offgrid-design-system`) + Meta-Label „DEINE ID“ ¹
   (letter-spacing 0.08em) und darunter `identity().nodeId` (Mono, z. B. „E3F0“). Das frühere Vergleichsbild entfällt (Skill `offgrid-crypto-handshake` §4).
3. `og-section-label card` „PROFIL“ · `og-card padded` (gap 8): `og-text-field` „Anzeigename“ (**kein** `maxlength`) + Hint
   „Wird beim Hinzufügen an neue Kontakte übertragen.“ Bei `blurred`: wenn `isValidDisplayName` → speichern (`SettingsService.setDisplayName` **und** `id.set_name`
   am Gerät, das den Namen im nächsten QR-Code zeigt), sonst Fehler `name-invalid`.
4. „ANTENNE“ · `og-card`:
   - Zeile (Min-Höhe 60, gap 12): `og-status-dot` + „Verbunden“ (`unlocked`) / „Getrennt“ (sonst) (16px) + rechts `og-signal-bars md`.
   - `og-info-row` „Anschluss“ – „USB-C · Serial“
   - `og-info-row` „Frequenz“ – „<formatMHz(freq)> MHz“ (`radio.get` → `freq_mhz` × 10⁶; ohne Wert: „–“)
   - `og-info-row` „Firmware“ – `device().fwVersion` (ohne: „–“)
   - Grid 2 Spalten gap 10, padding `14px 16px`: `og-link-button secondary` „Neu verbinden“ → `/verbinden`;
     `og-button secondary` „Trennen“ → `disconnect()` (deaktiviert, wenn `disconnected`).
   - Funk-, Mesh- und LED-Einstellungen (`radio.*`, `mesh.*`, `led.*`) gibt es als Dienst, **noch ohne Oberfläche**.
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

> **T23-Hinweis zu §8 und §9:** Die Texte dort sprechen von „Schlüsseln“ in der Export-Datei. Die App besitzt keine Kontaktschlüssel mehr (sie liegen auf
> dem Gerät); der Export enthält Kontakte ohne Schlüssel und den Verlauf. Die Texte sind in T14 zu prüfen und mit dem Menschen abzustimmen.

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

## 10. Standort senden – Sheet im Chat (ab T18, Referenz `StandortSenden.dc.html`)

`features/chat/location-sheet.component.ts` in `og-sheet` mit Titel „Standort senden“. Beim Öffnen `LocationService.locate()`.
1. **Wird bestimmt:** Karte (padding 16, Radius 20, Grund `--og-bg`, Rahmen 1px `--og-border`, gap 14) mit Spinner
   (wie Step-List-Spinner) und Text „Standort wird bestimmt …“ (15px).
2. **Fix da:** gleiche Karte: Kachel 48×48 Radius 14 `--og-accent-soft` mit Icon `pin` 24 `--og-accent` ·
   Mono 16px/1.35 zweizeilig: Breite (z. B. „47.05021° N“) und Länge („8.30934° O“) ·
   darunter 13px `--og-text-3`: „Genauigkeit <formatAccuracy> · <formatAgo(fix.at)>“.
   Ist `accuracy > 100`: zusätzlich `og-note` „Ungenau – im Freien wird es meist besser.“
3. **Fehler:** `og-note` mit Fehlertext (§0) und `og-button secondary` „Erneut versuchen“ → `locate()`.
4. Text 14px/1.45 `--og-text-2`: „Wird per Funk an <name> gesendet – auch ohne Mobilnetz.“
5. Nur T19: `og-segmented` (ariaLabel „Art der Freigabe“) mit „Einmal“ · „15 Min. live“ · „60 Min. live“, Standard „Einmal“.
6. Buttons (gap 10): `og-button primary` Icon `send` „An <name> senden“ – nur aktiv mit Fix →
   `MessagingService.sendLocation(contactId, fix)`, Sheet schliessen. `og-button secondary` „Abbrechen“ → schliessen.

## 11. Standort ansehen (`/chat/:contactId/standort/:messageId`, ab T18, Referenz `StandortDetail.dc.html`)

Beim Öffnen: aus `MessagingService.messages(contactId)` die Nachricht mit `messageId` nehmen (inkl. `location`) und
`LocationService.locate()` für den eigenen Standort aufrufen. Nachricht fehlt → zurück zum Chat (replaceUrl).
**Eigene Nachricht (`out`):** Titel „Mein Standort“, **kein** Block 2 (kein Pfeil, keine Entfernung), in Block 3 nur
Koordinaten-Zeile und `og-info-row` „Gesendet“; Footer nur „In Karten-App öffnen“.
1. `og-topbar` „Standort von <name>“, back `/chat/:contactId`, backLabel „Zurück zum Chat“.
2. Block zentriert, padding `12px 24px 0`, gap 6:
   - `og-bearing-dial` mit `bearing` (eigener Fix → Ziel), `label` „Richtung <compassName>, <Grad gerundet> Grad“.
   - Entfernung 40/800, letter-spacing -0.03em (`formatDistance`); ohne eigenen Fix: „–“.
   - 15px `--og-text-2`: „Richtung <compassName> · <Grad>°“; ohne eigenen Fix: „Eigener Standort fehlt“.
   - 13px `--og-text-3` zentriert: „Norden ist oben. Richte das Handy nach Norden aus.“
3. `og-card` (margin `20px 16px 0`):
   - Zeile (Min-Höhe 56, padding `0 8px 0 16px`): Mono 13px `formatCoordinate` + `og-icon-button plain copy`
     „Koordinaten kopieren“ → `copyCoordinates`; danach 2 s Icon `check` und `aria-live`-Text „Kopiert“.
   - `og-info-row` „Empfangen“ – „<formatTime(recordedAt)> · <formatAccuracy>“ (bei eigener Nachricht Label „Gesendet“).
   - `og-info-row` „Dein Standort“ – „<formatAgo(myFix.at)> · <formatAccuracy>“ bzw. Fehlertext kurz „nicht verfügbar“.
4. Footer (padding `0 16px 26px`, gap 10): `og-button primary` Icon `map` „In Karten-App öffnen“ → `openInMaps`
   (Fehler `no-maps-app` als `og-note`); `og-button secondary` Icon `refresh` „Meinen Standort aktualisieren“ → `locate()`
   (während `locating` Text „Wird bestimmt …“ und deaktiviert).
5. Live (nur T19): Werte aktualisieren sich automatisch mit jeder neuen Koordinate; über dem Dial Mono 11px
   `--og-accent` „LIVE · BIS <HH:mm>“.

## 12. Gruppen (nur T20, optional)

Alle Gruppen-Screens und -Texte stehen im Skill `offgrid-groups` §5.

