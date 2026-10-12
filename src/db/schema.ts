import type { SQLiteDatabase } from 'expo-sqlite';

const LATEST = 6;

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
        CREATE UNIQUE INDEX one_active_night ON nights (ifnull(ended_at, 0)) WHERE ended_at IS NULL;
      `);
    }
    if (row.user_version < 2) {
      // v2: no currency (plain two-decimal numbers), several nights open at once, and an exact
      // amount became an extra on top of a share. An old exact amount is an extra with no share.
      const cur = await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'currency'");
      const digits = cur ? currencyDigits(cur.value) : 2;
      if (digits === 0) {
        await db.execAsync(`
          UPDATE expenses SET amount_minor = amount_minor * 100;
          UPDATE expense_shares SET fixed_minor = fixed_minor * 100 WHERE fixed_minor IS NOT NULL;
          UPDATE settlements SET amount_minor = amount_minor * 100;
        `);
      } else if (digits === 3) {
        // Thousandths to hundredths. Rounds to the nearest hundredth; never below 1 (the CHECKs forbid 0).
        await db.execAsync(`
          UPDATE expenses SET amount_minor = MAX(1, CAST(ROUND(amount_minor / 10.0) AS INTEGER));
          UPDATE expense_shares SET fixed_minor = CAST(ROUND(fixed_minor / 10.0) AS INTEGER) WHERE fixed_minor IS NOT NULL;
          UPDATE settlements SET amount_minor = MAX(1, CAST(ROUND(amount_minor / 10.0) AS INTEGER));
        `);
      }
      await db.execAsync(`
        DELETE FROM settings WHERE key = 'currency';
        DROP INDEX IF EXISTS one_active_night;
        ALTER TABLE expense_shares RENAME COLUMN fixed_minor TO extra_minor;
        UPDATE expense_shares SET weight = 0 WHERE extra_minor IS NOT NULL;
      `);
    }
    if (row.user_version < 3) {
      // v3: a group shot can open the night too. The old group_photo is the end-of-night one.
      await db.execAsync('ALTER TABLE nights ADD COLUMN group_photo_start TEXT;');
    }
    if (row.user_version < 4) {
      // v4: a payment can be broken into items that people claim. Shares still hold the result,
      // so balances never read these tables; they are kept so the list can be opened and changed.
      await db.execAsync(`
        ALTER TABLE expenses ADD COLUMN service_minor INTEGER NOT NULL DEFAULT 0;
        CREATE TABLE expense_items (
          id INTEGER PRIMARY KEY NOT NULL,
          expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
          position INTEGER NOT NULL,
          name TEXT NOT NULL DEFAULT '',
          price_minor INTEGER NOT NULL CHECK (price_minor > 0)
        );
        CREATE TABLE item_claims (
          item_id INTEGER NOT NULL REFERENCES expense_items(id) ON DELETE CASCADE,
          person_id INTEGER NOT NULL REFERENCES people(id),
          count INTEGER NOT NULL CHECK (count > 0),
          position INTEGER NOT NULL,
          PRIMARY KEY (item_id, person_id)
        );
        CREATE INDEX expense_items_by_expense ON expense_items (expense_id, position);
      `);
    }
    if (row.user_version < 5) {
      // v5: each person's ways to get paid (a name, a number, an optional QR picture), and a receipt photo per payment.
      // The crew's light blue moved off a stock cyan to a chalk periwinkle; friends who had it follow.
      await db.execAsync(`
        CREATE TABLE pay_methods (
          id INTEGER PRIMARY KEY NOT NULL,
          person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
          position INTEGER NOT NULL,
          label TEXT NOT NULL,
          number TEXT NOT NULL DEFAULT '',
          qr_uri TEXT
        );
        CREATE INDEX pay_methods_by_person ON pay_methods (person_id, position);
        ALTER TABLE expenses ADD COLUMN receipt_uri TEXT;
        UPDATE people SET color = '#9CB8EB' WHERE color = '#8CC3E8';
      `);
    }
    if (row.user_version < 6) {
      // v6: a profile picture per person, shown in place of their emoji wherever they appear.
      await db.execAsync('ALTER TABLE people ADD COLUMN photo_uri TEXT;');
    }
    await db.execAsync(`PRAGMA user_version = ${LATEST}`);
  });
}

// v1 stored amounts in the currency's own minor unit: none for yen-style, thousandths for dinar-style.
function currencyDigits(code: string): number {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}
