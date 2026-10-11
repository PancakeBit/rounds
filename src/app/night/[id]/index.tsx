import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { balanceHistory } from '../../../core/balances';
import { categoryEmoji, categoryLabel } from '../../../core/categories';
import {
  deleteExpense, getNight, listExpenses, listSettlements, saveExpense,
  type Expense, type ExpenseInput, type Night, type NightMember, type Settlement,
} from '../../../db/repo';
import { useMoney } from '../../../state/settings';
import { Button } from '../../../ui/Button';
import { Circled, Land, ScoreColumn, Strike } from '../../../ui/chalk';
import { guarded } from '../../../ui/oops';
import { Snackbar } from '../../../ui/Snackbar';
import { theme } from '../../../ui/theme';

const BAR_GAP = 20;

export default function NightScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const nightId = Number(id);
  const db = useSQLiteContext();
  const money = useMoney();
  const insets = useSafeAreaInsets();
  const [night, setNight] = useState<Night | null>(null);
  const [members, setMembers] = useState<NightMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [paid, setPaid] = useState<Settlement[]>([]);
  const [undo, setUndo] = useState<ExpenseInput | null>(null);
  const [striking, setStriking] = useState<number | null>(null);

  const load = useCallback(async () => {
    await guarded("Couldn't load the board", async () => {
      const data = await getNight(db, nightId);
      if (!data) return;
      const exps = await listExpenses(db, nightId);
      const settled = (await listSettlements(db, nightId)).filter(s => s.paidAt != null);
      setNight(data.night);
      setMembers(data.members);
      setExpenses(exps);
      setPaid(settled);
    });
  }, [db, nightId]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoring = useRef(false);
  useFocusEffect(useCallback(() => {
    load();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      setStriking(null);
    };
  }, [load]));

  if (!night) return null;
  const ended = night.endedAt != null;
  const history = balanceHistory(members.map(m => m.id), expenses, paid);
  const byId = new Map(members.map(m => [m.id, m]));
  const tab = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Hold to delete: the row gets a chalk strike, then it is wiped and Undo is offered.
  function remove(e: Expense) {
    if (striking != null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStriking(e.id);
    timer.current = setTimeout(async () => {
      timer.current = null;
      const gone = await guarded("Couldn't wipe that round", () => deleteExpense(db, e.id));
      setStriking(null);
      if (gone) setUndo(gone);
      load();
    }, 200);
  }
  async function restore() {
    if (!undo || restoring.current) return;
    restoring.current = true;
    const snapshot = undo;
    setUndo(null);
    const ok = await guarded("Couldn't bring that round back", async () => { await saveExpense(db, snapshot); return true; });
    restoring.current = false;
    if (!ok) { setUndo(snapshot); return; }
    load();
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: night.title }} />
      <FlatList
        data={[...expenses].reverse()}
        keyExtractor={e => String(e.id)}
        contentContainerStyle={[styles.list, { paddingBottom: 120 + insets.bottom }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.kicker}>The tab</Text>
            <Land trigger={expenses.length}>
              <Text style={styles.tab} numberOfLines={1} adjustsFontSizeToFit>{money(tab)}</Text>
            </Land>
            <Text style={styles.dim}>
              {expenses.length === 0 ? 'No rounds yet' : `${expenses.length} ${expenses.length === 1 ? 'round' : 'rounds'} on the board`}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.board}>
              {members.map((m, i) => (
                <ScoreColumn key={m.id} person={m} photo={m.photoStart} history={history.get(m.id) ?? [0]} money={money} first={i === 0} />
              ))}
            </ScrollView>
            <View style={styles.actions}>
              {!ended && <Button kind="go" label="Settle up" onPress={() => router.push(`/night/${nightId}/settle`)} style={styles.flex} />}
              <Button kind="ghost" label="Faces" onPress={() => router.push(`/night/${nightId}/lineup?phase=${ended ? 'end' : 'start'}&then=back`)} />
              <Button kind="ghost" label="Recap" onPress={() => router.push(`/night/${nightId}/recap`)} style={styles.flex} />
            </View>
            {expenses.length === 0 && <Text style={styles.dim}>Board's clean. Chalk up the first round.</Text>}
            {expenses.length > 0 && !ended && <Text style={styles.dim}>Tap a round to edit it · hold to wipe it off</Text>}
          </View>
        }
        renderItem={({ item: e }) => {
          const payer = byId.get(e.payerId);
          const title = e.note || categoryLabel(e.category);
          return (
            <Pressable
              disabled={ended}
              onPress={() => router.push(`/night/${nightId}/expense?expenseId=${e.id}`)}
              onLongPress={() => remove(e)}
              accessibilityRole="button"
              accessibilityLabel={`${title}, ${money(e.amount)}, ${payer?.name ?? 'someone'} paid${e.isTreat ? ', on them' : ''}`}
              accessibilityHint={ended ? undefined : 'Tap to edit. Hold to wipe it off.'}
              style={styles.exp}
            >
              <Text style={styles.expEmoji}>{categoryEmoji(e.category)}</Text>
              <View style={styles.flex}>
                <Text style={styles.expTitle}>{title}</Text>
                <Text style={styles.dim}>{payer?.name} paid</Text>
              </View>
              {e.isTreat && (
                <Circled>
                  <Text style={styles.onMe}>ON ME</Text>
                </Circled>
              )}
              <Text style={styles.expAmt}>{money(e.amount)}</Text>
              {striking === e.id && <Strike thickness={4} />}
            </Pressable>
          );
        }}
      />
      {!ended && (
        <View style={[styles.bottom, { bottom: BAR_GAP + insets.bottom }]}>
          <Button label="Chalk up a round" onPress={() => router.push(`/night/${nightId}/expense`)} />
        </View>
      )}
      {ended && <Text style={[styles.closed, { bottom: 28 + insets.bottom }]}>All square. This night is closed.</Text>}
      <Snackbar visible={undo != null} message="Round wiped" action="Undo" onAction={restore} onHide={() => setUndo(null)} bottomOffset={BAR_GAP + theme.tap + 12} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { padding: 16, paddingBottom: 120, gap: 8 },
  header: { gap: 12, marginBottom: 4 },
  kicker: { ...theme.type.label, color: theme.color.inkDim },
  tab: { ...theme.type.hero, color: theme.color.ink, marginTop: -12 },
  board: { borderTopWidth: 2, borderBottomWidth: 2, borderColor: theme.color.line },
  actions: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  exp: {
    minHeight: theme.tap, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 10,
  },
  expEmoji: { fontSize: theme.font.title },
  expTitle: { ...theme.type.bodyBold, color: theme.color.ink },
  onMe: { ...theme.type.big, fontSize: theme.font.body, color: theme.color.accent },
  expAmt: { ...theme.type.big, fontSize: theme.font.title, color: theme.color.ink },
  dim: { ...theme.type.small, color: theme.color.inkDim },
  bottom: { position: 'absolute', left: 16, right: 16 },
  closed: { ...theme.type.label, position: 'absolute', alignSelf: 'center', color: theme.color.owed },
});
