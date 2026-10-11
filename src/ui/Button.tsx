import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from './theme';

type Kind = 'primary' | 'go' | 'dark' | 'ghost' | 'danger';

const FILL: Record<Kind, string> = {
  primary: theme.color.ink,
  go: theme.color.accent,
  dark: theme.color.bg,
  ghost: 'transparent',
  danger: theme.color.owes,
};
const TEXT: Record<Kind, string> = {
  primary: theme.color.bg,
  go: theme.color.bg,
  dark: theme.color.ink,
  ghost: theme.color.ink,
  danger: theme.color.bg,
};

interface Props {
  label: string;
  onPress: () => void;
  kind?: Kind;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ label, onPress, kind = 'primary', disabled, style }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: FILL[kind], opacity: disabled ? 0.4 : 1, transform: [{ translateY: pressed ? 2 : 0 }] },
        kind === 'ghost' && styles.ghost,
        style,
      ]}
    >
      <Text style={[kind === 'ghost' ? styles.small : styles.label, { color: TEXT[kind] }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: theme.tap, paddingHorizontal: 20, borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center' },
  ghost: { borderWidth: 2, borderColor: theme.color.line },
  label: { ...theme.type.big, letterSpacing: 1, textTransform: 'uppercase' },
  small: { ...theme.type.bodyBold },
});
