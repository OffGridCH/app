# T03 – Zeitformate, Krypto-Basis, Schlüssel-Muster, Signal-Level

**Abhängig von:** T00, T21
**Skills:** `offgrid-crypto-handshake`, `offgrid-screens` (nur §0), `offgrid-antenna-protocol` (nur §5 „Längen“ und §7), `offgrid-testing`
**Dateien:** `src/app/core/format/`, `src/app/core/crypto/`, `src/app/core/messaging/signal.ts`, `src/app/core/messaging/limits.ts`

## Umfang
- `core/format/time.ts` und `core/format/radio.ts` mit den Signaturen aus `offgrid-screens` §0.
- `core/messaging/limits.ts`: `contentBytes`, `maxContentBytes`, `isValidDisplayName` laut `offgrid-antenna-protocol` §5.
- `core/crypto/hex.ts`, `base64.ts`, `crypto.service.ts` (§1), `key-pattern.service.ts` (§4).
- `core/messaging/signal.ts`: `signalLevel(rssi, seenAt, now)` laut Antennen-Skill §7 und `signalLabel(level)` mit
  den Texten aus `offgrid-screens` §0.

## Akzeptanzkriterien
- [ ] Funktionssignaturen exakt wie in den Skills.
- [ ] Nur WebCrypto, keine Pakete.
- [ ] Prüfbefehle grün.

## Tests
`hex.spec.ts`, `base64.spec.ts`, `crypto.service.spec.ts`, `key-pattern.service.spec.ts`, `signal.spec.ts`, `limits.spec.ts`, `time.spec.ts`, `radio.spec.ts`.
