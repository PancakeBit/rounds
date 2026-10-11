import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { addPerson, listCrew, startNight, type Person } from '../../db/repo';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { guarded } from '../../ui/oops';
import { CREW_COLORS, CREW_EMOJI, theme } from '../../ui/theme';

function defaultTitle() {
  return `${new Date().toLocaleDateString(undefined, { weekday: 'long' })} night`;
}

export default function NewNight() {
  const db = useSQLiteContext();
  const [crew, setCrew] = useState<Person[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [title, setTitle] = useState(defaultTitle);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    guarded("Couldn't load the crew", async () => setCrew(await listCrew(db)));
  }, [db]));

  function toggle(id: number) {
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function quickAdd() {
    const name = newName.trim();
    if (!name) return;
    const i = crew.length;
    const id = await guarded("Couldn't add them", async () => {
      const newId = await addPerson(db, { name, emoji: CREW_EMOJI[i % CREW_EMOJI.length], color: CREW_COLORS[i % CREW_COLORS.length] });
      setCrew(await listCrew(db));
      return newId;
    });
    if (id === undefined) return;
    setPicked(prev => new Set(prev).add(id));
    setNewName('');
  }

  async function go() {
    if (busy) return;
    setBusy(true);
    const id = await guarded("Couldn't start the night", () => startNight(db, title, [...picked]));
    setBusy(false);
    if (id === undefined) return;
    router.replace(`/night/${id}/lineup?phase=start`);
  }

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'New night' }} />
      <TextInput value={title} onChangeText={setTitle} style={styles.title} maxLength={40} accessibilityLabel="Night name" />
      <Text style={styles.h2}>Who's out?</Text>
      <View style={styles.grid}>
        {crew.map(p => (
          <Pressable
            key={p.id}
            onPress={() => toggle(p.id)}
            accessibilityRole="checkbox"
            accessibilityLabel={p.name}
            accessibilityState={{ checked: picked.has(p.id) }}
            style={[styles.pick, picked.has(p.id) && styles.picked]}
          >
            <Avatar person={p} size={56} showName dimmed={!picked.has(p.id)} />
          </Pressable>
        ))}
      </View>
      {crew.length === 0 && <Text style={styles.dim}>No one in the crew yet. Add a name below.</Text>}
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
        <Button kind="ghost" label="Add" onPress={quickAdd} disabled={!newName.trim()} />
      </View>
      <Button label={`Let's go (${picked.size})`} onPress={go} disabled={picked.size < 2 || busy} style={styles.go} />
      {picked.size < 2 && <Text style={styles.dim}>Pick at least two people.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 16 },
  title: { ...theme.type.display, color: theme.color.ink, minHeight: theme.tap },
  h2: { ...theme.type.title, color: theme.color.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  pick: { minWidth: theme.tap, minHeight: theme.tap, padding: 8, borderRadius: theme.radius.md, borderWidth: 3, borderColor: 'transparent' },
  picked: { borderColor: theme.color.accent },
  addRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  input: {
    flex: 1, minHeight: theme.tap, ...theme.type.body, color: theme.color.ink, backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md, paddingHorizontal: 16,
  },
  go: { minHeight: 72 },
  dim: { ...theme.type.small, color: theme.color.inkDim, textAlign: 'center' },
});
