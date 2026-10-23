import type { Message } from './message';

export interface Contact {
  id: string;
  sendingKey: string;
  receivingKey: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  handshakeAt: string;
  lastRssi: number | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface Coordinate {
  id: string;
  contactId: string;
  messageId: string | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  context: 'einmal' | 'live';
  shareId: string | null;
  shareUntil: string | null;
  recordedAt: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface ContactListItem {
  contact: Contact;
  lastMessage: Message | null;
  unread: number;
  signalLevel: 0 | 1 | 2 | 3 | 4;
}

export interface PendingHandshakeItem {
  handshakeId: string;
  peerName: string;
}
