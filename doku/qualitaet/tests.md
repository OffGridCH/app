# Tests

Stand: **nach T01**. Der Test-Runner ist Vitest mit jsdom über den Angular-Builder.
Einmal, headless: `npm run test:ci`.

| Testdatei | Prüft |
|---|---|
| `src/app/app.component.spec.ts` | dass die App-Komponente erstellt wird (T00) |
| `src/app/ui/index.spec.ts` | die og-Grundkomponenten: der Barrel `src/app/ui/index.ts` exportiert alle 13 Komponenten, `og-button` rendert ein `<button>` und meldet Klicks, `og-link-button` ein `<a>` mit `routerLink`, `og-icon-button` je nach Route ein `<button>` oder ein `<a>`, `og-switch` die Rolle `switch` mit `aria-checked`, `og-segmented` eine `tablist` mit `aria-selected`, `og-text-field` die Zwei-Wege-Bindung des Werts und `og-icon` die Standardgrösse des gewählten Namens (T01) |

!!! info "Geplant"

    Diese Seite wird ab T03 gefüllt: Welche Testdatei prüft welchen Bereich der App (Codec, Formate,
    Repositories, Antenne).
