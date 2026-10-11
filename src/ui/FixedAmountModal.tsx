import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { minorToInput, parseMoney } from '../core/money';
import { Button } from './Button';
import { theme } from './theme';

interface Props {
  person: { name: string; emoji: string } | null;
  currency: string;
  initial: number | null;
  onDone: (minor: number | null) => void;
  onClose: () => void;
}

export function FixedAmountModal({ person, currency, initial, onDone, onClose }: Props) {
  const [text, setText] = useState('');
  useEffect(() => {
    setText(initial != null ? minorToInput(initial, currency) : '');
  }, [person, initial, currency]);
  const parsed = parseMoney(text, currency);
  return (
    <Modal visible={person != null} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{person?.emoji} {person?.name} pays exactly</Text>
          <TextInput
            autoFocus
            value={text}
            onChangeText={setText}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={theme.color.inkDim}
            style={styles.input}
          />
          <Text style={styles.hint}>Everyone else splits what's left.</Text>
          <View style={styles.row}>
            <Button kind="ghost" label="No fixed amount" onPress={() => onDone(null)} />
            <Button label="Set" disabled={parsed == null} onPress={() => onDone(parsed)} />
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
