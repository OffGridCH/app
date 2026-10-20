# T12 – Screen Chat

**Abhängig von:** T07, T10
**Skills:** `offgrid-screens` (§0, §6), `offgrid-design-system`
**Dateien:** `src/app/features/chat/`
**Referenz:** `docs/design/screens/Main.dc.html`, `ChatGetrennt.dc.html`

## Umfang
Seite laut Skill §6: Header mit Signal, Banner bei getrennter Antenne, Tagestrenner, Bubbles mit allen Status,
Retry, Leerzustand, Composer mit Byte-Limit, Auto-Scroll ans Ende, `markRead`.

## Akzeptanzkriterien
- [ ] Demo-Chat mit Anna: Aufbau und Masse wie Referenz `Main.dc.html`, Texte und Daten laut Skill §6.
- [ ] Senden zeigt sofort eine Bubble (queued → sent → zugestellt).
- [ ] `window.ogMock.drop()` → Banner + Placeholder „Wird später gesendet“; neue Nachricht bleibt „in Warteschlange“;
      `window.ogMock.restore()` → wird gesendet.
- [ ] `window.ogMock.failNext()` + Senden → „Nicht gesendet“ + „Erneut senden“ funktioniert.
- [ ] Beim Öffnen wird der Ungelesen-Zähler in der Kontaktliste 0.
- [ ] Prüfbefehle grün.
