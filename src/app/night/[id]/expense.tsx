import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import type { Category } from '../../../core/categories';
import { minorDigits, minorToInput, parseMoney } from '../../../core/money';
import { splitExpense, type ShareInput } from '../../../core/split';
import { getNight, listExpenses, saveExpense, type NightMember } from '../../../db/repo';
import { useMoney, useSettings } from '../../../state/settings';
import { AmountPad } from '../../../ui/AmountPad';
import { Avatar } from '../../../ui/Avatar';
import { Button } from '../../../ui/Button';
import { CategoryChips } from '../../../ui/CategoryChips';
import { FixedAmountModal } from '../../../ui/FixedAmountModal';
import { guarded } from '../../../ui/oops';
import { theme } from '../../../ui/theme';

type ShareState = { weight: number; fixed: number | null };

export default function ExpenseScreen() {
  const { id, expenseId } = useLocalSearchParams<{ id: string; expenseId?: string }>();
  const nightId = Number(id);
  const editingId = expenseId ? Number(expenseId) : undefined;
  const db = useSQLiteContext();
  const { currency } = useSettings();
  const money = useMoney();

  const [members, setMembers] = useState<NightMember[]>([]);
  const [amountText, setAmountText] = useState('');
  const [payerId, setPayerId] = useState<number | null>(null);
  const [category, setCategory] = useState<Category>('drinks');
  const [note, setNote] = useState('');
  const [isTreat, setIsTreat] = useState(false);
  const [shares, setShares] = useState<Record<number, ShareState>>({});
  const [createdAt, setCreatedAt] = useState<number | undefined>();
  const [fixedFor, setFixedFor] = useState<NightMember | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    guarded("Couldn't load this round", async () => {
      const data = await getNight(db, nightId);
      if (!data) return;
      setMembers(data.members);
      const all = await listExpenses(db, nightId);
      const existing = editingId != null ? all.find(e => e.id === editingId) : undefined;
      const everyone: Record<number, ShareState> = Object.fromEntries(data.members.map(m => [m.id, { weight: 1, fixed: null }]));
      if (existing) {
        setAmountText(minorToInput(existing.amount, currency));
        setPayerId(existing.payerId);
        setCategory(existing.category);
        setNote(existing.note);
        setIsTreat(existing.isTreat);
        setCreatedAt(existing.createdAt);
        if (existing.isTreat) {
          setShares(everyone);
        } else {
          const st: Record<number, ShareState> = Object.fromEntries(data.members.map(m => [m.id, { weight: 0, fixed: null }]));
          for (const s of existing.shares) st[s.personId] = { weight: s.weight, fixed: s.fixed ?? null };
          setShares(st);
        }
      } else {
        setPayerId(all.at(-1)?.payerId ?? data.members[0]?.id ?? null);
        setShares(everyone);
      }
    });
  }, [db, nightId, editingId, currency]);

  const amount = parseMoney(amountText, currency);
  const shareList: ShareInput[] = isTreat && payerId != null
    ? [{ personId: payerId, weight: 1 }]
    : members
        .map(m => ({ personId: m.id, weight: shares[m.id]?.weight ?? 0, fixed: shares[m.id]?.fixed ?? null }))
        .filter(s => s.weight > 0 || s.fixed != null);
  const preview = amount ? splitExpense(amount, shareList) : null;
  // The "For…" shortcut is lit when exactly one person is in, at one plain share.
  const soloFor = !isTreat && shareList.length === 1 && shareList[0].weight === 1 && shareList[0].fixed == null
    ? shareList[0].personId
    : null;
  const canSave = amount != null && amount > 0 && payerId != null && preview?.ok === true;

  // One tap for the most common round: the payer bought something for one other person.
  function onlyFor(personId: number) {
    setShares(Object.fromEntries(members.map(m => [m.id, { weight: m.id === personId ? 1 : 0, fixed: null }])));
  }

  // A "just for X" round can't be paid by X: put everyone back in rather than leave a self-only round.
  function changePayer(personId: number) {
    setPayerId(personId);
    if (soloFor === personId) {
      setShares(Object.fromEntries(members.map(m => [m.id, { weight: 1, fixed: null }])));
    }
  }

  function step(personId: number, delta: number) {
    setShares(prev => {
      const cur = prev[personId] ?? { weight: 0, fixed: null };
      return { ...prev, [personId]: { weight: Math.max(0, Math.min(9, cur.weight + delta)), fixed: null } };
    });
  }

  async function save() {
    if (busy.current || !canSave || amount == null || payerId == null) return;
    busy.current = true;
    setSaving(true);
    const ok = await guarded("Couldn't save that round", async () => {
      await saveExpense(db, { id: editingId, nightId, payerId, amount, category, note: note.trim(), isTreat, shares: shareList, createdAt });
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
      <Stack.Screen options={{ title: editingId != null ? 'Edit round' : 'New round' }} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={[styles.amount, !amountText && styles.placeholder]}>{amountText ? money(amount ?? 0) : money(0)}</Text>
        <AmountPad value={amountText} onChange={setAmountText} decimals={minorDigits(currency)} />

        <Text style={styles.h2}>Who paid?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.payers}>
          {members.map(m => (
            <Pressable
              key={m.id}
              onPress={() => changePayer(m.id)}
              accessibilityRole="radio"
              accessibilityLabel={`${m.name} paid`}
              accessibilityState={{ selected: payerId === m.id }}
              style={[styles.payer, payerId === m.id && styles.payerOn]}
            >
              <Avatar person={m} size={52} showName dimmed={payerId !== m.id} />
            </Pressable>
          ))}
        </ScrollView>

        <CategoryChips value={category} onChange={setCategory} />
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="What was it? (optional)"
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
        ) : (
          <>
            <Text style={styles.h2}>Just for one person?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.payers}>
              {members.filter(m => m.id !== payerId).map(m => (
                <Pressable
                  key={m.id}
                  onPress={() => onlyFor(m.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Just for ${m.name}`}
                  accessibilityHint="Splits this round with only them"
                  accessibilityState={{ selected: soloFor === m.id }}
                  style={[styles.forChip, soloFor === m.id && styles.forOn]}
                >
                  <Text style={[styles.forText, soloFor === m.id && styles.forTextOn]}>For {m.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.h2}>Who's in?</Text>
            <Text style={styles.hint}>+ for a bigger share · hold a name for an exact amount</Text>
            {members.map(m => {
              const st = shares[m.id] ?? { weight: 0, fixed: null };
              const owed = preview?.ok ? preview.owed.get(m.id) : undefined;
              const pct = owed != null && amount ? Math.round((owed * 100) / amount) : null;
              return (
                <View key={m.id} style={styles.shareRow}>
                  <Pressable
                    onLongPress={() => setFixedFor(m)}
                    accessibilityRole="button"
                    accessibilityLabel={`${m.name}, ${st.fixed != null ? 'exact amount' : `${st.weight} ${st.weight === 1 ? 'share' : 'shares'}`}`}
                    accessibilityHint="Hold to set an exact amount"
                    style={styles.shareWho}
                  >
                    <Avatar person={m} size={40} dimmed={st.weight === 0 && st.fixed == null} />
                    <Text style={styles.shareName} numberOfLines={1}>{m.name}</Text>
                  </Pressable>
                  {st.fixed != null ? (
                    <Text style={styles.fixedTag} accessibilityLabel="exact amount">exact</Text>
                  ) : (
                    <View style={styles.stepper}>
                      <Pressable onPress={() => step(m.id, -1)} style={styles.stepBtn} hitSlop={{ left: 4, right: 4 }} accessibilityRole="button" accessibilityLabel={`Fewer shares for ${m.name}`}>
                        <Text style={styles.stepText}>−</Text>
                      </Pressable>
                      <Text style={styles.weight}>{st.weight}</Text>
                      <Pressable onPress={() => step(m.id, 1)} style={styles.stepBtn} hitSlop={{ left: 4, right: 4 }} accessibilityRole="button" accessibilityLabel={`More shares for ${m.name}`}>
                        <Text style={styles.stepText}>+</Text>
                      </Pressable>
                    </View>
                  )}
                  <View style={styles.owedCol}>
                    <Text style={styles.owed}>{owed != null ? money(owed) : '—'}</Text>
                    <Text style={styles.pct}>{pct != null ? `${pct}%` : 'out'}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {preview && !preview.ok && <Text style={styles.error}>{preview.error}</Text>}
        <Button label={editingId != null ? 'Save changes' : 'Chalk it up'} onPress={save} disabled={!canSave || saving} style={styles.save} />
      </ScrollView>

      <FixedAmountModal
        person={fixedFor}
        currency={currency}
        initial={fixedFor ? shares[fixedFor.id]?.fixed ?? null : null}
        onClose={() => setFixedFor(null)}
        onDone={minor => {
          if (fixedFor) {
            const pid = fixedFor.id;
            setShares(prev => ({ ...prev, [pid]: { weight: minor == null ? prev[pid]?.weight ?? 0 : prev[pid]?.weight || 1, fixed: minor } }));
          }
          setFixedFor(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: 20, gap: 14, paddingBottom: 48 },
  amount: { ...theme.type.hero, color: theme.color.ink, textAlign: 'center', fontVariant: ['tabular-nums'] },
  placeholder: { color: theme.color.inkDim },
  h2: { ...theme.type.title, color: theme.color.ink },
  hint: { ...theme.type.small, color: theme.color.inkDim, marginTop: -8 },
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
  shareRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64, backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md, paddingHorizontal: 12,
  },
  shareWho: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: theme.tap },
  shareName: { flex: 1, ...theme.type.bodyBold, color: theme.color.ink },
  stepper: { flexDirection: 'row', alignItems: 'center' },
  stepBtn: { width: 48, height: theme.tap, alignItems: 'center', justifyContent: 'center' },
  stepText: { ...theme.type.big, color: theme.color.ink },
  weight: { ...theme.type.title, color: theme.color.ink, minWidth: 20, textAlign: 'center' },
  fixedTag: { ...theme.type.smallBold, color: theme.color.bg, backgroundColor: theme.color.ink, paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.sm, textTransform: 'uppercase' },
  owedCol: { alignItems: 'flex-end', minWidth: 72 },
  owed: { ...theme.type.bodyBold, color: theme.color.ink, fontVariant: ['tabular-nums'] },
  pct: { ...theme.type.small, color: theme.color.inkDim },
  error: { ...theme.type.bodyBold, color: theme.color.owes, textAlign: 'center' },
  save: { minHeight: 72, marginTop: 8 },
});
