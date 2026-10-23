import { TestBed } from '@angular/core/testing';

import { dataProviders } from '../../app.config';
import { AntennaPort } from './antenna-port';
import { MockDevice, type MockContact, type MockDeviceOptions, type MockTiming } from './mock-device';
import { SerialTransport } from './serial-transport';
import { BrowserKeystoreService } from '../keystore/browser-keystore.service';
import { KeystoreService } from '../keystore/keystore.service';

/**
 * Test-Helfer (kein Produktivcode, wird von keiner App-Datei importiert): richtet den echten `AntennaPort` gegen das simulierte Gerät ein.
 */

/** Kurze Zeiten, damit Tests mit echten Timern schnell laufen. Der Auto-Lock ist aus. */
export const FAST_TIMING: MockTiming = {
  sent: 5,
  relayed: 10,
  delivered: 15,
  contactActive: 20,
  lockTimeout: 0,
};

/** Zwei Kontakte, wie sie ein schon eingerichtetes Gerät hätte. */
export const TEST_CONTACTS: MockContact[] = [
  {
    contact_id: 1,
    name: 'Anna',
    node_id: 'ECE4',
    public_key: 'A5d2V7F/elA8qTcKyHqIP0WiIe7IjNTvZ30L+2bBRls=',
    state: 'active',
    fingerprint: '4821 0937 1156',
    tx_ctr: 0,
    rx_highest_ctr: null,
    last_rssi: null,
    last_snr: null,
  },
  {
    contact_id: 2,
    name: 'Luca',
    node_id: 'ADC2',
    public_key: 'BqrLZITC2oY61ClcpwPFdCqy4fG2okPDHpdGQrTK4qI=',
    state: 'pending',
    fingerprint: '7304 6218 0095',
    tx_ctr: 0,
    rx_highest_ctr: null,
    last_rssi: null,
    last_snr: null,
  },
];

/** Leitung, die direkt am simulierten Gerät hängt (ohne Browser-Verzögerung). */
export class LoopbackTransport extends SerialTransport {
  readonly device: MockDevice;
  private dataHandler: ((chunk: string) => void) | null = null;
  private closedHandler: (() => void) | null = null;

  constructor(options: Partial<MockDeviceOptions> = {}) {
    super();
    this.device = new MockDevice((line) => this.dataHandler?.(line), {
      ...options,
      timing: { ...FAST_TIMING, ...options.timing },
    });
  }

  async open(): Promise<void> {
    this.device.start();
  }

  async write(text: string): Promise<void> {
    for (const line of text.split('\n')) {
      if (line.length > 0) {
        this.device.receiveLine(line);
      }
    }
  }

  async close(): Promise<void> {
    this.device.detach();
  }

  onData(handler: (chunk: string) => void): void {
    this.dataHandler = handler;
  }

  onClosed(handler: () => void): void {
    this.closedHandler = handler;
  }

  /** Das Kabel wird gezogen. */
  unplug(): void {
    this.device.detach();
    this.closedHandler?.();
  }
}

/** Ein eingerichtetes, gesperrtes Gerät, das das erste Token annimmt. */
export function provisionedDevice(name = 'Test'): Partial<MockDeviceOptions> {
  return {
    state: 'locked',
    identityName: name,
    contacts: TEST_CONTACTS.map((contact) => ({ ...contact })),
    adoptFirstToken: true,
  };
}

export interface AntennaHarness {
  transport: LoopbackTransport;
  keystore: BrowserKeystoreService;
  antenna: AntennaPort;
  device: MockDevice;
}

/**
 * Richtet TestBed mit dem echten `AntennaPort`, dem simulierten Gerät und Memory-Repositories ein.
 * Nach dem Test `harness.antenna.disconnect()` aufrufen, damit keine Timer weiterlaufen.
 */
export function setupAntennaHarness(options: Partial<MockDeviceOptions> = {}): AntennaHarness {
  const transport = new LoopbackTransport(options);
  const keystore = new BrowserKeystoreService();
  TestBed.configureTestingModule({
    providers: [
      ...dataProviders,
      { provide: SerialTransport, useValue: transport },
      { provide: KeystoreService, useValue: keystore },
    ],
  });
  return { transport, keystore, antenna: TestBed.inject(AntennaPort), device: transport.device };
}
