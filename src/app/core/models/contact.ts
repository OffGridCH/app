import type { Message } from './message';

/** Zustand eines Kontakts auf dem Gerät: `pending`, bis das erste gültige Paket des Gegenübers eintrifft. */
export type ContactState = 'pending' | 'active';

/**
 * Ein Kontakt, wie ihn das Gerät meldet (`contact.get`).
 *
 * Die Kontaktschlüssel liegen nur auf dem Gerät und sind nie Teil dieses Objekts.
 * Die App spiegelt den Kontakt lokal, damit Verlauf und Anzeige auch ohne Gerät da sind.
 */
export interface Contact {
  /** Platz 1 bis 32 auf dem Gerät, stabil, solange der Kontakt existiert. */
  contactId: number;
  name: string;
  /** 4 Hex-Zeichen, Grossbuchstaben. */
  nodeId: string;
  /** Base64 des 32-Byte-Public-Keys. */
  publicKey: string;
  state: ContactState;
  /** Drei Gruppen zu je vier Ziffern, z. B. „0501 3010 7790“. Beide Handys zeigen dieselben Ziffern. */
  fingerprint: string;
  lastRssi: number | null;
  lastSnr: number | null;
  /** Nächster ausgehender Zähler (nur zur Information). */
  txCtr: number;
  /** Höchster verifizierter Zähler, den das Gerät empfangen hat. */
  rxHighestCtr: number | null;
}

export interface Coordinate {
  id: string;
  contactId: number;
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
