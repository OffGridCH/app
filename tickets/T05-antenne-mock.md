# T05 – Antennen-Abstraktion, Frame-Codec, Mock-Antenne

**Abhängig von:** T04
**Skills:** `offgrid-antenna-protocol`, `offgrid-crypto-handshake` (§1), `offgrid-architecture`, `offgrid-testing`
**Dateien:** `src/app/core/antenna/**` (ohne `serial-antenna.service.ts`, `usb-serial.plugin.ts`),
`src/app/core/messaging/frame.ts`, `src/app/app.config.ts`, `src/app/core/app-start.service.ts`

## Umfang
- `antenna.port.ts` (abstrakte Klasse laut Architektur §4; Typen liegen in `core/models/antenna.ts`), `ndjson.ts` (Zeilenpuffer, wird in T06 genutzt).
- `frame.ts` laut Protokoll §5 (`encodeFrame`, `peekFrame`, `decodeFrame`).
- `mock-antenna.service.ts` laut Protokoll §8 inkl. `window.ogMock`-Hooks.
- Provider-Weiche `AntennaPort` in `app.config.ts`: vorerst **immer** `MockAntennaService` (T06 ergänzt Serial).
- `AppStartService.init()` Schritt 3 (connect im Hintergrund).

## Akzeptanzkriterien
- [ ] `peekFrame` verwirft zu kurze Frames, falsche Version und unbekannte Typen.
- [ ] Mock durchläuft beim Start die Zustände in der Reihenfolge laut Skill und meldet `info`.
- [ ] `window.ogMock` existiert nur mit Mock-Antenne.
- [ ] Prüfbefehle grün.

## Tests
`ndjson.spec.ts`, `frame.spec.ts`.
