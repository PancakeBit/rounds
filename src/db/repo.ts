import type { SQLiteDatabase } from 'expo-sqlite';
import { nightBalances, type Transfer } from '../core/balances';
import { joinCategories, parseCategories, type Category } from '../core/categories';
import { formatMoney } from '../core/money';
import { settle, stillSettles } from '../core/settle';
import { itemShares, type ItemInput } from '../core/items';
import { splitExpense, type ShareInput } from '../core/split';
import type { StatExpense } from '../core/stats';

export interface Person { id: number; name: string; emoji: string; color: string; archived: boolean }
export interface NightMember extends Person { photoStart: string | null; photoEnd: string | null }
export interface Night {
  id: number; title: string; startedAt: number; endedAt: number | null;
  groupPhotoStart: string | null; groupPhoto: string | null; // group shots at the start and the end
}
// `items` is empty for a plain split. With items, `shares` holds each person's item total (see core/items).
export interface Expense extends StatExpense {
  id: number; nightId: number; note: string; items: ItemInput[]; service: number;
  receiptUri: string | null; // a photo of the paper receipt, kept on the phone
}
// One way to pay someone: a name the person chose ("GCash", "BPI"), a number, and an optional QR picture.
export interface PayMethod { label: string; number: string; qrUri: string | null }
export interface Settlement extends Transfer { id: number; paidAt: number | null }
export interface ExpenseInput {
  id?: number;
  nightId: number;
  payerId: number;
  amount: number;
  categories: Category[];
  note: string;
  isTreat: boolean;
  shares: ShareInput[];
  createdAt?: number;
  items?: ItemInput[]; // when present, amount and shares are worked out from them on save
  service?: number;
  receiptUri?: string | null;
}

type PersonRow = { id: number; name: string; emoji: string; color: string; archived: number };
type NightRow = { id: number; title: string; started_at: number; ended_at: number | null; group_photo: string | null; group_photo_start: string | null };
type MemberRow = PersonRow & { photo_start: string | null; photo_end: string | null };
type ExpenseRow = {
  id: number; night_id: number; payer_id: number; amount_minor: number;
  category: string; note: string; is_treat: number; created_at: number; service_minor: number; receipt_uri: string | null;
};
type ItemRow = { id: number; expense_id: number; name: string; price_minor: number };
type ClaimRow = { item_id: number; person_id: number; count: number };
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

export async function listPayMethods(db: SQLiteDatabase, personIds: number[]): Promise<Map<number, PayMethod[]>> {
  const out = new Map<number, PayMethod[]>(personIds.map(id => [id, []]));
  if (personIds.length === 0) return out;
  const rows = await db.getAllAsync<{ person_id: number; label: string; number: string; qr_uri: string | null }>(
    `SELECT person_id, label, number, qr_uri FROM pay_methods WHERE person_id IN (${personIds.map(() => '?').join(',')}) ORDER BY person_id, position`,
    ...personIds,
  );
  for (const r of rows) out.get(r.person_id)?.push({ label: r.label, number: r.number, qrUri: r.qr_uri });
  return out;
}

// Replaces the person's list. Returns the QR pictures no longer used, for the caller to delete.
export async function savePayMethods(db: SQLiteDatabase, personId: number, methods: PayMethod[]): Promise<string[]> {
  const clean = methods
    .map(m => ({ label: m.label.trim(), number: m.number.trim(), qrUri: m.qrUri }))
    .filter(m => m.label || m.number || m.qrUri);
  if (clean.some(m => !m.label)) throw new Error('Give each way to pay a name, like GCash');
  const before = (await listPayMethods(db, [personId])).get(personId) ?? [];
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM pay_methods WHERE person_id = ?', personId);
    for (const [position, m] of clean.entries()) {
      await db.runAsync(
        'INSERT INTO pay_methods (person_id, position, label, number, qr_uri) VALUES (?, ?, ?, ?, ?)',
        personId, position, m.label, m.number, m.qrUri,
      );
    }
  });
  const kept = new Set(clean.map(m => m.qrUri).filter(Boolean));
  return before.map(m => m.qrUri).filter((u): u is string => !!u && !kept.has(u));
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

// The name is only a label, so it can change any time, closed nights included.
export async function renameNight(db: SQLiteDatabase, nightId: number, title: string): Promise<void> {
  const t = title.trim();
  if (!t) throw new Error('Give it a name');
  const r = await db.runAsync('UPDATE nights SET title = ? WHERE id = ?', t.slice(0, 40), nightId);
  if (r.changes === 0) throw new Error('That one is already gone');
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

// Mistakes happen after closing: a closed night can be opened again. Its paid ticks stay.
export async function reopenNight(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('UPDATE nights SET ended_at = NULL WHERE id = ?', id);
}

// Deletes the night and everything in it (payments, items, settle-up). Photo files are the caller's to remove.
// Returns every photo the night referred to.
export async function deleteNight(db: SQLiteDatabase, id: number): Promise<string[]> {
  const n = await db.getFirstAsync<NightRow>('SELECT * FROM nights WHERE id = ?', id);
  if (!n) throw new Error('That night no longer exists');
  const faces = await db.getAllAsync<{ photo_start: string | null; photo_end: string | null }>(
    'SELECT photo_start, photo_end FROM night_members WHERE night_id = ?', id,
  );
  const receipts = await db.getAllAsync<{ receipt_uri: string | null }>('SELECT receipt_uri FROM expenses WHERE night_id = ?', id);
  await db.runAsync('DELETE FROM nights WHERE id = ?', id);
  return [n.group_photo, n.group_photo_start, ...faces.flatMap(f => [f.photo_start, f.photo_end]), ...receipts.map(r => r.receipt_uri)]
    .filter((u): u is string => !!u);
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
  const itemRows = await db.getAllAsync<ItemRow>(
    'SELECT i.id, i.expense_id, i.name, i.price_minor FROM expense_items i JOIN expenses e ON e.id = i.expense_id WHERE e.night_id = ? ORDER BY i.expense_id, i.position',
    nightId,
  );
  const claimRows = await db.getAllAsync<ClaimRow>(
    'SELECT c.item_id, c.person_id, c.count FROM item_claims c JOIN expense_items i ON i.id = c.item_id JOIN expenses e ON e.id = i.expense_id WHERE e.night_id = ? ORDER BY c.item_id, c.position',
    nightId,
  );
  const claims = new Map<number, ItemInput['claims']>();
  for (const c of claimRows) {
    const list = claims.get(c.item_id) ?? [];
    list.push({ personId: c.person_id, count: c.count });
    claims.set(c.item_id, list);
  }
  const items = new Map<number, ItemInput[]>();
  for (const i of itemRows) {
    const list = items.get(i.expense_id) ?? [];
    list.push({ name: i.name, price: i.price_minor, claims: claims.get(i.id) ?? [] });
    items.set(i.expense_id, list);
  }
  return rows.map(r => ({
    id: r.id,
    nightId: r.night_id,
    payerId: r.payer_id,
    amount: r.amount_minor,
    categories: parseCategories(r.category),
    note: r.note,
    isTreat: r.is_treat === 1,
    createdAt: r.created_at,
    shares: shares.get(r.id) ?? [],
    items: items.get(r.id) ?? [],
    service: r.service_minor,
    receiptUri: r.receipt_uri,
  }));
}

async function assertOpen(db: SQLiteDatabase, nightId: number) {
  const n = await db.getFirstAsync<{ ended_at: number | null }>('SELECT ended_at FROM nights WHERE id = ?', nightId);
  if (!n) throw new Error('That night no longer exists');
  if (n.ended_at != null) throw new Error('This night is closed');
}

export async function saveExpense(db: SQLiteDatabase, raw: ExpenseInput): Promise<number> {
  const items = raw.items ?? [];
  const service = items.length ? raw.service ?? 0 : 0;
  let input = raw;
  if (items.length) {
    // Worked out here from the night's members, so what is stored always matches the items.
    const data = await getNight(db, raw.nightId);
    if (!data) throw new Error('That night no longer exists');
    const derived = itemShares(items, service, data.members.map(m => m.id), raw.payerId, raw.isTreat);
    if (!derived.ok) throw new Error(derived.error);
    input = { ...raw, amount: derived.amount, shares: derived.shares };
  }
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
        'UPDATE expenses SET payer_id = ?, amount_minor = ?, category = ?, note = ?, is_treat = ?, service_minor = ?, receipt_uri = ? WHERE id = ?',
        input.payerId, input.amount, joinCategories(input.categories), input.note, input.isTreat ? 1 : 0, service, input.receiptUri ?? null, input.id,
      );
      await db.runAsync('DELETE FROM expense_shares WHERE expense_id = ?', input.id);
      await db.runAsync('DELETE FROM expense_items WHERE expense_id = ?', input.id);
    } else {
      const r = await db.runAsync(
        'INSERT INTO expenses (night_id, payer_id, amount_minor, category, note, is_treat, created_at, service_minor, receipt_uri) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        input.nightId, input.payerId, input.amount, joinCategories(input.categories), input.note, input.isTreat ? 1 : 0, input.createdAt ?? Date.now(), service, input.receiptUri ?? null,
      );
      id = r.lastInsertRowId;
    }
    for (const [position, s] of input.shares.entries()) {
      await db.runAsync(
        'INSERT INTO expense_shares (expense_id, person_id, weight, extra_minor, position) VALUES (?, ?, ?, ?, ?)',
        id, s.personId, s.weight, s.extra || null, position,
      );
    }
    for (const [position, it] of items.entries()) {
      const r = await db.runAsync(
        'INSERT INTO expense_items (expense_id, position, name, price_minor) VALUES (?, ?, ?, ?)',
        id, position, it.name.trim(), it.price,
      );
      for (const [cpos, c] of it.claims.filter(c => c.count > 0).entries()) {
        await db.runAsync(
          'INSERT INTO item_claims (item_id, person_id, count, position) VALUES (?, ?, ?, ?)',
          r.lastInsertRowId, c.personId, c.count, cpos,
        );
      }
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

// Moves a payment to another open night. Anyone in it who isn't in that night joins it (like a late arrival).
// Returns who was added.
export async function moveExpense(db: SQLiteDatabase, expenseId: number, toNightId: number): Promise<number[]> {
  const row = await db.getFirstAsync<{ night_id: number }>('SELECT night_id FROM expenses WHERE id = ?', expenseId);
  if (!row) throw new Error('That one is already gone');
  if (row.night_id === toNightId) return [];
  await assertOpen(db, row.night_id);
  await assertOpen(db, toNightId);
  const e = (await listExpenses(db, row.night_id)).find(x => x.id === expenseId)!;
  const involved = new Set([e.payerId, ...e.shares.map(s => s.personId), ...e.items.flatMap(i => i.claims.map(c => c.personId))]);
  const there = new Set((await db.getAllAsync<{ person_id: number }>('SELECT person_id FROM night_members WHERE night_id = ?', toNightId)).map(r => r.person_id));
  const added = [...involved].filter(p => !there.has(p));
  await db.withTransactionAsync(async () => {
    for (const p of added) await db.runAsync('INSERT INTO night_members (night_id, person_id) VALUES (?, ?)', toNightId, p);
    await db.runAsync('UPDATE expenses SET night_id = ? WHERE id = ?', toNightId, expenseId);
    // Both nights' plans are now out of date; Settle up works them out again when opened.
    await db.runAsync('DELETE FROM settlements WHERE night_id IN (?, ?) AND paid_at IS NULL', row.night_id, toNightId);
  });
  return added;
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
  const all = await listSettlements(db, nightId);
  const paid = all.filter(s => s.paidAt != null);
  const net = nightBalances(data.members.map(m => m.id), expenses, paid);
  // The plan people are already looking at stays put while it still squares everyone up.
  if (stillSettles(net, all.filter(s => s.paidAt == null))) return;
  const transfers = settle(net);
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

// Someone paid part of what they owe. The part is kept as its own paid payment and the row shrinks by it,
// so the rest stays with the same person and nobody else's row changes.
export async function payPart(db: SQLiteDatabase, settlementId: number, amount: number): Promise<void> {
  const row = await db.getFirstAsync<{ night_id: number; from_id: number; to_id: number; amount_minor: number; paid_at: number | null }>(
    'SELECT night_id, from_id, to_id, amount_minor, paid_at FROM settlements WHERE id = ?', settlementId,
  );
  if (!row || row.paid_at != null) throw new Error('That payment changed. Open Settle up again.');
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Enter how much they paid');
  if (amount > row.amount_minor) throw new Error(`That's more than the ${formatMoney(row.amount_minor)} they owe`);
  await assertOpen(db, row.night_id);
  if (amount === row.amount_minor) {
    await db.runAsync('UPDATE settlements SET paid_at = ? WHERE id = ?', Date.now(), settlementId);
    return;
  }
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'INSERT INTO settlements (night_id, from_id, to_id, amount_minor, paid_at) VALUES (?, ?, ?, ?, ?)',
      row.night_id, row.from_id, row.to_id, amount, Date.now(),
    );
    await db.runAsync('UPDATE settlements SET amount_minor = amount_minor - ? WHERE id = ?', amount, settlementId);
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
