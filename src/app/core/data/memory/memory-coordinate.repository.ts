import { Injectable } from '@angular/core';

import type { Coordinate } from '../../models/contact';
import { CoordinateRepository } from '../coordinate.repository';

/** Standortdaten im Arbeitsspeicher (Browser). */
@Injectable({ providedIn: 'root' })
export class MemoryCoordinateRepository extends CoordinateRepository {
  private readonly rows = new Map<string, Coordinate>();

  /** Leert alle Koordinaten. */
  clear(): void {
    this.rows.clear();
  }

  /** Fügt mehrere Koordinaten ein. */
  insertMany(rows: Coordinate[]): void {
    for (const row of rows) {
      this.rows.set(row.id, row);
    }
  }

  /**
   * Entfernt alle Koordinaten eines Kontakts.
   *
   * Entspricht dem `ON DELETE CASCADE` auf `coordinates.contact_id` (nur in Memory vorhanden).
   */
  deleteByContact(contactId: number): void {
    for (const [id, coordinate] of this.rows) {
      if (coordinate.contactId === contactId) {
        this.rows.delete(id);
      }
    }
  }

  /**
   * Entfernt die Koordinaten zu bestimmten Nachrichten.
   *
   * Entspricht dem `ON DELETE CASCADE` auf `coordinates.message_id` (nur in Memory vorhanden).
   */
  deleteByMessages(messageIds: readonly string[]): void {
    if (messageIds.length === 0) {
      return;
    }
    const ids = new Set(messageIds);
    for (const [id, coordinate] of this.rows) {
      if (coordinate.messageId !== null && ids.has(coordinate.messageId)) {
        this.rows.delete(id);
      }
    }
  }

  async insert(coordinate: Coordinate): Promise<void> {
    this.rows.set(coordinate.id, coordinate);
  }

  async latestForMessage(messageId: string): Promise<Coordinate | null> {
    const rows = [...this.rows.values()]
      .filter((coordinate) => coordinate.messageId === messageId)
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
    return rows.length > 0 ? rows[0] : null;
  }

  async latestForMessages(messageIds: string[]): Promise<Map<string, Coordinate>> {
    const latest = new Map<string, Coordinate>();
    for (const messageId of messageIds) {
      const coordinate = await this.latestForMessage(messageId);
      if (coordinate) {
        latest.set(messageId, coordinate);
      }
    }
    return latest;
  }

  async messageIdForShare(contactId: number, shareId: string): Promise<string | null> {
    const rows = [...this.rows.values()]
      .filter((coordinate) => coordinate.contactId === contactId && coordinate.shareId === shareId)
      .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
    return rows.length > 0 ? rows[0].messageId : null;
  }

  async count(): Promise<number> {
    return this.rows.size;
  }
}
