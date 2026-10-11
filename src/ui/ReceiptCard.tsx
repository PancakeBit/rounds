import { StyleSheet, Text, View } from 'react-native';
import type { Transfer } from '../core/balances';
import { categoryEmoji, categoryLabel } from '../core/categories';
import { formatMoney as money } from '../core/money';
import type { Leader, NightStats } from '../core/stats';
import { splitLabel } from '../core/summary';
import type { Expense, Night, NightMember } from '../db/repo';
import { Strike } from './chalk';
import { theme } from './theme';

interface Props {
  night: Night;
  members: NightMember[];
  expenses: Expense[];
  stats: NightStats;
  open: Transfer[];
  paid: Transfer[];
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

// The receipt half of the recap: everything that got paid, the total, and who owes who.
// Drawn as a chalk tally on the slate; each person's name is in their own colour.
export function ReceiptCard({ night, members, expenses, stats, open, paid }: Props) {
  const people = new Map(members.map(m => [m.id, m]));
  const name = (id: number) => people.get(id)?.name ?? '?';
  const Name = ({ id }: { id: number }) => (
    <Text style={{ color: people.get(id)?.color ?? theme.color.ink }}>{name(id)}</Text>
  );
  const ids = members.map(m => m.id);

  const transfer = (t: Transfer, done: boolean, key: string) => (
    <View key={key} style={styles.owesRow}>
      <View style={[styles.flex, done && styles.faded]}>
        <Text style={styles.owesWho} numberOfLines={1}>
          <Name id={t.fromId} />
          <Text style={styles.dim}> → </Text>
          <Name id={t.toId} />
        </Text>
      </View>
      <Text style={[styles.owesAmt, done && styles.faded]} numberOfLines={1}>{money(t.amount)}</Text>
      {done && <Text style={styles.paidTag}>PAID</Text>}
      {done && <Strike thickness={3} />}
    </View>
  );

  const title = (label: string, l: Leader | null) =>
    l && (
      <Text key={label} style={styles.award} numberOfLines={1}>
        <Text style={styles.dim}>{label} · </Text>
        <Name id={l.personId} />
        <Text style={styles.dim}> · {money(l.amount)}</Text>
      </Text>
    );

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>
        {new Date(night.startedAt).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      </Text>
      <Text style={styles.title} numberOfLines={2} adjustsFontSizeToFit>{night.title}</Text>
      <Text style={styles.dim}>
        {clock(night.startedAt)} → {night.endedAt != null ? clock(night.endedAt) : 'still open'}
      </Text>

      <View style={styles.rule} />
      {expenses.length === 0 && <Text style={styles.dim}>Nothing got paid for.</Text>}
      {expenses.map(e => (
        <View key={e.id} style={styles.item}>
          <Text style={styles.emoji}>{categoryEmoji(e.category)}</Text>
          <View style={styles.flex}>
            <Text style={styles.itemTitle} numberOfLines={1}>{e.note || categoryLabel(e.category)}</Text>
            <Text style={styles.itemSub} numberOfLines={2}>
              <Name id={e.payerId} />
              <Text style={styles.dim}> paid · {splitLabel(e, ids, name, money)}</Text>
            </Text>
          </View>
          <Text style={[styles.itemAmt, e.isTreat && styles.treat]} numberOfLines={1}>{money(e.amount)}</Text>
        </View>
      ))}
      <View style={styles.rule} />
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.total} numberOfLines={1} adjustsFontSizeToFit>{money(stats.total)}</Text>
      </View>

      <View style={styles.rule} />
      <Text style={styles.section}>Who owes who</Text>
      {open.length === 0 && paid.length === 0 && <Text style={styles.dim}>Nobody owes anybody.</Text>}
      {open.map((t, i) => transfer(t, false, `o${i}`))}
      {paid.map((t, i) => transfer(t, true, `p${i}`))}

      {(stats.bigSpender || stats.mostGenerous || stats.sponge) && (
        <>
          <View style={styles.rule} />
          {title('Big Spender', stats.bigSpender)}
          {title('Most Generous', stats.mostGenerous)}
          {title('The Sponge', stats.sponge)}
        </>
      )}
      <Text style={styles.footer}>Kept with Rounds</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.color.surface, borderWidth: 2, borderColor: theme.color.line, borderRadius: theme.radius.lg, padding: 20, gap: 10 },
  flex: { flex: 1 },
  faded: { opacity: 0.5 },
  kicker: { ...theme.type.label, color: theme.color.inkDim },
  title: { ...theme.type.display, color: theme.color.ink, textTransform: 'uppercase' },
  dim: { ...theme.type.small, color: theme.color.inkDim },
  rule: { height: 2, backgroundColor: theme.color.line, marginVertical: 4, transform: [{ rotate: '-0.4deg' }] },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  emoji: { fontSize: theme.font.title, width: 30 },
  itemTitle: { ...theme.type.bodyBold, color: theme.color.ink },
  itemSub: { ...theme.type.smallBold },
  itemAmt: { ...theme.type.title, color: theme.color.ink, fontVariant: ['tabular-nums'] },
  treat: { color: theme.color.accent },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  totalLabel: { ...theme.type.big, color: theme.color.ink, textTransform: 'uppercase' },
  total: { ...theme.type.display, color: theme.color.accent, flexShrink: 1 },
  section: { ...theme.type.label, color: theme.color.ink },
  owesRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  owesWho: { ...theme.type.title },
  owesAmt: { ...theme.type.title, color: theme.color.ink, fontVariant: ['tabular-nums'] },
  paidTag: { ...theme.type.smallBold, color: theme.color.accent },
  award: { ...theme.type.bodyBold },
  footer: { ...theme.type.label, color: theme.color.inkDim, textAlign: 'center', marginTop: 8 },
});
