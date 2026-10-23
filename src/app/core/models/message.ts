import type { Coordinate } from './contact';

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
  contactId: number;
  /** Zähler dieser Nachricht in der Unterhaltung (0 bis 16777215); bis `msg.send` antwortet `null`. */
  ctr: number | null;
  /** Lokaler Handle des Geräts für Status-Ereignisse, nur bis zum nächsten Neustart des Geräts gültig. */
  msgRef: number | null;
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

export interface MessageView extends Message {
  location: Coordinate | null;
}

export interface GeoFix {
  latitude: number;
  longitude: number;
  accuracy: number;
  at: string;
}
