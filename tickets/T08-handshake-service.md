# T08 – HandshakeService (ersetzt durch T23)

**Status: Kern erledigt durch T23 (PR #12). Nicht starten.**

Das Pairing macht die Antenne (`pair.begin`, `pair.complete`). `core/handshake/handshake.service.ts` liefert `begin`, `cancel`, `complete`,
`syncContacts`, `refreshContact`, `rename`, `remove`, `qrText`, `qrExpiresAt`, `error`, `completedContactId`, `clearCompleted`
(siehe Skill `offgrid-crypto-handshake` §3). Die Schlüssel-Rollen, die Frames `hs`/`hsa`, `HandshakeView` und `pending` entfallen.

Was aus diesem Ticket **noch fehlt**: `scan()` und `core/handshake/scanner.ts` (Browser-Variante mit `window.prompt`, nativ) – das erledigt T11.
