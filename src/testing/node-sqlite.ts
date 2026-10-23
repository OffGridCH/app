import { DatabaseSync } from 'node:sqlite';

import { MIGRATIONS } from '../app/core/data/migrations';
import type { SqlValue } from '../app/core/data/sqlite-mapping';

/**
 * Testhilfen, um die SQL-Abfragen der App gegen ein echtes SQLite zu prüfen.
 *
 * `node:sqlite` ist ab Node 22.5 Teil von Node und braucht kein Zusatzpaket.
 * Im Browser läuft die App mit den Memory-Repositories, diese Hilfen prüfen
 * deshalb genau die Abfragen, die auf Android gegen SQLite laufen.
 */

/** Legt eine In-Memory-Datenbank mit dem Schema aus Migration v1 an. */
export function openTestDatabase(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  const migration = MIGRATIONS.find((entry) => entry.version === 1);
  if (!migration) {
    throw new Error('Migration v1 fehlt');
  }
  for (const statement of migration.statements) {
    db.exec(statement);
  }
  return db;
}

/** Bindet `node:sqlite` an die Schnittstelle von `SqliteDatabaseService`. */
export class NodeSqliteDatabase {
  /**
   * Erlaubt, ein Statement vor der Ausführung zu ersetzen.
   *
   * Dient der Gegenprobe: so lässt sich der echte Produktivcode mit einem
   * Statement prüfen, das absichtlich fehlerhaft ist.
   */
  replaceStatement: (statement: string) => string = (statement) => statement;

  constructor(private readonly db: DatabaseSync) {}

  async query(statement: string, values: SqlValue[] = []): Promise<Record<string, unknown>[]> {
    return this.db.prepare(this.replaceStatement(statement)).all(...values);
  }

  async run(statement: string, values: SqlValue[] = []): Promise<void> {
    this.db.prepare(this.replaceStatement(statement)).run(...values);
  }
}
