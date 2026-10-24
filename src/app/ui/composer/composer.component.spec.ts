import { type ComponentFixture, TestBed } from '@angular/core/testing';

import { OgComposerComponent } from './composer.component';

describe('og-composer', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OgComposerComponent],
    });
  });

  /** Composer mit 10 Bytes Limit und einfacher Byte-Zählung (ein Zeichen = ein Byte). */
  function createComposer(): ComponentFixture<OgComposerComponent> {
    const fixture = TestBed.createComponent(OgComposerComponent);
    fixture.componentRef.setInput('label', 'Nachricht an Anna');
    fixture.componentRef.setInput('sendLabel', 'Senden');
    fixture.componentRef.setInput('maxBytes', 10);
    fixture.componentRef.setInput('countBytes', (text: string) => text.length);
    fixture.detectChanges();
    return fixture;
  }

  async function type(fixture: ComponentFixture<OgComposerComponent>, value: string): Promise<void> {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('sperrt das Senden bei leerem Text', () => {
    const fixture = createComposer();
    const send = fixture.nativeElement.querySelector('.og-composer__send') as HTMLButtonElement;

    expect(send.disabled).toBe(true);

    return type(fixture, '   ').then(() => {
      expect(send.disabled).toBe(true);
    });
  });

  it('sperrt das Senden bei zu vielen Bytes', async () => {
    const fixture = createComposer();
    const send = fixture.nativeElement.querySelector('.og-composer__send') as HTMLButtonElement;

    await type(fixture, 'Das ist zu lang');

    expect(send.disabled).toBe(true);
    const counter = fixture.nativeElement.querySelector('.og-composer__counter') as HTMLElement;
    expect(counter.textContent?.trim()).toBe('15 / 10 Zeichen pro Funkspruch');
    expect(counter.classList.contains('og-composer__counter--over')).toBe(true);
  });

  it('erlaubt das Senden bei zu vielen Bytes mit blockOverLimit=false', async () => {
    const fixture = createComposer();
    fixture.componentRef.setInput('blockOverLimit', false);
    fixture.detectChanges();

    await type(fixture, 'Das ist zu lang');

    const send = fixture.nativeElement.querySelector('.og-composer__send') as HTMLButtonElement;
    expect(send.disabled).toBe(false);

    const counter = fixture.nativeElement.querySelector('.og-composer__counter') as HTMLElement;
    expect(counter.classList.contains('og-composer__counter--over')).toBe(true);
  });

  it('sendet mit Enter und leert das Feld', async () => {
    const fixture = createComposer();
    const sent: string[] = [];
    fixture.componentInstance.send.subscribe((text: string) => sent.push(text));

    await type(fixture, 'Hallo');
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(sent).toEqual(['Hallo']);
    expect(fixture.componentInstance.text()).toBe('');
    expect(input.value).toBe('');
  });

  it('färbt den Zähler nur bei Überschreitung', async () => {
    const fixture = createComposer();
    const counter = fixture.nativeElement.querySelector('.og-composer__counter') as HTMLElement;

    await type(fixture, 'Hallo');
    expect(counter.classList.contains('og-composer__counter--over')).toBe(false);
    expect(counter.textContent?.trim()).toBe('5 / 10 Zeichen pro Funkspruch');

    await type(fixture, 'Das ist zu lang');
    expect(counter.classList.contains('og-composer__counter--over')).toBe(true);
  });

  it('sendet mit Enter nicht, wenn der Text zu lang ist', async () => {
    const fixture = createComposer();
    const sent: string[] = [];
    fixture.componentInstance.send.subscribe((text: string) => sent.push(text));

    await type(fixture, 'Das ist zu lang');
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(sent).toEqual([]);
    expect(fixture.componentInstance.text()).toBe('Das ist zu lang');
  });

  it('zählt die Bytes über den Input countBytes', async () => {
    const fixture = createComposer();
    fixture.componentRef.setInput('countBytes', () => 42);
    fixture.detectChanges();

    await type(fixture, 'Hallo');

    const counter = fixture.nativeElement.querySelector('.og-composer__counter') as HTMLElement;
    expect(counter.textContent?.trim()).toBe('42 / 10 Zeichen pro Funkspruch');
  });
});
