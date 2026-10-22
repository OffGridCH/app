import { type Message } from './message';

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
