# T01 – UI-Basis 1: Grundkomponenten

**Abhängig von:** T00
**Skills:** `offgrid-design-system`
**Dateien:** `src/app/ui/**`
**Referenz:** `docs/design/screens/Einstellungen.dc.html`, `Export.dc.html`

## Ziel
Die einfachen og-Komponenten exakt laut Skill §4.

## Umfang
`og-icon` (alle Icons der Tabelle §3), `og-button`, `og-link-button`, `og-icon-button`, `og-topbar`, `og-section-label`,
`og-card`, `og-info-row`, `og-status-dot`, `og-badge`, `og-text-field`, `og-switch`, `og-segmented`.
Je Komponente ein Ordner unter `src/app/ui/`, Klassenname `Og<Name>Component`, Selektor `og-<name>`.
`src/app/ui/index.ts` exportiert alle.

## Akzeptanzkriterien
- [ ] Inputs/Outputs/Models genau wie im Skill benannt und typisiert.
- [ ] Alle Masse über Tokens; Typografie über Mixins.
- [ ] `og-switch` und `og-segmented` haben die ARIA-Rollen/-Attribute laut Skill.
- [ ] `og-button` rendert `<button>`, `og-link-button`/`og-icon-button` mit `routerLink` rendern `<a>`.
- [ ] Prüfbefehle grün.

## Tests
Keine Pflichttests.

## Nicht im Umfang
Seiten, Services, `og-avatar`, `og-signal-bars`, `og-banner`, `og-step-list`, `og-message-bubble`, `og-composer`, `og-qr` (T02).
