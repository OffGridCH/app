import { Injectable, inject } from '@angular/core';

import type { Coordinate } from '../models/contact';
import { SqliteDatabaseService } from './database.service';
import { COORDINATE_COLUMNS, COORDINATE_INSERT, coordinateValues, countOf, toCoordinate } from './sqlite-mapping';

/**
 * Standortdaten lesen und schreiben.
 *
 * Abstrakte Klasse, damit sie als DI-Token dienen kann: nativ die SQLite-,
 * im Browser die Memory-Implementierung.
 */
export abstract class CoordinateRepository {
  /** Neue Koordinate. */
  abstract insert(coordinate: Coordinate): Promise<void>;

  /** Die neueste Koordinate einer Nachricht oder `null`. */
  abstract latestForMessage(messageId: string): Promise<Coordinate | null>;

  /** Die neueste Koordinate je Nachricht. */
  abstract latestForMessages(messageIds: string[]): Promise<Map<string, Coordinate>>;

  /** Die Nachricht-Id zu einer Freigabe-Id oder `null`. */
  abstract messageIdForShare(contactId: number, shareId: string): Promise<string | null>;

  /** Anzahl der Koordinaten. */
  abstract count(): Promise<number>;
}

/** Standortdaten in SQLite (nativ). */
@Injectable({ providedIn: 'root' })
export class SqliteCoordinateRepository extends CoordinateRepository {
  private readonly db = inject(SqliteDatabaseService);

  async insert(coordinate: Coordinate): Promise<void> {
    await this.db.run(COORDINATE_INSERT, coordinateValues(coordinate));
  }

  async latestForMessage(messageId: string): Promise<Coordinate | null> {
    const rows = await this.db.query(
      `SELECT ${COORDINATE_COLUMNS} FROM coordinates WHERE message_id = ? ORDER BY recorded_at DESC LIMIT 1`,
      [messageId],
    );
    return rows.length > 0 ? toCoordinate(rows[0]) : null;
  }

  async latestForMessages(messageIds: string[]): Promise<Map<string, Coordinate>> {
    const latest = new Map<string, Coordinate>();
    if (messageIds.length === 0) {
      return latest;
    }
    const placeholders = messageIds.map(() => '?').join(', ');
    const rows = await this.db.query(
      `SELECT ${COORDINATE_COLUMNS} FROM coordinates
       WHERE message_id IN (${placeholders})
       AND recorded_at IN (
         SELECT MAX(recorded_at) FROM coordinates WHERE message_id IN (${placeholders}) GROUP BY message_id
       )
       ORDER BY recorded_at ASC`,
      [...messageIds, ...messageIds],
    );
    for (const row of rows) {
      const coordinate = toCoordinate(row);
      if (coordinate.messageId !== null) {
        latest.set(coordinate.messageId, coordinate);
      }
    }
    return latest;
  }

  async messageIdForShare(contactId: number, shareId: string): Promise<string | null> {
    const rows = await this.db.query(
      'SELECT message_id FROM coordinates WHERE contact_id = ? AND share_id = ? ORDER BY recorded_at ASC LIMIT 1',
      [contactId, shareId],
    );
    const messageId = rows[0]?.['message_id'];
    return typeof messageId === 'string' ? messageId : null;
  }

  async count(): Promise<number> {
    const rows = await this.db.query('SELECT COUNT(*) AS total FROM coordinates');
    return countOf(rows);
  }
}
