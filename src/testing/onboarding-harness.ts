import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';

import { dataProviders } from '../app/app.config';
import { AntennaPort } from '../app/core/antenna/antenna-port';
import { MockSerialTransport } from '../app/core/antenna/mock-serial-transport';
import { SerialTransport } from '../app/core/antenna/serial-transport';
import { BrowserKeystoreService } from '../app/core/keystore/browser-keystore.service';
import { KeystoreService } from '../app/core/keystore/keystore.service';
import type { AntennaState } from '../app/core/models/antenna';

/**
 * Testhilfen für die Onboarding-Screens „Verbinden“ und „Name“.
 *
 * Die Tests laufen gegen das simulierte Gerät (`MockSerialTransport`), damit die Zustände der
 * Antenne echt sind und `window.ogMock` (aus der Entwicklerkonsole) zur Verfügung steht.
 * Die Navigation wird gemockt: die Tests prüfen, wohin die Seite navigiert, nicht die Routen.
 */

/** Die Umgebung eines Onboarding-Tests. */
export interface OnboardingHarness {
  /** Der Mock der Router-Navigation (`navigateByUrl`). */
  navigate: ReturnType<typeof vi.fn>;
  /** Die Antenne der Testumgebung. */
  antenna: AntennaPort;
}

/**
 * Richtet den TestBed für einen Onboarding-Screen ein: Memory-Datenbank, simulierte Antenne,
 * Schlüsselspeicher im Arbeitsspeicher und ein gemockter Router.
 */
export function setupOnboardingTest(): OnboardingHarness {
  const navigate = vi.fn().mockResolvedValue(true);
  TestBed.configureTestingModule({
    providers: [
      provideIonicAngular({ mode: 'md' }),
      ...dataProviders,
      { provide: SerialTransport, useExisting: MockSerialTransport },
      { provide: KeystoreService, useExisting: BrowserKeystoreService },
      { provide: Router, useValue: { navigateByUrl: navigate } },
    ],
  });
  return { navigate, antenna: TestBed.inject(AntennaPort) };
}

/**
 * Wartet, bis die Antenne den gewünschten Zustand hat.
 *
 * @param antenna Die Antenne der Testumgebung.
 * @param state Der erwartete Zustand.
 */
export async function waitForAntennaState(antenna: AntennaPort, state: AntennaState): Promise<void> {
  await vi.waitFor(() => {
    expect(antenna.state()).toBe(state);
  }, { timeout: 5000 });
}

/**
 * Erzeugt die Seite und zeigt ihren ersten Stand.
 *
 * @param component Die Seitenkomponente.
 */
export function createPage<T>(component: new () => T): ComponentFixture<T> {
  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  return fixture;
}

/**
 * Lässt die Seite ihre Änderungen anzeigen.
 *
 * @param fixture Die Seite.
 */
export async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  await fixture.whenStable();
  fixture.detectChanges();
}

/**
 * Sucht den Button mit dem gegebenen Text.
 *
 * @param fixture Die Seite.
 * @param label Die Beschriftung des Buttons.
 */
export function buttonByLabel(fixture: ComponentFixture<unknown>, label: string): HTMLButtonElement {
  const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
  const found = buttons.find((button) => button.textContent?.trim() === label);
  if (found === undefined) {
    throw new Error(`Kein Button mit der Beschriftung „${label}“ gefunden.`);
  }
  return found;
}

/**
 * Tippt einen Text in das erste Eingabefeld der Seite.
 *
 * @param fixture Die Seite.
 * @param value Der Text.
 */
export async function typeInto(fixture: ComponentFixture<unknown>, value: string): Promise<void> {
  const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  await fixture.whenStable();
  fixture.detectChanges();
}

/**
 * Liest den sichtbaren Text der Seite (ohne Leerzeichen).
 *
 * @param fixture Die Seite.
 */
export function textOf(fixture: ComponentFixture<unknown>): string {
  return (fixture.nativeElement.textContent ?? '').replace(/\s+/g, ' ').trim();
}
