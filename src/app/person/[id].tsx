import { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import { listCrew, listPayMethods, savePayMethods, setArchived, updatePerson, type PayMethod, type Person } from '../../db/repo';
import { pickPicture } from '../../photos/pick';
import { dropFile, keepPicture } from '../../photos/store';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { ImageViewer } from '../../ui/ImageViewer';
import { guarded } from '../../ui/oops';
import { Enter, Tap } from '../../ui/Tap';
import { CREW_COLORS, CREW_EMOJI, theme } from '../../ui/theme';

type Draft = PayMethod & { key: number };

// One friend: their name and look, and how to pay them (GCash, a bank, anything they type, with an optional QR).
export default function PersonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const personId = Number(id);
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [person, setPerson] = useState<Person | null>(null);
  const [name, setName] = useState('');
  const [look, setLook] = useState({ emoji: '', color: '' });
  const [methods, setMethods] = useState<Draft[]>([]);
  const [viewing, setViewing] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false); // a double tap must not save twice and go back two screens
  const nextKey = useRef(1);
  // QR pictures picked on this visit; any not saved are deleted when leaving.
  const fresh = useRef(new Set<string>());
  const draft = (m: PayMethod): Draft => ({ ...m, key: nextKey.current++ });

  useEffect(() => {
    guarded("Couldn't load them", async () => {
      const p = (await listCrew(db, true)).find(x => x.id === personId);
      if (!p) return;
      setPerson(p);
      setName(p.name);
      setLook({ emoji: p.emoji, color: p.color });
      const pm = (await listPayMethods(db, [personId])).get(personId) ?? [];
      setMethods(pm.length ? pm.map(draft) : [draft({ label: '', number: '', qrUri: null })]);
    });
    const picked = fresh.current;
    return () => { for (const u of picked) dropFile(u); };
  }, [db, personId]);

  const edit = (key: number, patch: Partial<Draft>) => setMethods(ms => ms.map(m => (m.key === key ? { ...m, ...patch } : m)));

  function shuffle() {
    const i = CREW_EMOJI.indexOf(look.emoji);
    setLook({ emoji: CREW_EMOJI[(i + 1) % CREW_EMOJI.length], color: CREW_COLORS[(i + 1) % CREW_COLORS.length] });
  }

  async function addQr(m: Draft) {
    const uri = await pickPicture('Add a QR code');
    if (!uri) return;
    const kept = await guarded("Couldn't keep that picture", () => keepPicture({ kind: 'qr', personId }, uri));
    if (!kept) return;
    fresh.current.add(kept);
    edit(m.key, { qrUri: kept });
  }

  async function save() {
    if (busy.current || !person) return;
    busy.current = true;
    setSaving(true);
    const ok = await guarded("Couldn't save that", async () => {
      await updatePerson(db, personId, { name, emoji: look.emoji, color: look.color });
      const unused = await savePayMethods(db, personId, methods);
      for (const u of unused) dropFile(u);
      return true;
    });
    setSaving(false);
    if (!ok) {
      busy.current = false;
      return;
    }
    // Saved pictures are no longer "fresh"; whatever was picked then dropped from the list still is.
    const kept = new Set(methods.map(m => m.qrUri));
    for (const u of [...fresh.current]) if (kept.has(u)) fresh.current.delete(u);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }

  async function retire() {
    if (busy.current || !person) return;
    busy.current = true;
    const ok = await guarded("Couldn't update the crew", async () => { await setArchived(db, personId, !person.archived); return true; });
    if (!ok) {
      busy.current = false;
      return;
    }
    router.back();
  }

  if (!person) return null;
  const changedLook = { ...person, name: name || person.name, ...look };

  return (
    <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 32 + insets.bottom }]} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: person.name }} />
      <View style={styles.top}>
        <Tap onPress={shuffle} accessibilityRole="button" accessibilityLabel="Shuffle emoji and colour" style={styles.shuffle}>
          <Avatar person={changedLook} size={72} />
        </Tap>
        <TextInput
          value={name}
          onChangeText={setName}
          style={[styles.name, { color: look.color }]}
          maxLength={20}
          accessibilityLabel="Name"
        />
      </View>
      <Text style={styles.dim}>Tap the face to shuffle it.</Text>

      <Text style={styles.h2}>Ways to pay {person.name}</Text>
      <Text style={styles.dim}>Whatever they use: GCash, Maya, a bank. Shown on Settle up whenever someone owes them.</Text>
      {methods.map(m => (
        <Enter key={m.key} index={0} style={styles.card}>
          <View style={styles.row}>
            <TextInput
              value={m.label}
              onChangeText={label => edit(m.key, { label })}
              placeholder="GCash"
              placeholderTextColor={theme.color.inkDim}
              style={[styles.input, styles.label]}
              maxLength={24}
              accessibilityLabel="Name of this way to pay"
            />
            <Tap
              onPress={() => setMethods(ms => (ms.length > 1 ? ms.filter(x => x.key !== m.key) : [draft({ label: '', number: '', qrUri: null })]))}
              ring={theme.color.owes}
              style={styles.remove}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${m.label || 'this way to pay'}`}
            >
              <Text style={styles.removeText}>×</Text>
            </Tap>
          </View>
          <TextInput
            value={m.number}
            onChangeText={number => edit(m.key, { number })}
            placeholder="0917 123 4567"
            placeholderTextColor={theme.color.inkDim}
            style={[styles.input, styles.number]}
            maxLength={40}
            accessibilityLabel={`${m.label || 'Account'} number`}
          />
          {m.qrUri ? (
            <View style={styles.qrRow}>
              <Tap onPress={() => setViewing(m)} accessibilityRole="imagebutton" accessibilityLabel="Show the QR code" style={styles.qrThumb}>
                <Image source={{ uri: m.qrUri }} style={styles.qrImg} />
              </Tap>
              <Button kind="ghost" label="Change QR" onPress={() => addQr(m)} />
              <Button kind="ghost" label="Remove QR" onPress={() => edit(m.key, { qrUri: null })} />
            </View>
          ) : (
            <Button kind="ghost" label="+ Add QR code" onPress={() => addQr(m)} />
          )}
        </Enter>
      ))}
      <Button kind="ghost" label="+ Add a way to pay" onPress={() => setMethods(ms => [...ms, draft({ label: '', number: '', qrUri: null })])} />

      <Button label="Save" onPress={save} disabled={saving || !name.trim()} style={styles.save} />
      <Button kind="ghost" label={person.archived ? 'Bring them back' : 'Retire from the crew'} onPress={retire} />
      <ImageViewer uri={viewing?.qrUri ?? null} caption={viewing ? `${viewing.label} ${viewing.number}`.trim() : undefined} onClose={() => setViewing(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  shuffle: { minWidth: theme.tap, minHeight: theme.tap, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, ...theme.type.display, minHeight: theme.tap, borderBottomWidth: 3, borderColor: theme.color.line },
  h2: { ...theme.type.title, color: theme.color.ink, marginTop: 8 },
  dim: { ...theme.type.small, color: theme.color.inkDim, marginTop: -6 },
  card: { backgroundColor: theme.color.surface, borderRadius: theme.radius.md, padding: 12, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { minHeight: theme.tap, color: theme.color.ink, borderBottomWidth: 2, borderColor: theme.color.line, paddingHorizontal: 4 },
  label: { flex: 1, ...theme.type.title },
  number: { ...theme.type.bodyBold, fontVariant: ['tabular-nums'] },
  remove: { width: 44, height: theme.tap, alignItems: 'center', justifyContent: 'center' },
  removeText: { ...theme.type.big, color: theme.color.inkDim },
  qrRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  qrThumb: { width: 72, height: 72, borderRadius: theme.radius.sm, overflow: 'hidden', backgroundColor: theme.color.bg },
  qrImg: { width: 72, height: 72 },
  save: { minHeight: 72, marginTop: 8 },
});
