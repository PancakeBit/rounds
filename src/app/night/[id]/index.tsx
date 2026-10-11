import { useCallback, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { formatMoney as money } from '../../../core/money';
import { Button } from '../../../ui/Button';
import { Circled, Land, ScoreColumn, Strike } from '../../../ui/chalk';
import { guarded } from '../../../ui/oops';
import { Snackbar } from '../../../ui/Snackbar';
import { Enter, Tap } from '../../../ui/Tap';
import { theme } from '../../../ui/theme';

// The bottom panel: "Someone paid" on top, "Settle up" bottom-most, clear space between them.
const PANEL_PAD = 12;
const PANEL_GAP = 16;
const PANEL_H = PANEL_PAD + theme.tap + PANEL_GAP + theme.tap + PANEL_PAD;

export default function NightScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const nightId = Number(id);
  const db = useSQLiteContext();
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

  // Hold to remove: the row gets a chalk strike, then it is wiped and Undo is offered.
  function remove(e: Expense) {
    if (striking != null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStriking(e.id);
    timer.current = setTimeout(async () => {
      timer.current = null;
      const gone = await guarded("Couldn't remove that", () => deleteExpense(db, e.id));
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
    const ok = await guarded("Couldn't bring that back", async () => { await saveExpense(db, snapshot); return true; });
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
        contentContainerStyle={[styles.list, { paddingBottom: (ended ? 80 : PANEL_H + 24) + insets.bottom }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.kicker}>The tab</Text>
            <Land trigger={expenses.length}>
              <Text style={styles.tab} numberOfLines={1} adjustsFontSizeToFit>{money(tab)}</Text>
            </Land>
            <Text style={styles.dim}>
              {expenses.length === 0 ? 'Nothing paid yet' : `${expenses.length} ${expenses.length === 1 ? 'thing' : 'things'} paid for`}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.board}>
              {members.map((m, i) => (
                <ScoreColumn key={m.id} person={m} photo={m.photoStart} history={history.get(m.id) ?? [0]} money={money} first={i === 0} />
              ))}
            </ScrollView>
            <View style={styles.actions}>
              <Button kind="ghost" label="Faces" onPress={() => router.push(`/night/${nightId}/lineup?phase=${ended ? 'end' : 'start'}&then=back`)} style={styles.actionFlex} />
              {!ended && <Button kind="ghost" label="Add someone" onPress={() => router.push(`/night/${nightId}/join`)} style={styles.actionFlex} />}
              <Button kind="ghost" label="Recap" onPress={() => router.push(`/night/${nightId}/recap`)} style={styles.actionFlex} />
            </View>
            {expenses.length === 0 && !ended && <Text style={styles.dim}>When someone pays for something, tap Someone paid.</Text>}
            {expenses.length > 0 && !ended && <Text style={styles.dim}>Tap one to change it · hold to remove it</Text>}
          </View>
        }
        renderItem={({ item: e, index }) => {
          const payer = byId.get(e.payerId);
          const title = e.note || categoryLabel(e.category);
          return (
            <Enter index={index}>
              <Tap
                disabled={ended}
                onPress={() => router.push(`/night/${nightId}/expense?expenseId=${e.id}`)}
                onLongPress={() => remove(e)}
                accessibilityRole="button"
                accessibilityLabel={`${title}, ${money(e.amount)}, ${payer?.name ?? 'someone'} paid${e.isTreat ? ', on them' : ''}`}
                accessibilityHint={ended ? undefined : 'Tap to change it. Hold to remove it.'}
                style={styles.exp}
              >
                <Text style={styles.expEmoji}>{categoryEmoji(e.category)}</Text>
                <View style={styles.flex}>
                  <Text style={styles.expTitle} numberOfLines={1}>{title}</Text>
                  <Text style={styles.dim}>{payer?.name} paid</Text>
                </View>
                {e.isTreat && (
                  <Circled>
                    <Text style={styles.onMe}>ON ME</Text>
                  </Circled>
                )}
                <Text style={styles.expAmt} numberOfLines={1}>{money(e.amount)}</Text>
                {striking === e.id && <Strike thickness={4} />}
              </Tap>
            </Enter>
          );
        }}
      />
      {!ended && (
        <View style={[styles.panel, { paddingBottom: PANEL_PAD + insets.bottom }]}>
          <Button label="Someone paid" onPress={() => router.push(`/night/${nightId}/expense`)} />
          <Button kind="go" label="Settle up" onPress={() => router.push(`/night/${nightId}/settle`)} />
        </View>
      )}
      {ended && <Text style={[styles.closed, { bottom: 28 + insets.bottom }]}>All square. This night is closed.</Text>}
      <Snackbar visible={undo != null} message="Removed" action="Undo" onAction={restore} onHide={() => setUndo(null)} bottomOffset={PANEL_H + 12} />
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
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  flex: { flex: 1 },
  actionFlex: { flex: 1, minWidth: 110 },
  exp: {
    minHeight: theme.tap, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 10,
  },
  expEmoji: { fontSize: theme.font.title },
  expTitle: { ...theme.type.bodyBold, color: theme.color.ink },
  onMe: { ...theme.type.big, fontSize: theme.font.body, color: theme.color.accent },
  expAmt: { ...theme.type.big, fontSize: theme.font.title, color: theme.color.ink },
  dim: { ...theme.type.small, color: theme.color.inkDim },
  panel: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: PANEL_PAD, gap: PANEL_GAP,
    backgroundColor: theme.color.bg, borderTopWidth: 2, borderTopColor: theme.color.line,
  },
  closed: { ...theme.type.label, position: 'absolute', alignSelf: 'center', color: theme.color.owed },
});
