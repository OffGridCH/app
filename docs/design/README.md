# Design-Referenz

Die Dateien in `screens/` stammen aus dem Design-Canvas. Es sind HTML-Dateien mit Inline-Styles in einem
Design-Format (`<x-dc>`, `{{…}}`, `<sc-for>`) – **nicht** im Browser lauffähig und **nicht** zum Kopieren gedacht.
Sie zeigen exakte Masse, Abstände und Texte des Normalzustands. Umsetzung immer mit den og-Komponenten und Tokens.

| Datei | Screen | Route |
|---|---|---|
| `Antenne.dc.html` | Antenne verbinden (Onboarding 1) | `/verbinden` |
| `KontakteLeer.dc.html` | Kontakte, Leerzustand | `/kontakte` |
| `Kontakte.dc.html` | Kontakte | `/kontakte` |
| `Handshake.dc.html` | Kontakt hinzufügen (beide Tabs) | `/kontakte/neu` |
| `KontaktBenennen.dc.html` | Handshake abgeschlossen | `/kontakte/neu/fertig/:id` |
| `Main.dc.html` | Chat | `/chat/:id` |
| `ChatGetrennt.dc.html` | Chat, Antenne getrennt, Nachricht fehlgeschlagen | `/chat/:id` |
| `Einstellungen.dc.html` | Einstellungen | `/einstellungen` |
| `Export.dc.html` | Daten exportieren | `/einstellungen/export` |
| `Import.dc.html` | Daten importieren | `/einstellungen/import` |

Farben in den Dateien entsprechen den Tokens in `.kilo/skills/offgrid-design-system/tokens.scss`.
Bei Abweichungen gelten **Skill-Texte und Tokens**, nicht die Referenz.
Das Schlüssel-Muster und der QR-Code sind in der Referenz Zufallsbeispiele.
