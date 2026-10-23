import { Injectable } from '@angular/core';

import type { Handshake } from '../../models/handshake';
import { HandshakeRepository } from '../handshake.repository';
import { nowIso } from '../sqlite-mapping';

/** Handshakes im Arbeitsspeicher (Browser). */
@Injectable({ providedIn: 'root' })
export class MemoryHandshakeRepository extends HandshakeRepository {
  private readonly rows = new Map<string, Handshake>();

  /** Leert alle Handshakes. */
  clear(): void {
    this.rows.clear();
  }

  /** Fügt mehrere Handshakes ein. */
  insertMany(rows: Handshake[]): void {
    for (const row of rows) {
      this.rows.set(row.id, row);
    }
  }

  async insert(handshake: Handshake): Promise<void> {
    this.rows.set(handshake.id, handshake);
  }

  async open(): Promise<Handshake[]> {
    return [...this.rows.values()]
      .filter((handshake) => handshake.state === 'waiting' || handshake.state === 'sent')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async doneShowers(): Promise<Handshake[]> {
    return [...this.rows.values()]
      .filter((handshake) => handshake.role === 'shower' && handshake.state === 'done')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async update(handshake: Handshake): Promise<void> {
    this.rows.set(handshake.id, { ...handshake, updatedAt: nowIso() });
  }
}
