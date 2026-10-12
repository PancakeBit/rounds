import { useCallback, useRef, useState } from 'react';
import { Alert, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { balanceHistory } from '../../../core/balances';
import { categoriesEmoji, categoriesLabel } from '../../../core/categories';
import {
  deleteExpense, deleteNight, getNight, listExpenses, listSettlements, renameNight, reopenNight, saveExpense,
  type Expense, type ExpenseInput, type Night, type NightMember, type Settlement,
} from '../../../db/repo';
import { formatMoney as money } from '../../../core/money';
import { Button } from '../../../ui/Button';
import { Circled, Land, ScoreColumn, Strike } from '../../../ui/chalk';
import { dropFile, dropNight } from '../../../photos/store';
import { NameModal } from '../../../ui/NameModal';
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
  const [naming, setNaming] = useState(false);

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
  const undoReceipt = useRef<string | null>(null); // receipt of the payment waiting on Undo
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
      if (gone) {
        dropFile(undoReceipt.current); // a second removal replaces the first one's Undo
        undoReceipt.current = gone.receiptUri ?? null;
        setUndo(gone);
      }
      load();
    }, 200);
  }
  async function restore() {
    if (!undo || restoring.current) return;
    restoring.current = true;
    const snapshot = undo;
    undoReceipt.current = null; // coming back: its receipt is needed again
    setUndo(null);
    const ok = await guarded("Couldn't bring that back", async () => { await saveExpense(db, snapshot); return true; });
    restoring.current = false;
    if (!ok) { setUndo(snapshot); return; }
    load();
  }

  async function reopen() {
    await guarded("Couldn't reopen it", () => reopenNight(db, nightId));
    load();
  }

  // Asks first: this removes every payment, settle-up tick and photo from the night, for good.
  function removeNight() {
    if (!night) return;
    Alert.alert(
      `Delete ${night.title}?`,
      "Every payment, settle-up tick and photo from this night goes. This can't be undone.",
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const files = await guarded("Couldn't delete it", () => deleteNight(db, nightId));
            if (!files) return;
            dropNight(nightId, files);
            router.dismissTo('/');
          },
        },
      ],
    );
  }

  async function rename(title: string) {
    setNaming(false);
    await guarded("Couldn't rename it", () => renameNight(db, nightId, title));
    load();
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: night.title,
          headerTitle: () => (
            <Tap onPress={() => setNaming(true)} accessibilityRole="button" accessibilityLabel={`${night.title}, rename`} style={styles.titleTap}>
              <Text style={styles.titleText} numberOfLines={1}>{night.title}</Text>
              <Text style={styles.titlePen}>✎</Text>
            </Tap>
          ),
        }}
      />
      <FlatList
        data={[...expenses].reverse()}
        keyExtractor={e => String(e.id)}
        contentContainerStyle={[styles.list, { paddingBottom: (ended ? 150 : PANEL_H + 24) + insets.bottom }]}
        ListFooterComponent={
          <Tap onPress={removeNight} ring={theme.color.owes} style={styles.deleteNight} accessibilityRole="button" accessibilityLabel={`Delete ${night.title}`}>
            <Text style={styles.deleteText}>Delete this night</Text>
          </Tap>
        }
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
          const title = e.note || categoriesLabel(e.categories);
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
                <Text style={styles.expEmoji}>{categoriesEmoji(e.categories)}</Text>
                <View style={styles.flex}>
                  <Text style={styles.expTitle} numberOfLines={1}>{title}</Text>
                  <Text style={styles.dim}>
                    {payer?.name} paid{e.items.length ? ` · ${e.items.length} ${e.items.length === 1 ? 'item' : 'items'}` : ''}{e.receiptUri ? ' · receipt' : ''}
                  </Text>
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
      {ended && (
        <View style={[styles.panel, { paddingBottom: PANEL_PAD + insets.bottom }]}>
          <Text style={styles.closedText}>All square. This night is closed.</Text>
          <Button kind="ghost" label="Reopen this night" onPress={reopen} />
        </View>
      )}
      <NameModal visible={naming} initial={night.title} onDone={rename} onClose={() => setNaming(false)} />
      <Snackbar visible={undo != null} message="Removed" action="Undo" onAction={restore} onHide={() => {
        // Undo is gone for good: the removed payment's receipt photo goes too.
        dropFile(undoReceipt.current);
        undoReceipt.current = null;
        setUndo(null);
      }} bottomOffset={PANEL_H + 12} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleTap: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: theme.tap, flexShrink: 1 },
  titleText: { fontFamily: theme.face.displayBold, fontSize: theme.font.title, color: theme.color.ink, flexShrink: 1 },
  titlePen: { ...theme.type.body, color: theme.color.inkDim },
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
  closedText: { ...theme.type.label, color: theme.color.owed, textAlign: 'center' },
  deleteNight: { minHeight: theme.tap, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  deleteText: { ...theme.type.bodyBold, color: theme.color.owes },
});
