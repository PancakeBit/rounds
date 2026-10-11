import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { minorToInput, parseMoney } from '../core/money';
import { Button } from './Button';
import { theme } from './theme';

interface Props {
  person: { name: string; emoji: string } | null;
  initial: number | null;
  onDone: (minor: number | null) => void;
  onClose: () => void;
}

// Something only this person had. It comes off the bill first; everyone in shares the rest.
export function ExtraModal({ person, initial, onDone, onClose }: Props) {
  const [text, setText] = useState('');
  useEffect(() => {
    setText(initial != null ? minorToInput(initial) : '');
  }, [person, initial]);
  const parsed = parseMoney(text);
  return (
    <Modal visible={person != null} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{person?.emoji} {person?.name}'s extra</Text>
          <TextInput
            autoFocus
            value={text}
            onChangeText={setText}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={theme.color.inkDim}
            style={styles.input}
          />
          <Text style={styles.hint}>
            What did only they have? It comes off the bill first, then everyone in splits the rest. Set their share to 0 if
            this is all they had.
          </Text>
          <View style={styles.row}>
            <Button kind="ghost" label="No extra" onPress={() => onDone(null)} />
            <Button label="Set" disabled={parsed == null} onPress={() => onDone(parsed ? parsed : null)} />
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
