import { TestBed } from '@angular/core/testing';

import { OgMessageBubbleComponent } from './message-bubble.component';

describe('og-message-bubble', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OgMessageBubbleComponent],
    });
  });

  it('zeigt bei failed den Button „Erneut senden“ und löst retry aus', async () => {
    const fixture = TestBed.createComponent(OgMessageBubbleComponent);
    const retry = vi.fn();
    fixture.componentInstance.retry.subscribe(retry);
    fixture.componentRef.setInput('direction', 'out');
    fixture.componentRef.setInput('status', 'failed');
    fixture.componentRef.setInput('text', 'Super, bis gleich!');
    fixture.detectChanges();

    const content = fixture.nativeElement.textContent as string;
    expect(content).toContain('Nicht gesendet');

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.textContent?.trim()).toBe('Erneut senden');

    button.click();
    await fixture.whenStable();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('zeigt bei failed keine Signalbalken', () => {
    const fixture = TestBed.createComponent(OgMessageBubbleComponent);
    fixture.componentRef.setInput('direction', 'out');
    fixture.componentRef.setInput('status', 'failed');
    fixture.componentRef.setInput('text', 'Super, bis gleich!');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('og-signal-bars')).toBeNull();
  });

  it('zeigt bei einer eingehenden Nachricht nur die Zeit', () => {
    const fixture = TestBed.createComponent(OgMessageBubbleComponent);
    fixture.componentRef.setInput('direction', 'in');
    fixture.componentRef.setInput('status', 'delivered');
    fixture.componentRef.setInput('text', 'Ja, ich warte hier.');
    fixture.componentRef.setInput('meta', '14:06');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('og-signal-bars')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('14:06');
  });

  it('zeigt bei zugestellt vier Signalbalken', () => {
    const fixture = TestBed.createComponent(OgMessageBubbleComponent);
    fixture.componentRef.setInput('direction', 'out');
    fixture.componentRef.setInput('status', 'delivered');
    fixture.componentRef.setInput('text', 'Wir sind bei der Hütte.');
    fixture.componentRef.setInput('meta', '14:03 · zugestellt');
    fixture.detectChanges();

    const bars = fixture.nativeElement.querySelectorAll('og-signal-bars rect.on');
    expect(bars).toHaveLength(4);
  });

  it('zeigt bei queued keine aktiven Signalbalken', () => {
    const fixture = TestBed.createComponent(OgMessageBubbleComponent);
    fixture.componentRef.setInput('direction', 'out');
    fixture.componentRef.setInput('status', 'queued');
    fixture.componentRef.setInput('text', 'Wir sind unterwegs.');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('og-signal-bars rect.on')).toHaveLength(0);
  });

  it('zeigt bei sent zwei aktive Signalbalken', () => {
    const fixture = TestBed.createComponent(OgMessageBubbleComponent);
    fixture.componentRef.setInput('direction', 'out');
    fixture.componentRef.setInput('status', 'sent');
    fixture.componentRef.setInput('text', 'Wir sind unterwegs.');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('og-signal-bars rect.on')).toHaveLength(2);
  });

  it('markiert die Bubble je Zustand', () => {
    const fixture = TestBed.createComponent(OgMessageBubbleComponent);
    fixture.componentRef.setInput('direction', 'out');
    fixture.componentRef.setInput('text', 'Super, bis gleich!');
    fixture.detectChanges();

    const bubble = fixture.nativeElement.querySelector('.og-message-bubble__bubble') as HTMLElement;
    expect(bubble.classList.contains('og-message-bubble__bubble--sent')).toBe(true);

    fixture.componentRef.setInput('status', 'queued');
    fixture.detectChanges();
    expect(bubble.classList.contains('og-message-bubble__bubble--queued')).toBe(true);
    expect(bubble.classList.contains('og-message-bubble__bubble--sent')).toBe(false);

    fixture.componentRef.setInput('status', 'failed');
    fixture.detectChanges();
    expect(bubble.classList.contains('og-message-bubble__bubble--failed')).toBe(true);
  });

  it('richtet ausgehende Nachrichten rechts und eingehende links aus', () => {
    const fixture = TestBed.createComponent(OgMessageBubbleComponent);
    fixture.componentRef.setInput('direction', 'in');
    fixture.componentRef.setInput('text', 'Ja, ich warte hier.');
    fixture.detectChanges();

    const wrapper = fixture.nativeElement.querySelector('.og-message-bubble') as HTMLElement;
    expect(wrapper.classList.contains('og-message-bubble--out')).toBe(false);

    fixture.componentRef.setInput('direction', 'out');
    fixture.detectChanges();
    expect(wrapper.classList.contains('og-message-bubble--out')).toBe(true);
  });

  it('verankert eingehende Nachrichten am linken Rand', () => {
    const fixture = TestBed.createComponent(OgMessageBubbleComponent);
    fixture.componentRef.setInput('direction', 'in');
    fixture.componentRef.setInput('text', 'Ja, ich warte hier.');
    fixture.detectChanges();

    const wrapper = fixture.nativeElement.querySelector('.og-message-bubble') as HTMLElement;
    const style = getComputedStyle(wrapper);

    expect(style.alignSelf).toBe('flex-start');
    expect(style.alignItems).toBe('flex-start');
  });

  it('verankert ausgehende Nachrichten am rechten Rand', () => {
    const fixture = TestBed.createComponent(OgMessageBubbleComponent);
    fixture.componentRef.setInput('direction', 'out');
    fixture.componentRef.setInput('status', 'sent');
    fixture.componentRef.setInput('text', 'Super, bis gleich!');
    fixture.detectChanges();

    const wrapper = fixture.nativeElement.querySelector('.og-message-bubble') as HTMLElement;
    const style = getComputedStyle(wrapper);

    expect(style.alignSelf).toBe('flex-end');
    expect(style.alignItems).toBe('flex-end');
  });

  it('begrenzt die Breite der Blase und bricht lange Wörter um', () => {
    const fixture = TestBed.createComponent(OgMessageBubbleComponent);
    fixture.componentRef.setInput('direction', 'in');
    fixture.componentRef.setInput('text', 'Ja, ich warte hier.');
    fixture.detectChanges();

    const wrapper = fixture.nativeElement.querySelector('.og-message-bubble') as HTMLElement;
    const bubble = fixture.nativeElement.querySelector('.og-message-bubble__bubble') as HTMLElement;
    const wrapperStyle = getComputedStyle(wrapper);
    const bubbleStyle = getComputedStyle(bubble);

    expect(wrapperStyle.maxWidth).toBe('78%');
    expect(['0', '0px']).toContain(wrapperStyle.minWidth);
    expect(bubbleStyle.maxWidth).toBe('100%');
    expect(['0', '0px']).toContain(bubbleStyle.minWidth);
    expect(bubbleStyle.overflowWrap).toBe('anywhere');
  });

  it('nutzt die Radien aus den Tokens', () => {
    const fixture = TestBed.createComponent(OgMessageBubbleComponent);
    fixture.componentRef.setInput('direction', 'in');
    fixture.componentRef.setInput('text', 'Ja, ich warte hier.');
    fixture.detectChanges();

    const bubble = fixture.nativeElement.querySelector('.og-message-bubble__bubble') as HTMLElement;
    expect(getComputedStyle(bubble).borderRadius).toBe(
      'var(--og-r-bubble) var(--og-r-bubble) var(--og-r-bubble) var(--og-r-bubble-tail)',
    );

    fixture.componentRef.setInput('direction', 'out');
    fixture.componentRef.setInput('status', 'sent');
    fixture.detectChanges();
    expect(getComputedStyle(bubble).borderRadius).toBe(
      'var(--og-r-bubble) var(--og-r-bubble) var(--og-r-bubble-tail) var(--og-r-bubble)',
    );
  });

  it('sprengt die Blase nicht bei einem Text ohne Leerzeichen', () => {
    const text = 'a'.repeat(83);
    const fixture = TestBed.createComponent(OgMessageBubbleComponent);
    fixture.componentRef.setInput('direction', 'out');
    fixture.componentRef.setInput('status', 'sent');
    fixture.componentRef.setInput('text', text);
    fixture.detectChanges();

    const bubble = fixture.nativeElement.querySelector('.og-message-bubble__bubble') as HTMLElement;

    // Der Text steht vollständig in der Blase und wird nicht abgeschnitten.
    expect(bubble.textContent).toBe(text);
    expect(text).toHaveLength(83);

    // Die Blase bleibt innerhalb der Zeile: sie ist auf die Zeilenbreite begrenzt,
    // schrumpft auf 0 und bricht das Wort um, statt es überstehen zu lassen.
    const bubbleStyle = getComputedStyle(bubble);
    expect(bubbleStyle.maxWidth).toBe('100%');
    expect(['0', '0px']).toContain(bubbleStyle.minWidth);
    expect(bubbleStyle.overflowWrap).toBe('anywhere');
  });

  it('setzt den Abstand beim Richtungswechsel', () => {
    const fixture = TestBed.createComponent(OgMessageBubbleComponent);
    fixture.componentRef.setInput('direction', 'out');
    fixture.componentRef.setInput('status', 'sent');
    fixture.componentRef.setInput('text', 'Wartest du dort auf uns?');
    fixture.detectChanges();

    const wrapper = fixture.nativeElement.querySelector('.og-message-bubble') as HTMLElement;
    expect(wrapper.classList.contains('og-message-bubble--group-start')).toBe(false);

    fixture.componentRef.setInput('groupStart', true);
    fixture.detectChanges();

    expect(wrapper.classList.contains('og-message-bubble--group-start')).toBe(true);
  });
});
