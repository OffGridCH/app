# Standort

Ein Standort ist eine Nachricht vom Typ `geo` der Host-API (`msg.send` mit `lat`, `lon`, `age_s`). Die App baut kein Funkpaket; die Antenne kodiert die Koordinaten und
meldet einen eingehenden Standort als `msg.received`. Die App speichert ihn als Standort-Nachricht samt Koordinate; weil die Antenne keine Uhr hat, setzt die App den Zeitpunkt der
Messung als „jetzt minus `age_s`“. Quittungen sind für Standorte standardmässig aus, die Nachricht endet bei „gesendet“. Details in [Nachrichten](nachrichten.md).

!!! info "Geplant"

    GPS-Kern, Entfernung und Richtung folgen mit T17, die Oberfläche mit T18. Der Live-Standort (T19) ist offen: das `geo`-Paket kennt keine
    Freigabe-Kennung, das ist mit dem Firmware-Team zu klären.
