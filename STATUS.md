# Status of the native Android app (branch `app-finish`)

Snapshot for the 02:00 team sync on 2026-10-24. The branch builds; the debug APK is at
`app/build/outputs/apk/debug/app-debug.apk` (install with `adb install -r <apk>`). Everything
runs against the simulated antenna on the emulator; a real Heltec is the hardware agent's lane
on `main`, which is merged in (last merge: `381869c`, TCP bridge to a real Heltec).

## Done

- **Shared components** match the HTML designs more closely and animate their state changes:
  buttons, switches (whole row toggles), segmented control (sliding highlight), badges, step
  list, signal bars, status dot, banners and notes (announced by TalkBack). Spinners and pulses
  stand still when the system animation scale is 0 (reduced motion).
- **Chat**: bubbles grouped like `Main.dc.html` (8 dp gap where the direction changes, the
  second outgoing bubble in a row tucks its top corner in), status changes cross-fade
  (queued dashed → sent solid → failed red), new bubbles animate into place. Reactions open
  with a real long press (a tap no longer does) and the own reaction shows under the bubble.
  Sheets slide up with a fading scrim. Bearing arrows turn the short way round.
  Comparison: [`docs/compare/07-chat.png`](docs/compare/07-chat.png) (design left, app right).
- **Antenne verbinden**: ring colours from the HTML, 16 sp intro, a ripple while searching
  (off with reduced motion); debug builds switch to the simulated antenna with a long press
  on the hero. [`docs/compare/01-antenne-verbinden.png`](docs/compare/01-antenne-verbinden.png)
- **Wie heisst du?**: Done on the keyboard submits, names are capitalised.
- **Kontakte**: type sizes from `Kontakte.dc.html`; a pending contact opens "Kontakt
  hinzufügen" like the design link. [`docs/compare/04-kontakte.png`](docs/compare/04-kontakte.png)
- **Release hygiene**: the test menu (long press on "OffGrid") exists only in debug builds.
- Tests: new unit tests for the message row grouping (5/5 pass), existing suite unchanged.

Older full-screen captures of every screen are in [`docs/screenshots`](docs/screenshots);
they are refreshed at the end.

## In progress

- Kontakt hinzufügen and Handshake abgeschlossen: pairing that survives rotation, scanner
  brackets and texts per `Handshake.dc.html`, debug-only helper buttons, error states
  (subagent, separate worktree).
- Einstellungen, Daten exportieren/importieren, Standort ansehen, Gruppen: HTML values,
  notification permission when background receive is switched on, error states (subagent).
- Message notifications with a deep link into the chat, notification permission at
  "Los gehts", screen transitions.
- The 3D render of the real antenna (`offgrid-antenna-3d/renders`) as the connect hero, once
  the renders are final.
- Font scale 200 %, 360 dp and large phones, TalkBack pass, lint, release-style APK signed
  with the debug key, refreshed screenshots and README.

## Open decisions for Artur

1. **83 bytes or 153 characters per radio message.** The app shows the antenna's
   `maxTextBytes` (83 with the current firmware); the designs show "153 Zeichen".
2. **PostHog key.** Analytics stays with the closed event list and opt-out as built; no key
   was created. The key goes into `local.properties` once decided. There is no in-app
   opt-out toggle in the designs.
3. **Groups.** Built as a preview against proposed `group.*` firmware commands that the
   firmware does not have yet; keep as preview, hide, or drop.
4. **Composer placeholder.** `Chat.png` shows "Nachricht an Anna" (first name), the screens
   skill says `<display_name>`. The app follows the PNG.
