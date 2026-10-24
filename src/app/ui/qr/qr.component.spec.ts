import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';

import { OgQrComponent } from './qr.component';

describe('og-qr', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OgQrComponent],
    });
  });

  /** QR-Komponente mit dem Inhalt rendern (der QR-Code wird asynchron erzeugt). */
  async function createQr(data = 'offgrid-test'): Promise<ComponentFixture<OgQrComponent>> {
    const fixture = TestBed.createComponent(OgQrComponent);
    fixture.componentRef.setInput('data', data);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('zeichnet den QR-Code als SVG auf der Karte', async () => {
    const fixture = await createQr();

    const card = fixture.nativeElement.querySelector('.og-qr__card') as HTMLElement;
    expect(card.getAttribute('role')).toBe('img');
    expect(card.getAttribute('aria-label')).toBe('QR-Code mit deinem Schlüssel');

    const svg = fixture.nativeElement.querySelector('.og-qr__code svg') as SVGElement;
    expect(svg).toBeTruthy();
    expect(svg.getAttribute('viewBox')).toBeTruthy();
  });

  it('zeichnet den QR-Code 230 × 230 Pixel gross', async () => {
    const fixture = await createQr();

    const svg = fixture.nativeElement.querySelector('.og-qr__code svg') as SVGElement;
    expect(svg).toBeInstanceOf(SVGElement);
    expect(svg.getAttribute('width')).toBe('230');
    expect(svg.getAttribute('height')).toBe('230');

    const modules = svg.querySelectorAll('rect');
    expect(modules.length).toBeGreaterThan(0);
  });

  it('rendert den QR-Code ohne innerHTML und ohne DomSanitizer', async () => {
    const sanitizer = TestBed.inject(DomSanitizer);
    const sanitize = vi.spyOn(sanitizer, 'sanitize');

    await createQr();

    expect(sanitize).not.toHaveBeenCalled();
    sanitize.mockRestore();
  });
});
