# Hardware findings: the app against a real Heltec V3

Interim state of 2026-10-24, 01:45. The agent working on the link layer keeps this file current; the
final version adds the protocol comparison, the codec results and the second-antenna checklist.

## The board

| Item | Value |
| --- | --- |
| Board | Heltec WiFi LoRa 32 V3: ESP32-S3, SX1262, 8 MB flash, CP2102 USB-UART |
| `device_id` | `<board-1-id>` |
| Attached to | lab host, `/dev/ttyUSB0` |
| Ran when plugged in | A local OLED demo build (`feature/oled-driver` at `a23ff1b` plus uncommitted demo values, Arduino core 3.x / ESP-IDF 5.5.5). It draws the boot animation and a dashboard and prints nothing on the UART, so the app cannot talk to it. |
| Tested first | Team firmware `OffGridCH/firmware` `main` at `ed9fd57` ("Merge pull request #3 … feature/radio-driver"), default PlatformIO env `heltec_wifi_lora_32_V3`, reports `fw.version` `0.1.0-config-store.1`, `mock: true`, `mock_stage: 5` |
| Runs now | Private lab image `0.2.0-lab.1`: `ed9fd57` plus real LoRa messaging, env `lab_radio` of the lab firmware branch. Nothing was pushed to the OffGrid organisation. Back to the team image: `pio run -e heltec_wifi_lora_32_V3 -t upload` in the team repository. |

**Backup.** The full 8 MB flash was read before anything was written (esptool 5.6.0, 00:39).

- `board1-full-backup.bin`, sha256
  `recorded outside this repository`
- Copies on the lab host (with `app0.bin`, `app1.bin` and `nvs.bin` cut out of it) and on
  a second machine; both copies have the same hash.
- Restore the original demo exactly: `esptool --port /dev/ttyUSB0 write-flash 0 board1-full-backup.bin`.

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
already clears RTS before DTR, and the TCP bridge used for testing leaves both lines as opened, so
connecting never reboots the board.

## Mismatches between the specs, the team firmware and the app

| # | Topic | Spec | Team firmware `ed9fd57` | App before | Now |
| --- | --- | --- | --- | --- | --- |
| 1 | Reactions | `msg.send` with `type: "reaction"` and a `target` object | Rejects every reaction with `E_INVALID_ARG`: `args["target"].is<JsonObject>()` on a const ArduinoJson view is always false; it must be `is<JsonObjectConst>()` | Pairing sends a reaction as its ping, so every successful pairing was reported as failed; reactions in the chat fail | App: a failed ping no longer fails a stored pairing (`pingSent = false`). Firmware: fixed in the private lab fork only; the team repository still has the bug. |
| 2 | First line after connect | The host may send right after opening | Answers the first `sys.hello` at once | `LineFramer` threw away the first line after opening, so every connect lost its first answer and waited for the 500 ms retry | Fixed: a first line is kept when it parses as a complete JSON object; a partial tail cannot. |
| 3 | Radio | Messages travel over LoRa (protocol spec) | No GitHub image sends chat over the radio. The default env simulates delivery (`mock: true`); `radio_diag` exposes `radio.*` and rejects `msg.*` | Shows simulated delivery as real | The private lab image sends and receives for real (see below). |
| 4 | Authentication | X25519 + HKDF + AES-GCM token wrap | `authentication: "bypassed-envelope-shape-only"`: any token of the right shape unlocks | Performs the real handshake | Works, but the board does not verify it yet. |
| 5 | Persistence | Identity, contacts and provisioning survive a reboot | Only the config store is in NVS; identity, contacts and the provisioned flag live in RAM | Assumes they persist | After a power cycle the app sees an unprovisioned board and must pair again. The lab image stores them in NVS. |
| 6 | Text budget | `limits.max_text_bytes`, 83 UTF-8 bytes | 83 | Uses the value from `sys.hello` (default 83) | Matches. The designs' "153 Zeichen" is not reachable with plain UTF-8; see the codec experiment below. |
| 7 | Boot time | App retries `sys.hello` for about 5 s | `default` has no boot animation | | The OLED driver branch (`feature/oled-driver`) plays a blocking 6.6 s boot animation in `setup()`. Merged as it is, the app would report a failed connect after every plug-in. The animation should run frame by frame from `loop()`. |
| 8 | `sys.boot` | Sent once at boot | Sent once at boot, so a host that connects later never sees it | Does not depend on it | Matches. |
| 9 | `msg.send` result | `bytes_on_air`, `est_airtime_ms` | 39 bytes and 268 ms for a 22-byte text at SF9/BW125 | | Matches the protocol spec (17 + 22 bytes) and the airtime formula (267.3 ms). On the lab image the radio measures 274–275 ms from TX start to TxDone: the formula plus about 7 ms of PA ramp, SPI and interrupt latency. |
| 10 | Retry timeout | Protocol 12.2: `(2 × hops + 2) × (airtime + jitter) × 2^retry` | Simulated | | Real numbers on the lab image at SF9: with the default 3 hops a lost text waits 8.5, 17, 34 and 68 s, so `failed` arrives after about 2 minutes; with 0 hops after about 32 s. The chat should show `retrying` as progress, not as an error. |
| 11 | Lock while sending | Board locks after 15 s without heartbeat | Fails pending messages with reason `locked` | | The app must keep its heartbeat running while messages are pending, also in the background; otherwise a retrying message fails as `locked`. |

## What already works against the real board

`RealAntennaTest` runs the app's own `LinkClient`, framing, `Pairing` and `AntennaManager` code against the
board through a TCP bridge on the lab host (`lab/tools/bridge.py` in the lab firmware repository). All six tests
pass against `ed9fd57`:

1. `sys.hello`, `sec.provision`, `sec.unlock`, `sys.status`, `id.get`, `contact.list`, `config.get`
2. Error codes from the Link spec: `E_UNKNOWN_CMD`, `E_NO_SESSION`, `E_NO_SUCH_CONTACT`, `E_INVALID_ARG`,
   `E_INVALID_QR` and a malformed line
3. Pairing with the spec's Bob test vector, `E_TOO_LONG` above 83 bytes, the `msg.status` sequence of a send
4. Heartbeat timeout: the board locks after 15 s without traffic and `sec.unlock` recovers it
5. Reconnecting does not reset the board
6. `AntennaManager` reaches `READY`

Run them with a bridge on the lab host and a tunnel to it (`ssh -N -L 7755:127.0.0.1:5555 lab-host`):

```
OFFGRID_TCP_LINK=127.0.0.1:7755 ./gradlew testDebugUnitTest --tests '*RealAntennaTest*'
```

Without `OFFGRID_TCP_LINK` the tests are skipped, so CI and other machines are unaffected. The other unit
tests pass as before.

The same six tests pass against the lab image, where the send is a real transmission: `sent`, three
`retrying` with RETRY 1 to 3 on air, then `failed` with reason `timeout`, because no second board answers.
The pairing ping (a reaction) is accepted there.

Not verified yet: a phone over USB (none was attached to adb) and a reception from a second radio.

## Lab radio image (private)

The lab image keeps the team's host layer and Link API and replaces the simulated delivery with protocol
v1 on the SX1262: per-contact keys from X25519 and HKDF, AES-128-CCM with 8-byte tags, 24-bit counters
with a 64-packet replay window, ACKs bound to the original counter, retries with RETRY + 1, keyed dedupe,
managed flooding with SNR-weighted relay delay, LBT/CAD and a 10 % duty-cycle token bucket. Identity,
provisioning and contacts persist in NVS (plain, not the encrypted vault of link spec 10; lab boards only).
`sys.hello` adds `lab_radio: true`, `text_codec` and `limits.max_text_input_bytes`; `mock` stays `true`
because authentication is still the team's shape-only check.

Evidence from the board on the lab host, 2026-10-24:

- `lab.selftest` on the ESP32: 15/15 checks against the protocol spec's worked examples (keys, node IDs,
  directional keys, text packet, ACK, reaction, location, HOP_LEFT outside the MIC, tamper rejection).
- `lab/tools/lab_check.py`, 19/19: the board pairs with the spec's Bob key; what its radio transmits is
  decrypted in Python with Bob's key, and Bob's packets are crafted in Python and fed in with `lab.inject`.
  Covered: real TX and measured airtime, delivery by ACK, `contact.state active`, receiving a text with the
  board's ACK verified in Python, duplicate suppression, re-ACK of a retry, reaction, location with altitude
  and age, a forged packet rejected, a transit packet relayed with HOP_LEFT − 1, and four transmissions with
  RETRY 0 to 3 followed by `failed`/`timeout`.

What only a second Heltec can show: reception over the air (RSSI/SNR, CRC errors), a real ACK coming back
(`delivered` without injection), relaying between two radios, CAD seeing a busy channel, and range.

## Byte and airtime budget (first estimate)

Every packet carries 17 bytes of overhead: the 8-byte header (routing, DST, SRC, CTR), the 1-byte inner
header and the 8-byte AES-CCM tag. An ACK is 16 bytes. Airtime with the team's LoRa settings (869.525 MHz,
CR 4/5, preamble 8, explicit header, CRC), computed with the same formula as the firmware:

| Packet | Bytes | SF7/BW250 | SF9/BW125 (default) | SF11/BW125 | SF12/BW125 |
| --- | ---: | ---: | ---: | ---: | ---: |
| ACK | 16 | 26 ms | 165 ms | 659 ms | 1319 ms |
| Reaction | 20 | 28 ms | 185 ms | 741 ms | 1319 ms |
| Location | 23 | 31 ms | 206 ms | 823 ms | 1483 ms |
| Text, 22 bytes | 39 | 41 ms | 267 ms | 1069 ms | 1974 ms |
| Text, 40 bytes | 57 | 54 ms | 349 ms | 1397 ms | 2630 ms |
| Text, 83 bytes (max) | 100 | 87 ms | 554 ms | 2216 ms | 3940 ms |

The band 869.40–869.65 MHz allows 10 % duty cycle per transmitter, 360 s per hour. At SF9 one board can
send about 1000 forty-byte texts per hour, so the budget is not the limit for a chat. The shared channel is:
a 40-byte text with its ACK occupies about 0.5 s of air at SF9 and 4 s at SF12, and each relay hop repeats
it. Shorter packets mean fewer collisions and more range per second of air, which is what the codec
experiment below measures.

## Bandwidth experiment (in progress)

A private lab firmware fork tests a compact TEXT body: a static Huffman code over characters plus a
German, Swiss German and English phrase dictionary, signalled with the spec's existing "compressed" flag
in the inner header. The packet format and crypto stay as specified. It is off by default; when it is on,
`sys.hello` reports `text_codec: "ogz1"` and `limits.max_text_input_bytes`. Measurements on a German
message set, Unishox2 for comparison, and the airtime saved per preset follow in the final version.

## Link-side changes in the app

- `link/tcp/TcpLink.kt` and `link/HardwareLinks.kt` (new): `hardwareLink(context)` returns a `TcpLink` when
  a debug build sets `OFFGRID_TCP_LINK=host:port` in `local.properties` (the emulator reaches the desktop
  as `10.0.2.2`), and the USB link otherwise. Release builds always use USB.
- `AppContainer.kt`: one line, `usbLink = hardwareLink(context)`.
- `link/LineFramer.kt`: keeps a complete first line (finding 2).
- `domain/Pairing.kt`: the ping after `pair.complete` no longer turns a stored contact into a pairing
  error (finding 1).
- No public signature that UI code calls has changed.
