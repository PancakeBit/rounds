import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Avatar } from './Avatar';
import { theme } from './theme';

// Motion law: everything lands like a dart. Fast in, one short thunk-and-quiver, then dead still.
// Numbers never tween; they are struck through and rewritten.

const lin = Easing.linear;

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

// Drops its children in from 12dp above with a 180ms quiver, every time `trigger` changes.
export function Land({ trigger, children, style }: { trigger: unknown; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const y = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();
  useEffect(() => {
    if (reduce) return;
    y.setValue(-12);
    Animated.sequence([
      Animated.timing(y, { toValue: 2, duration: 63, easing: lin, useNativeDriver: true }),
      Animated.timing(y, { toValue: -1, duration: 36, easing: lin, useNativeDriver: true }),
      Animated.timing(y, { toValue: 1, duration: 36, easing: lin, useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 45, easing: lin, useNativeDriver: true }),
    ]).start();
  }, [trigger, reduce, y]);
  return <Animated.View style={[style, { transform: [{ translateY: y }] }]}>{children}</Animated.View>;
}

// A chalk line drawn left to right across its parent in 140ms, once, when it mounts.
export function Strike({ color = theme.color.ink, thickness = 4 }: { color?: string; thickness?: number }) {
  const s = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();
  useEffect(() => {
    if (reduce) {
      s.setValue(1);
      return;
    }
    Animated.timing(s, { toValue: 1, duration: 140, easing: lin, useNativeDriver: true }).start();
  }, [reduce, s]);
  return (
    <Animated.View
      style={[
        styles.strike,
        {
          height: thickness,
          borderRadius: thickness / 2,
          marginTop: -thickness / 2,
          backgroundColor: color,
          transformOrigin: 'left center',
          transform: [{ rotate: '-5deg' }, { scaleX: s }],
        },
      ]}
    />
  );
}

// A hand-drawn ring around its children (the "ON ME" mark on a treat).
export function Circled({ children, color = theme.color.accent }: { children: ReactNode; color?: string }) {
  const k = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();
  useEffect(() => {
    if (reduce) {
      k.setValue(1);
      return;
    }
    Animated.timing(k, { toValue: 1, duration: 140, easing: lin, useNativeDriver: true }).start();
  }, [reduce, k]);
  const scale = k.interpolate({ inputRange: [0, 1], outputRange: [1.25, 1] });
  return (
    <View style={styles.circled}>
      {children}
      <Animated.View style={[styles.ring, { borderColor: color, opacity: k, transform: [{ rotate: '-4deg' }, { scale }] }]} />
    </View>
  );
}

interface ScoreColumnProps {
  person: { name: string; emoji: string; color: string };
  photo?: string | null;
  history: number[];
  money: (minor: number) => string;
  first?: boolean;
}

// The signature: one hand-ruled column per player. Older figures are struck through and the new one is
// written beneath, counting down to square at zero. Shows the last three figures.
export function ScoreColumn({ person, photo, history, money, first = false }: ScoreColumnProps) {
  const start = Math.max(0, history.length - 3);
  const last = history[history.length - 1] ?? 0;
  const tone = last > 0 ? theme.color.owed : last < 0 ? theme.color.owes : theme.color.ink;
  const word = last > 0 ? 'owed' : last < 0 ? 'owes' : 'square';
  const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${money(Math.abs(v))}`;
  return (
    <View style={[styles.col, !first && styles.colRule]} accessible accessibilityLabel={`${person.name} ${word} ${money(Math.abs(last))}`}>
      <Avatar person={person} photo={photo} size={44} />
      <Text style={styles.colName} numberOfLines={1}>{person.name}</Text>
      {history.slice(start).map((v, i) => {
        // Keyed by position in the whole history: when a figure stops being current it remounts
        // as a struck figure, which is what plays the strike exactly once.
        const index = start + i;
        return index === history.length - 1 ? (
          <Land key={index} trigger={index}>
            <Text style={[styles.figNow, { color: tone }]} numberOfLines={1} adjustsFontSizeToFit>{signed(v)}</Text>
          </Land>
        ) : (
          <View key={index} style={styles.figOldWrap}>
            <Text style={styles.figOld} numberOfLines={1}>{signed(v)}</Text>
            <Strike thickness={3} />
          </View>
        );
      })}
      <Text style={[styles.colWord, { color: tone }]}>{word}</Text>
    </View>
  );
}

const DUST = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2 + 0.3;
  const r = 110 + (i % 3) * 30;
  return { dx: Math.round(Math.cos(a) * r), dy: Math.round(Math.sin(a) * r * 0.8), size: 4 + (i % 3) * 2 };
});

// Full-screen green "ALL SQUARE" when the last transfer is ticked: slam, a puff of chalk dust, a double haptic.
export function AllSquare({ visible, line, children }: { visible: boolean; line: string; children?: ReactNode }) {
  const slam = useRef(new Animated.Value(1)).current;
  const dust = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();
  useEffect(() => {
    if (!visible) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const t = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 140);
    if (!reduce) {
      slam.setValue(1.14);
      dust.setValue(0);
      Animated.parallel([
        Animated.sequence([
          Animated.timing(slam, { toValue: 0.97, duration: 88, easing: lin, useNativeDriver: true }),
          Animated.timing(slam, { toValue: 1.015, duration: 55, easing: lin, useNativeDriver: true }),
          Animated.timing(slam, { toValue: 1, duration: 77, easing: lin, useNativeDriver: true }),
        ]),
        Animated.timing(dust, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    }
    return () => clearTimeout(t);
  }, [visible, reduce, slam, dust]);
  if (!visible) return null;
  const fade = dust.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] });
  return (
    <View style={styles.shot}>
      <View>
        <Animated.Text style={[styles.shotText, { transform: [{ scale: slam }] }]}>{'ALL\nSQUARE'}</Animated.Text>
        {!reduce && DUST.map((d, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dust,
              {
                width: d.size,
                height: d.size,
                borderRadius: d.size / 2,
                opacity: fade,
                transform: [
                  { translateX: dust.interpolate({ inputRange: [0, 1], outputRange: [0, d.dx] }) },
                  { translateY: dust.interpolate({ inputRange: [0, 1], outputRange: [0, d.dy] }) },
                ],
              },
            ]}
          />
        ))}
      </View>
      <Land trigger={visible}>
        <Text style={styles.shotLine}>{line}</Text>
      </Land>
      <View style={styles.shotActions}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  strike: { position: 'absolute', left: '-8%', right: '-8%', top: '52%', opacity: 0.9, pointerEvents: 'none' },
  circled: { paddingHorizontal: 10, paddingVertical: 3 },
  ring: { position: 'absolute', top: -2, bottom: -2, left: -4, right: -4, borderWidth: 2, borderRadius: 999 },
  col: { width: 88, alignItems: 'center', gap: 6, paddingTop: 12, paddingBottom: 14, paddingHorizontal: 4, minHeight: 236 },
  colRule: { borderLeftWidth: 2, borderLeftColor: theme.color.line },
  colName: { ...theme.type.title, color: theme.color.ink, textTransform: 'uppercase' },
  figNow: { ...theme.type.display },
  figOldWrap: { alignSelf: 'center' },
  figOld: { ...theme.type.title, color: theme.color.ink, opacity: 0.45, fontVariant: ['tabular-nums'] },
  colWord: { ...theme.type.smallBold, marginTop: 'auto', textTransform: 'uppercase', letterSpacing: 1 },
  shot: {
    ...StyleSheet.absoluteFill, backgroundColor: theme.color.accent, alignItems: 'center', justifyContent: 'center',
    gap: 18, padding: 24,
  },
  shotText: { ...theme.type.hero, color: theme.color.bg, textAlign: 'center', textTransform: 'uppercase' },
  dust: { position: 'absolute', left: '50%', top: '50%', backgroundColor: theme.color.ink },
  shotLine: { ...theme.type.bodyBold, fontSize: theme.font.title, color: theme.color.bg, textAlign: 'center' },
  shotActions: { alignSelf: 'stretch', gap: 10, marginTop: 24 },
});
