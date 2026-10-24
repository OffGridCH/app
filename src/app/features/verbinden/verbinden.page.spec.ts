import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { AntennaPort } from '../../core/antenna/antenna-port';
import { KeystoreService } from '../../core/keystore/keystore.service';
import { SettingsService } from '../../core/settings/settings.service';
import {
  buttonByLabel,
  createPage,
  setupOnboardingTest,
  textOf,
  waitForAntennaState,
} from '../../../testing/onboarding-harness';
import { VerbindenPage } from './verbinden.page';

/** Der Zustand eines Schrittes der Schritt-Liste. */
type StepState = 'done' | 'active' | 'todo';

describe('VerbindenPage', () => {
  afterEach(async () => {
    await TestBed.inject(AntennaPort).disconnect();
    localStorage.clear();
  });

  /** Liest den Zustand eines Schrittes der Schritt-Liste. */
  function stepState(fixture: { nativeElement: HTMLElement }, label: string): StepState {
    const steps = Array.from(fixture.nativeElement.querySelectorAll('.og-step-list__step')) as HTMLElement[];
    const step = steps.find((entry) => entry.textContent?.includes(label));
    if (step === undefined) {
      throw new Error(`Kein Schritt „${label}“ gefunden.`);
    }
    const marker = step.querySelector('.og-step-list__marker');
    if (marker?.classList.contains('og-step-list__marker--done')) {
      return 'done';
    }
    if (step.querySelector('.og-step-list__label--active') !== null) {
      return 'active';
    }
    return 'todo';
  }

  it('zeigt „SCHRITT 1 VON 2“ nur im Onboarding', async () => {
    setupOnboardingTest();
    const fixture = createPage(VerbindenPage);

    expect(textOf(fixture)).toContain('SCHRITT 1 VON 2');

    await TestBed.inject(SettingsService).completeOnboarding();
    fixture.detectChanges();

    expect(textOf(fixture)).not.toContain('SCHRITT 1 VON 2');
  });

  it('verbindet beim Öffnen, wenn die Antenne getrennt ist', () => {
    const harness = setupOnboardingTest();
    const connect = vi.spyOn(harness.antenna, 'connect');

    createPage(VerbindenPage);

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('sperrt „Weiter“, solange die Antenne nicht bereit ist', () => {
    setupOnboardingTest();
    const fixture = createPage(VerbindenPage);

    expect(buttonByLabel(fixture, 'Weiter').disabled).toBe(true);
  });

  it('reagiert live auf den Zustand der Antenne', async () => {
    const harness = setupOnboardingTest();
    const fixture = createPage(VerbindenPage);
    fixture.detectChanges();

    // Während des Verbindens sind die ersten beiden Schritte aktiv, der dritte ist offen.
    expect(stepState(fixture, 'USB-Gerät erkannt')).toBe('active');
    expect(stepState(fixture, 'Verbindung wird aufgebaut')).toBe('active');
    expect(stepState(fixture, 'Funkmodul bereit')).toBe('todo');
    expect(fixture.nativeElement.querySelector('.og-step-list__spinner')).not.toBeNull();

    await waitForAntennaState(harness.antenna, 'unlocked');
    fixture.detectChanges();

    expect(stepState(fixture, 'USB-Gerät erkannt')).toBe('done');
    expect(stepState(fixture, 'Verbindung wird aufgebaut')).toBe('done');
    expect(stepState(fixture, 'Funkmodul bereit')).toBe('done');
    expect(textOf(fixture)).toContain('FW 0.1.0');
  });

  it('sucht mit „Erneut suchen“ wieder nach der Antenne', async () => {
    const harness = setupOnboardingTest();
    const fixture = createPage(VerbindenPage);
    await waitForAntennaState(harness.antenna, 'unlocked');
    fixture.detectChanges();
    const connect = vi.spyOn(harness.antenna, 'connect');

    buttonByLabel(fixture, 'Erneut suchen').click();

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('sperrt „Erneut suchen“ während des Verbindens', () => {
    setupOnboardingTest();
    const fixture = createPage(VerbindenPage);
    fixture.detectChanges();

    expect(buttonByLabel(fixture, 'Erneut suchen').disabled).toBe(true);
  });

  it('entsperrt nach einem Schlüsselspeicher-Fehler mit „Erneut suchen“', async () => {
    const harness = setupOnboardingTest();
    // Der erste Entsperrversuch scheitert am Schlüsselspeicher, der zweite gelingt.
    const keystore = TestBed.inject(KeystoreService);
    vi.spyOn(keystore, 'createUnlockEnvelope').mockRejectedValueOnce(new Error('Schlüsselspeicher gesperrt'));
    const fixture = createPage(VerbindenPage);

    await vi.waitFor(() => expect(harness.antenna.error()).toBe('keystore-failed'));
    fixture.detectChanges();

    expect(harness.antenna.state()).toBe('locked');
    expect(buttonByLabel(fixture, 'Weiter').disabled).toBe(true);
    expect(textOf(fixture)).toContain('Der Schlüsselspeicher des Handys ist nicht verfügbar.');

    buttonByLabel(fixture, 'Erneut suchen').click();

    await waitForAntennaState(harness.antenna, 'unlocked');
    fixture.detectChanges();

    expect(harness.antenna.error()).toBeNull();
    expect(buttonByLabel(fixture, 'Weiter').disabled).toBe(false);
    expect(textOf(fixture)).not.toContain('Der Schlüsselspeicher des Handys ist nicht verfügbar.');
  });

  it('entsperrt ein gesperrtes Gerät mit „Erneut suchen“ statt neu zu verbinden', async () => {
    const harness = setupOnboardingTest();
    // Der erste Entsperrversuch scheitert am Schlüsselspeicher: das Gerät bleibt gesperrt.
    const keystore = TestBed.inject(KeystoreService);
    vi.spyOn(keystore, 'createUnlockEnvelope').mockRejectedValueOnce(new Error('Schlüsselspeicher gesperrt'));
    const fixture = createPage(VerbindenPage);
    await vi.waitFor(() => expect(harness.antenna.error()).toBe('keystore-failed'));
    fixture.detectChanges();

    expect(harness.antenna.state()).toBe('locked');

    const unlock = vi.spyOn(harness.antenna, 'unlock');
    const connect = vi.spyOn(harness.antenna, 'connect');

    buttonByLabel(fixture, 'Erneut suchen').click();

    // Ein gesperrtes Gerät ist noch verbunden: `connect()` kehrt sofort zurück, es muss entsperrt werden.
    expect(unlock).toHaveBeenCalledTimes(1);
    expect(connect).not.toHaveBeenCalled();

    // Der Zustand wechselt wirklich von `locked` auf `unlocked`.
    await waitForAntennaState(harness.antenna, 'unlocked');
    fixture.detectChanges();

    expect(harness.antenna.error()).toBeNull();
    expect(buttonByLabel(fixture, 'Weiter').disabled).toBe(false);
  });

  it('entsperrt ein gesperrtes Gerät nicht durch blosses Verbinden', async () => {
    const harness = setupOnboardingTest();
    const keystore = TestBed.inject(KeystoreService);
    vi.spyOn(keystore, 'createUnlockEnvelope').mockRejectedValueOnce(new Error('Schlüsselspeicher gesperrt'));
    createPage(VerbindenPage);
    await vi.waitFor(() => expect(harness.antenna.error()).toBe('keystore-failed'));

    expect(harness.antenna.state()).toBe('locked');

    // Der Weg über `connect()` allein: bei einem gesperrten, aber verbundenen Gerät passiert nichts.
    await harness.antenna.connect();

    expect(harness.antenna.state()).toBe('locked');
  });

  it('sucht nach dem Trennen mit „Erneut suchen“ wieder nach der Antenne', async () => {
    const harness = setupOnboardingTest();
    const fixture = createPage(VerbindenPage);
    await waitForAntennaState(harness.antenna, 'unlocked');
    window.ogMock?.drop();
    await vi.waitFor(() => expect(harness.antenna.state()).toBe('disconnected'));
    fixture.detectChanges();
    const connect = vi.spyOn(harness.antenna, 'connect');

    buttonByLabel(fixture, 'Erneut suchen').click();

    expect(connect).toHaveBeenCalledTimes(1);
    await waitForAntennaState(harness.antenna, 'unlocked');
  });

  it('führt im Onboarding mit „Weiter“ zur Namensseite', async () => {
    const harness = setupOnboardingTest();
    const fixture = createPage(VerbindenPage);
    await waitForAntennaState(harness.antenna, 'unlocked');
    fixture.detectChanges();

    buttonByLabel(fixture, 'Weiter').click();

    expect(harness.navigate).toHaveBeenCalledWith('/name');
  });

  it('führt nach dem Onboarding mit „Weiter“ zu den Einstellungen', async () => {
    const harness = setupOnboardingTest();
    await TestBed.inject(SettingsService).completeOnboarding();
    const fixture = createPage(VerbindenPage);
    await waitForAntennaState(harness.antenna, 'unlocked');
    fixture.detectChanges();

    buttonByLabel(fixture, 'Weiter').click();

    expect(harness.navigate).toHaveBeenCalledWith('/einstellungen');
  });

  it('lässt „Weiter“ im Onboarding bei einem frischen Gerät zu', async () => {
    localStorage.setItem('og.noseed', '1');
    const harness = setupOnboardingTest();
    const fixture = createPage(VerbindenPage);
    await waitForAntennaState(harness.antenna, 'unprovisioned');
    fixture.detectChanges();

    expect(buttonByLabel(fixture, 'Weiter').disabled).toBe(false);
  });

  it('sperrt „Weiter“ bei einem frischen Gerät nach dem Onboarding', async () => {
    localStorage.setItem('og.noseed', '1');
    const harness = setupOnboardingTest();
    await TestBed.inject(SettingsService).completeOnboarding();
    const fixture = createPage(VerbindenPage);
    await waitForAntennaState(harness.antenna, 'unprovisioned');
    fixture.detectChanges();

    expect(buttonByLabel(fixture, 'Weiter').disabled).toBe(true);
  });

  it('zeigt bei verlorener Verbindung den Fehlertext', async () => {
    const harness = setupOnboardingTest();
    const fixture = createPage(VerbindenPage);
    await waitForAntennaState(harness.antenna, 'unlocked');
    fixture.detectChanges();

    window.ogMock?.drop();
    await vi.waitFor(() => expect(harness.antenna.error()).toBe('lost'));
    fixture.detectChanges();

    expect(textOf(fixture)).toContain('Verbindung zur Antenne verloren.');
  });
});
