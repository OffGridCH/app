import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import {
  AVATAR_PATTERN_SIZE,
  OgAvatarComponent,
  OgBadgeComponent,
  OgBannerActionComponent,
  OgBannerComponent,
  OgButtonComponent,
  OgCardComponent,
  OgComposerComponent,
  OgIconButtonComponent,
  OgIconComponent,
  OgInfoRowComponent,
  OgLinkButtonComponent,
  OgMessageBubbleComponent,
  OgNoteComponent,
  OgQrComponent,
  OgSectionLabelComponent,
  OgSegmentedComponent,
  OgSignalBarsComponent,
  OgStatusDotComponent,
  OgStepListComponent,
  OgSwitchComponent,
  OgTextFieldComponent,
  OgTopbarComponent,
  avatarPattern,
} from './index';

@Component({
  selector: 'app-text-field-test-host',
  imports: [OgTextFieldComponent],
  template: '<og-text-field id="name" label="Anzeigename" />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TextFieldHostComponent {}

/**
 * Prüft die Grundkomponenten aus T01: der Barrel `src/app/ui/index.ts` muss fehlerfrei auflösen
 * und die Komponenten müssen die im Ticket geforderten Tags und ARIA-Attribute liefern.
 */
describe('UI-Basis (src/app/ui)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TextFieldHostComponent],
      providers: [provideRouter([])],
    });
  });

  it('exportiert alle 13 Grundkomponenten über den Barrel', () => {
    const components = [
      OgBadgeComponent,
      OgButtonComponent,
      OgCardComponent,
      OgIconButtonComponent,
      OgIconComponent,
      OgInfoRowComponent,
      OgLinkButtonComponent,
      OgSectionLabelComponent,
      OgSegmentedComponent,
      OgStatusDotComponent,
      OgSwitchComponent,
      OgTextFieldComponent,
      OgTopbarComponent,
    ];

    expect(components).toHaveLength(13);
    for (const component of components) {
      expect(component).toBeTypeOf('function');
    }
  });

  it('og-button rendert ein button-Element und meldet Klicks', async () => {
    const fixture = TestBed.createComponent(OgButtonComponent);
    const pressed = vi.fn();
    fixture.componentInstance.pressed.subscribe(pressed);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button).toBeTruthy();
    expect(button.type).toBe('button');

    button.click();
    await fixture.whenStable();
    expect(pressed).toHaveBeenCalledTimes(1);
  });

  it('og-button ist deaktiviert und löst keinen Klick aus', async () => {
    const fixture = TestBed.createComponent(OgButtonComponent);
    const pressed = vi.fn();
    fixture.componentInstance.pressed.subscribe(pressed);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    button.click();
    await fixture.whenStable();
    expect(pressed).not.toHaveBeenCalled();
  });

  it('og-link-button rendert ein a-Element mit routerLink', async () => {
    const fixture = TestBed.createComponent(OgLinkButtonComponent);
    fixture.componentRef.setInput('routerLink', '/einstellungen');
    fixture.detectChanges();
    await fixture.whenStable();

    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/einstellungen');
  });

  it('og-icon-button rendert ohne Route ein button und mit Route ein a', async () => {
    const fixture = TestBed.createComponent(OgIconButtonComponent);
    fixture.componentRef.setInput('icon', 'back');
    fixture.componentRef.setInput('label', 'Zurück zu den Kontakten');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button).toBeTruthy();
    expect(button.getAttribute('aria-label')).toBe('Zurück zu den Kontakten');

    fixture.componentRef.setInput('routerLink', '/kontakte');
    fixture.detectChanges();
    await fixture.whenStable();

    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.getAttribute('aria-label')).toBe('Zurück zu den Kontakten');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('og-switch hat die Rolle switch und schaltet aria-checked um', async () => {
    const fixture = TestBed.createComponent(OgSwitchComponent);
    fixture.componentRef.setInput('labelledBy', 'h1');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('role')).toBe('switch');
    expect(button.getAttribute('aria-checked')).toBe('false');
    expect(button.getAttribute('aria-labelledby')).toBe('h1');

    button.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(button.getAttribute('aria-checked')).toBe('true');
  });

  it('og-segmented rendert eine Tabliste mit ausgewähltem Segment', async () => {
    const fixture = TestBed.createComponent(OgSegmentedComponent);
    fixture.componentRef.setInput('options', [
      { value: 'a', label: 'Erster' },
      { value: 'b', label: 'Zweiter' },
    ]);
    fixture.componentRef.setInput('ariaLabel', 'Ansicht');
    fixture.componentRef.setInput('value', 'a');
    fixture.detectChanges();

    const list = fixture.nativeElement.querySelector('[role="tablist"]') as HTMLElement;
    expect(list).toBeTruthy();
    expect(list.getAttribute('aria-label')).toBe('Ansicht');

    const tabs = fixture.nativeElement.querySelectorAll('button[role="tab"]');
    expect(tabs).toHaveLength(2);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-selected')).toBe('false');

    (tabs[1] as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
  });

  it('og-text-field bindet den Wert in beide Richtungen', async () => {
    const fixture = TestBed.createComponent(OgTextFieldComponent);
    fixture.componentRef.setInput('id', 'value-name');
    fixture.componentRef.setInput('label', 'Anzeigename');
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
    expect(label.getAttribute('for')).toBe('value-name');

    input.value = 'OffGrid';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBe('OffGrid');
  });

  it('og-text-field verwendet eine statische Host-ID nur für das Input', () => {
    const fixture = TestBed.createComponent(TextFieldHostComponent);
    fixture.detectChanges();

    const host = fixture.nativeElement.querySelector('og-text-field') as HTMLElement;
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
    const elementsWithId = document.querySelectorAll('[id="name"]');

    expect(host.getAttribute('id')).toBeNull();
    expect(elementsWithId).toHaveLength(1);
    expect(elementsWithId[0]).toBe(input);
    expect(label.control).toBe(input);
  });

  it('og-icon rendert das gewählte Icon mit der Standardgrösse', async () => {
    const fixture = TestBed.createComponent(OgIconComponent);
    fixture.componentRef.setInput('name', 'check');
    fixture.detectChanges();

    const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('width')).toBe('14');
    expect(svg.getAttribute('stroke-width')).toBe('3');
  });

  it('exportiert die Zustandskomponenten über den Barrel', () => {
    const components = [
      OgAvatarComponent,
      OgBannerComponent,
      OgBannerActionComponent,
      OgNoteComponent,
      OgComposerComponent,
      OgMessageBubbleComponent,
      OgQrComponent,
      OgSignalBarsComponent,
      OgStepListComponent,
      avatarPattern,
    ];

    expect(components).toHaveLength(10);
    for (const component of components) {
      expect(component).toBeTypeOf('function');
    }
  });

  it('exportiert das Avatar-Muster mit 25 Werten', () => {
    expect(AVATAR_PATTERN_SIZE).toBe(25);
    expect(avatarPattern(11)).toHaveLength(AVATAR_PATTERN_SIZE);
  });
});
