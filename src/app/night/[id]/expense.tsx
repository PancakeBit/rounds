import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import type { Category } from '../../../core/categories';
import { formatMoney as money, minorToInput, parseMoney } from '../../../core/money';
import { splitExpense, type ShareInput } from '../../../core/split';
import { getNight, listExpenses, saveExpense, type NightMember } from '../../../db/repo';
import { AmountPad } from '../../../ui/AmountPad';
import { Avatar } from '../../../ui/Avatar';
import { Button } from '../../../ui/Button';
import { CategoryChips } from '../../../ui/CategoryChips';
import { ExtraModal } from '../../../ui/ExtraModal';
import { guarded } from '../../../ui/oops';
import { Pop, Tap } from '../../../ui/Tap';
import { theme } from '../../../ui/theme';

type ShareState = { weight: number; extra: number | null };

const allIn = (members: NightMember[]): Record<number, ShareState> =>
  Object.fromEntries(members.map(m => [m.id, { weight: 1, extra: null }]));

export default function ExpenseScreen() {
  const { id, expenseId } = useLocalSearchParams<{ id: string; expenseId?: string }>();
  const nightId = Number(id);
  const editingId = expenseId ? Number(expenseId) : undefined;
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();

  const [members, setMembers] = useState<NightMember[]>([]);
  const [amountText, setAmountText] = useState('');
  const [payerId, setPayerId] = useState<number | null>(null);
  const [category, setCategory] = useState<Category>('drinks');
  const [note, setNote] = useState('');
  const [isTreat, setIsTreat] = useState(false);
  const [shares, setShares] = useState<Record<number, ShareState>>({});
  const [createdAt, setCreatedAt] = useState<number | undefined>();
  const [extraFor, setExtraFor] = useState<NightMember | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);

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
        setCategory(existing.category);
        setNote(existing.note);
        setIsTreat(existing.isTreat);
        setCreatedAt(existing.createdAt);
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

  const amount = parseMoney(amountText);
  const shareList: ShareInput[] = isTreat && payerId != null
    ? [{ personId: payerId, weight: 1 }]
    : members
        .map(m => ({ personId: m.id, weight: shares[m.id]?.weight ?? 0, extra: shares[m.id]?.extra ?? null }))
        .filter(s => s.weight > 0 || (s.extra ?? 0) > 0);
  const preview = amount ? splitExpense(amount, shareList) : null;
  const extraSum = shareList.reduce((t, s) => t + (s.extra ?? 0), 0);
  const sharers = shareList.filter(s => s.weight > 0);
  // The "For…" shortcut is lit when exactly one person is in, at one plain share.
  const soloFor = !isTreat && shareList.length === 1 && shareList[0].weight === 1 && !shareList[0].extra
    ? shareList[0].personId
    : null;
  const canSave = amount != null && amount > 0 && payerId != null && preview?.ok === true;

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
      <Stack.Screen options={{ title: editingId != null ? 'Change this one' : 'Someone paid' }} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 48 + insets.bottom }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>How much?</Text>
        <Pop trigger={amountText}>
          <Text style={[styles.amount, !amountText && styles.placeholder]} numberOfLines={1} adjustsFontSizeToFit>
            {money(amount ?? 0)}
          </Text>
        </Pop>
        <AmountPad value={amountText} onChange={setAmountText} />

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
        <CategoryChips value={category} onChange={setCategory} />
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
                      <Text style={[styles.extraText, st.extra ? styles.extraTextOn : null]} numberOfLines={1}>
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
});
