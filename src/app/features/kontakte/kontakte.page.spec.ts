import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';

import { dataProviders } from '../../app.config';
import { AntennaPort } from '../../core/antenna/antenna-port';
import { MockSerialTransport } from '../../core/antenna/mock-serial-transport';
import { SerialTransport } from '../../core/antenna/serial-transport';
import { ContactRepository } from '../../core/data/contact.repository';
import { DataChangedService } from '../../core/data/data-changed.service';
import { MessageRepository } from '../../core/data/message.repository';
import { BrowserKeystoreService } from '../../core/keystore/browser-keystore.service';
import { KeystoreService } from '../../core/keystore/keystore.service';
import type { Contact } from '../../core/models/contact';
import type { JsonObject } from '../../core/models/device';
import { MessageStatus, type Message } from '../../core/models/message';
import { SettingsService } from '../../core/settings/settings.service';
import { createPage, textOf, waitForAntennaState } from '../../../testing/onboarding-harness';
import { KontaktePage } from './kontakte.page';

/**
 * Die Demo-Kontakte, wie das simulierte Gerät sie kennt.
 *
 * Die Public Keys sind die des Geräts: so überschreibt die Synchronisation die Kontakte nicht und
 * der Verlauf der Nachrichten bleibt erhalten.
 */
const KONTAKTE: readonly Contact[] = [
  {
    contactId: 1,
    name: 'Anna Meier',
    nodeId: 'ECE4',
    publicKey: 'A5d2V7F/elA8qTcKyHqIP0WiIe7IjNTvZ30L+2bBRls=',
    state: 'active',
    fingerprint: '4821 0937 1156',
    lastRssi: -92,
    lastSnr: 7.5,
    txCtr: 3,
    rxHighestCtr: 2,
  },
  {
    contactId: 2,
    name: 'Luca Bernasconi',
    nodeId: 'ADC2',
    publicKey: 'BqrLZITC2oY61ClcpwPFdCqy4fG2okPDHpdGQrTK4qI=',
    state: 'active',
    fingerprint: '7304 6218 0095',
    lastRssi: -100,
    lastSnr: 4,
    txCtr: 0,
    rxHighestCtr: 1,
  },
  {
    contactId: 3,
    name: 'Mia Frei',
    nodeId: '8E2D',
    publicKey: 'DuQAXvPB/3K5X3OnKS0xWmT92GDGn7rAaK40rByhzV0=',
    state: 'active',
    fingerprint: '1659 8842 3370',
    lastRssi: -110,
    lastSnr: 1.5,
    txCtr: 2,
    rxHighestCtr: null,
  },
  {
    contactId: 4,
    name: 'Jonas Keller',
    nodeId: '8DDB',
    publicKey: 'g7QWg+3lRb2fJHHIWz2mlAyShdhQDQyb6uG8Aw//aeo=',
    state: 'pending',
    fingerprint: '9027 5513 6841',
    lastRssi: null,
    lastSnr: null,
    txCtr: 0,
    rxHighestCtr: null,
  },
];

/** Eine Nachricht mit einem festen Abstand zu jetzt (in Minuten). */
function message(
  contactId: number,
  direction: Message['direction'],
  content: string,
  minutesAgo: number,
  read = false,
): Message {
  const sentAt = new Date(Date.now() - minutesAgo * 60_000).toISOString();
  return {
    id: crypto.randomUUID(),
    contactId,
    ctr: 1,
    msgRef: null,
    content,
    direction,
    kind: 'text',
    sentAt,
    status: MessageStatus.Delivered,
    rssi: direction === 'in' ? -92 : null,
    readAt: read ? sentAt : null,
    createdAt: sentAt,
    updatedAt: null,
  };
}

describe('KontaktePage', () => {
  afterEach(async () => {
    await TestBed.inject(AntennaPort).disconnect();
    localStorage.clear();
  });

  /** Richtet den TestBed ein: Memory-Datenbank, simulierte Antenne und ein Router für die Links. */
  function setup(): void {
    TestBed.configureTestingModule({
      providers: [
        provideIonicAngular({ mode: 'md' }),
        provideRouter([]),
        ...dataProviders,
        { provide: SerialTransport, useExisting: MockSerialTransport },
        { provide: KeystoreService, useExisting: BrowserKeystoreService },
      ],
    });
  }

  /** Legt die Demo-Kontakte und -Nachrichten an und meldet die Änderung. */
  async function seed(): Promise<void> {
    const contacts = TestBed.inject(ContactRepository);
    const messages = TestBed.inject(MessageRepository);
    for (const contact of KONTAKTE) {
      await contacts.upsert(contact);
    }
    // Anna: eine frische eingehende Nachricht (ungelesen). Luca: eine alte (vor 3 Stunden).
    await messages.insert(message(1, 'in', 'Bin oben beim Gipfelkreuz.', 2));
    await messages.insert(message(2, 'in', 'Basislager erreicht.', 180, true));
    // Mia: nur eine ausgehende Nachricht.
    await messages.insert(message(3, 'out', 'Wir starten morgen um 7 Uhr.', 1440));
    TestBed.inject(DataChangedService).notify();
  }

  /** Verbindet die Antenne und wartet, bis das Gerät entsperrt ist. */
  async function connectAntenna(): Promise<void> {
    const antenna = TestBed.inject(AntennaPort);
    await antenna.connect();
    await waitForAntennaState(antenna, 'unlocked');
  }

  /** Wartet, bis die Seite eine Bedingung erfüllt (die Liste lädt asynchron nach). */
  async function waitFor(
    assertion: () => void,
    fixture: ComponentFixture<KontaktePage>,
  ): Promise<void> {
    await vi.waitFor(
      () => {
        TestBed.tick();
        fixture.detectChanges();
        assertion();
      },
      { timeout: 5000 },
    );
  }

  /** Die Namen der Kontaktzeilen (ohne die ausstehenden Zeilen). */
  function kontaktNamen(fixture: ComponentFixture<KontaktePage>): string[] {
    const names = fixture.nativeElement.querySelectorAll('a.zeile .zeile__name') as NodeListOf<Element>;
    return Array.from(names).map((entry) => entry.textContent?.trim() ?? '');
  }

  /** Die Namen der ausstehenden Zeilen. */
  function pendingNamen(fixture: ComponentFixture<KontaktePage>): string[] {
    const names = fixture.nativeElement.querySelectorAll('div.zeile .zeile__name') as NodeListOf<Element>;
    return Array.from(names).map((entry) => entry.textContent?.trim() ?? '');
  }

  /** Die Ansagen der Signalbalken der Kontaktzeilen. */
  function signalLabels(fixture: ComponentFixture<KontaktePage>): (string | null)[] {
    const bars = fixture.nativeElement.querySelectorAll('a.zeile og-signal-bars svg') as NodeListOf<Element>;
    return Array.from(bars).map((entry) => entry.getAttribute('aria-label'));
  }

  /** Die Namen aller Zeilen in der Reihenfolge der Liste (Kontakte, dann ausstehende). */
  function alleNamen(fixture: ComponentFixture<KontaktePage>): string[] {
    const rows = fixture.nativeElement.querySelectorAll('.zeile') as NodeListOf<Element>;
    return Array.from(rows).map(
      (row) => row.querySelector('.zeile__name')?.textContent?.trim() ?? '',
    );
  }

  /** Die Anzahl der leuchtenden Signalbalken je Kontaktzeile. */
  function balken(fixture: ComponentFixture<KontaktePage>): number[] {
    const rows = fixture.nativeElement.querySelectorAll('a.zeile') as NodeListOf<Element>;
    return Array.from(rows).map((row) => row.querySelectorAll('og-signal-bars rect.on').length);
  }

  /** Die Vorschauen der Kontaktzeilen. */
  function vorschauen(fixture: ComponentFixture<KontaktePage>): string[] {
    const previews = fixture.nativeElement.querySelectorAll('a.zeile .zeile__preview') as NodeListOf<Element>;
    return Array.from(previews).map((entry) => entry.textContent?.trim() ?? '');
  }

  /** Der Text der Statuszeile der Antenne. */
  function statusText(fixture: ComponentFixture<KontaktePage>): string {
    const status = fixture.nativeElement.querySelector('.kontakte__status') as HTMLElement;
    return (status.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Erzeugt die Seite mit einer gemockten Antwort auf `radio.get`.
   *
   * Alle anderen Befehle gehen an das simulierte Gerät. `aufgerufen` zeigt, ob die App die
   * Frequenz beim Gerät abgefragt hat.
   */
  async function seiteMitRadioGet(
    antwort: JsonObject,
  ): Promise<{ fixture: ComponentFixture<KontaktePage>; aufgerufen: () => boolean }> {
    const antenna = TestBed.inject(AntennaPort);
    const original = antenna.request.bind(antenna);
    let aufgerufen = false;
    vi.spyOn(antenna, 'request').mockImplementation(async (cmd, args) => {
      if (cmd === 'radio.get') {
        aufgerufen = true;
        return antwort;
      }
      return original(cmd, args);
    });
    const fixture = createPage(KontaktePage);
    await connectAntenna();
    return { fixture, aufgerufen: () => aufgerufen };
  }

  it('zeigt die Kontakte in der Reihenfolge der letzten Nachricht', async () => {
    setup();
    await seed();
    const fixture = createPage(KontaktePage);

    await waitFor(() => expect(kontaktNamen(fixture)).toHaveLength(3), fixture);

    expect(kontaktNamen(fixture)).toEqual(['Anna Meier', 'Luca Bernasconi', 'Mia Frei']);
    expect(pendingNamen(fixture)).toEqual(['Jonas Keller']);
  });

  it('zeigt das Signal-Level nach dem Alter der letzten eingehenden Nachricht', async () => {
    setup();
    await seed();
    const fixture = createPage(KontaktePage);

    await waitFor(() => expect(signalLabels(fixture)).toHaveLength(3), fixture);

    // Anna: frische Nachricht (-92 dBm) → Level 3. Luca: letzte Nachricht älter als 15 Minuten → 0.
    // Mia: nur ausgehende Nachrichten → 0.
    expect(signalLabels(fixture)).toEqual(['Signal gut', 'Ausser Reichweite', 'Ausser Reichweite']);
  });

  it('zeigt je Kontakt so viele Signalbalken wie das Level', async () => {
    setup();
    await seed();
    const fixture = createPage(KontaktePage);

    await waitFor(() => expect(kontaktNamen(fixture)).toHaveLength(3), fixture);

    // Anna: 3 Balken. Luca (älter als 15 Minuten) und Mia (nur ausgehend): keine.
    expect(balken(fixture)).toEqual([3, 0, 0]);
  });

  it('stellt die ausstehenden Zeilen nach den Kontakten', async () => {
    setup();
    await seed();
    const fixture = createPage(KontaktePage);

    await waitFor(() => expect(pendingNamen(fixture)).toHaveLength(1), fixture);

    expect(alleNamen(fixture)).toEqual([
      'Anna Meier',
      'Luca Bernasconi',
      'Mia Frei',
      'Jonas Keller',
    ]);
  });

  it('zeigt den ausstehenden Kontakt ohne Signalansage', async () => {
    setup();
    await seed();
    const fixture = createPage(KontaktePage);

    await waitFor(() => expect(pendingNamen(fixture)).toHaveLength(1), fixture);

    expect(textOf(fixture)).toContain('Schlüssel ausstehend');
    const bars = fixture.nativeElement.querySelectorAll('div.zeile og-signal-bars svg') as NodeListOf<Element>;
    expect(bars).toHaveLength(1);
    expect(bars[0].getAttribute('aria-hidden')).toBe('true');
  });

  it('zeigt die Vorschau der letzten Nachricht', async () => {
    setup();
    await seed();
    const fixture = createPage(KontaktePage);

    await waitFor(() => expect(vorschauen(fixture)).toHaveLength(3), fixture);

    expect(vorschauen(fixture)).toEqual([
      'Bin oben beim Gipfelkreuz.',
      'Basislager erreicht.',
      'Du: Wir starten morgen um 7 Uhr.',
    ]);
  });

  it('zeigt „Noch keine Nachrichten“ bei einem Kontakt ohne Nachricht', async () => {
    setup();
    const contacts = TestBed.inject(ContactRepository);
    await contacts.upsert(KONTAKTE[0]);
    TestBed.inject(DataChangedService).notify();
    const fixture = createPage(KontaktePage);

    await waitFor(() => expect(kontaktNamen(fixture)).toHaveLength(1), fixture);

    expect(vorschauen(fixture)).toEqual(['Noch keine Nachrichten']);
  });

  it('verlinkt jede Kontaktzeile auf den Chat', async () => {
    setup();
    await seed();
    const fixture = createPage(KontaktePage);

    await waitFor(() => expect(kontaktNamen(fixture)).toHaveLength(3), fixture);

    const link = fixture.nativeElement.querySelector('a.zeile') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/chat/1');
  });

  it('schiebt einen Kontakt mit neuer Nachricht nach oben und zeigt das Badge', async () => {
    setup();
    await seed();
    const fixture = createPage(KontaktePage);
    await connectAntenna();
    await waitFor(() => expect(kontaktNamen(fixture)).toHaveLength(3), fixture);

    window.ogMock?.receive('Luca Bernasconi', 'Test');

    await waitFor(() => expect(kontaktNamen(fixture)[0]).toBe('Luca Bernasconi'), fixture);
    expect(kontaktNamen(fixture)).toEqual(['Luca Bernasconi', 'Anna Meier', 'Mia Frei']);
    const badge = fixture.nativeElement.querySelector('a.zeile .og-badge') as HTMLElement;
    expect(badge.textContent?.trim()).toBe('1');
  });

  it('meldet die verbundene Antenne mit der Frequenz des Geräts in der Statuszeile', async () => {
    setup();
    await seed();
    const antenna = TestBed.inject(AntennaPort);
    const request = vi.spyOn(antenna, 'request');
    const fixture = createPage(KontaktePage);
    await connectAntenna();

    await waitFor(() => expect(statusText(fixture)).toContain('Antenne verbunden'), fixture);
    await waitFor(() => expect(statusText(fixture)).toContain('· USB-C · 869 MHz'), fixture);

    // Die Frequenz kommt vom Gerät (`radio.get`), nicht aus einem festen Wert der App.
    expect(request.mock.calls.some((call) => call[0] === 'radio.get')).toBe(true);
  });

  it('rechnet die Frequenz des Geräts nach unten in MHz um', async () => {
    setup();
    await seed();
    const antenna = TestBed.inject(AntennaPort);
    const original = antenna.request.bind(antenna);
    vi.spyOn(antenna, 'request').mockImplementation(async (cmd, args) => {
      if (cmd === 'radio.get') {
        return { freq_mhz: 915.9 };
      }
      return original(cmd, args);
    });
    const fixture = createPage(KontaktePage);
    await connectAntenna();

    await waitFor(() => expect(statusText(fixture)).toContain('· USB-C · 915 MHz'), fixture);
  });

  it('zeigt keine Frequenz, wenn das Gerät keine meldet', async () => {
    setup();
    await seed();
    const antenna = TestBed.inject(AntennaPort);
    const original = antenna.request.bind(antenna);
    const radioGet = vi.fn();
    vi.spyOn(antenna, 'request').mockImplementation(async (cmd, args) => {
      if (cmd === 'radio.get') {
        radioGet();
        throw new Error('Die Antenne antwortet nicht.');
      }
      return original(cmd, args);
    });
    const fixture = createPage(KontaktePage);
    await connectAntenna();

    await waitFor(() => expect(radioGet).toHaveBeenCalled(), fixture);

    expect(statusText(fixture)).toContain('· USB-C');
    expect(statusText(fixture)).not.toContain('MHz');
  });

  it('zeigt die kleinste gültige Frequenz des Geräts', async () => {
    setup();
    await seed();
    const tief = await seiteMitRadioGet({ freq_mhz: 150 });

    await waitFor(() => expect(statusText(tief.fixture)).toContain('· USB-C · 150 MHz'), tief.fixture);
  });

  it('zeigt die grösste gültige Frequenz des Geräts', async () => {
    setup();
    await seed();
    const hoch = await seiteMitRadioGet({ freq_mhz: 960 });

    await waitFor(() => expect(statusText(hoch.fixture)).toContain('· USB-C · 960 MHz'), hoch.fixture);
  });

  it('zeigt keine Frequenz, wenn das Gerät eine zu tiefe Frequenz nennt', async () => {
    setup();
    await seed();
    const { fixture, aufgerufen } = await seiteMitRadioGet({ freq_mhz: 149 });

    await waitFor(() => expect(aufgerufen()).toBe(true), fixture);

    expect(statusText(fixture)).toContain('· USB-C');
    expect(statusText(fixture)).not.toContain('MHz');
  });

  it('zeigt keine Frequenz, wenn das Gerät eine zu hohe Frequenz nennt', async () => {
    setup();
    await seed();
    const { fixture, aufgerufen } = await seiteMitRadioGet({ freq_mhz: 961 });

    await waitFor(() => expect(aufgerufen()).toBe(true), fixture);

    expect(statusText(fixture)).toContain('· USB-C');
    expect(statusText(fixture)).not.toContain('MHz');
  });

  it('zeigt keine Frequenz, wenn das Gerät keinen Frequenzwert nennt', async () => {
    setup();
    await seed();
    const { fixture, aufgerufen } = await seiteMitRadioGet({});

    await waitFor(() => expect(aufgerufen()).toBe(true), fixture);

    expect(statusText(fixture)).toContain('· USB-C');
    expect(statusText(fixture)).not.toContain('MHz');
  });

  it('zeigt keine Frequenz, wenn der Wert des Geräts keine Zahl ist', async () => {
    setup();
    await seed();
    const { fixture, aufgerufen } = await seiteMitRadioGet({ freq_mhz: 'unbekannt' });

    await waitFor(() => expect(aufgerufen()).toBe(true), fixture);

    expect(statusText(fixture)).toContain('· USB-C');
    expect(statusText(fixture)).not.toContain('MHz');
  });

  it('meldet die getrennte Antenne in der Statuszeile', async () => {
    setup();
    await seed();
    const fixture = createPage(KontaktePage);
    await connectAntenna();
    await waitFor(() => expect(statusText(fixture)).toContain('Antenne verbunden'), fixture);

    window.ogMock?.drop();

    await waitFor(() => expect(statusText(fixture)).toContain('Antenne getrennt'), fixture);
    expect(statusText(fixture)).toContain('· Tippen zum Verbinden');
  });

  it('zeigt den Leerzustand, wenn es keine Kontakte gibt', async () => {
    setup();
    await TestBed.inject(SettingsService).load();
    const fixture = createPage(KontaktePage);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(textOf(fixture)).toContain('Noch keine Kontakte');
    expect(textOf(fixture)).toContain(
      'Triff dich mit jemandem, der OffGrid nutzt, und scannt gegenseitig eure Codes. Danach könnt ihr ohne Mobilnetz schreiben.',
    );
    expect(textOf(fixture)).toContain('Ersten Kontakt hinzufügen');
    expect(fixture.nativeElement.querySelector('.kontakte__empty')).not.toBeNull();
  });

  it('zeigt im Leerzustand nur den Knopf für die Einstellungen', async () => {
    setup();
    await TestBed.inject(SettingsService).load();
    const fixture = createPage(KontaktePage);
    await fixture.whenStable();
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('.kontakte__actions og-icon-button a');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute('aria-label')).toBe('Einstellungen');
  });

  it('zeigt nach dem Onboarding den Leerzustand, wenn das Gerät keine Kontakte hat', async () => {
    localStorage.setItem('og.noseed', '1');
    setup();
    const antenna = TestBed.inject(AntennaPort);
    const settings = TestBed.inject(SettingsService);
    await settings.load();
    await antenna.connect();
    await waitForAntennaState(antenna, 'unprovisioned');
    expect(await antenna.provision('Alice')).toBe(true);
    await settings.completeOnboarding();
    const fixture = createPage(KontaktePage);

    await waitFor(() => expect(statusText(fixture)).toContain('Antenne verbunden'), fixture);

    expect(textOf(fixture)).toContain('Noch keine Kontakte');
    expect(textOf(fixture)).toContain('Ersten Kontakt hinzufügen');
    expect(alleNamen(fixture)).toEqual([]);
  });

  it('zeigt die Kontakte des Geräts, wenn die Antenne entsperrt wird', async () => {
    setup();
    const fixture = createPage(KontaktePage);
    await connectAntenna();

    await waitFor(() => expect(kontaktNamen(fixture)).toHaveLength(3), fixture);

    expect(kontaktNamen(fixture)).toEqual(['Anna Meier', 'Luca Bernasconi', 'Mia Frei']);
    expect(pendingNamen(fixture)).toEqual(['Jonas Keller']);
  });

  it('zeigt mit Kontakten den Knopf zum Hinzufügen', async () => {
    setup();
    await seed();
    const fixture = createPage(KontaktePage);

    await waitFor(() => expect(kontaktNamen(fixture)).toHaveLength(3), fixture);

    const buttons = fixture.nativeElement.querySelectorAll('.kontakte__actions og-icon-button a');
    expect(buttons).toHaveLength(2);
    expect(buttons[1].getAttribute('aria-label')).toBe('Kontakt hinzufügen');
  });
});
