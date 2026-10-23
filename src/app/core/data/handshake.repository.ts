import { Injectable, inject } from '@angular/core';

import type { Handshake } from '../models/handshake';
import { SqliteDatabaseService } from './database.service';
import {
  HANDSHAKE_COLUMNS,
  HANDSHAKE_INSERT,
  HANDSHAKE_UPDATE,
  handshakeValues,
  nowIso,
  toHandshake,
} from './sqlite-mapping';

/**
 * Handshakes lesen und schreiben.
 *
 * Abstrakte Klasse, damit sie als DI-Token dienen kann: nativ die SQLite-,
 * im Browser die Memory-Implementierung.
 */
export abstract class HandshakeRepository {
  /** Neuer Handshake. */
  abstract insert(handshake: Handshake): Promise<void>;

  /** Offene Handshakes (warten oder gesendet). */
  abstract open(): Promise<Handshake[]>;

  /** Fertige Handshakes, bei denen wir den Code gezeigt haben. */
  abstract doneShowers(): Promise<Handshake[]>;

  /** Handshake ändern. */
  abstract update(handshake: Handshake): Promise<void>;
}

/** Handshakes in SQLite (nativ). */
@Injectable({ providedIn: 'root' })
export class SqliteHandshakeRepository extends HandshakeRepository {
  private readonly db = inject(SqliteDatabaseService);

  async insert(handshake: Handshake): Promise<void> {
    await this.db.run(HANDSHAKE_INSERT, handshakeValues(handshake));
  }

  async open(): Promise<Handshake[]> {
    const rows = await this.db.query(
      `SELECT ${HANDSHAKE_COLUMNS} FROM handshakes WHERE state IN ('waiting','sent') ORDER BY created_at ASC`,
    );
    return rows.map(toHandshake);
  }

  async doneShowers(): Promise<Handshake[]> {
    const rows = await this.db.query(
      `SELECT ${HANDSHAKE_COLUMNS} FROM handshakes WHERE role = 'shower' AND state = 'done' ORDER BY created_at ASC`,
    );
    return rows.map(toHandshake);
  }

  async update(handshake: Handshake): Promise<void> {
    await this.db.run(HANDSHAKE_UPDATE, [
      handshake.role,
      handshake.localKey,
      handshake.remoteKey,
      handshake.peerName,
      handshake.state,
      handshake.contactId,
      nowIso(),
      handshake.id,
    ]);
  }
}
