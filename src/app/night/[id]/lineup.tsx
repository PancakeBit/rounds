import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { getNight, setGroupPhoto, setMemberPhoto, type Night, type NightMember } from '../../../db/repo';
import { dropFile, type Phase } from '../../../photos/store';
import { Avatar } from '../../../ui/Avatar';
import { Button } from '../../../ui/Button';
import { guarded } from '../../../ui/oops';
import { theme } from '../../../ui/theme';

// /night/[id]/lineup?phase=start            straight after "Let's go"; Done goes to the scoreboard
// /night/[id]/lineup?phase=end              from ALL SQUARE; Done goes to the recap
// add &then=back to return to wherever it was opened from instead
export default function Lineup() {
  const params = useLocalSearchParams<{ id: string; phase?: string; then?: string }>();
  const nightId = Number(params.id);
  const phase: Phase = params.phase === 'end' ? 'end' : 'start';
  const db = useSQLiteContext();
  const [night, setNight] = useState<Night | null>(null);
  const [members, setMembers] = useState<NightMember[]>([]);

  const load = useCallback(async () => {
    await guarded("Couldn't load the line-up", async () => {
      const data = await getNight(db, nightId);
      if (!data) return;
      setNight(data.night);
      setMembers(data.members);
    });
  }, [db, nightId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const photoOf = (m: NightMember) => (phase === 'start' ? m.photoStart : m.photoEnd);
  const taken = members.filter(photoOf).length + (phase === 'end' && night?.groupPhoto ? 1 : 0);

  async function clear(m: NightMember) {
    const old = photoOf(m);
    if (!old) return;
    const ok = await guarded("Couldn't clear that photo", async () => {
      await setMemberPhoto(db, nightId, m.id, phase, null);
      return true;
    });
    if (!ok) return;
    dropFile(old);
    load();
  }
  async function clearGroup() {
    const old = night?.groupPhoto;
    if (!old) return;
    const ok = await guarded("Couldn't clear the group shot", async () => {
      await setGroupPhoto(db, nightId, null);
      return true;
    });
    if (!ok) return;
    dropFile(old);
    load();
  }

  function done() {
    if (params.then === 'back') router.back();
    else router.replace(phase === 'start' ? `/night/${nightId}` : `/night/${nightId}/recap`);
  }

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Stack.Screen options={{ title: phase === 'start' ? 'The line-up' : 'One more for the board' }} />
      <Text style={styles.lead}>
        {phase === 'start'
          ? 'Snap everyone before the first round. Tap a face and pass the phone.'
          : 'Same faces, a few rounds later. Tap a face, take a group shot, or both.'}
      </Text>
      <View style={styles.grid}>
        {members.map(m => (
          <Pressable
            key={m.id}
            onPress={() => router.push(`/night/${nightId}/snap?personId=${m.id}&phase=${phase}`)}
            onLongPress={() => clear(m)}
            accessibilityRole="button"
            accessibilityLabel={`${photoOf(m) ? 'Retake' : 'Take'} ${m.name}'s photo`}
            accessibilityHint={photoOf(m) ? 'Hold to go back to the emoji' : undefined}
            style={styles.cell}
          >
            <Avatar person={m} photo={photoOf(m)} size={96} showName />
          </Pressable>
        ))}
      </View>
      {phase === 'end' && (
        <Pressable
          onPress={() => router.push(`/night/${nightId}/snap?group=1`)}
          onLongPress={clearGroup}
          accessibilityRole="button"
          accessibilityLabel={night?.groupPhoto ? 'Retake the group shot' : 'Take a group shot'}
          accessibilityHint={night?.groupPhoto ? 'Hold to remove it' : undefined}
          style={styles.group}
        >
          {night?.groupPhoto ? (
            <Image source={{ uri: night.groupPhoto }} style={styles.groupImg} accessibilityIgnoresInvertColors />
          ) : (
            <Text style={styles.groupText}>Group shot</Text>
          )}
        </Pressable>
      )}
      <Text style={styles.dim}>Tap again to retake · hold a photo to go back to the emoji</Text>
      <Button label={taken > 0 ? 'Done' : 'Skip it'} onPress={done} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 16 },
  lead: { ...theme.type.bodyBold, color: theme.color.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center' },
  cell: { padding: 4, minWidth: theme.tap, minHeight: theme.tap },
  group: {
    minHeight: 120, borderRadius: theme.radius.lg, borderWidth: 2, borderColor: theme.color.line, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  groupImg: { width: '100%', aspectRatio: 4 / 3 },
  groupText: { ...theme.type.big, color: theme.color.ink, textTransform: 'uppercase' },
  dim: { ...theme.type.small, color: theme.color.inkDim, textAlign: 'center' },
});
