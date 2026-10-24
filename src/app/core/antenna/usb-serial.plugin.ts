import { InjectionToken } from '@angular/core';
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/** Ein USB-Gerät, das als Serial-Port geöffnet werden kann. */
export interface UsbSerialDevice {
  deviceId: number;
  vendorId: number;
  productId: number;
  name: string;
}

/** Schnittstelle des nativen Capacitor-Plugins `UsbSerial`. */
export interface UsbSerialPlugin {
  listDevices(): Promise<{ devices: UsbSerialDevice[] }>;
  connect(options: { deviceId: number; baudRate: number }): Promise<void>;
  write(options: { data: string }): Promise<void>;
  disconnect(): Promise<void>;
  /** `data` enthält die empfangenen Bytes Base64-kodiert. */
  addListener(event: 'data', listener: (event: { data: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'detached', listener: () => void): Promise<PluginListenerHandle>;
  addListener(event: 'error', listener: (event: { message: string }) => void): Promise<PluginListenerHandle>;
}

export const UsbSerial = registerPlugin<UsbSerialPlugin>('UsbSerial');

/** DI-Token für das native Plugin, damit der Transport im Test ersetzt werden kann. */
export const USB_SERIAL_PLUGIN = new InjectionToken<UsbSerialPlugin>('USB_SERIAL_PLUGIN');
