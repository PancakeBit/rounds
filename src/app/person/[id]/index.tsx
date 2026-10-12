import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { across, nightTransfers, type PairDebt } from '../../../core/across';
import type { PersonBreakdown } from '../../../core/breakdown';
import { whoHadWhat } from '../../../core/breakdown';
import { categoriesLabel } from '../../../core/categories';
import { formatMoney as money } from '../../../core/money';
import { splitLabel } from '../../../core/summary';
import { listCrew, listPayMethods, loadOpenNights, type Expense, type Night, type PayMethod, type Person } from '../../../db/repo';
import { Avatar } from '../../../ui/Avatar';
import { ImageViewer } from '../../../ui/ImageViewer';
import { guarded } from '../../../ui/oops';
import { Tap } from '../../../ui/Tap';
import { theme } from '../../../ui/theme';

interface NightView {
  night: Night; ids: number[]; had: PersonBreakdown | undefined; paidFor: Expense[];
  paidTotal: number; gotBack: number; sentBack: number; left: number;
}
interface PersonView { total: number; pairs: PairDebt[]; nights: NightView[] }

const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

// One person across every open night: where they stand, with whom, what it's for, and how to pay them.
export default function PersonSummary() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pid = Number(id);
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [person, setPerson] = useState<Person | null>(null);
  const [crew, setCrew] = useState<Map<number, Person>>(new Map());
  const [view, setView] = useState<PersonView>({ total: 0, pairs: [], nights: [] });
  const [ways, setWays] = useState<PayMethod[]>([]);
  const [qr, setQr] = useState<PayMethod | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  useFocusEffect(useCallback(() => {
    guarded("Couldn't load them", async () => {
      const everyone = await listCrew(db, true);
      setCrew(new Map(everyone.map(p => [p.id, p])));
      setPerson(everyone.find(p => p.id === pid) ?? null);
      // Worked out here, inside the guard, so bad stored data shows an error instead of crashing the page.
      const open = (await loadOpenNights(db)).filter(n => n.members.some(m => m.id === pid));
      const data = open.map(n => ({
        nightId: n.night.id, title: n.night.title, memberIds: n.members.map(m => m.id),
        expenses: n.expenses, paid: n.paid, unpaid: n.unpaid,
      }));
      const a = across(data);
      setView({
        total: a.net.get(pid) ?? 0,
        pairs: a.pairs.filter(p => p.fromId === pid || p.toId === pid),
        nights: open.map((n, i) => {
          let left = 0;
          for (const t of nightTransfers(data[i])) {
            if (t.toId === pid) left += t.amount;
            if (t.fromId === pid) left -= t.amount;
          }
          const paidFor = n.expenses.filter(e => e.payerId === pid);
          return {
            night: n.night,
            ids: data[i].memberIds,
            had: whoHadWhat(n.expenses, data[i].memberIds).get(pid),
            paidFor,
            paidTotal: paidFor.reduce((t, e) => t + e.amount, 0),
            gotBack: n.paid.filter(s => s.toId === pid).reduce((t, s) => t + s.amount, 0),
            sentBack: n.paid.filter(s => s.fromId === pid).reduce((t, s) => t + s.amount, 0),
            left,
          };
        }),
      });
      setWays((await listPayMethods(db, [pid])).get(pid) ?? []);
    });
  }, [db, pid]));

  if (!person) return null;
  const nameOf = (p: number) => crew.get(p)?.name ?? '?';
  const colorOf = (p: number) => crew.get(p)?.color ?? theme.color.ink;
  const Who = ({ p }: { p: number }) => <Text style={{ color: colorOf(p) }}>{nameOf(p)}</Text>;

  const { total, pairs, nights } = view;

  async function copy(i: number, text: string) {
    const ok = await guarded("Couldn't copy that", () => Clipboard.setStringAsync(text));
    if (!ok) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCopied(i);
    setTimeout(() => setCopied(c => (c === i ? null : c)), 1500);
  }

  const pieces = (p: PairDebt) =>
    p.pieces.length === 1
      ? `from ${p.pieces[0].title}`
      : p.pieces.map(x => `${x.title}: ${nameOf(x.fromId)} → ${nameOf(x.toId)} ${money(x.amount)}`).join(' · ');

  return (
    <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 32 + insets.bottom }]}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Tap onPress={() => router.push(`/person/${pid}/edit`)} style={styles.edit} accessibilityRole="button" accessibilityLabel={`Edit ${person.name}`}>
              <Text style={styles.editText}>Edit</Text>
            </Tap>
          ),
        }}
      />
      <View style={styles.hero}>
        <Avatar person={person} size={132} />
        <Text style={[styles.name, { color: person.color }]} numberOfLines={1} adjustsFontSizeToFit>{person.name}</Text>
        <Text style={styles.side}>
          {total > 0 ? <>gets back <Text style={styles.in}>{money(total)}</Text></> : total < 0 ? <>owes <Text style={styles.out}>{money(-total)}</Text></> : 'all square'}
          {nights.length > 0 ? ` across ${nights.length} open ${nights.length === 1 ? 'night' : 'nights'}` : ''}
        </Text>
      </View>

      {nights.length === 0 && <Text style={styles.dim}>Nothing open for {person.name} right now.</Text>}

      {pairs.length > 0 && (
        <>
          <Text style={styles.h2}>Who</Text>
          <View style={styles.panel}>
            {pairs.map((p, i) => (
              <View key={`${p.fromId}-${p.toId}`} style={[styles.pair, i > 0 && styles.rule]}>
                <View style={styles.pairTop}>
                  <Text style={styles.pairWho}>
                    <Who p={p.fromId} />
                    <Text style={styles.dimInline}> pays </Text>
                    <Who p={p.toId} />
                  </Text>
                  <Text style={styles.pairAmt}>{money(p.amount)}</Text>
                </View>
                <Text style={styles.small}>{pieces(p)}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {nights.length > 0 && <Text style={styles.h2}>What for</Text>}
      {nights.map(({ night, ids, had, paidFor, paidTotal, gotBack, sentBack, left }) => {
        return (
          <Tap key={night.id} style={styles.night} ring={theme.color.accent} onPress={() => router.push(`/night/${night.id}`)} accessibilityRole="button" accessibilityHint="Opens the night">
            <View style={styles.nightTop}>
              <Text style={styles.nightTitle} numberOfLines={1}>{night.title} <Text style={styles.dimInline}>{day(night.startedAt)}</Text></Text>
              <Text style={[styles.nightNet, { color: left > 0 ? theme.color.owed : left < 0 ? theme.color.owes : theme.color.ink }]}>
                {left > 0 ? `+${money(left)}` : left < 0 ? money(left) : 'square'}
              </Text>
            </View>

            <Text style={styles.kicker}>{person.name} had</Text>
            {(had?.lines ?? []).map((l, i) => (
              <View key={i} style={styles.line}>
                <Text style={styles.lineLabel}>
                  {l.label}
                  <Text style={styles.dimInline}> · </Text>
                  <Who p={l.payerId} />
                  <Text style={styles.dimInline}> paid</Text>
                </Text>
                <Text style={styles.lineAmt}>{money(l.amount)}</Text>
              </View>
            ))}
            {!had && <Text style={styles.small}>Nothing yet.</Text>}

            {paidFor.length > 0 && <Text style={styles.kicker}>{person.name} paid for</Text>}
            {paidFor.map(e => (
              <View key={e.id} style={styles.line}>
                <Text style={styles.lineLabel}>
                  {e.note || categoriesLabel(e.categories)}
                  <Text style={styles.dimInline}> · {splitLabel(e, ids, nameOf, money)}</Text>
                </Text>
                <Text style={styles.lineAmt}>{money(e.amount)}</Text>
              </View>
            ))}

            <View style={[styles.line, styles.foot]}>
              <Text style={styles.small}>
                Had {money(had?.total ?? 0)} · paid {money(paidTotal)}
                {gotBack ? ` · got ${money(gotBack)} back` : ''}
                {sentBack ? ` · paid back ${money(sentBack)}` : ''}
              </Text>
              <Text style={styles.small}>{left > 0 ? `gets back ${money(left)}` : left < 0 ? `owes ${money(-left)}` : 'square'}</Text>
            </View>
          </Tap>
        );
      })}

      <Text style={styles.h2}>Pay {person.name}</Text>
      {ways.map((m, i) => (
        <View key={i} style={styles.method}>
          <Text style={styles.methodText} selectable>
            <Text style={{ color: person.color }}>{m.label}</Text>{m.number ? `  ${m.number}` : ''}
          </Text>
          {!!m.number && (
            <Tap onPress={() => copy(i, m.number)} style={styles.chip} accessibilityRole="button" accessibilityLabel={`Copy ${m.label} number`}>
              <Text style={styles.chipText}>{copied === i ? 'Copied' : 'Copy'}</Text>
            </Tap>
          )}
          {!!m.qrUri && (
            <Tap onPress={() => setQr(m)} style={styles.chip} accessibilityRole="button" accessibilityLabel={`Show ${person.name}'s ${m.label} QR code`}>
              <Text style={styles.chipText}>QR</Text>
            </Tap>
          )}
        </View>
      ))}
      {ways.length === 0 && (
        <Tap onPress={() => router.push(`/person/${pid}/edit`)} style={styles.addWays} accessibilityRole="button">
          <Text style={styles.chipText}>+ Add how to pay {person.name}</Text>
        </Tap>
      )}
      <ImageViewer uri={qr?.qrUri ?? null} caption={qr ? `${person.name}'s ${qr.label}` : undefined} onClose={() => setQr(null)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 12 },
  edit: { minHeight: 44, minWidth: 56, alignItems: 'center', justifyContent: 'center' },
  editText: { ...theme.type.bodyBold, color: theme.color.accent },
  hero: { alignItems: 'center', gap: 6, marginBottom: 4 },
  name: { ...theme.type.display },
  side: { ...theme.type.body, color: theme.color.inkDim, textAlign: 'center' },
  in: { ...theme.type.bodyBold, color: theme.color.owed },
  out: { ...theme.type.bodyBold, color: theme.color.owes },
  h2: { ...theme.type.title, color: theme.color.ink, marginTop: 8 },
  dim: { ...theme.type.body, color: theme.color.inkDim },
  dimInline: { ...theme.type.small, color: theme.color.inkDim },
  small: { ...theme.type.small, color: theme.color.inkDim },
  panel: { backgroundColor: theme.color.surface, borderRadius: theme.radius.lg, paddingHorizontal: 14 },
  pair: { paddingVertical: 10, gap: 2 },
  rule: { borderTopWidth: 1, borderTopColor: theme.color.line },
  pairTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pairWho: { flex: 1, ...theme.type.bodyBold },
  pairAmt: { ...theme.type.big, fontSize: 26, color: theme.color.ink },
  night: { backgroundColor: theme.color.surface, borderRadius: theme.radius.lg, padding: 14, gap: 6 },
  nightTop: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  nightTitle: { flex: 1, ...theme.type.bodyBold, color: theme.color.ink },
  nightNet: { ...theme.type.big, fontSize: theme.font.title },
  kicker: { ...theme.type.label, fontSize: theme.font.small, letterSpacing: 2, color: theme.color.inkDim, marginTop: 4 },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  lineLabel: { flex: 1, ...theme.type.body, fontSize: 15, color: theme.color.ink },
  lineAmt: { ...theme.type.body, fontSize: 15, color: theme.color.ink, fontVariant: ['tabular-nums'] },
  foot: { borderTopWidth: 1, borderTopColor: theme.color.line, paddingTop: 6, marginTop: 4, flexWrap: 'wrap' },
  method: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 },
  methodText: { flex: 1, ...theme.type.bodyBold, color: theme.color.ink, fontVariant: ['tabular-nums'] },
  chip: {
    minHeight: 44, minWidth: 64, paddingHorizontal: 12, borderRadius: theme.radius.md, borderWidth: 2, borderColor: theme.color.line,
    alignItems: 'center', justifyContent: 'center',
  },
  chipText: { ...theme.type.smallBold, color: theme.color.ink },
  addWays: { minHeight: theme.tap, borderRadius: theme.radius.md, borderWidth: 2, borderStyle: 'dashed', borderColor: theme.color.line, alignItems: 'center', justifyContent: 'center' },
});
