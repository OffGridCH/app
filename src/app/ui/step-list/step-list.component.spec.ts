import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { OgStepListComponent, type OgStep } from './step-list.component';

/** Die drei Zustände der Schritt-Liste (Skill `offgrid-design-system` §4, og-step-list). */
const STEPS: OgStep[] = [
  { label: 'Antenne verbinden', state: 'done' },
  { label: 'Schlüssel austauschen', state: 'active', meta: 'Wird übertragen' },
  { label: 'Kontakt benennen', state: 'todo' },
];

describe('og-step-list', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OgStepListComponent],
    });
  });

  /** Schritt-Liste mit den angegebenen Schritten. */
  function createStepList(steps: OgStep[] = STEPS): ComponentFixture<OgStepListComponent> {
    const fixture = TestBed.createComponent(OgStepListComponent);
    fixture.componentRef.setInput('steps', steps);
    fixture.detectChanges();
    return fixture;
  }

  /** Die Styles der gerenderten Komponenten (Angular hängt sie im `<head>` ein). */
  function componentStyles(): string {
    return Array.from(document.head.querySelectorAll('style'))
      .map((style) => style.textContent ?? '')
      .join('\n');
  }

  it('rendert eine geordnete Liste mit allen Schritten', () => {
    const fixture = createStepList();

    const list = fixture.nativeElement.querySelector('ol') as HTMLElement;
    expect(list).toBeTruthy();

    const items = fixture.nativeElement.querySelectorAll('.og-step-list__step');
    expect(items).toHaveLength(3);

    const labels = Array.from(
      fixture.nativeElement.querySelectorAll('.og-step-list__label'),
    ).map((label) => (label as HTMLElement).textContent?.trim());
    expect(labels).toEqual(['Antenne verbinden', 'Schlüssel austauschen', 'Kontakt benennen']);
  });

  it('zeigt bei einem erledigten Schritt ein Häkchen', () => {
    const fixture = createStepList();

    const marker = fixture.nativeElement.querySelector(
      '.og-step-list__step:first-child .og-step-list__marker',
    ) as HTMLElement;
    expect(marker.classList.contains('og-step-list__marker--done')).toBe(true);
    expect(marker.querySelector('og-icon')).toBeTruthy();
  });

  it('zeigt beim aktiven Schritt standardmässig einen pulsierenden Punkt', () => {
    const fixture = createStepList();

    expect(fixture.nativeElement.querySelector('.og-step-list__pulse')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.og-step-list__spinner')).toBeNull();
  });

  it('zeigt beim aktiven Schritt mit activeStyle spinner einen Spinner', () => {
    const fixture = TestBed.createComponent(OgStepListComponent);
    fixture.componentRef.setInput('steps', STEPS);
    fixture.componentRef.setInput('activeStyle', 'spinner');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.og-step-list__spinner')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.og-step-list__pulse')).toBeNull();
  });

  it('markiert einen offenen Schritt als todo', () => {
    const fixture = createStepList();

    const marker = fixture.nativeElement.querySelector(
      '.og-step-list__step:last-child .og-step-list__marker',
    ) as HTMLElement;
    expect(marker.classList.contains('og-step-list__marker--todo')).toBe(true);
    expect(marker.querySelector('og-icon')).toBeNull();
    expect(marker.querySelector('.og-step-list__pulse')).toBeNull();
    expect(marker.querySelector('.og-step-list__spinner')).toBeNull();
  });

  it('zeigt den Meta-Text des aktiven Schritts', () => {
    const fixture = createStepList();

    const meta = fixture.nativeElement.querySelector('.og-step-list__meta') as HTMLElement;
    expect(meta.textContent?.trim()).toBe('Wird übertragen');
    expect(meta.classList.contains('og-step-list__meta--active')).toBe(true);
  });

  it('verdichtet die Liste mit compact', () => {
    const fixture = createStepList();

    const list = fixture.nativeElement.querySelector('ol') as HTMLElement;
    expect(list.classList.contains('og-step-list--compact')).toBe(false);

    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();

    expect(list.classList.contains('og-step-list--compact')).toBe(true);
  });

  it('schaltet die Animationen bei prefers-reduced-motion ab', () => {
    createStepList();

    // jsdom wertet keine Media-Queries aus: geprüft wird deshalb die Regel im Stylesheet.
    const rule = /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?animation: none;/.exec(
      componentStyles(),
    );

    expect(rule).not.toBeNull();
    expect(rule?.[0]).toContain('.og-step-list__pulse');
    expect(rule?.[0]).toContain('.og-step-list__spinner');
  });
});
