---
name: offgrid-location
description: Standort-Funktion von OffGrid – eigenen GPS-Standort bestimmen, als Funk-Nachricht senden und empfangen, Entfernung und Richtung berechnen, Karten-App öffnen, Koordinaten kopieren, optional Live-Standort. Laden bei allem in core/location, bei Standort-Frames und bei den Standort-Screens.
---

# Standort

Ziel: Im Gelände ohne Netz wissen, **wo** der andere ist – und **wie weit / in welche Richtung**.
Es gibt **keine Karte in der App** (ohne Internet keine Kartenkacheln). Stattdessen: Entfernung + Himmelsrichtung +
Richtungspfeil (Norden oben) und ein Knopf, der die Koordinaten an eine Offline-Karten-App auf dem Handy übergibt.

## 1. Geo-Funktionen (`core/location/geo.ts`, reine Funktionen, mit Tests)

```ts
type LatLon = { latitude: number; longitude: number };
distanceMeters(a: LatLon, b: LatLon): number      // Haversine, Erdradius 6 371 000 m
bearingDegrees(from: LatLon, to: LatLon): number  // Anfangskurs 0–359.9, 0 = Norden, im Uhrzeigersinn
compassName(deg: number): string                  // 8 Sektoren à 45°, Mitte bei 0/45/90…:
  // „Norden“, „Nordosten“, „Osten“, „Südosten“, „Süden“, „Südwesten“, „Westen“, „Nordwesten“
formatDistance(m: number): string                 // zuerst runden, dann Einheit wählen: r = auf 10 m gerundet;
                                                  // r < 1000 → „850 m“; sonst k = auf 0.1 km gerundet; k < 10 → „1.2 km“;
                                                  // sonst ganze km „12 km“. Zahlen mit Intl 'de-CH' (995 m → „1.0 km“, 9999 m → „10 km“)
formatCoordinate(lat: number, lon: number): string // 5 Nachkommastellen, Betrag + Halbkugel: „47.05021° N, 8.30934° O“
                                                  // (S bei lat < 0, W bei lon < 0)
formatCoordinatePlain(lat, lon): string           // zum Kopieren: „47.05021, 8.30934“
formatAccuracy(m: number): string                 // „±8 m“ (gerundet, mind. 1)
formatAgo(iso: string, now: Date): string         // < 1 min „gerade eben“, < 60 min „vor <n> Min.“,
                                                  // < 24 h „vor <n> Std.“, sonst formatListTime(iso, now)
roundCoord(v: number): number                     // auf 6 Nachkommastellen (für den Funk-Frame)
```

## 2. LocationService (`core/location/location.service.ts`)

- `locate()`:
  1. `locating = true`, `error = null`.
  2. **Browser/Mock** (`!isNative()` oder Mock aktiv): **immer** den Demo-Fix `{ latitude: 47.05021, longitude: 8.30934,
     accuracy: 8, at: <jetzt> }` nach 600 ms zurückgeben, ohne Geolocation aufzurufen (reproduzierbare Demo). Weiter bei 6.
  3. Nativ: `Geolocation.checkPermissions()`; erlaubt ist `location === 'granted' || coarseLocation === 'granted'`.
     Sonst `requestPermissions({ permissions: ['location', 'coarseLocation'] })` und erneut so prüfen;
     nicht erlaubt → `error = 'location-denied'`, Ende (null).
  4. `Promise.race` aus `Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 })`
     und einem eigenen 20-s-Timer. Ergebnis → `GeoFix` (`accuracy` auf ganze m gerundet,
     `at = new Date(position.timestamp).toISOString()`) → `myFix` setzen, zurückgeben.
  5. Fehler: eigener Timer zuerst → `'location-timeout'`; jeder andere Fehler → `'location-unavailable'`. Rückgabe null.
  6. Immer am Ende `locating = false`.
- `isFresh(fix, now)`: `now - fix.at <= 10 min`.
- `LocationErrorCode = 'location-denied' | 'location-timeout' | 'location-unavailable' | 'no-maps-app'`
- Android-Manifest (T17): `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`,
  `<uses-feature android:name="android.hardware.location.gps" android:required="false" />`.
- GPS funktioniert **ohne** Mobilnetz/Internet. Kein Hintergrund-Standort.

## 3. Senden und Empfangen (in `MessagingService`)

`sendLocation(contactId, fix)`:
1. Nachricht speichern: `kind 'location'`, `content ''`, `wireId` neu, Status `Queued`, `sent_at` = jetzt.
2. Koordinate speichern: `contactId`, `messageId`, Werte aus `fix` (gerundet mit `roundCoord`), `context 'einmal'`,
   `recordedAt = fix.at`.
3. Senden/Warteschlange/`txdone`/`ack`/Retry **genau wie bei Text** (Skill `offgrid-antenna-protocol` §6).
   Frame-Typ `loc` statt `msg`.

Empfang `loc`: wie `msg` (Duplikat über `wireId`, `ack` senden, Signal aktualisieren), aber `kind 'location'`,
`content ''` und eine Koordinate aus dem Frame (`recordedAt` aus `t`). Ohne `s` (shareId) → `context 'einmal'`.

Vorschautext in der Kontaktliste für `kind 'location'`: „Standort“ bzw. „Du: Standort“.

## 4. Karten-App und Kopieren (`core/location/maps.ts`, ab T18)

- `openInMaps(lat, lon, label): Promise<LocationErrorCode | null>`: nativ direkt
  `const { completed } = await AppLauncher.openUrl({ url: 'geo:<lat>,<lon>?q=<lat>,<lon>(' + encodeURIComponent(label) + ')' })`
  (**kein** `canOpenUrl` – das prüft auf Android nur Paketnamen). `completed === false` oder Fehler →
  Koordinaten kopieren und `'no-maps-app'` zurückgeben; sonst null.
  Browser: `window.open('https://www.openstreetmap.org/?mlat=<lat>&mlon=<lon>#map=15/<lat>/<lon>', '_blank')`.
- `copyCoordinates(lat, lon)`: `Clipboard.write({ string: formatCoordinatePlain(lat, lon) })`; Browser: `navigator.clipboard.writeText`.
- Offline-Hinweis (nur Doku, nicht UI): Für Karten ohne Netz eine Offline-Karten-App mit heruntergeladenem Gebiet
  installieren (z. B. Organic Maps oder OsmAnd). Die App übergibt nur die Koordinaten.

## 5. Live-Standort (nur T19, optional)

- Im Sende-Sheet zusätzlich `og-segmented` mit `einmal` „Einmal“, `15` „15 Min. live“, `60` „60 Min. live“.
- Live: sofort senden, danach alle **2 Minuten** neuer Fix und neuer `loc`-Frame, bis `share_until` erreicht ist oder
  „Beenden“ gedrückt wird. **Nur solange die App im Vordergrund ist** (Timer pausiert bei `App` `pause`, läuft bei `resume`
  weiter, holt aber keine verpassten Sendungen nach).
- Alle Live-Updates gehören zu **einer** Nachricht: Frame-Felder `s` (shareId, 8 Hex) und `e` (Ende, Unix-Sekunden).
- Sender: Das **erste** Update ist eine normale Standort-Nachricht (Warteschlange, Status, Retry, `ack` wie Text).
  **Folge-Updates** werden ohne Warteschlange und ohne Retry gesendet (nur wenn Antenne `ready`, sonst überspringen),
  bekommen je eine neue zufällige `wireId` nur für den Frame und speichern lokal nur eine neue Koordinate an der ersten
  Nachricht. Ihre `ack`s werden ignoriert.
- Empfänger: `CoordinateRepository.messageIdForShare(contactId, shareId)` liefert eine Nachricht → nur neue Koordinate
  anhängen (Duplikat, wenn gleiche `recorded_at` schon da ist), trotzdem `ack` senden. Sonst wie normales `loc`.
- Funk-Last: 1 Frame / 2 min ist für das 1-%-Duty-Cycle-Limit unkritisch. Kürzere Intervalle sind nicht erlaubt.

## 6. Grenzen (ehrlich)

- Der Richtungspfeil zeigt die Richtung **relativ zu Norden**, nicht relativ zur Handyausrichtung (kein Kompass-Sensor).
- Genauigkeit hängt vom GPS ab; über 100 m Ungenauigkeit zeigt die App einen Hinweis.
- Entfernung wird nur angezeigt, wenn der eigene Standort höchstens 10 Minuten alt ist.
