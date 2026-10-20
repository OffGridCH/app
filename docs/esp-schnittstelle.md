# OffGrid – Schnittstelle App ↔ Antenne (Vorschlag v1)

Zum Abstimmen zwischen App (Frontend) und Antennen-Firmware (ESP32 + LoRa 868 MHz).
Die App behandelt die Antenne als **reines Funkmodem**: Sie gibt fertige, verschlüsselte Pakete zum Senden und
bekommt empfangene Pakete samt Signalstärke zurück. Verschlüsselung, Kontakte und Zustellbestätigungen macht die App.

## 1. Verbindung

- USB-C, USB-CDC oder USB-UART (CP210x/CH340) – bitte angeben, welcher Chip/Modus.
- 115200 Baud, 8N1. Die App setzt DTR/RTS auf `true` nach dem Öffnen.
- **Bitte prüfen:** Darf DTR/RTS einen Reset des ESP auslösen? Wenn ja, muss die Firmware nach dem Boot sofort
  auf `hello` reagieren können.

## 2. Format

- Eine Nachricht = **eine Zeile JSON**, abgeschlossen mit `\n`. Nur ASCII. Max. 512 Zeichen pro Zeile.
- Unbekannte Felder werden ignoriert (vorwärtskompatibel).
- Binärdaten (Funkpakete) als **Base64** im Feld `p`.

## 3. Befehle App → Antenne

| t | Felder | Erwartete Antwort |
|---|---|---|
| `hello` | `proto: 1` | `info` innerhalb von 3 s (die App versucht es bis zu 3× – reicht für einen Neustart durch DTR) |
| `tx` | `id` (8 Hex-Zeichen), `p` (Base64, max. `max` Bytes nach Dekodierung) | `txdone` mit derselben `id`, wenn gefunkt (Ziel < 10 s) |
| `ping` | – | `pong` |

## 4. Meldungen Antenne → App

| t | Felder | Bedeutung |
|---|---|---|
| `info` | `proto` (1), `fw` (z. B. `"1.0.0"`), `freq` (Hz, z. B. `868100000`), `max` (max. Paketgrösse in Bytes) | Antwort auf `hello` |
| `txdone` | `id`, `ok` (bool), `err` (`"busy"` \| `"too_long"` \| `"radio"`) | Paket gefunkt bzw. nicht |
| `rx` | `p` (Base64), `rssi` (dBm, Integer), `snr` (dB, Zahl) | Jedes empfangene LoRa-Paket, ungefiltert |
| `pong` | – | Antwort auf `ping` |
| `log` | `msg` | Debug-Ausgabe (optional) |

**Wichtig:** Ausser diesen Zeilen bitte **nichts** auf die Serial-Schnittstelle schreiben (kein `Serial.println("Booting…")`),
oder nur als `{"t":"log","msg":"…"}`.

## 5. Beispiel

```
→ {"t":"hello","proto":1}
← {"t":"info","proto":1,"fw":"1.0.0","freq":868100000,"max":222}
→ {"t":"tx","id":"a1b2c3d4","p":"EQx4..."}
← {"t":"txdone","id":"a1b2c3d4","ok":true}
← {"t":"rx","p":"EQx4...","rssi":-92,"snr":7.25}
→ {"t":"ping"}
← {"t":"pong"}
```

## 6. Verhalten

- Die App sendet alle 5 s `ping`. Kommt 15 s lang keine Zeile, gilt die Antenne als getrennt.
- `tx` während die Antenne sendet: in eine Warteschlange legen (bevorzugt) oder `txdone ok:false err:"busy"`.
- Empfangene Pakete **alle** weitergeben (auch eigene Echos sind ok – die App filtert).

## 7. Zu klären (bitte ausfüllen)

| Frage | Antwort |
|---|---|
| Max. LoRa-Payload in Bytes (`max`) | |
| Spreading Factor / Bandbreite / Coding Rate | |
| Duty-Cycle-Begrenzung (868 MHz: 1 %) – wie gehandhabt? | |
| USB-Chip / CDC? Reset bei DTR? | |
| Firmware-Versionsschema | |
| Wer testet die Gegenstelle (zweites Gerät) wann? | |

## 8. Was die App ins Paket `p` packt (nur zur Info)

`[1 Byte Version/Typ][4 Byte Empfänger-Tag][12 Byte IV][verschlüsselte Daten + 16 Byte Auth-Tag]` –
Mindestgrösse 33 Bytes. Die Antenne muss den Inhalt nicht verstehen.
