import { Injectable } from '@angular/core';

import { DEMO_CONTACTS } from '../data/memory/seed';
import type { FailureReason } from '../models/device';
import { MockDevice, type MockContact, type MockDeviceOptions } from './mock-device';
import { SerialTransport, TransportError } from './serial-transport';

/** Entwickler-Hooks auf `window.ogMock` (nur mit dem Browser-Mock). */
export interface OgMock {
  /** Ein Kontakt (Platz oder Name) schreibt einen Text. */
  receive(contact: number | string, text: string): void;
  /** Ein Kontakt reagiert. */
  react(contact: number | string, target: { author: 'me' | 'peer'; ref: number }, emoji: string | null): void;
  /** Ein Kontakt teilt seinen Standort. */
  receiveLocation(contact: number | string, lat?: number, lon?: number): void;
  /** Die nächste gesendete Nachricht schlägt fehl. */
  failNext(reason?: FailureReason): void;
  /** Das Gerät sperrt sich, als hätte die App zu lange nichts gesagt. */
  lock(): void;
  /** Das Gerät startet neu. */
  reboot(): void;
  /** Das Kabel wird gezogen. */
  drop(): void;
}

declare global {
  interface Window {
    ogMock?: OgMock;
  }
}

/** Der Demo-Kontakt in der Form der Host-API. */
function toMockContact(contact: (typeof DEMO_CONTACTS)[number]): MockContact {
  return {
    contact_id: contact.contactId,
    name: contact.name,
    node_id: contact.nodeId,
    public_key: contact.publicKey,
    state: contact.state,
    fingerprint: contact.fingerprint,
    tx_ctr: contact.txCtr,
    rx_highest_ctr: contact.rxHighestCtr,
    last_rssi: contact.lastRssi,
    last_snr: contact.lastSnr,
  };
}

/**
 * Leitung zum simulierten Gerät (Browser).
 *
 * Das Gerät lebt, solange die Seite offen ist. Standardmässig ist es ein schon eingerichtetes Gerät mit den
 * Demo-Kontakten, gesperrt, und nimmt das erste Token an. Mit `localStorage og.noseed = '1'` ist es ein
 * frisches Gerät (`unprovisioned`).
 */
@Injectable({ providedIn: 'root' })
export class MockSerialTransport extends SerialTransport {
  /** Das Gerät bleibt über Trennen und Neuverbinden erhalten (Tresor, Kontakte), nur sein Strom ist weg. */
  private device: MockDevice | null = null;
  private dataHandler: ((chunk: string) => void) | null = null;
  private closedHandler: (() => void) | null = null;
  private opening: { timer: ReturnType<typeof setTimeout>; cancel: () => void } | null = null;

  async open(): Promise<void> {
    this.device ??= new MockDevice((line) => this.dataHandler?.(line), this.demoOptions());
    const device = this.device;
    this.exposeHooks(device);
    // Das Gerät braucht einen Moment zum Booten und meldet sich dann mit einem LF und `sys.boot`.
    await new Promise<void>((resolve, reject) => {
      this.opening = {
        timer: setTimeout(resolve, 50),
        cancel: () => reject(new TransportError('open-failed', 'Verbindung beim Öffnen beendet')),
      };
    });
    this.opening = null;
    device.start();
  }

  async write(text: string): Promise<void> {
    const device = this.device;
    if (device === null) {
      throw new Error('Keine Verbindung');
    }
    for (const line of text.split('\n')) {
      if (line.length > 0) {
        device.receiveLine(line);
      }
    }
  }

  async close(): Promise<void> {
    if (this.opening !== null) {
      clearTimeout(this.opening.timer);
      this.opening.cancel();
      this.opening = null;
    }
    this.device?.detach();
    if (typeof window !== 'undefined') {
      delete window.ogMock;
    }
  }

  onData(handler: (chunk: string) => void): void {
    this.dataHandler = handler;
  }

  onClosed(handler: () => void): void {
    this.closedHandler = handler;
  }

  private demoOptions(): Partial<MockDeviceOptions> {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('og.noseed') === '1') {
      return {};
    }
    return {
      state: 'locked',
      identityName: 'HolyG',
      contacts: DEMO_CONTACTS.map(toMockContact),
      adoptFirstToken: true,
    };
  }

  private exposeHooks(device: MockDevice): void {
    if (typeof window === 'undefined') {
      return;
    }
    const resolve = (contact: number | string): number | null => {
      if (typeof contact === 'number') {
        return contact;
      }
      const found = DEMO_CONTACTS.find((entry) => entry.name === contact);
      return found ? found.contactId : null;
    };
    window.ogMock = {
      receive: (contact, text) => {
        const id = resolve(contact);
        if (id !== null) {
          device.injectText(id, text);
        }
      },
      react: (contact, target, emoji) => {
        const id = resolve(contact);
        if (id !== null) {
          device.injectReaction(id, target, emoji);
        }
      },
      receiveLocation: (contact, lat = 47.05812, lon = 8.31998) => {
        const id = resolve(contact);
        if (id !== null) {
          device.injectGeo(id, lat, lon);
        }
      },
      failNext: (reason) => device.failNext(reason),
      lock: () => device.lockNow(),
      reboot: () => device.reboot(),
      drop: () => {
        device.detach();
        this.closedHandler?.();
      },
    };
  }
}
