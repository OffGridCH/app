import type { Contact, Coordinate } from '../models/contact';
import { MessageStatus, type Direction, type Message, type MessageKind } from '../models/message';

/** Wert, der als SQL-Parameter gebunden werden kann. */
export type SqlValue = string | number | null;

/** Spaltenliste einer Tabelle in der Reihenfolge der INSERT-Parameter. */
export const CONTACT_COLUMNS =
  'contact_id, name, node_id, public_key, state, fingerprint, last_rssi, last_snr, tx_ctr, rx_highest_ctr';

export const MESSAGE_COLUMNS =
  'id, contact_id, ctr, msg_ref, content, direction, kind, sent_at, status, rssi, read_at, created_at, updated_at';

/**
 * Spaltenliste der Tabelle `messages`, mit dem Tabellennamen qualifiziert.
 *
 * Nötig in Abfragen mit `JOIN`, sonst sind Spaltennamen wie `contact_id` mehrdeutig.
 */
export const MESSAGE_COLUMNS_QUALIFIED = MESSAGE_COLUMNS.split(', ')
  .map((column) => `messages.${column}`)
  .join(', ');

export const COORDINATE_COLUMNS =
  'id, contact_id, message_id, latitude, longitude, accuracy, context, share_id, share_until, recorded_at, created_at, updated_at';

export const CONTACT_INSERT = `INSERT INTO contacts (${CONTACT_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

/**
 * Kontakt einfügen oder aktualisieren.
 *
 * Kein `INSERT OR REPLACE`: Das löscht die Zeile zuerst und würde über `ON DELETE CASCADE`
 * den Verlauf des Kontakts mitlöschen.
 */
export const CONTACT_UPSERT = `${CONTACT_INSERT}
  ON CONFLICT(contact_id) DO UPDATE SET
    name = excluded.name,
    node_id = excluded.node_id,
    public_key = excluded.public_key,
    state = excluded.state,
    fingerprint = excluded.fingerprint,
    last_rssi = excluded.last_rssi,
    last_snr = excluded.last_snr,
    tx_ctr = excluded.tx_ctr,
    rx_highest_ctr = excluded.rx_highest_ctr`;

export const CONTACT_UPDATE_NAME = 'UPDATE contacts SET name = ? WHERE contact_id = ?';

export const CONTACT_UPDATE_LINK = 'UPDATE contacts SET last_rssi = ?, last_snr = ? WHERE contact_id = ?';

export const CONTACT_UPDATE_STATE = 'UPDATE contacts SET state = ? WHERE contact_id = ?';

export const CONTACT_DELETE = 'DELETE FROM contacts WHERE contact_id = ?';

export const MESSAGE_INSERT = `INSERT INTO messages (${MESSAGE_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

export const MESSAGE_UPDATE_STATUS = 'UPDATE messages SET status = ?, updated_at = ? WHERE id = ?';

/** Zähler und Handle aus der Antwort des Geräts auf `msg.send` eintragen. */
export const MESSAGE_ASSIGN_REF = 'UPDATE messages SET ctr = ?, msg_ref = ?, status = ?, updated_at = ? WHERE id = ?';

/** Eine gescheiterte Nachricht noch einmal senden: wieder in die Warteschlange, ohne Zähler und Handle. */
export const MESSAGE_REQUEUE = 'UPDATE messages SET ctr = NULL, msg_ref = NULL, status = ?, updated_at = ? WHERE id = ?';

/** Alles, was das Gerät in der Warteschlange hatte, gilt nach seinem Neustart als gescheitert. */
export const MESSAGE_FAIL_PENDING =
  "UPDATE messages SET status = ?, updated_at = ? WHERE direction = 'out' AND msg_ref IS NOT NULL AND status IN (?, ?)";

export const MESSAGE_MARK_READ =
  "UPDATE messages SET read_at = ?, updated_at = ? WHERE contact_id = ? AND direction = 'in' AND read_at IS NULL";

/**
 * Die letzte Nachricht je Kontakt.
 *
 * Alle projizierten Spalten sind mit `messages.` qualifiziert, sonst meldet SQLite
 * bei der Unterabfrage `latest` „ambiguous column name: contact_id“.
 */
export const MESSAGE_LAST_PER_CONTACT = `SELECT ${MESSAGE_COLUMNS_QUALIFIED} FROM messages
  INNER JOIN (
    SELECT contact_id, MAX(sent_at) AS max_sent FROM messages GROUP BY contact_id
  ) latest ON latest.contact_id = messages.contact_id AND latest.max_sent = messages.sent_at
  ORDER BY messages.sent_at ASC`;

export const COORDINATE_INSERT = `INSERT INTO coordinates (${COORDINATE_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

export const SETTING_UPSERT = 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)';

/** Parameterwerte eines Kontakts in der Reihenfolge von `CONTACT_COLUMNS`. */
export function contactValues(contact: Contact): SqlValue[] {
  return [
    contact.contactId,
    contact.name,
    contact.nodeId,
    contact.publicKey,
    contact.state,
    contact.fingerprint,
    contact.lastRssi,
    contact.lastSnr,
    contact.txCtr,
    contact.rxHighestCtr,
  ];
}

/** Parameterwerte einer Nachricht in der Reihenfolge von `MESSAGE_COLUMNS`. */
export function messageValues(message: Message): SqlValue[] {
  return [
    message.id,
    message.contactId,
    message.ctr,
    message.msgRef,
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

/** Datenbankzeile -> Kontakt. */
export function toContact(row: Record<string, unknown>): Contact {
  return {
    contactId: number(row, 'contact_id'),
    name: text(row, 'name'),
    nodeId: text(row, 'node_id'),
    publicKey: text(row, 'public_key'),
    state: text(row, 'state') as Contact['state'],
    fingerprint: text(row, 'fingerprint'),
    lastRssi: nullableNumber(row, 'last_rssi'),
    lastSnr: nullableNumber(row, 'last_snr'),
    txCtr: number(row, 'tx_ctr'),
    rxHighestCtr: nullableNumber(row, 'rx_highest_ctr'),
  };
}

/** Datenbankzeile -> Nachricht. */
export function toMessage(row: Record<string, unknown>): Message {
  return {
    id: text(row, 'id'),
    contactId: number(row, 'contact_id'),
    ctr: nullableNumber(row, 'ctr'),
    msgRef: nullableNumber(row, 'msg_ref'),
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
    contactId: number(row, 'contact_id'),
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
