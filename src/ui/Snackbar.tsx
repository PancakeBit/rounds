import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from './theme';

interface Props {
  visible: boolean;
  message: string;
  action: string;
  onAction: () => void;
  onHide: () => void;
  /** Distance above the bottom inset. Defaults to 24. */
  bottomOffset?: number;
}

export function Snackbar({ visible, message, action, onAction, onHide, bottomOffset = 24 }: Props) {
  const insets = useSafeAreaInsets();
  const hide = useRef(onHide);
  hide.current = onHide;
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => hide.current(), 5000);
    return () => clearTimeout(t);
  }, [visible]);
  if (!visible) return null;
  return (
    <View style={[styles.bar, { bottom: insets.bottom + bottomOffset }]}>
      <Text style={styles.msg}>{message}</Text>
      <Pressable onPress={onAction} hitSlop={16} accessibilityRole="button">
        <Text style={styles.action}>{action}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute', left: 16, right: 16, minHeight: theme.tap, paddingHorizontal: 20,
    borderRadius: theme.radius.md, backgroundColor: theme.color.ink, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  msg: { ...theme.type.bodyBold, color: theme.color.bg },
  action: { ...theme.type.label, color: theme.color.bg, textDecorationLine: 'underline' },
});
