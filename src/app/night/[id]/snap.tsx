import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Tap } from '../../../ui/Tap';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSQLiteContext } from 'expo-sqlite';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getNight, setGroupPhoto, setMemberPhoto } from '../../../db/repo';
import { dropFile, keepPhoto, type Phase } from '../../../photos/store';
import { Button } from '../../../ui/Button';
import { guarded } from '../../../ui/oops';
import { theme } from '../../../ui/theme';

// /night/[id]/snap?personId=3&phase=start   one face: front camera, chalk circle to aim at
// /night/[id]/snap?group=1                    the group shot: back camera, full frame
export default function Snap() {
  const params = useLocalSearchParams<{ id: string; personId?: string; phase?: string; group?: string }>();
  const nightId = Number(params.id);
  const isGroup = params.group === '1';
  const personId = Number(params.personId);
  const phase: Phase = params.phase === 'end' ? 'end' : 'start';
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const cam = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>(isGroup ? 'back' : 'front');
  const [who, setWho] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isGroup) return;
    guarded("Couldn't load that photo screen", async () => {
      const d = await getNight(db, nightId);
      setWho(d?.members.find(m => m.id === personId)?.name ?? '');
    });
  }, [db, nightId, personId, isGroup]);

  const title = isGroup ? 'Group shot' : who;

  if (!permission) return <View style={styles.screen} />;
  if (!permission.granted) {
    return (
      <View style={[styles.screen, styles.ask]}>
        <Stack.Screen options={{ title }} />
        <Text style={styles.askText}>Rounds needs the camera for this. Photos stay on this phone.</Text>
        {permission.canAskAgain ? (
          <Button label="Allow camera" onPress={requestPermission} />
        ) : (
          <Text style={styles.dim}>Camera access is off for Rounds. Turn it on in Android settings, or skip: faces stay emoji.</Text>
        )}
        <Button kind="ghost" label="Skip, keep the emoji" onPress={() => router.back()} />
      </View>
    );
  }

  async function shoot() {
    if (busy || !cam.current) return;
    setBusy(true);
    setError(null);
    try {
      const pic = await cam.current.takePictureAsync({ quality: 0.7 });
      if (!pic) throw new Error('The camera came back empty. Try again.');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const data = await getNight(db, nightId);
      if (!data) throw new Error('That night no longer exists');
      if (isGroup) {
        const uri = await keepPhoto(nightId, { kind: 'group' }, pic.uri);
        await setGroupPhoto(db, nightId, uri);
        dropFile(data.night.groupPhoto);
      } else {
        const m = data.members.find(x => x.id === personId);
        if (!m) throw new Error("They aren't in this night");
        const uri = await keepPhoto(nightId, { kind: 'person', personId, phase }, pic.uri);
        await setMemberPhoto(db, nightId, personId, phase, uri);
        dropFile(phase === 'start' ? m.photoStart : m.photoEnd);
      }
      router.back();
    } catch (e) {
      // Shown on screen so the failure is never silent; the shutter works again for a retry.
      setError(((e as Error)?.message ?? String(e)) + ' Try again.');
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title }} />
      <CameraView ref={cam} style={StyleSheet.absoluteFill} facing={facing} />
      {!isGroup && (
        <View style={styles.aim}>
          <View style={styles.ring} />
        </View>
      )}
      <View style={[styles.controls, { bottom: 32 + insets.bottom }]}>
        {error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.row}>
          <View style={styles.side} />
          <Tap
            onPress={shoot}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Take the photo"
            style={[styles.shutter, busy && styles.shutterDown]}
          />
          <View style={styles.side}>
            <Button kind="dark" label="Flip" onPress={() => setFacing(f => (f === 'front' ? 'back' : 'front'))} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  ask: { padding: 24, gap: 16, justifyContent: 'center' },
  askText: { ...theme.type.title, color: theme.color.ink },
  dim: { ...theme.type.body, color: theme.color.inkDim },
  aim: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  ring: { width: 260, height: 260, borderRadius: 130, borderWidth: 4, borderColor: theme.color.ink, opacity: 0.9 },
  controls: { position: 'absolute', left: 0, right: 0, gap: 12, paddingHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { width: 96 },
  shutter: { width: 84, height: 84, borderRadius: 42, backgroundColor: theme.color.ink, borderWidth: 6, borderColor: theme.color.bg },
  shutterDown: { transform: [{ translateY: 2 }], opacity: 0.7 },
  error: { ...theme.type.bodyBold, color: theme.color.owes, backgroundColor: theme.color.bg, padding: 10, borderRadius: theme.radius.md, textAlign: 'center' },
});
