import { useRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { ItemClaim } from '../core/items';
import { formatMoney as money } from '../core/money';
import type { NightMember } from '../db/repo';
import { Button } from './Button';
import { Enter, Pop, Tap } from './Tap';
import { theme } from './theme';

// One row of a payment broken into items, as typed. Claims keep tap order: odd cents go to the first claimer.
export interface ItemDraft { key: number; name: string; priceText: string; claims: ItemClaim[] }

interface Props {
  items: ItemDraft[];
  members: NightMember[];
  parts: Map<number, Map<number, number>>; // by row key: what each person owes for that item (priced rows only)
  onChange: (items: ItemDraft[]) => void;
  onAdd: () => void;
  onRemove: (key: number) => void;
  focusKey: number | null; // the row just added: scrolled into view once laid out, then given the keyboard
  onFocused: () => void;
  onReveal: (y: number) => void; // y of that row inside this list; the screen scrolls to it
}

const MAX_COUNT = 9;

export function ItemList({ items, members, parts, onChange, onAdd, onRemove, focusKey, onFocused, onReveal }: Props) {
  const inputs = useRef(new Map<number, TextInput>());
  const byId = new Map(members.map(m => [m.id, m]));

  // A new row takes the keyboard only once it has been laid out. Focusing on mount (autoFocus) made
  // Android scroll to where the row was before it had a position, which is the top of the screen.
  function laidOut(key: number, y: number) {
    if (key !== focusKey) return;
    onReveal(y);
    requestAnimationFrame(() => inputs.current.get(key)?.focus());
    onFocused();
  }

  const update = (key: number, patch: Partial<ItemDraft>) =>
    onChange(items.map(it => (it.key === key ? { ...it, ...patch } : it)));

  // Tap a name to claim; tap again for a bigger part (x2, x3).
  const claim = (it: ItemDraft, personId: number) => {
    const has = it.claims.find(c => c.personId === personId);
    update(it.key, {
      claims: has
        ? it.claims.map(c => (c.personId === personId ? { ...c, count: Math.min(MAX_COUNT, c.count + 1) } : c))
        : [...it.claims, { personId, count: 1 }],
    });
  };
  const unclaim = (it: ItemDraft, personId: number) =>
    update(it.key, { claims: it.claims.filter(c => c.personId !== personId) });
  // Unclaimed already means everyone shares it, so the Everyone chip just clears the claims.
  const isEveryone = (it: ItemDraft) =>
    it.claims.length === 0 || (it.claims.length === members.length && it.claims.every(c => c.count === 1));
  const everyone = (it: ItemDraft) => update(it.key, { claims: [] });

  // Under each priced item: who pays what for it. Shared by everyone reads as one figure each.
  function split(it: ItemDraft) {
    const owed = parts.get(it.key);
    if (!owed || owed.size === 0) return null;
    const amounts = [...owed.values()];
    if (it.claims.length === 0) {
      const lo = Math.min(...amounts), hi = Math.max(...amounts);
      return (
        <Text style={styles.split}>
          Shared by everyone · {lo === hi ? money(lo) : `${money(lo)}–${money(hi)}`} each
        </Text>
      );
    }
    return (
      <Text style={styles.split}>
        {[...owed].map(([pid, amt], i) => (
          <Text key={pid}>
            {i > 0 && <Text style={styles.dot}> · </Text>}
            <Text style={{ color: byId.get(pid)?.color ?? theme.color.ink }}>{byId.get(pid)?.name ?? '?'}</Text>
            <Text style={styles.splitAmt}> {money(amt)}</Text>
          </Text>
        ))}
      </Text>
    );
  }

  return (
    <View style={styles.list}>
      {items.map(it => {
        const everyoneOn = isEveryone(it);
        return (
          <View key={it.key} onLayout={e => laidOut(it.key, e.nativeEvent.layout.y)}>
            <Enter index={0} style={styles.card}>
              <View style={styles.top}>
                <TextInput
                  ref={r => {
                    if (r) inputs.current.set(it.key, r);
                    else inputs.current.delete(it.key);
                  }}
                  value={it.name}
                  onChangeText={name => update(it.key, { name })}
                  placeholder="What was it?"
                  placeholderTextColor={theme.color.inkDim}
                  style={styles.name}
                  maxLength={40}
                  accessibilityLabel="Item name"
                />
                <TextInput
                  value={it.priceText}
                  onChangeText={priceText => update(it.key, { priceText })}
                  placeholder="0.00"
                  placeholderTextColor={theme.color.inkDim}
                  keyboardType="decimal-pad"
                  style={styles.price}
                  maxLength={12}
                  accessibilityLabel={`Price of ${it.name || 'this item'}`}
                />
                <Tap
                  onPress={() => onRemove(it.key)}
                  style={styles.remove}
                  ring={theme.color.owes}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${it.name || 'this item'}`}
                >
                  <Text style={styles.removeText}>×</Text>
                </Tap>
              </View>
              <View style={styles.chips}>
                <Tap
                  onPress={() => everyone(it)}
                  accessibilityRole="button"
                  accessibilityLabel="Everyone had this"
                  accessibilityState={{ selected: everyoneOn }}
                  style={[styles.chip, everyoneOn && styles.chipAll]}
                >
                  <Text style={[styles.chipText, everyoneOn && styles.chipAllText]}>Everyone</Text>
                </Tap>
                {members.map(m => {
                  const count = it.claims.find(c => c.personId === m.id)?.count ?? 0;
                  const on = count > 0;
                  return (
                    <Tap
                      key={m.id}
                      onPress={() => claim(it, m.id)}
                      onLongPress={() => unclaim(it, m.id)}
                      ring={m.color}
                      accessibilityRole="button"
                      accessibilityLabel={on ? `${m.name}, ${count > 1 ? `times ${count}` : 'claimed'}` : `${m.name} had this`}
                      accessibilityHint={on ? 'Tap for a bigger part, hold to take them off' : undefined}
                      style={[styles.chip, on ? { backgroundColor: m.color, borderColor: m.color } : { borderColor: theme.color.line }]}
                    >
                      <Text style={[styles.chipText, { color: on ? theme.color.bg : m.color }]} numberOfLines={1}>
                        {m.emoji} {m.name}
                      </Text>
                      {count > 1 && (
                        <Pop trigger={count}>
                          <Text style={[styles.times, { color: theme.color.bg }]}>×{count}</Text>
                        </Pop>
                      )}
                    </Tap>
                  );
                })}
              </View>
              {split(it) ?? (it.claims.length === 0 && <Text style={styles.split}>Shared by everyone · tap names if only some had it</Text>)}
            </Enter>
          </View>
        );
      })}
      <Button kind="ghost" label="+ Add item" onPress={onAdd} />
      <Text style={styles.hint}>Tap a name to claim · tap again for ×2 · hold to take them off</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  card: { backgroundColor: theme.color.surface, borderRadius: theme.radius.md, padding: 12, gap: 10 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: {
    flex: 1, minHeight: theme.tap, ...theme.type.bodyBold, color: theme.color.ink,
    borderBottomWidth: 2, borderColor: theme.color.line, paddingHorizontal: 4,
  },
  price: {
    width: 104, minHeight: theme.tap, ...theme.type.title, color: theme.color.ink, textAlign: 'right',
    fontVariant: ['tabular-nums'], borderBottomWidth: 2, borderColor: theme.color.line, paddingHorizontal: 4,
  },
  remove: { width: 44, height: theme.tap, alignItems: 'center', justifyContent: 'center' },
  removeText: { ...theme.type.big, color: theme.color.inkDim },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 48, paddingHorizontal: 14, borderRadius: theme.radius.md, borderWidth: 2, borderColor: theme.color.line,
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.color.bg,
  },
  chipAll: { backgroundColor: theme.color.ink, borderColor: theme.color.ink },
  chipText: { ...theme.type.bodyBold, color: theme.color.ink },
  chipAllText: { color: theme.color.bg },
  times: { ...theme.type.title },
  split: { ...theme.type.smallBold, color: theme.color.inkDim },
  splitAmt: { color: theme.color.ink, fontVariant: ['tabular-nums'] },
  dot: { color: theme.color.inkDim },
  hint: { ...theme.type.small, color: theme.color.inkDim, textAlign: 'center' },
});
