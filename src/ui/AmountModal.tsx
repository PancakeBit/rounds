import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { parseMoney } from '../core/money';
import { Button } from './Button';
import { theme } from './theme';

interface Props {
  visible: boolean;
  title: string;
  hint?: string;
  confirm: string;
  onDone: (minor: number) => void;
  onClose: () => void;
}

// Type an amount and confirm it. Used for "paid part of it".
export function AmountModal({ visible, title, hint, confirm, onDone, onClose }: Props) {
  const [text, setText] = useState('');
  useEffect(() => { if (visible) setText(''); }, [visible]);
  const parsed = parseMoney(text);
  const ok = parsed != null && parsed > 0;
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            autoFocus
            value={text}
            onChangeText={setText}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={theme.color.inkDim}
            style={styles.input}
            accessibilityLabel={title}
          />
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          <View style={styles.row}>
            <Button kind="ghost" label="Cancel" onPress={onClose} />
            <Button label={confirm} disabled={!ok} onPress={() => ok && onDone(parsed!)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000a', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: theme.color.surface, borderRadius: theme.radius.lg, padding: 24, gap: 16 },
  title: { ...theme.type.title, color: theme.color.ink },
  input: { ...theme.type.display, color: theme.color.ink, borderBottomWidth: 3, borderColor: theme.color.accent, paddingVertical: 8 },
  hint: { ...theme.type.small, color: theme.color.inkDim },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
});
