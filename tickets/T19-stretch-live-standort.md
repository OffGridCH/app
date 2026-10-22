# T19 – (Optional) Live-Standort

**Abhängig von:** T18
**Status-Hinweis:** Optional. Startet erst, wenn der Mensch es freigibt (in `STATUS.local.md` auf `offen` setzen).
**Skills:** `offgrid-location` (§5), `offgrid-screens` (§6 Punkt 5, §10, §11), `offgrid-design-system`, `offgrid-data`, `offgrid-testing`
**Dateien:** `src/app/core/location/`, `src/app/core/messaging/`, `src/app/core/data/**` (nur `messageIdForShare`), `src/app/features/chat/`, `src/app/features/standort/`,
`src/app/ui/location-bubble/`, `src/testing/**` (nur Tester)

## Umfang
Live-Freigabe 15 oder 60 Minuten, Update alle 2 Minuten nur im Vordergrund, alle Updates in **einer** Bubble,
„Beenden“ für die eigene Freigabe, Anzeige „Live · bis HH:mm“ / „Live beendet“.

## Akzeptanzkriterien
- [ ] Intervall exakt 2 Minuten, nie kürzer; Pause bei App-Hintergrund.
- [ ] Empfänger zeigt nur eine Bubble pro Freigabe, Werte aktualisieren sich.
- [ ] „Beenden“ stoppt sofort, es folgen keine weiteren Frames.
- [ ] Prüfbefehle grün.

## Tests
`location.service.spec.ts` bzw. `messaging.service.spec.ts`: mit Fake-Timern 3 Updates in 4 Minuten; Empfänger hängt
Koordinaten an dieselbe Nachricht an (gleiche `shareId`); nach `share_until` keine Updates mehr.
