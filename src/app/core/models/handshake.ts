export type HandshakeErrorCode = 'invalid-qr' | 'antenna-not-ready' | 'scan-cancelled' | 'scanner-unavailable';

export interface Handshake {
  id: string;
  role: 'shower' | 'scanner';
  localKey: string;
  remoteKey: string | null;
  peerName: string | null;
  state: 'waiting' | 'sent' | 'done' | 'cancelled';
  contactId: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface HandshakeView {
  role: 'shower' | 'scanner';
  step: 1 | 2 | 3;
  qrText?: string;
  peerName?: string;
  error?: HandshakeErrorCode;
}
