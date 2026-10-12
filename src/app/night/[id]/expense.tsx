import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import type { Category } from '../../../core/categories';
import { formatMoney as money, minorToInput, parseMoney } from '../../../core/money';
import { itemShares, splitItems, type ItemInput } from '../../../core/items';
import { splitExpense, type ShareInput } from '../../../core/split';
import { getNight, listExpenses, saveExpense, type NightMember } from '../../../db/repo';
import { AmountPad } from '../../../ui/AmountPad';
import { Avatar } from '../../../ui/Avatar';
import { Button } from '../../../ui/Button';
import { CategoryChips } from '../../../ui/CategoryChips';
import { ExtraModal } from '../../../ui/ExtraModal';
import { ItemList, type ItemDraft } from '../../../ui/ItemList';
import { guarded } from '../../../ui/oops';
import { Pop, Tap } from '../../../ui/Tap';
import { theme } from '../../../ui/theme';

type ShareState = { weight: number; extra: number | null };

const allIn = (members: NightMember[]): Record<number, ShareState> =>
  Object.fromEntries(members.map(m => [m.id, { weight: 1, extra: null }]));

// A row with no name, no price and no claims is a spare: skipped, not an error.
const isBlank = (d: ItemDraft) => !d.name.trim() && !d.priceText.trim() && d.claims.length === 0;
const hasPrice = (d: ItemDraft) => (parseMoney(d.priceText) ?? 0) > 0;
const toItems = (drafts: ItemDraft[]): ItemInput[] =>
  drafts.filter(d => !isBlank(d)).map(d => ({ name: d.name.trim(), price: parseMoney(d.priceText) ?? 0, claims: d.claims }));

export default function ExpenseScreen() {
  const { id, expenseId } = useLocalSearchParams<{ id: string; expenseId?: string }>();
  const nightId = Number(id);
  const editingId = expenseId ? Number(expenseId) : undefined;
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();

  const [members, setMembers] = useState<NightMember[]>([]);
  const [amountText, setAmountText] = useState('');
  const [payerId, setPayerId] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>(['drinks']);
  const [note, setNote] = useState('');
  const [isTreat, setIsTreat] = useState(false);
  const [shares, setShares] = useState<Record<number, ShareState>>({});
  const [createdAt, setCreatedAt] = useState<number | undefined>();
  const [extraFor, setExtraFor] = useState<NightMember | null>(null);
  const [saving, setSaving] = useState(false);
  // null: one amount split by shares. A list: the payment broken into items people claim.
  const [items, setItems] = useState<ItemDraft[] | null>(null);
  const [serviceText, setServiceText] = useState('');
  const [focusKey, setFocusKey] = useState<number | null>(null);
  const nextKey = useRef(1);
  const busy = useRef(false);
  const draft = (name = '', priceText = '', claims: ItemDraft['claims'] = []): ItemDraft =>
    ({ key: nextKey.current++, name, priceText, claims });

  useEffect(() => {
    guarded("Couldn't load this", async () => {
      const data = await getNight(db, nightId);
      if (!data) return;
      setMembers(data.members);
      const all = await listExpenses(db, nightId);
      const existing = editingId != null ? all.find(e => e.id === editingId) : undefined;
      if (existing) {
        setAmountText(minorToInput(existing.amount));
        setPayerId(existing.payerId);
        setCategories(existing.categories);
        setNote(existing.note);
        setIsTreat(existing.isTreat);
        setCreatedAt(existing.createdAt);
        if (existing.items.length) {
          setItems([...existing.items.map(it => draft(it.name, minorToInput(it.price), it.claims)), draft()]);
          setServiceText(existing.service ? minorToInput(existing.service) : '');
        }
        if (existing.isTreat) {
          setShares(allIn(data.members));
        } else {
          const st: Record<number, ShareState> = Object.fromEntries(data.members.map(m => [m.id, { weight: 0, extra: null }]));
          for (const s of existing.shares) st[s.personId] = { weight: s.weight, extra: s.extra || null };
          setShares(st);
        }
      } else {
        setPayerId(all.at(-1)?.payerId ?? data.members[0]?.id ?? null);
        setShares(allIn(data.members));
      }
    });
  }, [db, nightId, editingId]);

  const itemList = items ? toItems(items) : [];
  // A row still being typed (no price yet) is left out of the preview so the totals don't blank out; it only blocks Save.
  const unpriced = items ? items.filter(d => !isBlank(d) && !hasPrice(d)) : [];
  const pricedDrafts = items ? items.filter(hasPrice) : [];
  const pricedList = toItems(pricedDrafts);
  const serviceParsed = serviceText.trim() ? parseMoney(serviceText) : 0;
  const service = serviceParsed ?? -1; // unreadable service text fails the split with its own message
  const memberIds = members.map(m => m.id);
  const itemPreview = items && pricedList.length ? splitItems(pricedList, service, memberIds) : null;
  const itemSave = items && payerId != null ? itemShares(itemList, service, memberIds, payerId, isTreat) : null;

  // Per row: what each person owes for it, for the line under each item and the breakdown per person.
  const parts = new Map<number, Map<number, number>>(
    itemPreview?.ok ? pricedDrafts.map((d, i) => [d.key, itemPreview.perItem[i]]) : [],
  );
  const scroller = useRef<ScrollView>(null);
  const listY = useRef(0);
  const reveal = useCallback((y: number) => scroller.current?.scrollTo({ y: Math.max(0, listY.current + y - 16), animated: true }), []);
  const focused = useCallback(() => setFocusKey(null), []);

  const amount = items ? (itemPreview?.ok ? itemPreview.total : null) : parseMoney(amountText);
  const shareList: ShareInput[] = isTreat && payerId != null
    ? [{ personId: payerId, weight: 1 }]
    : members
        .map(m => ({ personId: m.id, weight: shares[m.id]?.weight ?? 0, extra: shares[m.id]?.extra ?? null }))
        .filter(s => s.weight > 0 || (s.extra ?? 0) > 0);
  const preview = items ? itemPreview : amount ? splitExpense(amount, shareList) : null;
  const extraSum = shareList.reduce((t, s) => t + (s.extra ?? 0), 0);
  const sharers = shareList.filter(s => s.weight > 0);
  // The "For…" shortcut is lit when exactly one person is in, at one plain share.
  const soloFor = !isTreat && shareList.length === 1 && shareList[0].weight === 1 && !shareList[0].extra
    ? shareList[0].personId
    : null;
  const canSave = items
    ? itemSave?.ok === true && unpriced.length === 0
    : amount != null && amount > 0 && payerId != null && preview?.ok === true;

  // The amount becomes the first item. Anything only one person had becomes its own item, claimed by them.
  function breakIntoItems() {
    const typed = parseMoney(amountText) ?? 0;
    const st = members.map(m => ({ id: m.id, ...(shares[m.id] ?? { weight: 0, extra: null }) }));
    const extras = st.filter(s => (s.extra ?? 0) > 0);
    const rest = typed - extras.reduce((t, s) => t + (s.extra ?? 0), 0);
    const plainAll = st.every(s => s.weight === 1);
    const claims = isTreat || plainAll ? [] : st.filter(s => s.weight > 0).map(s => ({ personId: s.id, count: s.weight }));
    // Extras that cover the whole bill leave nothing for a first row.
    const first = rest > 0 || extras.length === 0 ? [draft(note.trim(), rest > 0 ? minorToInput(rest) : '', claims)] : [];
    const own = extras.map(s => draft(`${members.find(m => m.id === s.id)?.name ?? ''}'s extra`, minorToInput(s.extra!), [{ personId: s.id, count: 1 }]));
    setItems([...first, ...own, draft()]);
    setFocusKey(null); // no keyboard yet: let them see the list first
  }

  function addItem() {
    if (!items) return;
    const d = draft();
    setItems([...items, d]);
    setFocusKey(d.key);
  }

  // Removing a real item down to one real item makes it a plain split again: its price (plus any service)
  // is the amount, its claims the shares. Spare blank rows don't count, and removing one never switches back.
  function removeItem(key: number) {
    if (!items) return;
    const gone = items.find(d => d.key === key);
    const left = items.filter(d => d.key !== key);
    const real = left.filter(d => !isBlank(d));
    if (!gone || isBlank(gone) || real.length !== 1) {
      setItems(left.length ? left : [draft()]);
      return;
    }
    const only = real[0];
    const price = only ? parseMoney(only.priceText) ?? 0 : 0;
    const total = price + Math.max(0, serviceParsed ?? 0);
    setAmountText(total > 0 ? minorToInput(total) : '');
    if (only?.name.trim() && !note.trim()) setNote(only.name.trim());
    const claimed = only?.claims.filter(c => c.count > 0) ?? [];
    setShares(claimed.length
      ? Object.fromEntries(members.map(m => [m.id, { weight: Math.min(9, claimed.find(c => c.personId === m.id)?.count ?? 0), extra: null }]))
      : allIn(members));
    setItems(null);
    setServiceText('');
  }

  // One tap for the most common case: the payer bought something for one other person.
  function onlyFor(personId: number) {
    setShares(Object.fromEntries(members.map(m => [m.id, { weight: m.id === personId ? 1 : 0, extra: null }])));
  }

  // A "just for X" can't be paid by X: put everyone back in rather than leave X paying themselves.
  function changePayer(personId: number) {
    setPayerId(personId);
    if (soloFor === personId) setShares(allIn(members));
  }

  function step(personId: number, delta: number) {
    setShares(prev => {
      const cur = prev[personId] ?? { weight: 0, extra: null };
      return { ...prev, [personId]: { ...cur, weight: Math.max(0, Math.min(9, cur.weight + delta)) } };
    });
  }

  async function save() {
    if (busy.current || !canSave || amount == null || payerId == null) return;
    busy.current = true;
    setSaving(true);
    const ok = await guarded("Couldn't save that", async () => {
      if (items && itemSave?.ok) {
        await saveExpense(db, {
          id: editingId, nightId, payerId, amount: itemSave.amount, categories, note: note.trim(), isTreat,
          shares: itemSave.shares, createdAt, items: itemList, service: Math.max(0, service),
        });
      } else {
        await saveExpense(db, { id: editingId, nightId, payerId, amount, categories, note: note.trim(), isTreat, shares: shareList, createdAt });
      }
      return true;
    });
    if (!ok) {
      busy.current = false;
      setSaving(false);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: editingId != null ? 'Change this one' : 'Someone paid' }} />
      <ScrollView ref={scroller} contentContainerStyle={[styles.body, { paddingBottom: 48 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>{items ? 'Total' : 'How much?'}</Text>
        <Pop trigger={items ? amount : amountText}>
          <Text style={[styles.amount, !(items ? amount : amountText) && styles.placeholder]} numberOfLines={1} adjustsFontSizeToFit>
            {money(amount ?? 0)}
          </Text>
        </Pop>
        {items ? (
          <>
            <View onLayout={e => { listY.current = e.nativeEvent.layout.y; }}>
              <ItemList
                items={items}
                members={members}
                parts={parts}
                onChange={setItems}
                onAdd={addItem}
                onRemove={removeItem}
                focusKey={focusKey}
                onFocused={focused}
                onReveal={reveal}
              />
            </View>
            <View style={styles.serviceRow}>
              <Text style={styles.serviceLabel}>Service / tax / tip</Text>
              <TextInput
                value={serviceText}
                onChangeText={setServiceText}
                placeholder="0.00"
                placeholderTextColor={theme.color.inkDim}
                keyboardType="decimal-pad"
                style={styles.serviceInput}
                maxLength={12}
                accessibilityLabel="Service, tax or tip"
              />
            </View>
            <Text style={styles.hint}>Spread by what each person had.</Text>
          </>
        ) : (
          <>
            <AmountPad value={amountText} onChange={setAmountText} />
            <Button kind="ghost" label="Break it into items" onPress={breakIntoItems} />
          </>
        )}

        <Text style={styles.h2}>Who paid?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.payers}>
          {members.map(m => (
            <Tap
              key={m.id}
              onPress={() => changePayer(m.id)}
              accessibilityRole="radio"
              accessibilityLabel={`${m.name} paid`}
              accessibilityState={{ selected: payerId === m.id }}
              style={[styles.payer, payerId === m.id && styles.payerOn]}
            >
              <Avatar person={m} size={52} showName dimmed={payerId !== m.id} />
            </Tap>
          ))}
        </ScrollView>

        <Text style={styles.h2}>What for?</Text>
        <Text style={styles.hint}>Pick as many as fit</Text>
        <CategoryChips value={categories} onChange={setCategories} />
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Note (optional)"
          placeholderTextColor={theme.color.inkDim}
          style={styles.note}
          maxLength={40}
        />

        <Button
          kind={isTreat ? 'go' : 'ghost'}
          label={isTreat ? 'On me: yes' : 'On me (my treat)'}
          onPress={() => setIsTreat(t => !t)}
        />

        {isTreat ? (
          <Text style={styles.treat}>
            {members.find(m => m.id === payerId)?.name ?? 'The payer'} covers this one. Nobody owes anything for it.
          </Text>
        ) : items ? (
          <>
            <Text style={styles.h2}>Who owes what</Text>
            {members.map(m => {
              const owed = itemPreview?.ok ? itemPreview.owed.get(m.id) ?? 0 : null;
              // What their total is made of: their part of each item, then their part of the service.
              const lines = itemPreview?.ok
                ? [
                    ...pricedDrafts.flatMap((d, i) => {
                      const amt = itemPreview.perItem[i].get(m.id);
                      if (!amt) return [];
                      const c = d.claims.find(x => x.personId === m.id);
                      const how = d.claims.length === 0 ? ' (shared)' : c && c.count > 1 ? ` (×${c.count})` : '';
                      return [`${d.name.trim() || `Item ${i + 1}`}${how} ${money(amt)}`];
                    }),
                    ...(itemPreview.service.get(m.id) ? [`Service ${money(itemPreview.service.get(m.id)!)}`] : []),
                  ]
                : [];
              return (
                <View key={m.id} style={styles.owesBlock}>
                  <View style={styles.owesRow}>
                    <Avatar person={m} size={36} dimmed={!owed} />
                    <Text style={[styles.shareName, { color: owed ? m.color : theme.color.inkDim }]} numberOfLines={1}>{m.name}</Text>
                    <Text style={[styles.owed, !owed && styles.placeholder]} numberOfLines={1}>{owed != null ? money(owed) : '—'}</Text>
                  </View>
                  {lines.length > 0 && <Text style={styles.breakdown}>{lines.join('  ·  ')}</Text>}
                </View>
              );
            })}
          </>
        ) : (
          <>
            <Text style={styles.h2}>Just for one person?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.payers}>
              {members.filter(m => m.id !== payerId).map(m => (
                <Tap
                  key={m.id}
                  onPress={() => onlyFor(m.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Just for ${m.name}`}
                  accessibilityHint="Splits this with only them"
                  accessibilityState={{ selected: soloFor === m.id }}
                  style={[styles.forChip, soloFor === m.id && styles.forOn]}
                >
                  <Text style={[styles.forText, soloFor === m.id && styles.forTextOn]}>For {m.name}</Text>
                </Tap>
              ))}
            </ScrollView>
            <Text style={styles.h2}>Who's in?</Text>
            <Text style={styles.hint}>− / + for a smaller or bigger share · Extra for something only they had</Text>
            {members.map(m => {
              const st = shares[m.id] ?? { weight: 0, extra: null };
              const owed = preview?.ok ? preview.owed.get(m.id) : undefined;
              const pct = owed != null && amount ? Math.round((owed * 100) / amount) : null;
              const out = st.weight === 0 && !st.extra;
              return (
                <View key={m.id} style={styles.shareCard}>
                  <View style={styles.shareTop}>
                    <Avatar person={m} size={40} dimmed={out} />
                    <Text style={styles.shareName} numberOfLines={1}>{m.name}</Text>
                    <View style={styles.owedCol}>
                      <Text style={styles.owed} numberOfLines={1} adjustsFontSizeToFit>{owed != null ? money(owed) : '—'}</Text>
                      <Text style={styles.pct}>{pct != null ? `${pct}%` : 'out'}</Text>
                    </View>
                  </View>
                  <View style={styles.shareControls}>
                    <View style={styles.stepper}>
                      <Tap onPress={() => step(m.id, -1)} style={styles.stepBtn} ring={theme.color.accent} accessibilityRole="button" accessibilityLabel={`Smaller share for ${m.name}`}>
                        <Text style={styles.stepText}>−</Text>
                      </Tap>
                      <Pop trigger={st.weight}>
                        <Text style={styles.weight} accessibilityLabel={`${st.weight} ${st.weight === 1 ? 'share' : 'shares'}`}>{st.weight}</Text>
                      </Pop>
                      <Tap onPress={() => step(m.id, 1)} style={styles.stepBtn} ring={theme.color.accent} accessibilityRole="button" accessibilityLabel={`Bigger share for ${m.name}`}>
                        <Text style={styles.stepText}>+</Text>
                      </Tap>
                    </View>
                    <Tap
                      onPress={() => setExtraFor(m)}
                      accessibilityRole="button"
                      accessibilityLabel={st.extra ? `${m.name}'s extra, ${money(st.extra)}. Tap to change` : `Add an extra for ${m.name}`}
                      style={[styles.extraBtn, st.extra ? styles.extraOn : null]}
                    >
                      <Text style={[styles.extraText, st.extra ? styles.extraTextOn : null]} numberOfLines={1} adjustsFontSizeToFit>
                        {st.extra ? `+${money(st.extra)}` : '+ Extra'}
                      </Text>
                    </Tap>
                  </View>
                </View>
              );
            })}
            {extraSum > 0 && amount != null && preview?.ok && (
              <Text style={styles.hint}>
                {amount - extraSum === 0
                  ? 'Extras cover the whole bill.'
                  : `Extras ${money(extraSum)} · the other ${money(amount - extraSum)} split between ${sharers.length}${sharers.some(s => s.weight !== 1) ? ' by shares' : ''}`}
              </Text>
            )}
          </>
        )}

        {preview && !preview.ok && <Text style={styles.error}>{preview.error}</Text>}
        {items && unpriced.length > 0 && (
          <Text style={styles.error}>{unpriced[0].name.trim() ? `${unpriced[0].name.trim()} needs a price` : 'An item needs a price'}</Text>
        )}
        {items && unpriced.length === 0 && itemList.length === 0 && <Text style={styles.hint}>Add an item to save.</Text>}
        {items && unpriced.length === 0 && itemList.length > 0 && preview?.ok && itemSave && !itemSave.ok && (
          <Text style={styles.error}>{itemSave.error}</Text>
        )}
        <Button label={editingId != null ? 'Save changes' : 'Save'} onPress={save} disabled={!canSave || saving} style={styles.save} />
      </ScrollView>

      <ExtraModal
        person={extraFor}
        initial={extraFor ? shares[extraFor.id]?.extra ?? null : null}
        onClose={() => setExtraFor(null)}
        onDone={minor => {
          if (extraFor) {
            const pid = extraFor.id;
            setShares(prev => ({ ...prev, [pid]: { weight: prev[pid]?.weight ?? 0, extra: minor } }));
          }
          setExtraFor(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: 20, gap: 14, paddingBottom: 48 },
  kicker: { ...theme.type.label, color: theme.color.inkDim, textAlign: 'center' },
  amount: { ...theme.type.hero, color: theme.color.ink, textAlign: 'center', fontVariant: ['tabular-nums'] },
  placeholder: { color: theme.color.inkDim },
  h2: { ...theme.type.title, color: theme.color.ink },
  hint: { ...theme.type.small, color: theme.color.inkDim, marginTop: -6 },
  payers: { gap: 8 },
  payer: { minWidth: theme.tap, minHeight: theme.tap, padding: 6, borderRadius: theme.radius.md, borderWidth: 3, borderColor: 'transparent' },
  payerOn: { borderColor: theme.color.ink },
  forChip: {
    minHeight: theme.tap, paddingHorizontal: 18, borderRadius: theme.radius.md, borderWidth: 2, borderColor: theme.color.line,
    justifyContent: 'center',
  },
  forOn: { backgroundColor: theme.color.ink, borderColor: theme.color.ink },
  forText: { ...theme.type.bodyBold, color: theme.color.ink },
  forTextOn: { color: theme.color.bg },
  note: {
    minHeight: theme.tap, ...theme.type.body, color: theme.color.ink, backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md, paddingHorizontal: 16,
  },
  treat: { ...theme.type.bodyBold, color: theme.color.accent, textAlign: 'center' },
  shareCard: { backgroundColor: theme.color.surface, borderRadius: theme.radius.md, paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
  shareTop: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  shareName: { flex: 1, ...theme.type.bodyBold, color: theme.color.ink },
  shareControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: { width: theme.tap, height: theme.tap, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.md, backgroundColor: theme.color.bg },
  stepText: { ...theme.type.big, color: theme.color.ink },
  weight: { ...theme.type.title, color: theme.color.ink, minWidth: 36, textAlign: 'center' },
  extraBtn: {
    minHeight: theme.tap, paddingHorizontal: 16, borderRadius: theme.radius.md, borderWidth: 2, borderColor: theme.color.line,
    justifyContent: 'center', flexShrink: 1,
  },
  extraOn: { backgroundColor: theme.color.ink, borderColor: theme.color.ink },
  extraText: { ...theme.type.bodyBold, color: theme.color.ink },
  extraTextOn: { color: theme.color.bg },
  owedCol: { alignItems: 'flex-end', maxWidth: '45%' },
  owed: { ...theme.type.bodyBold, color: theme.color.ink, fontVariant: ['tabular-nums'] },
  pct: { ...theme.type.small, color: theme.color.inkDim },
  error: { ...theme.type.bodyBold, color: theme.color.owes, textAlign: 'center' },
  save: { minHeight: 72, marginTop: 8 },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  serviceLabel: { flex: 1, ...theme.type.bodyBold, color: theme.color.ink },
  serviceInput: {
    width: 120, minHeight: theme.tap, ...theme.type.title, color: theme.color.ink, textAlign: 'right',
    fontVariant: ['tabular-nums'], borderBottomWidth: 2, borderColor: theme.color.line, paddingHorizontal: 4,
  },
  owesBlock: { gap: 2, paddingBottom: 6, borderBottomWidth: 1, borderColor: theme.color.line },
  owesRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  breakdown: { ...theme.type.small, color: theme.color.inkDim, paddingLeft: 46 },
});
