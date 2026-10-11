import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link, router, Stack, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { getActiveNight, listCrew, listPastNights, type Night, type Person } from '../db/repo';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { guarded } from '../ui/oops';
import { theme } from '../ui/theme';

export default function Home() {
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const [active, setActive] = useState<Night | null>(null);
  const [past, setPast] = useState<Night[]>([]);
  const [crew, setCrew] = useState<Person[]>([]);

  useFocusEffect(useCallback(() => {
    guarded("Couldn't load the board", async () => {
      setActive(await getActiveNight(db));
      setPast(await listPastNights(db));
      setCrew(await listCrew(db));
    });
  }, [db]));

  return (
    <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 20 + insets.bottom }]}>
      <Stack.Screen options={{ title: 'Rounds', headerRight: () => <Link href="/settings" style={styles.gear} accessibilityRole="button" accessibilityLabel="Settings">⚙️</Link> }} />

      {active ? (
        <Pressable style={styles.active} onPress={() => router.push(`/night/${active.id}`)}>
          <Text style={styles.kicker}>TONIGHT</Text>
          <Text style={styles.activeTitle}>{active.title}</Text>
          <Text style={styles.activeHint}>Tap to jump back in</Text>
        </Pressable>
      ) : (
        <Button label="Start a night" onPress={() => router.push('/night/new')} style={styles.start} />
      )}

      <View style={styles.rowHead}>
        <Text style={styles.h2}>The crew</Text>
        <Link href="/crew" style={styles.link} accessibilityRole="button">Edit</Link>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.crew}>
        {crew.map(p => <Avatar key={p.id} person={p} size={56} showName />)}
        {crew.length === 0 && <Text style={styles.dim}>No one yet. Add your friends under Edit.</Text>}
      </ScrollView>

      <Text style={styles.h2}>Past nights</Text>
      {past.map(n => (
        <Pressable key={n.id} style={styles.pastRow} onPress={() => router.push(`/night/${n.id}`)}>
          <Text style={styles.pastTitle}>{n.title}</Text>
          <Text style={styles.dim}>{new Date(n.startedAt).toLocaleDateString()}</Text>
        </Pressable>
      ))}
      {past.length === 0 && <Text style={styles.dim}>Nothing yet. Tonight could be the first.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 16 },
  gear: { fontSize: 26, minWidth: theme.tap, minHeight: theme.tap, textAlign: 'center', textAlignVertical: 'center' },
  start: { minHeight: 96 },
  active: { backgroundColor: theme.color.accent, borderRadius: theme.radius.lg, padding: 24 },
  kicker: { ...theme.type.label, color: theme.color.bg },
  activeTitle: { ...theme.type.display, color: theme.color.bg },
  activeHint: { ...theme.type.body, color: theme.color.bg },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  h2: { ...theme.type.title, color: theme.color.ink },
  link: { ...theme.type.bodyBold, color: theme.color.accent, minWidth: theme.tap, minHeight: theme.tap, textAlign: 'center', textAlignVertical: 'center' },
  crew: { gap: 12 },
  dim: { ...theme.type.body, color: theme.color.inkDim },
  pastRow: {
    minHeight: theme.tap, backgroundColor: theme.color.surface, borderRadius: theme.radius.md, padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  pastTitle: { ...theme.type.bodyBold, color: theme.color.ink },
});
