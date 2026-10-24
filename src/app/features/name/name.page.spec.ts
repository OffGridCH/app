import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { AntennaPort } from '../../core/antenna/antenna-port';
import { SettingsService } from '../../core/settings/settings.service';
import {
  buttonByLabel,
  createPage,
  setupOnboardingTest,
  textOf,
  typeInto,
  waitForAntennaState,
} from '../../../testing/onboarding-harness';
import { NamePage } from './name.page';

describe('NamePage', () => {
  afterEach(async () => {
    await TestBed.inject(AntennaPort).disconnect();
    localStorage.clear();
  });

  it('zeigt „SCHRITT 2 VON 2“', () => {
    setupOnboardingTest();
    const fixture = createPage(NamePage);

    expect(textOf(fixture)).toContain('SCHRITT 2 VON 2');
  });

  it('prüft den Namen nach Bytes und nicht nach Zeichen', async () => {
    setupOnboardingTest();
    const fixture = createPage(NamePage);
    const button = buttonByLabel(fixture, 'Los gehts');

    // 12 Umlaute sind 24 Bytes: noch gültig.
    await typeInto(fixture, 'ä'.repeat(12));
    expect(button.disabled).toBe(false);

    // 13 Umlaute sind 26 Bytes: zu lang.
    await typeInto(fixture, 'ä'.repeat(13));
    expect(button.disabled).toBe(true);

    // 24 Zeichen sind 24 Bytes: gültig.
    await typeInto(fixture, 'a'.repeat(24));
    expect(button.disabled).toBe(false);

    // 25 Zeichen sind 25 Bytes: zu lang.
    await typeInto(fixture, 'a'.repeat(25));
    expect(button.disabled).toBe(true);
  });

  it('sperrt „Los gehts“ bei einem leeren Namen', async () => {
    setupOnboardingTest();
    const fixture = createPage(NamePage);

    expect(buttonByLabel(fixture, 'Los gehts').disabled).toBe(true);

    await typeInto(fixture, '   ');
    expect(buttonByLabel(fixture, 'Los gehts').disabled).toBe(true);
  });

  it('gibt dem Feld keine maximale Länge', () => {
    setupOnboardingTest();
    const fixture = createPage(NamePage);

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

    expect(input.getAttribute('maxlength')).toBeNull();
  });

  it('beschriftet das Feld „Anzeigename“', () => {
    setupOnboardingTest();
    const fixture = createPage(NamePage);

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;

    expect(input.id).toBe('dn');
    expect(label.getAttribute('for')).toBe('dn');
    expect(label.textContent?.trim()).toBe('Anzeigename');
  });

  it('zeigt den Feldfehler, wenn das Feld verlassen wurde', async () => {
    setupOnboardingTest();
    const fixture = createPage(NamePage);

    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(textOf(fixture)).toContain('Der Name muss 1 bis 24 Bytes lang sein (Umlaute zählen doppelt).');
  });

  it('speichert den Namen, schliesst das Onboarding ab und wechselt mit replaceUrl zu den Kontakten', async () => {
    const harness = setupOnboardingTest();
    await harness.antenna.connect();
    await waitForAntennaState(harness.antenna, 'unlocked');
    const fixture = createPage(NamePage);

    await typeInto(fixture, 'Alice');
    buttonByLabel(fixture, 'Los gehts').click();

    await vi.waitFor(() => expect(harness.navigate).toHaveBeenCalledWith('/kontakte', { replaceUrl: true }));
    const settings = TestBed.inject(SettingsService);
    expect(settings.displayName()).toBe('Alice');
    expect(settings.onboardingDone()).toBe(true);
  });

  it('gibt den Namen dem Gerät', async () => {
    const harness = setupOnboardingTest();
    await harness.antenna.connect();
    await waitForAntennaState(harness.antenna, 'unlocked');
    const fixture = createPage(NamePage);

    await typeInto(fixture, 'Alice');
    buttonByLabel(fixture, 'Los gehts').click();

    await vi.waitFor(() => expect(harness.navigate).toHaveBeenCalled());
    const identity = await harness.antenna.request('id.get');
    expect(identity['name']).toBe('Alice');
  });

  it('richtet ein frisches Gerät ein und wird danach unlocked', async () => {
    localStorage.setItem('og.noseed', '1');
    const harness = setupOnboardingTest();
    await harness.antenna.connect();
    await waitForAntennaState(harness.antenna, 'unprovisioned');
    const fixture = createPage(NamePage);

    await typeInto(fixture, 'Alice');
    buttonByLabel(fixture, 'Los gehts').click();

    await vi.waitFor(() => expect(harness.antenna.state()).toBe('unlocked'));
    expect(harness.navigate).toHaveBeenCalledWith('/kontakte', { replaceUrl: true });
    expect(TestBed.inject(SettingsService).displayName()).toBe('Alice');
  });

  it('zeigt bei verlorener Verbindung den Fehlertext', async () => {
    const harness = setupOnboardingTest();
    await harness.antenna.connect();
    await waitForAntennaState(harness.antenna, 'unlocked');
    const fixture = createPage(NamePage);

    window.ogMock?.drop();
    await vi.waitFor(() => expect(harness.antenna.error()).toBe('lost'));

    await typeInto(fixture, 'Alice');
    buttonByLabel(fixture, 'Los gehts').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(textOf(fixture)).toContain('Verbindung zur Antenne verloren.');
    expect(harness.navigate).not.toHaveBeenCalled();
  });

  it('meldet, dass die Antenne nicht bereit ist', async () => {
    const harness = setupOnboardingTest();
    const fixture = createPage(NamePage);

    await typeInto(fixture, 'Alice');
    buttonByLabel(fixture, 'Los gehts').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(textOf(fixture)).toContain('Antenne nicht bereit. Verbinde sie zuerst.');
    expect(harness.navigate).not.toHaveBeenCalled();
  });
});
