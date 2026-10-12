import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Tap } from '../ui/Tap';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { addPerson, listCrew, listPayMethods, updatePerson, type Person } from '../db/repo';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { guarded } from '../ui/oops';
import { CREW_COLORS, CREW_EMOJI, theme } from '../ui/theme';

const lookAt = (i: number) => ({ emoji: CREW_EMOJI[i % CREW_EMOJI.length], color: CREW_COLORS[i % CREW_COLORS.length] });

export default function Crew() {
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const [people, setPeople] = useState<Person[]>([]);
  const [name, setName] = useState('');
  const [look, setLook] = useState(0);
  const [rev, setRev] = useState(0);
  const [ways, setWays] = useState<Map<number, string[]>>(new Map());

  const load = useCallback(async () => {
    await guarded("Couldn't load the crew", async () => {
      const crew = await listCrew(db, true);
      const pm = await listPayMethods(db, crew.map(p => p.id));
      setPeople(crew);
      setWays(new Map([...pm].map(([id, ms]) => [id, ms.map(m => m.label)])));
    });
  }, [db]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function add() {
    if (!name.trim()) return;
    const newId = await guarded("Couldn't save that", () => addPerson(db, { name, ...lookAt(look) }));
    if (newId === undefined) return;
    setName('');
    setLook(l => l + 1);
    load();
    router.push(`/person/${newId}/edit`); // straight on to how to pay them, which they can skip
  }

  async function reshuffle(p: Person) {
    const i = CREW_EMOJI.indexOf(p.emoji);
    await guarded("Couldn't update the crew", () => updatePerson(db, p.id, { name: p.name, ...lookAt(i + 1) }));
    load();
  }

  async function rename(p: Person, next: string) {
    if (!next.trim() || next.trim() === p.name) { await load(); setRev(r => r + 1); return; }
    const ok = await guarded("Couldn't update the crew", async () => { await updatePerson(db, p.id, { name: next, emoji: p.emoji, color: p.color }); return true; });
    await load();
    if (!ok) setRev(r => r + 1);
  }

  return (
    <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 20 + insets.bottom }]} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'The crew' }} />
      <View style={styles.addRow}>
        <Tap style={styles.shuffle} accessibilityRole="button" onPress={() => setLook(l => l + 1)} accessibilityLabel="Shuffle emoji and colour">
          <Avatar person={{ name, ...lookAt(look) }} size={56} />
        </Tap>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Friend's name"
          placeholderTextColor={theme.color.inkDim}
          style={styles.input}
          maxLength={20}
          returnKeyType="done"
          onSubmitEditing={add}
        />
        <Button label="Add" onPress={add} disabled={!name.trim()} />
      </View>
      <Text style={styles.dim}>Tap a face to shuffle it. Tap a name to rename. Details for ways to pay them.</Text>

      {people.map(p => (
        <View key={p.id} style={styles.row}>
          <Tap style={styles.shuffle} accessibilityRole="button" onPress={() => reshuffle(p)} accessibilityLabel={`Shuffle ${p.name}'s look`}>
            <Avatar person={p} dimmed={p.archived} />
          </Tap>
          <View style={styles.flex}>
            <TextInput
              key={`${p.id}-${rev}`}
              defaultValue={p.name}
              onEndEditing={e => rename(p, e.nativeEvent.text)}
              style={[styles.name, p.archived && styles.dimName]}
              maxLength={20}
            />
            <Text style={styles.ways} numberOfLines={1}>
              {p.archived ? 'Retired' : ways.get(p.id)?.length ? ways.get(p.id)!.join(' · ') : 'No ways to pay yet'}
            </Text>
          </View>
          <Button kind="ghost" label="Details" onPress={() => router.push(`/person/${p.id}/edit`)} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 14 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  input: {
    flex: 1, minHeight: theme.tap, ...theme.type.body, color: theme.color.ink, backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md, paddingHorizontal: 16,
  },
  shuffle: { minWidth: theme.tap, minHeight: theme.tap, alignItems: 'center', justifyContent: 'center' },
  dim: { ...theme.type.small, color: theme.color.inkDim },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  name: { ...theme.type.bodyBold, color: theme.color.ink, minHeight: 44, paddingVertical: 0 },
  ways: { ...theme.type.small, color: theme.color.inkDim },
  dimName: { color: theme.color.inkDim },
});
