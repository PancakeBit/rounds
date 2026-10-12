import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Tap } from '../../../ui/Tap';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import {
  endNight, generateSettlements, getNight, listPayMethods, listSettlements, payPart, setSettlementPaid,
  type NightMember, type PayMethod, type Settlement,
} from '../../../db/repo';
import { formatMoney as money } from '../../../core/money';
import { Avatar } from '../../../ui/Avatar';
import { Button } from '../../../ui/Button';
import { AmountModal } from '../../../ui/AmountModal';
import { AllSquare, Land, Strike } from '../../../ui/chalk';
import { ImageViewer } from '../../../ui/ImageViewer';
import { guarded } from '../../../ui/oops';
import { theme } from '../../../ui/theme';

export default function SettleUp() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const nightId = Number(id);
  const db = useSQLiteContext();
  const [title, setTitle] = useState('');
  const [members, setMembers] = useState<NightMember[]>([]);
  const [rows, setRows] = useState<Settlement[]>([]);
  const [ended, setEnded] = useState(false);
  const [shot, setShot] = useState(false);
  // Every "N to square up" figure shown so far; older ones are drawn struck through.
  const [counts, setCounts] = useState<number[]>([]);
  const [ways, setWays] = useState<Map<number, PayMethod[]>>(new Map());
  const [qr, setQr] = useState<{ uri: string; caption: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [partOf, setPartOf] = useState<Settlement | null>(null);

  const show = useCallback((next: Settlement[]) => {
    setRows(next);
    const left = next.filter(r => r.paidAt == null).length;
    setCounts(prev => (prev.at(-1) === left ? prev : [...prev, left]));
  }, []);

  const [loaded, setLoaded] = useState(false);
  // One in-flight action at a time, so a double tap can't close the night twice.
  const busy = useRef(false);
  const loadedRef = useRef(false);

  // Only marks the night shot once endNight has actually succeeded. Refuses before a good load.
  async function closeNight(): Promise<void> {
    if (!loadedRef.current) return;
    const ok = await guarded("Couldn't close the night", async () => { await endNight(db, nightId); return true; });
    if (!ok) return;
    setEnded(true);
    setShot(true);
  }

  async function finish() {
    if (busy.current || ended || !loadedRef.current) return;
    busy.current = true;
    try { await closeNight(); } finally { busy.current = false; }
  }

  // Regenerating on every focus means edits made since the last visit are reflected,
  // while transfers already ticked as paid are kept and counted.
  const load = useCallback(async () => {
    const result = await guarded("Couldn't load the settle-up", async () => {
      const data = await getNight(db, nightId);
      if (!data) return undefined;
      if (data.night.endedAt == null) await generateSettlements(db, nightId);
      const list = await listSettlements(db, nightId);
      const pm = await listPayMethods(db, data.members.map(m => m.id));
      return { data, list, pm };
    });
    if (!result) return;
    const { data, list, pm } = result;
    setWays(pm);
    setTitle(data.night.title);
    setMembers(data.members);
    setEnded(data.night.endedAt != null);
    show(list);
    loadedRef.current = true;
    setLoaded(true);
  }, [db, nightId, show]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const byId = new Map(members.map(m => [m.id, m]));

  async function toggle(r: Settlement) {
    if (ended || busy.current || !loadedRef.current) return;
    busy.current = true;
    try {
      const next = await guarded("Couldn't tick that off", async () => {
        await setSettlementPaid(db, r.id, r.paidAt == null);
        return listSettlements(db, nightId);
      });
      if (!next) return;
      show(next);
    } finally {
      busy.current = false;
    }
  }

  async function copy(key: string, text: string) {
    const ok = await guarded("Couldn't copy that", () => Clipboard.setStringAsync(text));
    if (!ok) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCopied(key);
    setTimeout(() => setCopied(c => (c === key ? null : c)), 1500);
  }

  async function paidPart(r: Settlement, amount: number) {
    setPartOf(null);
    if (busy.current) return;
    busy.current = true;
    try {
      const next = await guarded("Couldn't save that", async () => {
        await payPart(db, r.id, amount);
        return listSettlements(db, nightId);
      });
      if (next) show(next);
    } finally {
      busy.current = false;
    }
  }

  const allPaid = loaded && !ended && rows.length > 0 && rows.every(r => r.paidAt != null);

  const recent = counts.slice(-3);
  const firstIndex = counts.length - recent.length;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Settle up' }} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 20 + insets.bottom }]}>
        {!loaded ? (
          <Text style={styles.dim}>Loading…</Text>
        ) : rows.length === 0 ? (
          <View style={styles.square}>
            <Text style={styles.big}>Nobody owes anybody.</Text>
            {!ended && <Button kind="go" label="Close the night" onPress={finish} />}
          </View>
        ) : (
          <>
            {!ended && (
              <View style={styles.count}>
                {recent.map((n, i) =>
                  i === recent.length - 1 ? (
                    <Land key={firstIndex + i} trigger={firstIndex + i}>
                      <Text style={styles.countNow}>{n}</Text>
                    </Land>
                  ) : (
                    <View key={firstIndex + i}>
                      <Text style={styles.countOld}>{n}</Text>
                      <Strike thickness={5} />
                    </View>
                  ),
                )}
                <Text style={styles.countWord}>to square up</Text>
              </View>
            )}
            <Text style={styles.dim}>{ended ? 'All square. Everyone paid.' : 'Tick each one when the money moves.'}</Text>
            {rows.map(r => {
              const from = byId.get(r.fromId);
              const to = byId.get(r.toId);
              const done = r.paidAt != null;
              const methods = to ? ways.get(to.id) ?? [] : [];
              return (
                <View key={r.id} style={styles.card}>
                <Tap
                  onPress={() => toggle(r)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: done }}
                  accessibilityLabel={`${from?.name} pays ${to?.name} ${money(r.amount)}`}
                  disabled={ended}
                  ring={theme.color.accent}
                  style={styles.row}
                >
                  {from && <Avatar person={from} photo={from.photoStart} size={44} />}
                  <View style={[styles.flex, done && styles.faded]}>
                    <Text style={styles.who} numberOfLines={2}>
                      <Text style={{ color: from?.color ?? theme.color.ink }}>{from?.name}</Text>
                      <Text style={styles.pays}> pays </Text>
                      <Text style={{ color: to?.color ?? theme.color.ink }}>{to?.name}</Text>
                    </Text>
                    <Text style={styles.amt} numberOfLines={1} adjustsFontSizeToFit>{money(r.amount)}</Text>
                    {done && <Strike thickness={4} />}
                  </View>
                  {to && <Avatar person={to} photo={to.photoStart} size={32} />}
                  <View style={[styles.box, done && styles.boxDone]}>
                    {done && <Text style={styles.tick}>✓</Text>}
                  </View>
                </Tap>
                {!done && !ended && (
                  <View style={styles.payInfo}>
                    {methods.map((m, i) => {
                      const key = `${r.id}-${i}`;
                      return (
                        <View key={key} style={styles.method}>
                          <Text style={styles.methodText} numberOfLines={2} selectable>
                            <Text style={[styles.methodLabel, { color: to?.color ?? theme.color.ink }]}>{m.label}</Text>
                            {m.number ? `  ${m.number}` : ''}
                          </Text>
                          {!!m.number && (
                            <Tap onPress={() => copy(key, m.number)} style={styles.chip} accessibilityRole="button" accessibilityLabel={`Copy ${m.label} number`}>
                              <Text style={styles.chipText}>{copied === key ? 'Copied' : 'Copy'}</Text>
                            </Tap>
                          )}
                          {!!m.qrUri && (
                            <Tap
                              onPress={() => setQr({ uri: m.qrUri!, caption: `${to?.name}'s ${m.label} · ${money(r.amount)}` })}
                              style={styles.chip}
                              accessibilityRole="button"
                              accessibilityLabel={`Show ${to?.name}'s ${m.label} QR code`}
                            >
                              <Text style={styles.chipText}>QR</Text>
                            </Tap>
                          )}
                        </View>
                      );
                    })}
                    {methods.length === 0 && to && (
                      <Text style={styles.small}>No ways to pay {to.name} saved yet. Add them under The crew.</Text>
                    )}
                    <Tap onPress={() => setPartOf(r)} style={styles.partBtn} accessibilityRole="button" accessibilityLabel={`${from?.name} paid part of it`}>
                      <Text style={styles.chipText}>Paid part of it</Text>
                    </Tap>
                  </View>
                )}
                </View>
              );
            })}
          </>
        )}
        {allPaid && <Text style={styles.dim}>Everyone's paid. Close the night when you're done.</Text>}
        {allPaid && <Button kind="go" label="Close the night" onPress={finish} />}
        {ended && !shot && <Button kind="ghost" label="See the recap" onPress={() => router.replace(`/night/${nightId}/recap`)} />}
      </ScrollView>
      <ImageViewer uri={qr?.uri ?? null} caption={qr?.caption} onClose={() => setQr(null)} />
      <AmountModal
        visible={partOf != null}
        title={partOf ? `How much did ${byId.get(partOf.fromId)?.name} pay?` : ''}
        hint={partOf ? `Of the ${money(partOf.amount)} they owe ${byId.get(partOf.toId)?.name}. The rest stays on the list.` : undefined}
        confirm="Paid that"
        onDone={amt => partOf && paidPart(partOf, amt)}
        onClose={() => setPartOf(null)}
      />
      <AllSquare visible={shot} line={`${title} is settled.`}>
        <Button kind="dark" label="One more for the board" onPress={() => router.replace(`/night/${nightId}/lineup?phase=end`)} />
        <Button kind="dark" label="Straight to the recap" onPress={() => router.replace(`/night/${nightId}/recap`)} />
      </AllSquare>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: 20, gap: 12 },
  square: { alignItems: 'center', gap: 20, paddingVertical: 48 },
  big: { ...theme.type.display, color: theme.color.ink, textAlign: 'center' },
  count: { flexDirection: 'row', alignItems: 'flex-end', gap: 14, minHeight: 104 },
  countNow: { ...theme.type.hero, color: theme.color.ink },
  countOld: { ...theme.type.display, color: theme.color.ink, opacity: 0.45 },
  countWord: { ...theme.type.big, color: theme.color.ink, textTransform: 'uppercase', paddingBottom: 10 },
  dim: { ...theme.type.body, color: theme.color.inkDim },
  card: { backgroundColor: theme.color.surface, borderRadius: theme.radius.md, overflow: 'hidden' },
  payInfo: { paddingHorizontal: 16, paddingBottom: 12, gap: 8, borderTopWidth: 1, borderTopColor: theme.color.line, paddingTop: 10 },
  method: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  methodText: { flex: 1, ...theme.type.bodyBold, color: theme.color.ink, fontVariant: ['tabular-nums'] },
  methodLabel: { ...theme.type.bodyBold },
  chip: {
    minHeight: 44, minWidth: 64, paddingHorizontal: 12, borderRadius: theme.radius.md, borderWidth: 2, borderColor: theme.color.line,
    alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.bg,
  },
  chipText: { ...theme.type.smallBold, color: theme.color.ink },
  partBtn: {
    minHeight: 44, alignSelf: 'flex-start', paddingHorizontal: 14, borderRadius: theme.radius.md, borderWidth: 2,
    borderColor: theme.color.line, justifyContent: 'center',
  },
  small: { ...theme.type.small, color: theme.color.inkDim },
  row: {
    minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.color.surface,
    borderRadius: theme.radius.md, paddingHorizontal: 16,
  },
  flex: { flex: 1 },
  faded: { opacity: 0.5 },
  who: { ...theme.type.title, color: theme.color.ink },
  pays: { ...theme.type.body, color: theme.color.inkDim },
  amt: { ...theme.type.display, color: theme.color.accent },
  box: {
    width: 40, height: 40, borderRadius: theme.radius.sm, borderWidth: 3, borderColor: theme.color.ink,
    alignItems: 'center', justifyContent: 'center',
  },
  boxDone: { borderColor: theme.color.accent },
  tick: { ...theme.type.big, color: theme.color.accent },
});
