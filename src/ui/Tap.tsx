import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useReduceMotion } from './chalk';
import { theme } from './theme';

// Press law: a touch sinks in at once (60ms), lets go with a springy overshoot, and a hit ring
// bursts outward and fades, like a struck target. With Remove animations on, only the haptic stays.

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface TapProps extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Colour of the hit ring. Pass null for no ring (dense controls such as the keypad use a softer one). */
  ring?: string | null;
  /** How far the button sinks. 0.92 by default. */
  sink?: number;
}

export function Tap({ style, children, ring = theme.color.ink, sink = 0.92, onPressIn, onPressOut, onPress, disabled, ...rest }: TapProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const burst = useRef(new Animated.Value(1)).current;
  const reduce = useReduceMotion();
  const radius = (StyleSheet.flatten(style)?.borderRadius as number | undefined) ?? theme.radius.md;

  return (
    <AnimatedPressable
      // A short delay lets a scroll claim the touch first, so swiping a list doesn't buzz or sink what's under the finger.
      unstable_pressDelay={40}
      {...rest}
      disabled={disabled}
      onPressIn={e => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (!reduce) Animated.timing(scale, { toValue: sink, duration: 60, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
        onPressIn?.(e);
      }}
      onPressOut={e => {
        if (!reduce) Animated.spring(scale, { toValue: 1, speed: 40, bounciness: 14, useNativeDriver: true }).start();
        onPressOut?.(e);
      }}
      onPress={e => {
        if (!reduce && ring) {
          burst.setValue(0);
          Animated.timing(burst, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
        }
        onPress?.(e);
      }}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
      {ring && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              borderRadius: radius,
              borderColor: ring,
              opacity: burst.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
              transform: [{ scale: burst.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }],
            },
          ]}
        />
      )}
    </AnimatedPressable>
  );
}

// A quick pop every time `trigger` changes: for a digit typed into the amount, a share stepped up.
export function Pop({ trigger, children, style }: { trigger: unknown; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const k = useRef(new Animated.Value(1)).current;
  const reduce = useReduceMotion();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduce) return;
    k.setValue(1.14);
    const anim = Animated.spring(k, { toValue: 1, speed: 50, bounciness: 12, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [trigger, reduce, k]);
  return <Animated.View style={[style, { transform: [{ scale: k }] }]}>{children}</Animated.View>;
}

// Rows drop in one after another when a screen opens. Only on mount; later changes are left alone.
export function Enter({ index, children, style }: { index: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduce = useReduceMotion();
  const k = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    if (reduce) {
      k.setValue(1);
      return;
    }
    const anim = Animated.timing(k, {
      toValue: 1, duration: 160, delay: Math.min(index, 8) * 35, easing: Easing.out(Easing.back(2)), useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, []);
  return (
    <Animated.View
      style={[style, { opacity: k, transform: [{ translateY: k.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ring: { ...StyleSheet.absoluteFill, borderWidth: 3 },
});
