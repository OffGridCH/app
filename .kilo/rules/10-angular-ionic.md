# 10 – Code-Konventionen Angular / Ionic

## Angular

- Nur **Standalone Components**. Keine NgModules.
- `changeDetection: ChangeDetectionStrategy.OnPush` in jeder Komponente.
- Abhängigkeiten mit `inject()`, nicht über den Konstruktor.
- Komponenten-Inputs mit `input()` / `input.required()`, Outputs mit `output()`. Keine `@Input`/`@Output`-Decorators.
- Zustand in Services als `signal()`, abgeleitet mit `computed()`. Komponenten lesen nur Signals.
- Die App ist **zoneless** (kein `zone.js`, kein `provideZoneChangeDetection`). Jede asynchrone Änderung
  (Plugin-Events, `setTimeout`, Promises) schreibt in ein Signal – sonst aktualisiert sich die Oberfläche nicht.
- Templates: `@if`, `@for (x of xs; track x.id)`, `@switch`. Kein `*ngIf`/`*ngFor`.
- RxJS nur dort, wo eine Bibliothek Observables liefert. Sofort mit `toSignal()` oder in ein Signal überführen.
- Kein `any`. Kein `as unknown as`. Typen liegen in `src/app/core/models/`.
- Keine Logik im Template ausser einfachen Bedingungen. Alles andere als `computed()` in der Komponente.
- Datum/Zeit-Formatierung nur über `src/app/core/format/time.ts` (siehe Skill `offgrid-screens`).

## Ionic

- Import immer aus `@ionic/angular` (Ionic 9), `provideIonicAngular({ mode: 'md' })`. Nie `@ionic/angular/standalone`
  oder `@ionic/angular/lazy`, nie `IonicModule`.
- Erlaubte Ionic-Komponenten: `ion-app`, `ion-router-outlet`, `ion-header`, `ion-content`, `ion-footer`.
  Alles Sichtbare (Buttons, Listen, Inputs, Schalter, Karten) sind **eigene `og-` Komponenten** aus `src/app/ui/`.
- `ion-header` und `ion-footer` immer mit Klasse `ion-no-border`.
- Ionic-Farben werden in `src/theme/global.scss` auf die Tokens gemappt. Keine Ionic-Farbattribute (`color="primary"`).

## Styles

- **Nur Tokens** aus `src/theme/tokens.scss` (`var(--og-…)`). Keine Hex-Farben in Komponenten.
- Keine globalen Klassen ausser denen in `global.scss`. Komponentenstyles sind gekapselt.
- Abstände/Grössen exakt wie im Skill `offgrid-design-system`. Keine eigenen Werte.
- Layout mit Flex/Grid + `gap`. Margins nur dort, wo der Skill sie ausdrücklich nennt.

## Barrierefreiheit (Pflicht)

- Klickbares ist `<button>` oder `<a>`, nie ein `div` mit Klick.
- Icon-Buttons brauchen `aria-label` (deutscher Text aus dem Skill).
- Jedes Eingabefeld hat ein `<label for>`.
- Touch-Ziele mindestens 44 × 44 px.

## Fehlerbehandlung

- Services werfen keine rohen Fehler in die UI. Sie setzen einen Fehlerzustand (Signal) mit einem
  Fehlercode aus `src/app/core/models/errors.ts`. Die Seite zeigt den deutschen Text aus dem Skill.
- `console.log` nur über `src/app/core/log.ts` (`log.debug/info/warn/error`), in Produktion nur `warn`/`error`.
