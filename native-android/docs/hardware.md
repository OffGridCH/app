# Hardware findings: the app against a real Heltec V3

State of 2026-10-24, 02:50. Written by the agent that worked on the link layer, the lab firmware and the
text codec. Everything firmware-side lives in the lab firmware branch
(branch `lab`); nothing was pushed to the OffGrid organisation.

## The boards

| Item | Board 1 | Board 2 |
| --- | --- | --- |
| Hardware | Heltec WiFi LoRa 32 V3: ESP32-S3, SX1262, 8 MB flash, CP2102 USB-UART | same |
| `device_id` | `<board-1-id>` | `<board-2-id>` |
| Ran when plugged in | A local OLED demo build: `feature/oled-driver` at `a23ff1b` plus uncommitted demo values, Arduino core 3.x / ESP-IDF 5.5.5. It drew the boot animation and a dashboard and printed nothing on the UART. | A team build with the OLED screens of `integration/oled` (strings "Start pairing in the app", "Hold PRG for 3 s to erase"), Arduino core 2.x / ESP-IDF 4.4.7, team config store in NVS. It printed the ROM boot log and did not answer `sys.hello` on the CP2102 UART. |
| Backup | `board1-full-backup.bin`, sha256 `recorded outside this repository` | `board2-full-backup.bin`, sha256 `recorded outside this repository` |
| Backup location | the lab host plus a second copy, outside this repository | the same |
| Runs now | Lab image `0.2.0-lab.2` (`e154992`), paired with board 2, OGZ1, handed to Artur | the same, paired with board 1, handed to Nils |

Both backups are full 8 MB reads made before anything was written; the lab host also keeps `app0.bin`, `app1.bin`
and `nvs.bin` cut out of each. To restore a board exactly as it came:

```
esptool --port /dev/ttyUSB0 write-flash 0 board1-full-backup.bin   # board 1
esptool --port /dev/ttyUSB0 write-flash 0 board2-full-backup.bin   # board 2
```

To put the team image on instead: `pio run -e heltec_wifi_lora_32_V3 -t upload` in the team repository.

## The serial protocol it really speaks

The team image speaks the Link spec as written: JSON Lines on UART0 through the CP2102, 115200 8N1, one
object per line, at most 2048 bytes. `sys.hello` answers like this (session values shortened):

```json
{"id":1,"ok":true,"result":{"device":"heltec_wifi_lora_32_v3","chip":"ESP32-S3","device_id":"<board-1-id>",
 "fw":{"version":"0.1.0-config-store.1","build":"Oct 24 2026"},"proto":"1.0","state":"locked","mock":true,
 "mock_stage":5,"radio_diagnostics":false,"config_storage":"nvs","config_schema":1,
 "authentication":"bypassed-envelope-shape-only","session":{"device_eph_pub":"…","nonce":"…"},
 "limits":{"max_line":2048,"max_contacts":32,"max_text_bytes":83,"pending_queue":8}}}
```

DTR/RTS drive the ESP32 auto-reset: RTS asserted with DTR released resets the board. `UsbSerialLink`
clears RTS before DTR, and the TCP bridge used for testing leaves both lines as opened, so connecting never
reboots the board.

## Mismatches between the specs, the team firmware and the app

| # | Topic | Spec | Team firmware | App before | Now |
| --- | --- | --- | --- | --- | --- |
| 1 | Reactions | `msg.send` with `type: "reaction"` and a `target` object | `ed9fd57` rejects every reaction with `E_INVALID_ARG`: `args["target"].is<JsonObject>()` on a const ArduinoJson view is always false; it must be `is<JsonObjectConst>()` | Pairing sends a reaction as its ping, so every successful pairing was reported as failed | App: a failed ping no longer fails a stored pairing. Firmware: fixed in the lab fork only. |
| 2 | First line after connect | The host may send right after opening | Answers the first `sys.hello` at once | `LineFramer` dropped the first line after opening, so every connect waited for the 500 ms retry | Fixed: a first line is kept when it parses as a complete JSON object. |
| 3 | Radio | Messages travel over LoRa | No team image sends chat over the radio. The default env simulates delivery (`mock: true`); `radio_diag` exposes `radio.*` and rejects `msg.*` | Shows simulated delivery as real | The lab image sends and receives for real. |
| 4 | Authentication | X25519 + HKDF + AES-GCM token wrap | `authentication: "bypassed-envelope-shape-only"` | Performs the real handshake | Works; the board does not verify it yet (team and lab). |
| 5 | Persistence | Identity, contacts and provisioning survive a reboot | Only the config store is in NVS | Assumes they persist | The lab image stores identity, provisioning, name, codec and contacts in NVS; verified with an EN reset on both boards. |
| 6 | Text budget | `limits.max_text_bytes`, 83 UTF-8 bytes | 83 | Uses `sys.hello` | Matches. With OGZ1 a TEXT of up to 160 input bytes fits (see below). |
| 7 | Boot time | App retries `sys.hello` for about 8 s | `a23ff1b` played a blocking 6.6 s boot animation in `setup()` | | Upstream `ceb6843` (#6) now draws the animation from `tick()` and only blocks 100 ms in `init()`. The lab image also starts the panel from `tick()`; `sys.hello` answers in the same 220 ms during the animation as after it, and 1.2 s after a reset. |
| 8 | `sys.boot` | Sent once at boot | Sent once, a later host never sees it | Does not depend on it | Matches. |
| 9 | `msg.send` result | `bytes_on_air`, `est_airtime_ms` | 39 bytes, 268 ms for a 22-byte text at SF9/BW125 | | Matches. The radio measures the formula plus 7–8 ms (PA ramp, SPI, interrupt latency). |
| 10 | Retry timeout | Protocol 12.2: `(2 × hops + 2) × (airtime + jitter) × 2^retry` | Simulated | | Real at SF9 with 3 hops: 8.5, 17, 34 and 68 s, so `failed` arrives after about 2 minutes; 0 hops about 32 s. The spec's example of about 6 s assumes far less jitter. |
| 11 | Lock while sending | Board locks after 15 s without heartbeat | Fails pending messages with reason `locked` | | The app keeps its heartbeat running; it must also do so in the background while messages are pending. |
| 12 | Protocol update `d8cc28d` | Shared data/ACK counters, reservations persisted before use, authentication before relay dedupe, own packets in the dedupe cache | Spec only | | Implemented in the lab engine. |
| 14 | Pairing salt lifetime | Both boards derive the contact keys from both QR salts; "do not refresh between being scanned and scanning back" | `pair.begin` draws a new salt on every call and `pair.complete` discards it | `Pairing.begin()` calls `pair.begin` whenever the pairing screen opens, also after scanning the peer and before the peer scans back | Field test 2026-10-24: the boards paired with matching fingerprints, every packet arrived (RSSI −15 dBm) and failed its tag, so nothing was delivered. Lab `0.2.0-lab.2` (`e154992`) keeps the salt for the 5-minute window; reproduced before and passing after with `two_board_check.py --app-flow`. The team firmware still has it. |
| 15 | Re-pairing a known key | `replace: true` re-pairs an existing contact | `E_CONTACT_EXISTS` without `replace` | Shows "contact exists" and keeps the old keys | A side that kept stale keys must delete the contact or re-pair with `replace`; the app does not offer that yet. |
| 13 | `RealAntennaTest` with OGZ1 | | | | A build with `OFFGRID_TEXT_CODEC=ogz1` switches the board to OGZ1 in `antennaManagerReachesReady`, so `pairBobFromTheSpecAndSendText` no longer gets `E_TOO_LONG` for its long text. Expected; 6/6 with `raw`. |

## What works against the real boards

- `lab.selftest` on the ESP32: 15/15 checks against the protocol spec's worked examples.
- `lab/tools/lab_check.py`, 23/23 on both boards with the flashed image `eaf4606`: the board pairs with the
  spec's Bob key, its transmissions are decrypted in Python with Bob's key, and Bob's packets are crafted
  in Python and fed in with `lab.inject`. Covered: real TX and measured airtime, delivery by ACK,
  `contact.state active`, receiving a text with the board's ACK verified in Python, duplicate suppression,
  re-ACK of a retry, reaction, location, a forged packet rejected, a transit packet relayed with
  HOP_LEFT − 1, RETRY 0 to 3 then `failed`/`timeout`, and OGZ1 both ways (127-byte text in a 64-byte
  packet, 60-byte reply in 17 bytes, an incompressible 160-byte text rejected).
- `RealAntennaTest` (the app's own `LinkClient`, framing, `Pairing`, `AntennaManager`): 6/6 against the
  team image `ed9fd57` and the lab image with `raw`; 5/6 with the phone build's OGZ1 setting (finding 13).
- Emulator UI against board 1 through the bridge: connect, contact sync, a text shown as «gesendet».
- A phone over USB: handed to Artur and Nils with the APK; not observed by the agent. Their first
  two-board test failed on finding 14.
- Two boards over the air (`lab/tools/two_board_check.py`, both on the lab host with `0.2.0-lab.2`): pairing in the
  phones' order, text both ways, location and reaction, each received and delivered with ACK, RSSI −14 to
  −17 dBm, SNR 10.5 to 11.5 dB at about 1 m, no tag failures, 17/17. The pairing survives a reset.

```
# bridge on the lab host, tunnel from the development machine
ssh -N -L 7755:127.0.0.1:5555 lab-host
OFFGRID_TCP_LINK=127.0.0.1:7755 ./gradlew testDebugUnitTest --tests '*RealAntennaTest*'
```

Without `OFFGRID_TCP_LINK` these tests are skipped, so CI and other machines are unaffected.

## Lab radio image (private)

The lab image keeps the team's host layer and Link API and replaces the simulated delivery with protocol
v1 on the SX1262: per-contact keys from X25519 and HKDF, AES-128-CCM with 8-byte tags, 24-bit counters
with a 64-packet replay window, ACKs bound to the original counter, retries with RETRY + 1, keyed dedupe,
managed flooding with SNR-weighted relay delay, LBT/CAD and a 10 % duty-cycle token bucket. Persistence
is plain NVS, not the encrypted vault of link spec 10; lab boards only. `sys.hello` adds
`lab_radio: true`, `text_codec` and `limits.max_text_input_bytes`; `mock` stays `true` because
authentication is still the team's shape-only check. Lab commands: `lab.selftest`, `lab.get`,
`lab.set {text_codec}`, `lab.inject`, `lab.oled`.

### OLED

The display runs the team's merged drawing code from `ceb6843` (PRs #5 and #6): the boot animation and the
Home, Radio, Pairing and Factory reset screens, fed from the lab engine. PRG (short press) turns the page.

- Home: lock state, name, node ID, phone icon from link traffic within 12 s, frequency, SF/BW, contacts
  n/32, queue n/8, and the last activity. A received message shows sender and signal as the team's demo
  build did (`#E841  -92dBm ✓✓`); sends show `Sent ✓`, `Delivered ✓✓` or `Send failed`.
- Radio: TX/RX packets from the SX1262 and RSSI/SNR of the last packet.
- Pairing: the 5-minute countdown during `pair.begin`, then the fingerprint after a new pairing.
- Measured on both boards: 299 boot frames in 6624 ms, one 128-byte row per loop pass, longest loop
  pass in the display 5.8 ms.
- `lab.oled {row: 0..7}` dumps the frame on the panel; `lab/tools/oledshot.py` turns it into PNGs.

Demo values recovered from board 1's flash backup by disassembling `setup()` of the demo build: name
`Alice`, own node `#E3F0`, lock closed, phone connected, 869.525 MHz SF9 BW125, contacts 3/32, queue 0/8,
received `#E841  -92dBm` with two ticks. Alice (E3F0) and Bob (E841) are the protocol spec's worked
example. `lab.oled {demo: true}` shows exactly that screen. In live use the upstream rule holds: a locked
board shows `Locked` and `-` instead of name and counts.

## Protocol comparison: bytes and airtime before and after

Every packet carries 17 bytes of overhead (8-byte header, 1-byte inner header, 8-byte AES-CCM tag); an ACK
is 16 bytes. Airtime at 869.525 MHz, CR 4/5, preamble 8, explicit header, CRC. The codec numbers come from
150 synthetic test messages (German, Swiss German, English, emoji), not from real chats.

| Message | Before (team spec, raw) | After (OGZ1) | SF9/BW125 before → after | SF11/BW125 before → after |
| --- | ---: | ---: | ---: | ---: |
| TEXT, median message | 52 B | 35 B | 329 → 247 ms | 1315 → 987 ms |
| TEXT, mean over the test set | | | 367 → 267 ms (−27 %) | 1454 → 1052 ms (−28 %) |
| TEXT, maximum | 100 B for 83 input bytes | 100 B for up to 160 input bytes | 554 ms | 2216 ms |
| ACK | 16 B | 16 B | 165 ms | 660 ms |
| Reaction | 20 B | 20 B | 185 ms | 741 ms |
| Location | 23 B | 23 B | 206 ms | 823 ms |

| Codec on the TEXT body | Mean / median bytes | Saved | Messages that fit 83 B |
| --- | ---: | ---: | ---: |
| Raw UTF-8 | 42.6 / 35 | | 92 % |
| Unishox2 (comparison) | 29.2 / 24 | 31 % | 100 % |
| OGZ1 (static Huffman, dictionary, canned phrases) | 20.5 / 18 | 52 % | 100 % |

Exchanges per hour within the 10 % duty cycle at SF9 (text plus ACK, no retries): 729 raw, 875 with OGZ1
direct; 243 and 292 over three hops on one shared channel. Further levers that were measured but not built:
a 4-byte MIC, a 16-bit counter on air and a per-pair link ID would save another 12 %.

OGZ1 is sent only when strictly shorter than raw and is signalled with the spec's "compressed" flag; the
header and crypto stay as specified. A board with the team image cannot read OGZ1 texts. Details and
vectors: `lab/protocol/` in the lab repository.

## Two-board test checklist

Both boards carry `eaf4606` in factory state (869.525 MHz, SF9, BW125). Both phones need the same APK so
that both boards switch to OGZ1.

1. Each phone connects its own board; both OLEDs show the open lock and `connected`.
2. Boards at least a few metres apart, better in different rooms; side by side the receiver can overload.
3. Both open "Kontakt hinzufügen" and scan each other's QR code within 5 minutes (both directions).
4. Both OLEDs show the same fingerprint; compare it, close the overlay with PRG.
5. A sends a text to B: A shows «gesendet», then ✓✓ and `Delivered ✓✓` on its OLED; B shows the message
   and `#<A's node>  -xxdBm ✓✓`; the contact turns active on the first packet.
6. The other direction, a reaction and a location.
7. PRG to the Radio page: RX packets and RSSI/SNR now come from the other board.
8. Unplug and replug one board: contact and unlock survive; send again.
9. Optional, with a third board in between: relaying, visible as a higher `hops` in `msg.status`.

If `Nicht gesendet` appears after about 2 minutes: check the distance, that both scanned each other's
code, and that both phones run the same APK.

## Link-side changes in the app

- `link/tcp/TcpLink.kt`, `link/HardwareLinks.kt`: a debug build with `OFFGRID_TCP_LINK=host:port` in
  `local.properties` talks to a real board through the bridge; release builds always use USB.
- `AppContainer.kt` (the UI agent's file, two small changes): `usbLink = hardwareLink(context)`, and
  `defaultLinkKind()` picks the real link on the emulator when a debug build sets `OFFGRID_TCP_LINK`.
- `link/LineFramer.kt`: keeps a complete first line (finding 2).
- `domain/Pairing.kt`: the ping after `pair.complete` no longer turns a stored contact into an error.
- `domain/AntennaManager.kt`: `AntennaState` gains `textCodec` and `maxTextInputBytes` (both defaulted),
  read from `sys.hello`; on a lab image the app selects `BuildConfig.TEXT_CODEC` with `lab.set`.
  `sys.hello` is retried 16 times (8 s).
- `domain/Limits.kt`: new `MessageLimits.onAirTextBytes(text, codec, maxInputBytes)` and
  `canSend(text, antenna)`; `canSend(text, maxBytes)` is unchanged.
- `link/codec/OgzCodec.kt`, `OgzTables.kt`: the OGZ1 encoder, byte-identical to the firmware.
- `app/build.gradle.kts`: `OFFGRID_TEXT_CODEC` in `local.properties` (`ogz1` or `raw`) sets
  `BuildConfig.TEXT_CODEC`.
- No public signature that UI code calls was removed or changed.
