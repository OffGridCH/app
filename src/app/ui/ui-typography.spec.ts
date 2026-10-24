import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { readProjectSource } from '../../testing/project-source';

import { OgBannerActionComponent } from './banner/banner-action.component';
import { OgNoteComponent } from './banner/note.component';

/**
 * Prüft die Schriftschnitte der UI-Komponenten gegen den Skill `offgrid-design-system` §2.
 *
 * Die Komponenten dürfen keine eigenen Rohwerte für Schrift definieren, sondern müssen
 * die Mixins aus `src/theme/typography.scss` verwenden (`og-type-action` 14 px/700,
 * `og-type-note` 14 px/1.45). Das wird zweimal geprüft: über das berechnete CSS der
 * gerenderten Komponente und über den Quelltext der Komponente.
 */

/** Liefert den Inhalt eines Mixins aus `src/theme/typography.scss`. */
function readMixin(name: string): string {
  const source = readProjectSource('src/theme/typography.scss');
  const start = source.indexOf(`@mixin ${name} {`);

  expect(start, `Mixin ${name} fehlt in src/theme/typography.scss`).toBeGreaterThan(-1);

  const end = source.indexOf('}', start);
  expect(end, `Mixin ${name} ist nicht geschlossen`).toBeGreaterThan(start);

  return source.slice(start, end);
}

describe('Typografie der UI-Komponenten', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OgBannerActionComponent, OgNoteComponent],
      providers: [provideRouter([])],
    });
  });

  it('og-banner-action rendert den Typ og-type-action (14 px / 700)', () => {
    const fixture = TestBed.createComponent(OgBannerActionComponent);
    fixture.componentRef.setInput('routerLink', '/einstellungen');
    fixture.detectChanges();

    const action = fixture.nativeElement.querySelector('a') as HTMLElement;
    const style = getComputedStyle(action);

    expect(style.fontSize).toBe('14px');
    expect(style.fontWeight).toBe('700');
  });

  it('og-note rendert den Typ og-type-note (14 px / 1.45)', () => {
    const fixture = TestBed.createComponent(OgNoteComponent);
    fixture.componentRef.setInput('text', 'Der Akku ist fast leer.');
    fixture.detectChanges();

    const note = fixture.nativeElement.querySelector('.og-note__text') as HTMLElement;
    const style = getComputedStyle(note);

    expect(style.fontSize).toBe('14px');
    expect(style.lineHeight).toBe('1.45');
    expect(style.fontWeight).toBe('400');
  });

  it('og-banner-action verwendet den Mixin og-type-action statt eigener Rohwerte', () => {
    const source = readProjectSource('src/app/ui/banner/banner-action.component.ts');

    expect(source).toContain('@include og-type-action;');
    expect(source).not.toMatch(/font-size:/);
    expect(source).not.toMatch(/font-weight:/);
    expect(source).not.toMatch(/line-height:/);
  });

  it('og-note verwendet den Mixin og-type-note statt eigener Rohwerte', () => {
    const source = readProjectSource('src/app/ui/banner/note.component.ts');

    expect(source).toContain('@include og-type-note;');
    expect(source).not.toMatch(/font-size:/);
    expect(source).not.toMatch(/font-weight:/);
    expect(source).not.toMatch(/line-height:/);
  });

  it('die Mixins og-type-action und og-type-note sind in src/theme/typography.scss definiert', () => {
    const action = readMixin('og-type-action');
    expect(action).toContain('font-size: 14px;');
    expect(action).toContain('font-weight: 700;');

    const note = readMixin('og-type-note');
    expect(note).toContain('font-size: 14px;');
    expect(note).toContain('line-height: 1.45;');
    expect(note).toContain('font-weight: 400;');
  });
});
