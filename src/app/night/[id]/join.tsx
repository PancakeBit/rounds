import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Tap } from '../../../ui/Tap';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { addNightMember, addPerson, getNight, listCrew, type Person } from '../../../db/repo';
import { Avatar } from '../../../ui/Avatar';
import { Button } from '../../../ui/Button';
import { guarded } from '../../../ui/oops';
import { CREW_COLORS, CREW_EMOJI, theme } from '../../../ui/theme';

export default function JoinNight() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const nightId = Number(id);
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const [loaded, setLoaded] = useState(false);
  const [closed, setClosed] = useState(false);
  const [candidates, setCandidates] = useState<Person[]>([]);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  useFocusEffect(useCallback(() => {
    guarded("Couldn't load the crew", async () => {
      const data = await getNight(db, nightId);
      if (!data) return;
      const inIds = new Set(data.members.map(m => m.id));
      const crew = await listCrew(db);
      setClosed(data.night.endedAt != null);
      setCandidates(crew.filter(p => !inIds.has(p.id)));
      setLoaded(true);
    });
  }, [db, nightId]));

  // One add at a time. Returns true when the person joined.
  async function run(what: string, fn: () => Promise<unknown>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const ok = await guarded(what, async () => { await fn(); return true; });
    busyRef.current = false;
    setBusy(false);
    if (ok) router.back();
  }

  function addExisting(p: Person) {
    return run("Couldn't add them", () => addNightMember(db, nightId, p.id));
  }

  function quickAdd() {
    const name = newName.trim();
    if (!name) return;
    return run("Couldn't add them", async () => {
      const i = (await listCrew(db, true)).length;
      const pid = await addPerson(db, { name, emoji: CREW_EMOJI[i % CREW_EMOJI.length], color: CREW_COLORS[i % CREW_COLORS.length] });
      await addNightMember(db, nightId, pid);
    });
  }

  if (!loaded) return <Stack.Screen options={{ title: 'Add someone' }} />;

  if (closed) {
    return (
      <View style={[styles.body, { paddingBottom: 20 + insets.bottom }]}>
        <Stack.Screen options={{ title: 'Add someone' }} />
        <Text style={styles.h2}>This night is closed.</Text>
        <Button label="Back" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 20 + insets.bottom }]} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Add someone' }} />
      <Text style={styles.lead}>Late to the party? Tap them in. They only share what gets paid from now on.</Text>
      <View style={styles.grid}>
        {candidates.map(p => (
          <Tap
            key={p.id}
            onPress={() => addExisting(p)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Add ${p.name} to tonight`}
            style={styles.pick}
          >
            <Avatar person={p} size={56} showName />
          </Tap>
        ))}
      </View>
      {candidates.length === 0 && <Text style={styles.dim}>Everyone's already here.</Text>}
      <View style={styles.addRow}>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="Someone new? Name"
          placeholderTextColor={theme.color.inkDim}
          style={styles.input}
          maxLength={20}
          returnKeyType="done"
          onSubmitEditing={quickAdd}
          accessibilityLabel="New friend's name"
        />
        <Button kind="ghost" label="Add" onPress={quickAdd} disabled={!newName.trim() || busy} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 16 },
  lead: { ...theme.type.body, color: theme.color.ink },
  h2: { ...theme.type.title, color: theme.color.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  pick: { minWidth: theme.tap, minHeight: theme.tap, padding: 8, borderRadius: theme.radius.md, borderWidth: 3, borderColor: 'transparent' },
  addRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  input: {
    flex: 1, minHeight: theme.tap, ...theme.type.body, color: theme.color.ink, backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md, paddingHorizontal: 16,
  },
  dim: { ...theme.type.small, color: theme.color.inkDim, textAlign: 'center' },
});
