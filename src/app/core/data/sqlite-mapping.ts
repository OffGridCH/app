import type { Contact, Coordinate } from '../models/contact';
import type { Handshake } from '../models/handshake';
import { MessageStatus, type Direction, type Message, type MessageKind } from '../models/message';

/** Wert, der als SQL-Parameter gebunden werden kann. */
export type SqlValue = string | number | null;

/** Spaltenliste einer Tabelle in der Reihenfolge der INSERT-Parameter. */
export const CONTACT_COLUMNS =
  'id, sending_key, receiving_key, display_name, first_name, last_name, handshake_at, last_rssi, last_seen_at, created_at, updated_at';

export const MESSAGE_COLUMNS =
  'id, contact_id, wire_id, content, direction, kind, sent_at, status, rssi, read_at, created_at, updated_at';

export const COORDINATE_COLUMNS =
  'id, contact_id, message_id, latitude, longitude, accuracy, context, share_id, share_until, recorded_at, created_at, updated_at';

export const HANDSHAKE_COLUMNS =
  'id, role, local_key, remote_key, peer_name, state, contact_id, created_at, updated_at';

export const CONTACT_INSERT = `INSERT INTO contacts (${CONTACT_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

export const CONTACT_UPDATE_NAMES =
  'UPDATE contacts SET display_name = ?, first_name = ?, last_name = ?, updated_at = ? WHERE id = ?';

export const CONTACT_UPDATE_SIGNAL = 'UPDATE contacts SET last_rssi = ?, last_seen_at = ?, updated_at = ? WHERE id = ?';

export const CONTACT_DELETE = 'DELETE FROM contacts WHERE id = ?';

export const MESSAGE_INSERT = `INSERT INTO messages (${MESSAGE_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

export const MESSAGE_UPDATE_STATUS = 'UPDATE messages SET status = ?, updated_at = ? WHERE id = ?';

export const MESSAGE_MARK_READ =
  "UPDATE messages SET read_at = ?, updated_at = ? WHERE contact_id = ? AND direction = 'in' AND read_at IS NULL";

export const COORDINATE_INSERT = `INSERT INTO coordinates (${COORDINATE_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

export const HANDSHAKE_INSERT = `INSERT INTO handshakes (${HANDSHAKE_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

export const HANDSHAKE_UPDATE =
  'UPDATE handshakes SET role = ?, local_key = ?, remote_key = ?, peer_name = ?, state = ?, contact_id = ?, updated_at = ? WHERE id = ?';

export const SETTING_UPSERT = 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)';

/** Parameterwerte eines Kontakts in der Reihenfolge von `CONTACT_COLUMNS`. */
export function contactValues(contact: Contact): SqlValue[] {
  return [
    contact.id,
    contact.sendingKey,
    contact.receivingKey,
    contact.displayName,
    contact.firstName,
    contact.lastName,
    contact.handshakeAt,
    contact.lastRssi,
    contact.lastSeenAt,
    contact.createdAt,
    contact.updatedAt,
  ];
}

/** Parameterwerte einer Nachricht in der Reihenfolge von `MESSAGE_COLUMNS`. */
export function messageValues(message: Message): SqlValue[] {
  return [
    message.id,
    message.contactId,
    message.wireId,
    message.content,
    message.direction,
    message.kind,
    message.sentAt,
    message.status,
    message.rssi,
    message.readAt,
    message.createdAt,
    message.updatedAt,
  ];
}

/** Parameterwerte einer Koordinate in der Reihenfolge von `COORDINATE_COLUMNS`. */
export function coordinateValues(coordinate: Coordinate): SqlValue[] {
  return [
    coordinate.id,
    coordinate.contactId,
    coordinate.messageId,
    coordinate.latitude,
    coordinate.longitude,
    coordinate.accuracy,
    coordinate.context,
    coordinate.shareId,
    coordinate.shareUntil,
    coordinate.recordedAt,
    coordinate.createdAt,
    coordinate.updatedAt,
  ];
}

/** Parameterwerte eines Handshakes in der Reihenfolge von `HANDSHAKE_COLUMNS`. */
export function handshakeValues(handshake: Handshake): SqlValue[] {
  return [
    handshake.id,
    handshake.role,
    handshake.localKey,
    handshake.remoteKey,
    handshake.peerName,
    handshake.state,
    handshake.contactId,
    handshake.createdAt,
    handshake.updatedAt,
  ];
}

/** Datenbankzeile -> Kontakt. */
export function toContact(row: Record<string, unknown>): Contact {
  return {
    id: text(row, 'id'),
    sendingKey: text(row, 'sending_key'),
    receivingKey: text(row, 'receiving_key'),
    displayName: text(row, 'display_name'),
    firstName: nullableText(row, 'first_name'),
    lastName: nullableText(row, 'last_name'),
    handshakeAt: text(row, 'handshake_at'),
    lastRssi: nullableNumber(row, 'last_rssi'),
    lastSeenAt: nullableText(row, 'last_seen_at'),
    createdAt: text(row, 'created_at'),
    updatedAt: nullableText(row, 'updated_at'),
  };
}

/** Datenbankzeile -> Nachricht. */
export function toMessage(row: Record<string, unknown>): Message {
  return {
    id: text(row, 'id'),
    contactId: text(row, 'contact_id'),
    wireId: text(row, 'wire_id'),
    content: text(row, 'content'),
    direction: text(row, 'direction') as Direction,
    kind: text(row, 'kind') as MessageKind,
    sentAt: text(row, 'sent_at'),
    status: number(row, 'status') as MessageStatus,
    rssi: nullableNumber(row, 'rssi'),
    readAt: nullableText(row, 'read_at'),
    createdAt: text(row, 'created_at'),
    updatedAt: nullableText(row, 'updated_at'),
  };
}

/** Datenbankzeile -> Koordinate. */
export function toCoordinate(row: Record<string, unknown>): Coordinate {
  return {
    id: text(row, 'id'),
    contactId: text(row, 'contact_id'),
    messageId: nullableText(row, 'message_id'),
    latitude: number(row, 'latitude'),
    longitude: number(row, 'longitude'),
    accuracy: nullableNumber(row, 'accuracy'),
    context: text(row, 'context') as Coordinate['context'],
    shareId: nullableText(row, 'share_id'),
    shareUntil: nullableText(row, 'share_until'),
    recordedAt: text(row, 'recorded_at'),
    createdAt: text(row, 'created_at'),
    updatedAt: nullableText(row, 'updated_at'),
  };
}

/** Datenbankzeile -> Handshake. */
export function toHandshake(row: Record<string, unknown>): Handshake {
  return {
    id: text(row, 'id'),
    role: text(row, 'role') as Handshake['role'],
    localKey: text(row, 'local_key'),
    remoteKey: nullableText(row, 'remote_key'),
    peerName: nullableText(row, 'peer_name'),
    state: text(row, 'state') as Handshake['state'],
    contactId: nullableText(row, 'contact_id'),
    createdAt: text(row, 'created_at'),
    updatedAt: nullableText(row, 'updated_at'),
  };
}

/** Textwert einer Spalte. */
export function text(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  return typeof value === 'string' ? value : String(value ?? '');
}

/** Textwert einer Spalte, `null` wenn die Spalte leer ist. */
export function nullableText(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' ? value : null;
}

/** Zahlenwert einer Spalte. */
export function number(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  return typeof value === 'number' ? value : Number(value ?? 0);
}

/** Zahlenwert einer Spalte, `null` wenn die Spalte leer ist. */
export function nullableNumber(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  return typeof value === 'number' ? value : null;
}

/** Aktueller Zeitstempel als ISO-8601-String in UTC. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Liest die Anzahl aus einer Zählabfrage (`COUNT(*) AS total`). */
export function countOf(rows: Record<string, unknown>[]): number {
  const value = rows[0]?.['total'];
  return typeof value === 'number' ? value : Number(value ?? 0);
}
