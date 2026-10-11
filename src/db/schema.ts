import type { SQLiteDatabase } from 'expo-sqlite';

const LATEST = 1;

export async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if (!row) throw new Error('Could not read the database schema version');
  if (row.user_version > LATEST) throw new Error('Database schema is newer than this app supports');
  if (row.user_version === LATEST) return;

  await db.withTransactionAsync(async () => {
    if (row.user_version < 1) {
      await db.execAsync(`
        CREATE TABLE people (
          id INTEGER PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          emoji TEXT NOT NULL,
          color TEXT NOT NULL,
          archived INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE nights (
          id INTEGER PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          started_at INTEGER NOT NULL,
          ended_at INTEGER,
          group_photo TEXT
        );
        CREATE TABLE night_members (
          night_id INTEGER NOT NULL REFERENCES nights(id) ON DELETE CASCADE,
          person_id INTEGER NOT NULL REFERENCES people(id),
          photo_start TEXT,
          photo_end TEXT,
          PRIMARY KEY (night_id, person_id)
        );
        CREATE TABLE expenses (
          id INTEGER PRIMARY KEY NOT NULL,
          night_id INTEGER NOT NULL REFERENCES nights(id) ON DELETE CASCADE,
          payer_id INTEGER NOT NULL REFERENCES people(id),
          amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
          category TEXT NOT NULL,
          note TEXT NOT NULL DEFAULT '',
          is_treat INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        );
        CREATE TABLE expense_shares (
          expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
          person_id INTEGER NOT NULL REFERENCES people(id),
          weight INTEGER NOT NULL CHECK (weight >= 0),
          fixed_minor INTEGER,
          position INTEGER NOT NULL,
          PRIMARY KEY (expense_id, person_id)
        );
        CREATE TABLE settlements (
          id INTEGER PRIMARY KEY NOT NULL,
          night_id INTEGER NOT NULL REFERENCES nights(id) ON DELETE CASCADE,
          from_id INTEGER NOT NULL REFERENCES people(id),
          to_id INTEGER NOT NULL REFERENCES people(id),
          amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
          paid_at INTEGER
        );
        CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      `);
    }
    await db.execAsync(`PRAGMA user_version = ${LATEST}`);
  });
}
