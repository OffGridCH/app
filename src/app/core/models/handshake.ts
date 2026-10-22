import { type HandshakeErrorCode } from './errors';

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

/** Zustand der Handshake-Seite für die Anzeige. */
export interface HandshakeView {
  role: 'shower' | 'scanner';
  step: 1 | 2 | 3;
  qrText?: string;
  peerName?: string;
  error?: HandshakeErrorCode;
}
