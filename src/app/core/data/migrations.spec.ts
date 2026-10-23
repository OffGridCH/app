import { MIGRATIONS } from './migrations';
import {
  CONTACT_COLUMNS,
  CONTACT_DELETE,
  CONTACT_INSERT,
  CONTACT_UPDATE_NAMES,
  CONTACT_UPDATE_SIGNAL,
  COORDINATE_COLUMNS,
  COORDINATE_INSERT,
  HANDSHAKE_COLUMNS,
  HANDSHAKE_INSERT,
  HANDSHAKE_UPDATE,
  MESSAGE_COLUMNS,
  MESSAGE_INSERT,
  MESSAGE_MARK_READ,
  MESSAGE_UPDATE_STATUS,
  SETTING_UPSERT,
} from './sqlite-mapping';

/** Feste Werte, die im Schema erlaubt sind (CHECK-Constraints, feste Vergleiche). */
const ALLOWED_LITERALS = new Set([
  'in',
  'out',
  'text',
  'location',
  'shower',
  'scanner',
  'waiting',
  'sent',
  'done',
  'cancelled',
  'einmal',
  'live',
]);

/** Alle Statements der Migrationen. */
function migrationStatements(): string[] {
  return MIGRATIONS.flatMap((migration) => migration.statements);
}

/** Ein Statement ohne Zeilenumbrüche. */
function normalize(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

/** Zerlegt den Rumpf einer CREATE TABLE-Anweisung an den Kommas ausserhalb der Klammern. */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of body) {
    if (char === '(') {
      depth += 1;
    }
    if (char === ')') {
      depth -= 1;
    }
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim().length > 0) {
    parts.push(current.trim());
  }
  return parts;
}

/** Das CREATE TABLE-Statement einer Tabelle. */
function ddlOf(table: string): string {
  const statement = migrationStatements().find((sql) =>
    normalize(sql).startsWith(`CREATE TABLE IF NOT EXISTS ${table} (`),
  );
  if (!statement) {
    throw new Error(`Tabelle ${table} fehlt in den Migrationen`);
  }
  return normalize(statement);
}

/** Die Spaltennamen einer Tabelle in der Reihenfolge des Schemas. */
function columnsOf(table: string): string[] {
  const ddl = ddlOf(table);
  const body = ddl.slice(ddl.indexOf('(') + 1, ddl.lastIndexOf(')'));
  return splitTopLevel(body)
    .filter((part) => !/^(primary|unique|check|foreign|constraint)\b/i.test(part))
    .map((part) => part.split(/\s+/)[0]);
}

/** Alle in Anführungszeichen gesetzten Texte eines Statements. */
function literalsOf(sql: string): string[] {
  return [...sql.matchAll(/'([^']*)'/g)].map((match) => match[1]);
}

/** Anzahl der Parameterbindungen (`?`) eines Statements. */
function placeholdersOf(sql: string): number {
  return (sql.match(/\?/g) ?? []).length;
}

/** Anzahl der Spalten einer Spaltenliste. */
function columnCount(columns: string): number {
  return columns.split(',').length;
}

describe('Migrationen', () => {
  it('legt die Versionen aufsteigend und eindeutig an, zuerst Version 1', () => {
    const versions = MIGRATIONS.map((migration) => migration.version);

    expect(versions[0]).toBe(1);
    expect([...versions].sort((a, b) => a - b)).toEqual(versions);
    expect(new Set(versions).size).toBe(versions.length);
    for (const version of versions) {
      expect(Number.isSafeInteger(version)).toBe(true);
      expect(version).toBeGreaterThanOrEqual(0);
    }
  });

  it('erstellt die Tabelle contacts mit den Spalten aus dem Daten-Skill', () => {
    expect(columnsOf('contacts')).toEqual([
      'id',
      'sending_key',
      'receiving_key',
      'display_name',
      'first_name',
      'last_name',
      'handshake_at',
      'last_rssi',
      'last_seen_at',
      'created_at',
      'updated_at',
    ]);
  });

  it('erstellt die Tabelle messages mit den Spalten aus dem Daten-Skill', () => {
    expect(columnsOf('messages')).toEqual([
      'id',
      'contact_id',
      'wire_id',
      'content',
      'direction',
      'kind',
      'sent_at',
      'status',
      'rssi',
      'read_at',
      'created_at',
      'updated_at',
    ]);
  });

  it('erstellt die Tabelle coordinates mit den Spalten aus dem Daten-Skill', () => {
    expect(columnsOf('coordinates')).toEqual([
      'id',
      'contact_id',
      'message_id',
      'latitude',
      'longitude',
      'accuracy',
      'context',
      'share_id',
      'share_until',
      'recorded_at',
      'created_at',
      'updated_at',
    ]);
  });

  it('erstellt die Tabelle handshakes mit den Spalten aus dem Daten-Skill', () => {
    expect(columnsOf('handshakes')).toEqual([
      'id',
      'role',
      'local_key',
      'remote_key',
      'peer_name',
      'state',
      'contact_id',
      'created_at',
      'updated_at',
    ]);
  });

  it('erstellt die Tabelle settings mit den Spalten aus dem Daten-Skill', () => {
    expect(columnsOf('settings')).toEqual(['key', 'value']);
  });

  it('legt die Indizes aus dem Daten-Skill an', () => {
    const statements = migrationStatements().map(normalize);

    expect(statements).toContain(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_receiving_key ON contacts(receiving_key);',
    );
    expect(statements).toContain(
      'CREATE INDEX IF NOT EXISTS idx_messages_contact_sent ON messages(contact_id, sent_at);',
    );
    expect(statements).toContain('CREATE INDEX IF NOT EXISTS idx_messages_wire ON messages(contact_id, wire_id);');
    expect(statements).toContain(
      'CREATE INDEX IF NOT EXISTS idx_coordinates_message ON coordinates(message_id, recorded_at);',
    );
  });

  it('löscht Nachrichten und Koordinaten per ON DELETE CASCADE', () => {
    expect(ddlOf('messages')).toContain('contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE');
    expect(ddlOf('coordinates')).toContain('contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE');
    expect(ddlOf('coordinates')).toContain('message_id TEXT REFERENCES messages(id) ON DELETE CASCADE');
  });

  it('hält die Wertebereiche der Spalten ein', () => {
    expect(ddlOf('messages')).toContain("CHECK (direction IN ('in','out'))");
    expect(ddlOf('messages')).toContain("CHECK (kind IN ('text','location'))");
    expect(ddlOf('messages')).toContain('CHECK (status BETWEEN 0 AND 3)');
    expect(ddlOf('handshakes')).toContain("CHECK (role IN ('shower','scanner'))");
    expect(ddlOf('handshakes')).toContain("CHECK (state IN ('waiting','sent','done','cancelled'))");
    expect(ddlOf('coordinates')).toContain("CHECK (context IN ('einmal','live'))");
    expect(ddlOf('contacts')).toContain('CHECK (length(sending_key) = 32)');
    expect(ddlOf('contacts')).toContain('CHECK (length(receiving_key) = 32)');
    expect(ddlOf('contacts')).toContain('CHECK (length(display_name) BETWEEN 1 AND 100)');
    expect(ddlOf('messages')).toContain('CHECK (length(wire_id) = 8)');
  });

  it('bindet alle Werte als Parameter und verkettet keine Werte in SQL', () => {
    const statements = [
      ...migrationStatements(),
      CONTACT_INSERT,
      CONTACT_UPDATE_NAMES,
      CONTACT_UPDATE_SIGNAL,
      CONTACT_DELETE,
      MESSAGE_INSERT,
      MESSAGE_UPDATE_STATUS,
      MESSAGE_MARK_READ,
      COORDINATE_INSERT,
      HANDSHAKE_INSERT,
      HANDSHAKE_UPDATE,
      SETTING_UPSERT,
    ];

    for (const statement of statements) {
      for (const literal of literalsOf(statement)) {
        expect(ALLOWED_LITERALS.has(literal), `Unerlaubter Wert „${literal}" in: ${normalize(statement)}`).toBe(true);
      }
    }
  });

  it('bindet bei jedem INSERT so viele Werte wie die Tabelle Spalten hat', () => {
    expect(placeholdersOf(CONTACT_INSERT)).toBe(columnCount(CONTACT_COLUMNS));
    expect(placeholdersOf(MESSAGE_INSERT)).toBe(columnCount(MESSAGE_COLUMNS));
    expect(placeholdersOf(COORDINATE_INSERT)).toBe(columnCount(COORDINATE_COLUMNS));
    expect(placeholdersOf(HANDSHAKE_INSERT)).toBe(columnCount(HANDSHAKE_COLUMNS));
  });
});
