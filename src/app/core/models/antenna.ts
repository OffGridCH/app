// Antenne und LoRa-Frames. Quelle: Skill `offgrid-antenna-protocol` §4 und §5.

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

// Frame-Typen laut Skill `offgrid-antenna-protocol` §5. Weitere Typen kommen mit ihrem Ticket:
// 'loc' (T17), 'gki' und 'gmsg' (T20).
export type FrameType = 'msg' | 'ack' | 'hs' | 'hsa';
