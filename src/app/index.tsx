import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link, router, Stack, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { formatMoney as money } from '../core/money';
import { listCrew, listOpenNights, listPastNights, type Night, type OpenNight, type Person } from '../db/repo';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { guarded } from '../ui/oops';
import { Enter, Tap } from '../ui/Tap';
import { theme } from '../ui/theme';

const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export default function Home() {
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const [open, setOpen] = useState<OpenNight[]>([]);
  const [past, setPast] = useState<Night[]>([]);
  const [crew, setCrew] = useState<Person[]>([]);

  useFocusEffect(useCallback(() => {
    guarded("Couldn't load the board", async () => {
      setOpen(await listOpenNights(db));
      setPast(await listPastNights(db));
      setCrew(await listCrew(db));
    });
  }, [db]));

  return (
    <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 20 + insets.bottom }]}>
      <Stack.Screen options={{ title: 'Rounds' }} />

      <Button label="Start a night" onPress={() => router.push('/night/new')} style={styles.start} />

      {open.length > 0 && <Text style={styles.h2}>Still open</Text>}
      {open.map((n, i) => (
        <Enter key={n.id} index={i}>
          <Tap
            style={styles.open}
            ring={theme.color.accent}
            onPress={() => router.push(`/night/${n.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`${n.title}, ${day(n.startedAt)}, ${n.unpaid > 0 ? `${money(n.unpaid)} still to pay` : 'nobody owes anything'}`}
          >
            <View style={styles.flex}>
              <Text style={styles.openTitle} numberOfLines={1}>{n.title}</Text>
              <Text style={styles.openDay}>{day(n.startedAt)}</Text>
            </View>
            <View style={styles.right}>
              <Text style={styles.unpaid} numberOfLines={1} adjustsFontSizeToFit>{n.unpaid > 0 ? money(n.unpaid) : 'Square'}</Text>
              <Text style={styles.openDay}>{n.unpaid > 0 ? 'still to pay' : 'close it when done'}</Text>
            </View>
          </Tap>
        </Enter>
      ))}

      <View style={styles.rowHead}>
        <Text style={styles.h2}>The crew</Text>
        <Link href="/crew" style={styles.link} accessibilityRole="button">Edit</Link>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.crew}>
        {crew.map(p => <Avatar key={p.id} person={p} size={56} showName />)}
        {crew.length === 0 && <Text style={styles.dim}>No one yet. Add your friends under Edit.</Text>}
      </ScrollView>

      <Text style={styles.h2}>Past nights</Text>
      {past.map((n, i) => (
        <Enter key={n.id} index={open.length + i}>
          <Tap style={styles.pastRow} onPress={() => router.push(`/night/${n.id}`)} accessibilityRole="button">
            <Text style={styles.pastTitle} numberOfLines={1}>{n.title}</Text>
            <Text style={styles.dim}>{day(n.startedAt)}</Text>
          </Tap>
        </Enter>
      ))}
      {past.length === 0 && <Text style={styles.dim}>Closed nights land here.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 16 },
  start: { minHeight: 96 },
  flex: { flex: 1 },
  open: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 84, backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg, borderWidth: 3, borderColor: theme.color.accent, paddingHorizontal: 18, paddingVertical: 14,
  },
  openTitle: { ...theme.type.title, color: theme.color.ink },
  openDay: { ...theme.type.small, color: theme.color.inkDim },
  right: { alignItems: 'flex-end', maxWidth: '50%' },
  unpaid: { ...theme.type.title, color: theme.color.accent, fontVariant: ['tabular-nums'] },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  h2: { ...theme.type.title, color: theme.color.ink },
  link: { ...theme.type.bodyBold, color: theme.color.accent, minWidth: theme.tap, minHeight: theme.tap, textAlign: 'center', textAlignVertical: 'center' },
  crew: { gap: 12 },
  dim: { ...theme.type.body, color: theme.color.inkDim },
  pastRow: {
    minHeight: theme.tap, backgroundColor: theme.color.surface, borderRadius: theme.radius.md, padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12,
  },
  pastTitle: { ...theme.type.bodyBold, color: theme.color.ink, flex: 1 },
});
