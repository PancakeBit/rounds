import type { SQLiteDatabase } from 'expo-sqlite';
import { nightBalances, type Transfer } from '../core/balances';
import type { Category } from '../core/categories';
import { settle } from '../core/settle';
import { splitExpense, type ShareInput } from '../core/split';
import type { StatExpense } from '../core/stats';

export interface Person { id: number; name: string; emoji: string; color: string; archived: boolean }
export interface NightMember extends Person { photoStart: string | null; photoEnd: string | null }
export interface Night {
  id: number; title: string; startedAt: number; endedAt: number | null;
  groupPhotoStart: string | null; groupPhoto: string | null; // group shots at the start and the end
}
export interface Expense extends StatExpense { id: number; nightId: number; note: string }
export interface Settlement extends Transfer { id: number; paidAt: number | null }
export interface ExpenseInput {
  id?: number;
  nightId: number;
  payerId: number;
  amount: number;
  category: Category;
  note: string;
  isTreat: boolean;
  shares: ShareInput[];
  createdAt?: number;
}

type PersonRow = { id: number; name: string; emoji: string; color: string; archived: number };
type NightRow = { id: number; title: string; started_at: number; ended_at: number | null; group_photo: string | null; group_photo_start: string | null };
type MemberRow = PersonRow & { photo_start: string | null; photo_end: string | null };
type ExpenseRow = {
  id: number; night_id: number; payer_id: number; amount_minor: number;
  category: string; note: string; is_treat: number; created_at: number;
};
type ShareRow = { expense_id: number; person_id: number; weight: number; extra_minor: number | null };
type SettlementRow = { id: number; from_id: number; to_id: number; amount_minor: number; paid_at: number | null };

const toPerson = (r: PersonRow): Person => ({ ...r, archived: r.archived === 1 });
const toNight = (r: NightRow): Night => ({
  id: r.id, title: r.title, startedAt: r.started_at, endedAt: r.ended_at, groupPhotoStart: r.group_photo_start, groupPhoto: r.group_photo,
});

// People

export async function listCrew(db: SQLiteDatabase, includeArchived = false): Promise<Person[]> {
  const where = includeArchived ? '' : 'WHERE archived = 0';
  const rows = await db.getAllAsync<PersonRow>(`SELECT * FROM people ${where} ORDER BY archived, name COLLATE NOCASE`);
  return rows.map(toPerson);
}

export async function addPerson(db: SQLiteDatabase, p: { name: string; emoji: string; color: string }): Promise<number> {
  const name = p.name.trim();
  if (!name) throw new Error('Give them a name first');
  const r = await db.runAsync('INSERT INTO people (name, emoji, color) VALUES (?, ?, ?)', name, p.emoji, p.color);
  return r.lastInsertRowId;
}

export async function updatePerson(db: SQLiteDatabase, id: number, p: { name: string; emoji: string; color: string }): Promise<void> {
  const name = p.name.trim();
  if (!name) throw new Error('Give them a name first');
  await db.runAsync('UPDATE people SET name = ?, emoji = ?, color = ? WHERE id = ?', name, p.emoji, p.color, id);
}

export async function setArchived(db: SQLiteDatabase, id: number, archived: boolean): Promise<void> {
  await db.runAsync('UPDATE people SET archived = ? WHERE id = ?', archived ? 1 : 0, id);
}

// Nights

export interface OpenNight extends Night { unpaid: number }

// Nights stay open until someone closes them, so several can be open at once (payments can take days).
// `unpaid` is what is still to move between people, net of transfers already ticked off.
export async function listOpenNights(db: SQLiteDatabase): Promise<OpenNight[]> {
  const rows = await db.getAllAsync<NightRow>('SELECT * FROM nights WHERE ended_at IS NULL ORDER BY started_at DESC');
  const out: OpenNight[] = [];
  for (const r of rows) {
    const data = await getNight(db, r.id);
    const expenses = await listExpenses(db, r.id);
    const paid = (await listSettlements(db, r.id)).filter(s => s.paidAt != null);
    const net = nightBalances(data?.members.map(m => m.id) ?? [], expenses, paid);
    let unpaid = 0;
    for (const v of net.values()) if (v > 0) unpaid += v;
    out.push({ ...toNight(r), unpaid });
  }
  return out;
}

export async function listPastNights(db: SQLiteDatabase): Promise<Night[]> {
  const rows = await db.getAllAsync<NightRow>('SELECT * FROM nights WHERE ended_at IS NOT NULL ORDER BY started_at DESC');
  return rows.map(toNight);
}

export async function startNight(db: SQLiteDatabase, title: string, memberIds: number[]): Promise<number> {
  if (memberIds.length < 2) throw new Error('A night needs at least two people');
  let id = 0;
  await db.withTransactionAsync(async () => {
    const r = await db.runAsync('INSERT INTO nights (title, started_at) VALUES (?, ?)', title.trim() || 'Night out', Date.now());
    id = r.lastInsertRowId;
    for (const pid of memberIds) await db.runAsync('INSERT INTO night_members (night_id, person_id) VALUES (?, ?)', id, pid);
  });
  return id;
}

// A late arrival joins a night that is already running. Earlier payments keep their stored shares.
export async function addNightMember(db: SQLiteDatabase, nightId: number, personId: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    await assertOpen(db, nightId);
    const exists = await db.getFirstAsync<{ one: number }>(
      'SELECT 1 AS one FROM night_members WHERE night_id = ? AND person_id = ?', nightId, personId,
    );
    if (exists) throw new Error("They're already in tonight");
    await db.runAsync('INSERT INTO night_members (night_id, person_id) VALUES (?, ?)', nightId, personId);
  });
}

// Members are returned whether or not they are archived: old nights must still show retired friends.
export async function getNight(db: SQLiteDatabase, id: number): Promise<{ night: Night; members: NightMember[] } | null> {
  const r = await db.getFirstAsync<NightRow>('SELECT * FROM nights WHERE id = ?', id);
  if (!r) return null;
  const members = await db.getAllAsync<MemberRow>(
    'SELECT p.*, nm.photo_start, nm.photo_end FROM people p JOIN night_members nm ON nm.person_id = p.id WHERE nm.night_id = ? ORDER BY p.name COLLATE NOCASE',
    id,
  );
  return {
    night: toNight(r),
    members: members.map(m => ({ ...toPerson(m), photoStart: m.photo_start, photoEnd: m.photo_end })),
  };
}

// Photos are not money, so these do not check whether the night is closed.
export async function setMemberPhoto(
  db: SQLiteDatabase, nightId: number, personId: number, phase: 'start' | 'end', uri: string | null,
): Promise<void> {
  const column = phase === 'start' ? 'photo_start' : 'photo_end';
  await db.runAsync(`UPDATE night_members SET ${column} = ? WHERE night_id = ? AND person_id = ?`, uri, nightId, personId);
}

export async function setGroupPhoto(db: SQLiteDatabase, nightId: number, phase: 'start' | 'end', uri: string | null): Promise<void> {
  const column = phase === 'start' ? 'group_photo_start' : 'group_photo';
  await db.runAsync(`UPDATE nights SET ${column} = ? WHERE id = ?`, uri, nightId);
}

export async function endNight(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('UPDATE nights SET ended_at = ? WHERE id = ? AND ended_at IS NULL', Date.now(), id);
}

// Expenses

export async function listExpenses(db: SQLiteDatabase, nightId: number): Promise<Expense[]> {
  const rows = await db.getAllAsync<ExpenseRow>('SELECT * FROM expenses WHERE night_id = ? ORDER BY created_at, id', nightId);
  const shareRows = await db.getAllAsync<ShareRow>(
    'SELECT s.expense_id, s.person_id, s.weight, s.extra_minor FROM expense_shares s JOIN expenses e ON e.id = s.expense_id WHERE e.night_id = ? ORDER BY s.expense_id, s.position',
    nightId,
  );
  const shares = new Map<number, ShareInput[]>();
  for (const s of shareRows) {
    const list = shares.get(s.expense_id) ?? [];
    list.push({ personId: s.person_id, weight: s.weight, extra: s.extra_minor });
    shares.set(s.expense_id, list);
  }
  return rows.map(r => ({
    id: r.id,
    nightId: r.night_id,
    payerId: r.payer_id,
    amount: r.amount_minor,
    category: r.category as Category,
    note: r.note,
    isTreat: r.is_treat === 1,
    createdAt: r.created_at,
    shares: shares.get(r.id) ?? [],
  }));
}

async function assertOpen(db: SQLiteDatabase, nightId: number) {
  const n = await db.getFirstAsync<{ ended_at: number | null }>('SELECT ended_at FROM nights WHERE id = ?', nightId);
  if (!n) throw new Error('That night no longer exists');
  if (n.ended_at != null) throw new Error('This night is closed');
}

export async function saveExpense(db: SQLiteDatabase, input: ExpenseInput): Promise<number> {
  const check = splitExpense(input.amount, input.shares);
  if (!check.ok) throw new Error(check.error);
  if (input.id != null) {
    const existing = await db.getFirstAsync<{ night_id: number }>('SELECT night_id FROM expenses WHERE id = ?', input.id);
    if (!existing) throw new Error('That one is already gone');
    if (existing.night_id !== input.nightId) throw new Error('That belongs to a different night');
    await assertOpen(db, existing.night_id);
  } else {
    await assertOpen(db, input.nightId);
  }
  let id = input.id ?? 0;
  await db.withTransactionAsync(async () => {
    if (input.id != null) {
      await db.runAsync(
        'UPDATE expenses SET payer_id = ?, amount_minor = ?, category = ?, note = ?, is_treat = ? WHERE id = ?',
        input.payerId, input.amount, input.category, input.note, input.isTreat ? 1 : 0, input.id,
      );
      await db.runAsync('DELETE FROM expense_shares WHERE expense_id = ?', input.id);
    } else {
      const r = await db.runAsync(
        'INSERT INTO expenses (night_id, payer_id, amount_minor, category, note, is_treat, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        input.nightId, input.payerId, input.amount, input.category, input.note, input.isTreat ? 1 : 0, input.createdAt ?? Date.now(),
      );
      id = r.lastInsertRowId;
    }
    for (const [position, s] of input.shares.entries()) {
      await db.runAsync(
        'INSERT INTO expense_shares (expense_id, person_id, weight, extra_minor, position) VALUES (?, ?, ?, ?, ?)',
        id, s.personId, s.weight, s.extra || null, position,
      );
    }
  });
  return id;
}

export async function deleteExpense(db: SQLiteDatabase, id: number): Promise<ExpenseInput> {
  const row = await db.getFirstAsync<{ night_id: number }>('SELECT night_id FROM expenses WHERE id = ?', id);
  if (!row) throw new Error('That one is already gone');
  await assertOpen(db, row.night_id);
  const e = (await listExpenses(db, row.night_id)).find(x => x.id === id)!;
  await db.runAsync('DELETE FROM expenses WHERE id = ?', id);
  const { id: _drop, ...snapshot } = e;
  return snapshot;
}

// Settlements

export async function listSettlements(db: SQLiteDatabase, nightId: number): Promise<Settlement[]> {
  const rows = await db.getAllAsync<SettlementRow>('SELECT * FROM settlements WHERE night_id = ? ORDER BY id', nightId);
  return rows.map(r => ({ id: r.id, fromId: r.from_id, toId: r.to_id, amount: r.amount_minor, paidAt: r.paid_at }));
}

// Keeps paid rows, recomputes the unpaid ones from what is still owed.
export async function generateSettlements(db: SQLiteDatabase, nightId: number): Promise<void> {
  const data = await getNight(db, nightId);
  if (!data) throw new Error('That night no longer exists');
  const expenses = await listExpenses(db, nightId);
  const paid = (await listSettlements(db, nightId)).filter(s => s.paidAt != null);
  const transfers = settle(nightBalances(data.members.map(m => m.id), expenses, paid));
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM settlements WHERE night_id = ? AND paid_at IS NULL', nightId);
    for (const t of transfers) {
      await db.runAsync(
        'INSERT INTO settlements (night_id, from_id, to_id, amount_minor) VALUES (?, ?, ?, ?)',
        nightId, t.fromId, t.toId, t.amount,
      );
    }
  });
}

export async function setSettlementPaid(db: SQLiteDatabase, id: number, paid: boolean): Promise<void> {
  const row = await db.getFirstAsync<{ night_id: number }>('SELECT night_id FROM settlements WHERE id = ?', id);
  if (!row) throw new Error('That payment changed. Open Settle up again.');
  await assertOpen(db, row.night_id);
  await db.runAsync('UPDATE settlements SET paid_at = ? WHERE id = ?', paid ? Date.now() : null, id);
}

// Settings

export async function getSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const r = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return r?.value ?? null;
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}

export async function hasAnyExpenses(db: SQLiteDatabase): Promise<boolean> {
  const r = await db.getFirstAsync<{ has: number }>('SELECT EXISTS(SELECT 1 FROM expenses) AS has');
  return r?.has === 1;
}
