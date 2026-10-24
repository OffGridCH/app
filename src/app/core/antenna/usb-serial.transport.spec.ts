import { TestBed } from '@angular/core/testing';
import type { PluginListenerHandle } from '@capacitor/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toBase64 } from '../crypto/base64';
import { USB_SERIAL_PLUGIN } from './usb-serial.plugin';
import { UsbSerialTransport } from './usb-serial.transport';

const mocks = {
  listDevices: vi.fn(),
  connect: vi.fn(),
  write: vi.fn(),
  disconnect: vi.fn(),
  addListener: vi.fn(),
  listeners: new Map<string, (event: unknown) => void>(),
};

describe('UsbSerialTransport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listeners.clear();
    mocks.listDevices.mockResolvedValue({
      devices: [{ deviceId: 7, vendorId: 0x303a, productId: 0x1001, name: 'USB' }],
    });
    mocks.connect.mockResolvedValue(undefined);
    mocks.write.mockResolvedValue(undefined);
    mocks.disconnect.mockResolvedValue(undefined);
    mocks.addListener.mockImplementation(
      (event: string, listener: (event: unknown) => void): Promise<PluginListenerHandle> => {
        mocks.listeners.set(event, listener);
        return Promise.resolve({
          remove: vi.fn(async () => {
            mocks.listeners.delete(event);
          }),
        });
      },
    );
    TestBed.configureTestingModule({
      providers: [{ provide: USB_SERIAL_PLUGIN, useValue: mocks }],
    });
  });

  it('meldet kein Gerät als no-device', async () => {
    mocks.listDevices.mockResolvedValue({ devices: [] });
    const transport = TestBed.inject(UsbSerialTransport);

    await expect(transport.open()).rejects.toMatchObject({ code: 'no-device' });
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it.each([
    ['PERMISSION_DENIED', 'permission-denied'],
    ['OPEN_FAILED', 'open-failed'],
    ['NO_DRIVER', 'no-device'],
  ] as const)('übersetzt den Plugin-Code %s', async (pluginCode, transportCode) => {
    mocks.connect.mockRejectedValue({ code: pluginCode });
    const transport = TestBed.inject(UsbSerialTransport);

    await expect(transport.open()).rejects.toMatchObject({ code: transportCode });
  });

  it('dekodiert UTF-8 über Chunk-Grenzen hinweg', async () => {
    const transport = TestBed.inject(UsbSerialTransport);
    const chunks: string[] = [];
    transport.onData((chunk) => chunks.push(chunk));
    await transport.open();

    const bytes = new TextEncoder().encode('Grüsse');
    const split = bytes.indexOf(0xc3) + 1;
    emit('data', { data: toBase64(bytes.slice(0, split)) });
    emit('data', { data: toBase64(bytes.slice(split)) });

    expect(chunks.join('')).toBe('Grüsse');
  });

  it('meldet das Abziehen des Geräts als geschlossen', async () => {
    const transport = TestBed.inject(UsbSerialTransport);
    const closed = vi.fn();
    transport.onClosed(closed);
    await transport.open();

    emit('detached', {});

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('meldet einen Lesefehler des Plugins als geschlossen', async () => {
    const transport = TestBed.inject(UsbSerialTransport);
    const closed = vi.fn();
    transport.onClosed(closed);
    await transport.open();

    emit('error', { message: 'Lesefehler' });

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('meldet einen unbekannten Plugin-Fehler als open-failed', async () => {
    mocks.connect.mockRejectedValue(new Error('unbekannt'));
    const transport = TestBed.inject(UsbSerialTransport);

    await expect(transport.open()).rejects.toMatchObject({ code: 'open-failed' });
  });

  it('schreibt Text unverändert zum Plugin', async () => {
    const transport = TestBed.inject(UsbSerialTransport);
    await transport.open();

    await transport.write('Grüsse\n');

    expect(mocks.write).toHaveBeenCalledWith({ data: 'Grüsse\n' });
  });

  it('trennt die Verbindung beim Schliessen und entfernt die Listener', async () => {
    const transport = TestBed.inject(UsbSerialTransport);
    await transport.open();

    await transport.close();

    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
    expect(mocks.listeners.size).toBe(0);
  });
});

function emit(event: string, payload: unknown): void {
  const listener = mocks.listeners.get(event);
  expect(listener).toBeDefined();
  listener?.(payload);
}
