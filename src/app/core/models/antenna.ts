export type AntennaState = 'disconnected' | 'searching' | 'device-found' | 'connecting' | 'ready' | 'error';

export interface AntennaInfo {
  proto: number;
  fw: string;
  freq: number;
  max: number;
}

export type AntennaEvent =
  | { type: 'rx'; frame: Uint8Array; rssi: number; snr: number }
  | { type: 'txdone'; id: string; ok: boolean; err?: string };

export type AntennaErrorCode =
  'no-device' | 'permission-denied' | 'open-failed' | 'no-info' | 'proto-mismatch' | 'lost';

export type FrameType = 'msg' | 'ack' | 'hs' | 'hsa';
