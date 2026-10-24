import { TestBed } from '@angular/core/testing';

import { OgSignalBarsComponent } from './signal-bars.component';

describe('og-signal-bars', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OgSignalBarsComponent],
    });
  });

  it('zeigt bei Level 2 genau zwei aktive Balken', () => {
    const fixture = TestBed.createComponent(OgSignalBarsComponent);
    fixture.componentRef.setInput('level', 2);
    fixture.componentRef.setInput('label', 'Signal mittel');
    fixture.detectChanges();

    const bars = fixture.nativeElement.querySelectorAll('rect');
    expect(bars).toHaveLength(4);
    expect(fixture.nativeElement.querySelectorAll('rect.on')).toHaveLength(2);
    expect(fixture.nativeElement.querySelectorAll('rect.off')).toHaveLength(2);
  });

  it('setzt das aria-label der Balken', () => {
    const fixture = TestBed.createComponent(OgSignalBarsComponent);
    fixture.componentRef.setInput('level', 4);
    fixture.componentRef.setInput('label', 'Signal sehr gut');
    fixture.detectChanges();

    const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe('Signal sehr gut');
    expect(fixture.nativeElement.querySelectorAll('rect.on')).toHaveLength(4);
  });

  it('schaltet bei Level 0 alle Balken aus', () => {
    const fixture = TestBed.createComponent(OgSignalBarsComponent);
    fixture.componentRef.setInput('level', 0);
    fixture.componentRef.setInput('label', 'Ausser Reichweite');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('rect.on')).toHaveLength(0);
    expect(fixture.nativeElement.querySelectorAll('rect.off')).toHaveLength(4);
  });

  it('ist ohne Label rein dekorativ', () => {
    const fixture = TestBed.createComponent(OgSignalBarsComponent);
    fixture.componentRef.setInput('level', 2);
    fixture.componentRef.setInput('label', '');
    fixture.detectChanges();

    const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('aria-label')).toBeNull();
  });

  it('schaltet je Level genau so viele Balken an', () => {
    for (let level = 0; level <= 4; level++) {
      const fixture = TestBed.createComponent(OgSignalBarsComponent);
      fixture.componentRef.setInput('level', level);
      fixture.componentRef.setInput('label', 'Signal');
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('rect.on')).toHaveLength(level);
      expect(fixture.nativeElement.querySelectorAll('rect.off')).toHaveLength(4 - level);
    }
  });

  it('zeichnet die Balken in der Grösse sm kleiner', () => {
    const fixture = TestBed.createComponent(OgSignalBarsComponent);
    fixture.componentRef.setInput('level', 1);
    fixture.componentRef.setInput('label', 'Signal schwach');
    fixture.detectChanges();

    const md = fixture.nativeElement.querySelector('svg') as SVGElement;
    expect(md.getAttribute('width')).toBe('20');
    expect(md.getAttribute('height')).toBe('14');

    fixture.componentRef.setInput('size', 'sm');
    fixture.detectChanges();

    const sm = fixture.nativeElement.querySelector('svg') as SVGElement;
    expect(sm.getAttribute('width')).toBe('15');
    expect(sm.getAttribute('height')).toBe('11');
  });
});
