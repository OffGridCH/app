import { MIGRATIONS } from './migrations';
import {
  CONTACT_COLUMNS,
  CONTACT_DELETE,
  CONTACT_INSERT,
  CONTACT_UPDATE_LINK,
  CONTACT_UPDATE_NAME,
  CONTACT_UPDATE_STATE,
  CONTACT_UPSERT,
  COORDINATE_COLUMNS,
  COORDINATE_INSERT,
  MESSAGE_ASSIGN_REF,
  MESSAGE_COLUMNS,
  MESSAGE_FAIL_PENDING,
  MESSAGE_INSERT,
  MESSAGE_LAST_PER_CONTACT,
  MESSAGE_MARK_READ,
  MESSAGE_REQUEUE,
  MESSAGE_UPDATE_STATUS,
  SETTING_UPSERT,
} from './sqlite-mapping';

/** Feste Werte, die im Schema erlaubt sind (CHECK-Constraints, feste Vergleiche). */
const ALLOWED_LITERALS = new Set([
  'in',
  'out',
  'text',
  'location',
  'pending',
  'active',
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

  it('erstellt die Tabelle contacts ohne Schlüssel, nur mit den Spalten der Host-API', () => {
    expect(columnsOf('contacts')).toEqual([
      'contact_id',
      'name',
      'node_id',
      'public_key',
      'state',
      'fingerprint',
      'last_rssi',
      'last_snr',
      'tx_ctr',
      'rx_highest_ctr',
    ]);
  });

  it('speichert keine Schlüssel und keine Funk-Id', () => {
    const ddl = migrationStatements().map(normalize).join(' ');

    expect(ddl).not.toMatch(/sending_key|receiving_key|local_key|remote_key|wire_id/);
  });

  it('erstellt die Tabelle messages mit ctr und msg_ref statt wire_id', () => {
    expect(columnsOf('messages')).toEqual([
      'id',
      'contact_id',
      'ctr',
      'msg_ref',
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

  it('hat keine Tabelle handshakes mehr (das Gerät macht das Pairing)', () => {
    expect(() => ddlOf('handshakes')).toThrow();
  });

  it('erstellt die Tabelle settings mit den Spalten aus dem Daten-Skill', () => {
    expect(columnsOf('settings')).toEqual(['key', 'value']);
  });

  it('legt die Indizes aus dem Daten-Skill an', () => {
    const statements = migrationStatements().map(normalize);

    expect(statements).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_public_key ON contacts(public_key);');
    expect(statements).toContain(
      'CREATE INDEX IF NOT EXISTS idx_messages_contact_sent ON messages(contact_id, sent_at);',
    );
    expect(statements).toContain(
      'CREATE INDEX IF NOT EXISTS idx_messages_ctr ON messages(contact_id, direction, ctr);',
    );
    expect(statements).toContain('CREATE INDEX IF NOT EXISTS idx_messages_msg_ref ON messages(msg_ref);');
    expect(statements).toContain(
      'CREATE INDEX IF NOT EXISTS idx_coordinates_message ON coordinates(message_id, recorded_at);',
    );
  });

  it('löscht Nachrichten und Koordinaten per ON DELETE CASCADE', () => {
    expect(ddlOf('messages')).toContain(
      'contact_id INTEGER NOT NULL REFERENCES contacts(contact_id) ON DELETE CASCADE',
    );
    expect(ddlOf('coordinates')).toContain(
      'contact_id INTEGER NOT NULL REFERENCES contacts(contact_id) ON DELETE CASCADE',
    );
    expect(ddlOf('coordinates')).toContain('message_id TEXT REFERENCES messages(id) ON DELETE CASCADE');
  });

  it('hält die Wertebereiche der Spalten ein', () => {
    expect(ddlOf('messages')).toContain("CHECK (direction IN ('in','out'))");
    expect(ddlOf('messages')).toContain("CHECK (kind IN ('text','location'))");
    expect(ddlOf('messages')).toContain('CHECK (status BETWEEN 0 AND 3)');
    expect(ddlOf('coordinates')).toContain("CHECK (context IN ('einmal','live'))");
    expect(ddlOf('contacts')).toContain("CHECK (state IN ('pending','active'))");
    expect(ddlOf('contacts')).toContain('CHECK (contact_id BETWEEN 1 AND 32)');
    expect(ddlOf('contacts')).toContain('CHECK (length(name) BETWEEN 1 AND 24)');
    expect(ddlOf('contacts')).toContain('CHECK (length(node_id) = 4)');
    expect(ddlOf('contacts')).toContain('CHECK (length(public_key) = 44)');
    expect(ddlOf('messages')).toContain('CHECK (ctr IS NULL OR ctr BETWEEN 0 AND 16777215)');
  });

  it('bindet alle Werte als Parameter und verkettet keine Werte in SQL', () => {
    const statements = [
      ...migrationStatements(),
      CONTACT_INSERT,
      CONTACT_UPSERT,
      CONTACT_UPDATE_NAME,
      CONTACT_UPDATE_LINK,
      CONTACT_UPDATE_STATE,
      CONTACT_DELETE,
      MESSAGE_INSERT,
      MESSAGE_UPDATE_STATUS,
      MESSAGE_ASSIGN_REF,
      MESSAGE_REQUEUE,
      MESSAGE_FAIL_PENDING,
      MESSAGE_LAST_PER_CONTACT,
      MESSAGE_MARK_READ,
      COORDINATE_INSERT,
      SETTING_UPSERT,
    ];

    for (const statement of statements) {
      for (const literal of literalsOf(statement)) {
        expect(ALLOWED_LITERALS.has(literal), `Unerlaubter Wert „${literal}" in: ${normalize(statement)}`).toBe(true);
      }
    }
  });

  it('aktualisiert Kontakte per ON CONFLICT und nicht per REPLACE (REPLACE würde den Verlauf kaskadiert löschen)', () => {
    expect(normalize(CONTACT_UPSERT)).toContain('ON CONFLICT(contact_id) DO UPDATE SET');
    expect(CONTACT_UPSERT).not.toMatch(/REPLACE/i);
  });

  it('qualifiziert in der Abfrage der letzten Nachricht alle Spalten (kein „ambiguous column name“)', () => {
    expect(MESSAGE_LAST_PER_CONTACT).toContain('messages.contact_id');
    expect(MESSAGE_LAST_PER_CONTACT).not.toMatch(/SELECT id, contact_id/);
  });

  it('bindet bei jedem INSERT so viele Werte wie die Tabelle Spalten hat', () => {
    expect(placeholdersOf(CONTACT_INSERT)).toBe(columnCount(CONTACT_COLUMNS));
    expect(placeholdersOf(MESSAGE_INSERT)).toBe(columnCount(MESSAGE_COLUMNS));
    expect(placeholdersOf(COORDINATE_INSERT)).toBe(columnCount(COORDINATE_COLUMNS));
    expect(placeholdersOf(CONTACT_UPSERT)).toBe(columnCount(CONTACT_COLUMNS));
  });
});
