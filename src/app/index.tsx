import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { across, nightTransfers, type OpenNightData } from '../core/across';
import { formatMoney as money } from '../core/money';
import {
  getGroupName, listCrew, listPastNights, loadOpenNights, setGroupName,
  type Night, type OpenNight, type Person,
} from '../db/repo';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { NameModal } from '../ui/NameModal';
import { guarded } from '../ui/oops';
import { Enter, Tap } from '../ui/Tap';
import { theme } from '../ui/theme';

const PAD = 20;
const GAP = 10;
const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const isToday = (ms: number) => new Date(ms).toDateString() === new Date().toDateString();

// Home is people first: the group, each person's face, and where they stand across every open night.
export default function Home() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const db = useSQLiteContext();
  const [groupName, setName] = useState('');
  const [naming, setNaming] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [net, setNet] = useState<Map<number, number>>(new Map());
  const [open, setOpen] = useState<OpenNight[]>([]);
  const [tabs, setTabs] = useState<Map<number, number>>(new Map());
  const [past, setPast] = useState<Night[]>([]);

  const load = useCallback(async () => {
    await guarded("Couldn't load the board", async () => {
      const nights = await loadOpenNights(db);
      const data: OpenNightData[] = nights.map(n => ({
        nightId: n.night.id, title: n.night.title, memberIds: n.members.map(m => m.id),
        expenses: n.expenses, paid: n.paid, unpaid: n.unpaid,
      }));
      const a = across(data);
      // The current crew, plus anyone retired who still has money open.
      const everyone = await listCrew(db, true);
      setPeople(everyone.filter(p => !p.archived || (a.net.get(p.id) ?? 0) !== 0));
      setNet(a.net);
      setTabs(new Map(nights.map(n => [n.night.id, n.expenses.reduce((t, e) => t + e.amount, 0)])));
      // Still to move on each night: the same plan Settle up shows.
      setOpen(nights.map((n, i) => ({ ...n.night, unpaid: nightTransfers(data[i]).reduce((t, x) => t + x.amount, 0) })));
      setPast(await listPastNights(db));
      setName(await getGroupName(db));
    });
  }, [db]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function rename(next: string) {
    setNaming(false);
    await guarded("Couldn't rename the group", () => setGroupName(db, next));
    load();
  }

  const cardW = Math.floor((width - PAD * 2 - GAP) / 2); // whole pixels, so two always fit on a row
  const [tonight, ...others] = open;

  return (
    <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 24 + insets.bottom }]}>
      <Stack.Screen options={{ title: 'Rounds' }} />

      {tonight && (
        <Tap
          style={styles.tonight}
          ring={theme.color.accent}
          onPress={() => router.push(`/night/${tonight.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`${tonight.title}, ${money(tabs.get(tonight.id) ?? 0)} so far`}
        >
          <View style={styles.flex}>
            <Text style={styles.tonightKicker}>{isToday(tonight.startedAt) ? 'Tonight' : `Open · ${day(tonight.startedAt)}`}</Text>
            <Text style={styles.tonightTitle} numberOfLines={1}>{tonight.title}</Text>
          </View>
          <Text style={styles.tonightTab} numberOfLines={1}>{money(tabs.get(tonight.id) ?? 0)}</Text>
        </Tap>
      )}

      {!tonight && <Button label="Start a night" onPress={() => router.push('/night/new')} style={styles.start} />}

      <View style={styles.groupHead}>
        <Tap onPress={() => setNaming(true)} style={styles.groupName} accessibilityRole="button" accessibilityLabel={`${groupName}, rename the group`}>
          <Text style={styles.groupText} numberOfLines={1}>{groupName}</Text>
          <Text style={styles.pen}>✎</Text>
        </Tap>
        {open.length > 0 && <Text style={styles.dim}>{open.length} {open.length === 1 ? 'night' : 'nights'} open</Text>}
      </View>

      <View style={styles.grid}>
        {people.map((p, i) => {
          const v = net.get(p.id) ?? 0;
          return (
            <Enter key={p.id} index={i} style={{ width: cardW }}>
              <Tap
                style={styles.card}
                ring={p.color}
                onPress={() => router.push(`/person/${p.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${p.name}, ${v > 0 ? `gets back ${money(v)}` : v < 0 ? `owes ${money(-v)}` : 'all square'}`}
              >
                <Avatar person={p} size={96} dimmed={p.archived} />
                <Text style={[styles.cardName, { color: p.color }]} numberOfLines={1}>{p.name}</Text>
                {v > 0 ? (
                  <Text style={styles.side}>gets back <Text style={styles.sideIn}>{money(v)}</Text></Text>
                ) : v < 0 ? (
                  <Text style={styles.side}>owes <Text style={styles.sideOut}>{money(-v)}</Text></Text>
                ) : (
                  <Text style={styles.side}>all square</Text>
                )}
              </Tap>
            </Enter>
          );
        })}
        <Tap
          style={[styles.card, styles.addCard, { width: cardW }]}
          onPress={() => router.push('/crew')}
          accessibilityRole="button"
          accessibilityLabel="Add someone or edit the group"
        >
          <Text style={styles.plus}>+</Text>
          <Text style={styles.addText}>{people.length ? 'Add someone' : 'Add your friends'}</Text>
        </Tap>
      </View>

      {/* With a night on, faces come first; with none, starting one is the main thing to do. */}
      {tonight && <Button label="Start a night" onPress={() => router.push('/night/new')} style={styles.start} />}

      {others.length > 0 && <Text style={styles.h2}>Also open</Text>}
      {others.map(n => (
        <Tap key={n.id} style={styles.row} onPress={() => router.push(`/night/${n.id}`)} accessibilityRole="button">
          <View style={styles.flex}>
            <Text style={styles.rowTitle} numberOfLines={1}>{n.title}</Text>
            <Text style={styles.dim}>{day(n.startedAt)}</Text>
          </View>
          <Text style={styles.rowAmt}>{n.unpaid > 0 ? `${money(n.unpaid)} to pay` : 'square'}</Text>
        </Tap>
      ))}

      <Text style={styles.h2}>Past nights</Text>
      {past.map(n => (
        <Tap key={n.id} style={styles.row} onPress={() => router.push(`/night/${n.id}`)} accessibilityRole="button">
          <Text style={[styles.rowTitle, styles.flex]} numberOfLines={1}>{n.title}</Text>
          <Text style={styles.dim}>{day(n.startedAt)}</Text>
        </Tap>
      ))}
      {past.length === 0 && <Text style={styles.dim}>Closed nights land here.</Text>}

      <NameModal
        visible={naming}
        initial={groupName}
        title="Name the group"
        placeholder="The Group"
        maxLength={30}
        onDone={rename}
        onClose={() => setNaming(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: PAD, gap: 14 },
  flex: { flex: 1 },
  tonight: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg, borderWidth: 3, borderColor: theme.color.accent, paddingHorizontal: 14, paddingVertical: 10,
  },
  tonightKicker: { ...theme.type.label, fontSize: theme.font.small, color: theme.color.accent },
  tonightTitle: { ...theme.type.title, color: theme.color.ink },
  tonightTab: { ...theme.type.big, fontSize: theme.font.title, color: theme.color.ink },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  groupName: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: theme.tap, flexShrink: 1 },
  groupText: { ...theme.type.display, fontSize: 32, color: theme.color.ink, flexShrink: 1 },
  pen: { ...theme.type.body, color: theme.color.inkDim },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  card: {
    backgroundColor: theme.color.surface, borderRadius: theme.radius.lg, paddingTop: 14, paddingBottom: 12,
    paddingHorizontal: 8, alignItems: 'center', gap: 6, minHeight: 180,
  },
  cardName: { ...theme.type.title, fontSize: 26 },
  side: { ...theme.type.small, color: theme.color.inkDim },
  sideIn: { ...theme.type.smallBold, color: theme.color.owed },
  sideOut: { ...theme.type.smallBold, color: theme.color.owes },
  addCard: { backgroundColor: 'transparent', borderWidth: 2, borderStyle: 'dashed', borderColor: theme.color.line, justifyContent: 'center' },
  plus: { ...theme.type.hero, fontSize: 48, color: theme.color.inkDim },
  addText: { ...theme.type.bodyBold, color: theme.color.inkDim },
  start: { minHeight: 80 },
  h2: { ...theme.type.title, color: theme.color.ink, marginTop: 4 },
  dim: { ...theme.type.small, color: theme.color.inkDim },
  row: {
    minHeight: theme.tap, backgroundColor: theme.color.surface, borderRadius: theme.radius.md, paddingHorizontal: 16, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  rowTitle: { ...theme.type.bodyBold, color: theme.color.ink },
  rowAmt: { ...theme.type.smallBold, color: theme.color.accent },
});
