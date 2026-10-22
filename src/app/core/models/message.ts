export type Direction = 'in' | 'out';

export enum MessageStatus {
  Queued = 0,
  Sent = 1,
  Delivered = 2,
  Failed = 3,
}

export type MessageKind = 'text' | 'location';

export interface Message {
  id: string;
  contactId: string;
  wireId: string;
  content: string;
  direction: Direction;
  kind: MessageKind;
  sentAt: string;
  status: MessageStatus;
  rssi: number | null;
  readAt: string | null;
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

export interface MessageView extends Message {
  location: Coordinate | null;
}

export interface GeoFix {
  latitude: number;
  longitude: number;
  accuracy: number;
  at: string;
}
