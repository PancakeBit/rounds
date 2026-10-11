import { Image, StyleSheet, Text, View } from 'react-native';
import { categoryEmoji, categoryLabel } from '../core/categories';
import { formatGap, type Leader, type NightStats } from '../core/stats';
import type { Night, NightMember } from '../db/repo';
import { Avatar } from './Avatar';
import { theme } from './theme';

interface Props {
  night: Night;
  stats: NightStats;
  members: NightMember[];
  money: (minor: number) => string;
  showFaces: boolean;
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export function RecapCard({ night, stats, members, money, showFaces }: Props) {
  const people = new Map(members.map(m => [m.id, m]));
  const award = (title: string, l: Leader | null) => {
    if (!l) return null;
    const p = people.get(l.personId);
    return (
      <View style={styles.award}>
        {p && <Avatar person={p} photo={showFaces ? p.photoStart : null} size={40} />}
        <View style={styles.flex}>
          <Text style={styles.awardTitle}>{title}</Text>
          <Text style={styles.awardWho}>{p?.name}</Text>
        </View>
        <Text style={styles.awardAmt}>{money(l.amount)}</Text>
      </View>
    );
  };
  const maxCat = stats.byCategory[0]?.amount ?? 1;
  const anyStart = members.some(m => m.photoStart);
  const anyEnd = members.some(m => m.photoEnd);
  const faces = showFaces && (anyStart || anyEnd || night.groupPhoto != null);

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>{new Date(night.startedAt).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
      <Text style={styles.total}>{money(stats.total)}</Text>
      <Text style={styles.sub}>
        {night.title} · {stats.rounds} {stats.rounds === 1 ? 'round' : 'rounds'}{stats.topCategory ? ` · mostly ${categoryEmoji(stats.topCategory)}` : ''}
      </Text>

      {faces && (
        <View style={styles.faces}>
          {anyStart && (
            <View style={styles.faceRow}>
              <Text style={styles.faceTime}>{clock(night.startedAt)}</Text>
              {members.map(m => <Avatar key={m.id} person={m} photo={m.photoStart} size={52} />)}
            </View>
          )}
          {anyEnd && (
            <View style={styles.faceRow}>
              <Text style={styles.faceTime}>{night.endedAt != null ? clock(night.endedAt) : 'Late'}</Text>
              {members.map(m => <Avatar key={m.id} person={m} photo={m.photoEnd} size={52} />)}
            </View>
          )}
          {night.groupPhoto && <Image source={{ uri: night.groupPhoto }} style={styles.group} accessibilityIgnoresInvertColors />}
        </View>
      )}

      <View style={styles.awards}>
        {award('Big Spender', stats.bigSpender)}
        {award('Most Generous', stats.mostGenerous)}
        {award('The Sponge', stats.sponge)}
        {stats.longestGapMs != null && (
          <View style={styles.award}>
            <View style={styles.flex}><Text style={styles.awardTitle}>Longest dry spell</Text></View>
            <Text style={styles.awardAmt}>{formatGap(stats.longestGapMs)}</Text>
          </View>
        )}
      </View>

      <View style={styles.cats}>
        {stats.byCategory.map(c => (
          <View key={c.category} style={styles.catRow}>
            <Text style={styles.catLabel}>{categoryEmoji(c.category)} {categoryLabel(c.category)}</Text>
            <View style={styles.barTrack}><View style={[styles.bar, { width: `${Math.max(4, (c.amount / maxCat) * 100)}%` }]} /></View>
            <Text style={styles.catAmt}>{money(c.amount)}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.footer}>Chalked up with Rounds</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.color.surface, borderWidth: 2, borderColor: theme.color.line, borderRadius: theme.radius.lg, padding: 20, gap: 14 },
  kicker: { ...theme.type.label, color: theme.color.inkDim },
  total: { ...theme.type.hero, color: theme.color.accent },
  sub: { ...theme.type.bodyBold, color: theme.color.ink, marginTop: -12 },
  faces: { gap: 10, borderTopWidth: 2, borderColor: theme.color.line, paddingTop: 12 },
  faceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  faceTime: { ...theme.type.smallBold, color: theme.color.inkDim, width: 64, textTransform: 'uppercase' },
  group: { width: '100%', aspectRatio: 4 / 3, borderRadius: theme.radius.md },
  awards: { borderTopWidth: 2, borderColor: theme.color.line },
  award: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 58, borderBottomWidth: 2, borderColor: theme.color.line },
  flex: { flex: 1 },
  awardTitle: { ...theme.type.smallBold, color: theme.color.inkDim, textTransform: 'uppercase' },
  awardWho: { ...theme.type.bodyBold, color: theme.color.ink },
  awardAmt: { ...theme.type.big, color: theme.color.ink },
  cats: { gap: 8 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catLabel: { ...theme.type.smallBold, color: theme.color.ink, width: 96 },
  barTrack: { flex: 1, height: 10, borderRadius: 2, backgroundColor: theme.color.bg, overflow: 'hidden' },
  bar: { height: 10, borderRadius: 2, backgroundColor: theme.color.accent },
  catAmt: { ...theme.type.smallBold, color: theme.color.ink, minWidth: 64, textAlign: 'right' },
  footer: { ...theme.type.label, color: theme.color.inkDim, textAlign: 'center' },
});
