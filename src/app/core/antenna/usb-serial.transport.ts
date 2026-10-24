import { Injectable, inject } from '@angular/core';
import type { PluginListenerHandle } from '@capacitor/core';

import { fromBase64 } from '../crypto/base64';
import { log } from '../log';
import { SerialTransport, TransportError } from './serial-transport';
import { USB_SERIAL_PLUGIN } from './usb-serial.plugin';

const BAUD_RATE = 115200;

/** USB-Serial-Transport für Android. Er verbindet die App mit dem ersten verfügbaren Serial-Gerät. */
@Injectable({ providedIn: 'root' })
export class UsbSerialTransport extends SerialTransport {
  private readonly plugin = inject(USB_SERIAL_PLUGIN);
  private dataHandler: ((chunk: string) => void) | null = null;
  private closedHandler: (() => void) | null = null;
  private listenerHandles: PluginListenerHandle[] = [];
  private decoder = new TextDecoder('utf-8');

  async open(): Promise<void> {
    this.decoder = new TextDecoder('utf-8');
    try {
      const { devices } = await this.plugin.listDevices();
      const device = devices[0];
      if (!device) {
        throw new TransportError('no-device', 'Kein USB-Serial-Gerät gefunden');
      }

      await this.addListeners();
      await this.plugin.connect({ deviceId: device.deviceId, baudRate: BAUD_RATE });
    } catch (error) {
      await this.removeListeners();
      throw this.toTransportError(error);
    }
  }

  async write(text: string): Promise<void> {
    try {
      await this.plugin.write({ data: text });
    } catch (error) {
      throw this.toTransportError(error);
    }
  }

  async close(): Promise<void> {
    try {
      await this.plugin.disconnect();
    } catch (error) {
      throw this.toTransportError(error);
    } finally {
      await this.removeListeners();
    }
  }

  onData(handler: (chunk: string) => void): void {
    this.dataHandler = handler;
  }

  onClosed(handler: () => void): void {
    this.closedHandler = handler;
  }

  private async addListeners(): Promise<void> {
    const handles = await Promise.all([
      this.plugin.addListener('data', ({ data }) => this.handleData(data)),
      this.plugin.addListener('detached', () => this.closedHandler?.()),
      this.plugin.addListener('error', ({ message }) => {
        log.error('Fehler im USB-Serial-Plugin', message);
        this.closedHandler?.();
      }),
    ]);
    this.listenerHandles = handles;
  }

  private async removeListeners(): Promise<void> {
    const handles = this.listenerHandles;
    this.listenerHandles = [];
    await Promise.allSettled(handles.map((handle) => handle.remove()));
  }

  private handleData(encoded: string): void {
    try {
      const text = this.decoder.decode(fromBase64(encoded), { stream: true });
      if (text.length > 0) {
        this.dataHandler?.(text);
      }
    } catch (error) {
      log.error('USB-Serial-Daten konnten nicht dekodiert werden', error);
      this.closedHandler?.();
    }
  }

  private toTransportError(error: unknown): TransportError {
    if (error instanceof TransportError) {
      return error;
    }

    switch (pluginErrorCode(error)) {
      case 'PERMISSION_DENIED':
        return new TransportError('permission-denied', 'Keine Berechtigung für das USB-Serial-Gerät');
      case 'NO_DRIVER':
        return new TransportError('no-device', 'Kein passendes USB-Serial-Gerät gefunden');
      case 'OPEN_FAILED':
        return new TransportError('open-failed', 'USB-Serial-Gerät konnte nicht geöffnet werden');
      default:
        return new TransportError('open-failed', 'USB-Serial-Gerät konnte nicht geöffnet werden');
    }
  }
}

function pluginErrorCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = error.code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}
