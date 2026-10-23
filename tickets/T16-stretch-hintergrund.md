# T16 – (Stretch) Empfang im Hintergrund

**Abhängig von:** T15
**Skills:** `offgrid-architecture`, `offgrid-antenna-protocol`
**Status-Hinweis:** Nur starten, wenn der Mensch es freigibt (neues Paket nötig). Bis dahin `blockiert`.

## Problem
Android beendet bzw. drosselt die App im Hintergrund – dann bricht die USB-Serial-Verbindung ab.

## Vorschlag (vom Menschen zu entscheiden, dann Ticket präzisieren)
- Paket `@capawesome-team/capacitor-android-foreground-service` (muss in „Erlaubte Pakete“ ergänzt werden).
- Bei `bgReceive === true` und Antenne `unlocked`: Foreground-Service mit dauerhafter Benachrichtigung „OffGrid empfängt Nachrichten“.
- **Heartbeat nötig:** Die Antenne sperrt sich nach 15 s ohne gültige Zeile der App. Der Dienst muss daher auch im Hintergrund alle 5 s `sys.ping` senden
  (sonst sperrt die Antenne, der Funk geht aus und es kommen keine Nachrichten mehr an).
- Benachrichtigung bei neuer Nachricht: `@capacitor/local-notifications` (ebenfalls ergänzen).

## Falls T16 nicht umgesetzt wird
Zeile „Im Hintergrund empfangen“ in den Einstellungen entfernen (Text verspricht sonst etwas, das nicht funktioniert).
