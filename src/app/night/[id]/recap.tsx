import { useCallback, useRef, useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { nightBalances } from '../../../core/balances';
import { settle } from '../../../core/settle';
import { nightStats } from '../../../core/stats';
import { nightSummary } from '../../../core/summary';
import {
  getNight, listExpenses, listSettlements, type Expense, type Night, type NightMember, type Settlement,
} from '../../../db/repo';
import { useMoney } from '../../../state/settings';
import { Button } from '../../../ui/Button';
import { guarded, oops } from '../../../ui/oops';
import { RecapCard } from '../../../ui/RecapCard';
import { theme } from '../../../ui/theme';

export default function Recap() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const nightId = Number(id);
  const db = useSQLiteContext();
  const money = useMoney();
  const card = useRef<View>(null);
  const [night, setNight] = useState<Night | null>(null);
  const [members, setMembers] = useState<NightMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [paid, setPaid] = useState<Settlement[]>([]);
  const [showFaces, setShowFaces] = useState(true);
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
    });
  }, [db, nightId]));

  async function share() {
    if (busy.current) return;
    busy.current = true;
    try {
      const uri = await captureRef(card, { format: 'png', quality: 1 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Send to the group' });
    } catch (e) {
      oops(e, "Couldn't share the recap");
    } finally {
      busy.current = false;
    }
  }

  async function shareText() {
    if (!night || busy.current) return;
    busy.current = true;
    try {
      // Worked out fresh, so it is right even mid-night before anyone has opened Settle up.
      const open = settle(nightBalances(members.map(m => m.id), expenses, paid));
      const message = nightSummary({
        title: night.title,
        date: new Date(night.startedAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
        memberIds: members.map(m => m.id),
        names: new Map(members.map(m => [m.id, m.name])),
        expenses,
        paid,
        open,
        money,
      });
      await Share.share({ message });
    } catch (e) {
      oops(e, "Couldn't share the text");
    } finally {
      busy.current = false;
    }
  }

  if (!night) return null;
  const hasPhotos = night.groupPhoto != null || members.some(m => m.photoStart || m.photoEnd);
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Stack.Screen options={{ title: 'Recap' }} />
      <View ref={card} collapsable={false} style={styles.capture}>
        <RecapCard night={night} stats={nightStats(expenses)} members={members} money={money} showFaces={showFaces} />
      </View>
      {hasPhotos && (
        <Button kind="ghost" label={showFaces ? 'Hide faces' : 'Show faces'} onPress={() => setShowFaces(v => !v)} />
      )}
      <Button label="Send to the group" onPress={share} style={styles.share} />
      <Button kind="ghost" label="Send as text" onPress={shareText} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 12 },
  capture: { backgroundColor: theme.color.bg, padding: 8 },
  share: { minHeight: 64 },
});
