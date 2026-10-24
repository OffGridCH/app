import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { OgAvatarComponent, type OgAvatarSize } from './avatar.component';

/** Muster mit 25 Werten (Zeilen von oben, links nach rechts). */
const PATTERN: boolean[] = [
  true, false, true, false, true,
  false, true, false, true, false,
  true, false, true, false, true,
  false, true, false, true, false,
  true, false, true, false, true,
];

/** Zellgrösse, Lücke und Zellradius je Grösse (Skill `offgrid-design-system` §4, og-avatar). */
const METRICS: { size: OgAvatarSize; cell: string; gap: string; radius: string }[] = [
  { size: 40, cell: '4px', gap: '1px', radius: '1px' },
  { size: 48, cell: '5px', gap: '1px', radius: '1px' },
  { size: 56, cell: '5px', gap: '1px', radius: '1px' },
  { size: 72, cell: '7px', gap: '1.5px', radius: '1px' },
  { size: 96, cell: '9px', gap: '2px', radius: '2px' },
];

describe('og-avatar', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OgAvatarComponent],
    });
  });

  /** Avatar mit Grösse und Muster (Standard: `PATTERN`). */
  function createAvatar(
    size: OgAvatarSize,
    pattern: boolean[] = PATTERN,
  ): ComponentFixture<OgAvatarComponent> {
    const fixture = TestBed.createComponent(OgAvatarComponent);
    fixture.componentRef.setInput('size', size);
    fixture.componentRef.setInput('pattern', pattern);
    fixture.detectChanges();
    return fixture;
  }

  it('zeichnet ein 5×5-Raster mit 25 Zellen', () => {
    const fixture = createAvatar(48);

    const cells = fixture.nativeElement.querySelectorAll('.og-avatar__cell');
    expect(cells).toHaveLength(25);
  });

  it('schaltet genau die Zellen des Musters an', () => {
    const fixture = createAvatar(48);

    const on = fixture.nativeElement.querySelectorAll('.og-avatar__cell--on');
    expect(on).toHaveLength(PATTERN.filter((cell) => cell).length);
  });

  it('ist rein dekorativ (aria-hidden)', () => {
    const fixture = createAvatar(48);

    expect(fixture.nativeElement.getAttribute('aria-hidden')).toBe('true');
  });

  it('rendert in allen fünf Grössen die Masse des Skills', () => {
    for (const metric of METRICS) {
      const fixture = createAvatar(metric.size);
      const box = fixture.nativeElement.querySelector('.og-avatar') as HTMLElement;
      const grid = fixture.nativeElement.querySelector('.og-avatar__grid') as HTMLElement;
      const cell = fixture.nativeElement.querySelector('.og-avatar__cell') as HTMLElement;

      const boxStyle = box.getAttribute('style') ?? '';
      expect(boxStyle).toContain(`width: ${metric.size}px`);
      expect(boxStyle).toContain(`height: ${metric.size}px`);

      const gridStyle = grid.getAttribute('style') ?? '';
      expect(gridStyle).toContain(`repeat(5, ${metric.cell})`);
      expect(gridStyle).toContain(`grid-auto-rows: ${metric.cell}`);
      expect(gridStyle).toContain(`gap: ${metric.gap}`);

      expect(cell.getAttribute('style') ?? '').toContain(`border-radius: ${metric.radius}`);
    }
  });

  it('zeigt im Zustand pending kein Raster', () => {
    const fixture = TestBed.createComponent(OgAvatarComponent);
    fixture.componentRef.setInput('size', 40);
    fixture.componentRef.setInput('variant', 'pending');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.og-avatar__grid')).toBeNull();

    const box = fixture.nativeElement.querySelector('.og-avatar') as HTMLElement;
    expect(box.classList.contains('og-avatar--pending')).toBe(true);
    expect(box.getAttribute('style') ?? '').toContain('width: 40px');
  });
});
