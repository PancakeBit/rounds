import { useCallback, useRef, useState, type RefObject } from 'react';
import { ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { nightBalances } from '../../../core/balances';
import { defaultLayout, fittingLayouts, nextLayout, shotsOf, type LayoutId } from '../../../core/collage';
import { formatMoney as money } from '../../../core/money';
import { settle } from '../../../core/settle';
import { nightStats } from '../../../core/stats';
import { nightSummary } from '../../../core/summary';
import {
  getNight, listExpenses, listSettlements, type Expense, type Night, type NightMember, type Settlement,
} from '../../../db/repo';
import { Button } from '../../../ui/Button';
import { Collage } from '../../../ui/collage/Collage';
import { guarded, oops } from '../../../ui/oops';
import { ReceiptCard } from '../../../ui/ReceiptCard';
import { Tap } from '../../../ui/Tap';
import { theme } from '../../../ui/theme';

type Tab = 'receipt' | 'photos';
const PAD = 20;

export default function Recap() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const nightId = Number(id);
  const db = useSQLiteContext();
  const receiptRef = useRef<View>(null);
  const photosRef = useRef<View>(null);
  const [night, setNight] = useState<Night | null>(null);
  const [members, setMembers] = useState<NightMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [paid, setPaid] = useState<Settlement[]>([]);
  const [tab, setTab] = useState<Tab>('receipt');
  const [layout, setLayout] = useState<LayoutId | null>(null);
  const [breakdown, setBreakdown] = useState(false); // "Who had what" on the receipt and in the text; off by default
  const busy = useRef(false);

  // On focus, so photos taken on the line-up screen show up when coming back.
  useFocusEffect(useCallback(() => {
    guarded("Couldn't load the recap", async () => {
      const data = await getNight(db, nightId);
      if (!data) return;
      const exp = await listExpenses(db, nightId);
      const sett = await listSettlements(db, nightId);
      setNight(data.night);
      setMembers(data.members);
      setExpenses(exp);
      setPaid(sett.filter(s => s.paidAt != null));
      // Keep a shuffled layout while it still fits the photos; otherwise use the night's own pick.
      const shots = shotsOf(data.night, data.members);
      setLayout(prev => {
        const fit = fittingLayouts(shots);
        // The plain single frame gives way as soon as anything richer fits.
        const keep = prev != null && fit.includes(prev) && !(prev === 'single' && fit.length > 1);
        return keep ? prev : defaultLayout(shots, data.night.id);
      });
    });
  }, [db, nightId]));

  // Worked out fresh, so it is right even mid-night before anyone has opened Settle up.
  const openTransfers = () => settle(nightBalances(members.map(m => m.id), expenses, paid));

  async function shareImage(ref: RefObject<View | null>, what: string) {
    if (busy.current) return;
    busy.current = true;
    try {
      const uri = await captureRef(ref, { format: 'png', quality: 1 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Send to the group' });
    } catch (e) {
      oops(e, `Couldn't share the ${what}`);
    } finally {
      busy.current = false;
    }
  }

  async function shareText() {
    if (!night || busy.current) return;
    busy.current = true;
    try {
      const message = nightSummary({
        title: night.title,
        date: new Date(night.startedAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
        memberIds: members.map(m => m.id),
        names: new Map(members.map(m => [m.id, m.name])),
        expenses,
        paid,
        open: openTransfers(),
        money,
        breakdown,
      });
      await Share.share({ message });
    } catch (e) {
      oops(e, "Couldn't share the text");
    } finally {
      busy.current = false;
    }
  }

  if (!night) return null;

  return (
    <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 20 + insets.bottom }]}>
      <Stack.Screen options={{ title: 'Recap' }} />
      <View style={styles.tabs} accessibilityRole="tablist">
        {(['receipt', 'photos'] as const).map(t => (
          <Tap
            key={t}
            onPress={() => setTab(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === t }}
            style={[styles.tab, tab === t && styles.tabOn]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextOn]}>{t === 'receipt' ? 'The receipt' : 'The photos'}</Text>
          </Tap>
        ))}
      </View>

      {tab === 'receipt' ? (
        <>
          <Tap
            onPress={() => setBreakdown(b => !b)}
            accessibilityRole="switch"
            accessibilityLabel="Show who had what"
            accessibilityState={{ checked: breakdown }}
            style={styles.toggle}
          >
            <View style={[styles.box, breakdown && styles.boxOn]}>{breakdown && <Text style={styles.tick}>✓</Text>}</View>
            <View style={styles.flex}>
              <Text style={styles.toggleText}>Show who had what</Text>
              <Text style={styles.dim}>Each person's total and what it's made of</Text>
            </View>
          </Tap>
          <View ref={receiptRef} collapsable={false} style={styles.capture}>
            <ReceiptCard night={night} members={members} expenses={expenses} stats={nightStats(expenses)} open={openTransfers()} paid={paid} breakdown={breakdown} />
          </View>
          <Button label="Send the receipt" onPress={() => shareImage(receiptRef, 'receipt')} style={styles.share} />
          <Button kind="ghost" label="Send as text" onPress={shareText} />
        </>
      ) : layout == null ? (
        <View style={styles.empty}>
          <Text style={styles.emptyBig}>No photos from this night.</Text>
          <Text style={styles.dim}>Snap the crew at the start or the end, or take a group shot, and the collage builds itself.</Text>
          <Button
            label="Take some"
            onPress={() => router.push(`/night/${nightId}/lineup?phase=${night.endedAt != null ? 'end' : 'start'}&then=back`)}
          />
        </View>
      ) : (
        <>
          <View ref={photosRef} collapsable={false} style={styles.capture}>
            <Collage layout={layout} night={night} members={members} width={width - PAD * 2} />
          </View>
          <Button kind="ghost" label="Shuffle the layout" onPress={() => setLayout(l => (l ? nextLayout(shotsOf(night, members), l) : l))} />
          <Button label="Send the photos" onPress={() => shareImage(photosRef, 'photos')} style={styles.share} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: PAD, gap: 12 },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1, minHeight: theme.tap, borderRadius: theme.radius.md, borderWidth: 2, borderColor: theme.color.line,
    alignItems: 'center', justifyContent: 'center',
  },
  tabOn: { backgroundColor: theme.color.ink, borderColor: theme.color.ink },
  tabText: { ...theme.type.title, color: theme.color.ink, textTransform: 'uppercase' },
  tabTextOn: { color: theme.color.bg },
  capture: { backgroundColor: theme.color.bg },
  flex: { flex: 1 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: theme.tap },
  box: {
    width: 32, height: 32, borderRadius: theme.radius.sm, borderWidth: 2, borderColor: theme.color.line,
    alignItems: 'center', justifyContent: 'center',
  },
  boxOn: { backgroundColor: theme.color.accent, borderColor: theme.color.accent },
  tick: { ...theme.type.bodyBold, color: theme.color.bg },
  toggleText: { ...theme.type.bodyBold, color: theme.color.ink },
  share: { minHeight: 64 },
  empty: { gap: 14, paddingVertical: 32 },
  emptyBig: { ...theme.type.display, color: theme.color.ink },
  dim: { ...theme.type.body, color: theme.color.inkDim },
});
