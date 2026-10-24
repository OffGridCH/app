# Status of the native Android app (branch `app-finish`)

Snapshot for the 02:00 team sync on 2026-10-24. The branch builds and passes
`./gradlew testDebugUnitTest lint assembleDebug assembleRelease` (lint: 0 errors). APKs:

- Debug: `app/build/outputs/apk/debug/app-debug.apk`
- Release-style, signed with the SDK debug key: `app/build/outputs/apk/release/app-release.apk`

Install with `adb install -r <apk>`; details in the [README](README.md). Everything runs against
the simulated antenna on the emulator; a real Heltec is the hardware agent's lane on `main`,
which is merged in (last merge: `1b19e72`, OGZ1 text codec).

## Done

- **Shared components** match the HTML designs and animate their state changes: buttons,
  switches (whole row toggles), segmented control (sliding highlight), badges, step list, signal
  bars, status dot, banners and notes (announced by TalkBack). Spinners, ripples and pulses stand
  still when animations are off.
- **Chat**: bubbles grouped like `Main.dc.html`, status changes cross-fade (queued dashed, sent
  solid, failed red), new bubbles animate in, reactions by long press with the own reaction under
  the bubble, sheets slide up over a fading scrim, bearing arrows turn the short way.
  Comparison: [`docs/compare/07-chat.png`](docs/compare/07-chat.png) (design left, app right).
- **Antenne verbinden**: the 3D render of the antenna as the hero, ring colours from the HTML, a
  ripple while searching. [`docs/compare/01-antenne-verbinden.png`](docs/compare/01-antenne-verbinden.png)
- **Wie heisst du?**: Done on the keyboard submits, names are capitalised, the notification
  permission is asked once at "Los gehts".
- **Kontakte**: type sizes from `Kontakte.dc.html`, a pending contact opens "Kontakt
  hinzufügen", the status line wraps as a unit at large font sizes.
  [`docs/compare/04-kontakte.png`](docs/compare/04-kontakte.png)
- **Kontakt hinzufügen, Handshake abgeschlossen**: pairing survives rotation, scanner brackets
  and texts per `Handshake.dc.html`, error states, debug-only helper buttons.
- **Einstellungen, Daten exportieren/importieren, Standort senden/ansehen, Gruppen**: HTML values,
  error states, notification permission when background receive is switched on.
- **Notifications**: one per conversation, none for the open chat, private on the lock screen,
  a tap opens the chat (also from a cold start).
- **Screen transitions**: shared-axis slide and fade.
- **Quality**: font scale 200 %, 360 dp and 480 dp wide, landscape, TalkBack labels; test menu
  and debug buttons only in debug builds.
- **Composer** counts on-air bytes with the antenna's text codec, so a lab image with OGZ1
  fits more text into the same 83 bytes; the team firmware is unchanged (raw UTF-8).
- **Einstellungen**: an edited name is saved when leaving the screen or pressing Done (it was
  lost before when the field still had focus).
- **Tests**: 26 new unit tests (message grouping, notifications and deep links, pairing UI
  state, backup forms, new group); the whole suite passes (71 tests, 6 hardware tests skipped
  without a board).
- **Screenshots**: every screen and state refreshed in [`docs/screenshots`](docs/screenshots);
  side-by-side with the designs in [`docs/compare`](docs/compare).

## Not verified

- A physical phone (none was attached to adb) and a real Heltec over USB from the app.
- Import end to end through the system file picker (export to the share sheet works; the
  encryption round trip is covered by unit tests).

## Open decisions for Artur

1. **83 bytes or 153 characters per radio message.** The app shows the antenna's
   `maxTextBytes` (83 with the current firmware); the designs show "153 Zeichen", the group
   design "120 Zeichen".
2. **PostHog key.** Analytics stays with the closed event list as built; no key was created.
   The key goes into `local.properties`. There is no in-app opt-out toggle in the designs.
3. **Groups.** Built as a preview against proposed `group.*` firmware commands that the
   firmware does not have; keep as preview, hide, or drop. The "Gruppe erstellen" button in the
   contact list header is not in `Kontakte.png`.
4. **Composer placeholder.** `Chat.png` shows "Nachricht an Anna", `chat-standort.png`
   "Nachricht an Anna Meier". The app follows the screens skill (display name).
5. **Release key.** The release-style APK is signed with the debug key; a store release needs a
   real key.
