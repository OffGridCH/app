import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { KontaktZeileComponent, type KontaktZeile } from './kontakt-zeile.component';

/** Eine Zeile mit Kontakt, letzter Nachricht und Signal. */
const ZEILE: KontaktZeile = {
  contactId: 7,
  name: 'Anna Meier',
  pattern: new Array<boolean>(25).fill(true),
  preview: 'Ja, ich warte hier.',
  time: '14:06',
  unread: 1,
  level: 3,
  signal: 'Signal gut',
};

describe('KontaktZeileComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
  });

  /** Erzeugt die Zeile (als Kontakt oder als ausstehender Kontakt). */
  function createZeile(pending = false) {
    const fixture = TestBed.createComponent(KontaktZeileComponent);
    fixture.componentRef.setInput('zeile', ZEILE);
    fixture.componentRef.setInput('pending', pending);
    fixture.detectChanges();
    return fixture;
  }

  it('zeigt Name, Vorschau, Zeit und Badge', () => {
    const fixture = createZeile();

    expect(fixture.nativeElement.querySelector('.zeile__name')?.textContent?.trim()).toBe('Anna Meier');
    expect(fixture.nativeElement.querySelector('.zeile__preview')?.textContent?.trim()).toBe(
      'Ja, ich warte hier.',
    );
    expect(fixture.nativeElement.querySelector('.zeile__time')?.textContent?.trim()).toBe('14:06');
    expect(fixture.nativeElement.querySelector('.og-badge')?.textContent?.trim()).toBe('1');
  });

  it('verlinkt die Zeile auf den Chat des Kontakts', async () => {
    const fixture = createZeile();
    await fixture.whenStable();

    const link = fixture.nativeElement.querySelector('a.zeile') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/chat/7');
  });

  it('zeigt die Signalbalken mit der Ansage des Levels', () => {
    const fixture = createZeile();

    const bars = fixture.nativeElement.querySelector('og-signal-bars svg') as SVGElement;
    expect(bars.getAttribute('aria-label')).toBe('Signal gut');
    expect(fixture.nativeElement.querySelectorAll('og-signal-bars rect.on')).toHaveLength(3);
  });

  it('zeigt einen ausstehenden Kontakt ohne Klick und ohne Signalansage', () => {
    const fixture = createZeile(true);

    expect(fixture.nativeElement.querySelector('a.zeile')).toBeNull();
    expect(fixture.nativeElement.querySelector('div.zeile')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.zeile__pending')?.textContent?.trim()).toBe(
      'Schlüssel ausstehend',
    );
    const bars = fixture.nativeElement.querySelector('og-signal-bars svg') as SVGElement;
    expect(bars.getAttribute('aria-hidden')).toBe('true');
    expect(fixture.nativeElement.querySelectorAll('og-signal-bars rect.on')).toHaveLength(0);
  });

  it('zeigt bei einem Kontakt ohne Nachricht den Platzhalter', () => {
    const fixture = TestBed.createComponent(KontaktZeileComponent);
    fixture.componentRef.setInput('zeile', { ...ZEILE, preview: 'Noch keine Nachrichten', time: '', unread: 0 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.zeile__preview')?.textContent?.trim()).toBe(
      'Noch keine Nachrichten',
    );
    expect(fixture.nativeElement.querySelector('.zeile__time')?.textContent?.trim()).toBe('');
    expect(fixture.nativeElement.querySelector('.og-badge')).toBeNull();
  });

  it('meldet Änderungen der Zeile', () => {
    const fixture = createZeile();

    fixture.componentRef.setInput('zeile', { ...ZEILE, name: 'Luca Bernasconi' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.zeile__name')?.textContent?.trim()).toBe('Luca Bernasconi');
  });

  it('hebt die Vorschau einer ungelesenen Nachricht hervor', () => {
    const fixture = createZeile();

    // Ungelesen → kräftigere Farbe (Skill `offgrid-screens` §3).
    expect(fixture.nativeElement.querySelector('.zeile__preview--unread')).not.toBeNull();

    fixture.componentRef.setInput('zeile', { ...ZEILE, unread: 0 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.zeile__preview--unread')).toBeNull();
  });
});
