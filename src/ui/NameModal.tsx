import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from './Button';
import { theme } from './theme';

interface Props {
  visible: boolean;
  initial: string;
  onDone: (title: string) => void;
  onClose: () => void;
}

// Renaming a night that has already started.
export function NameModal({ visible, initial, onDone, onClose }: Props) {
  const [text, setText] = useState(initial);
  useEffect(() => {
    if (visible) setText(initial);
  }, [visible, initial]);
  const ok = text.trim().length > 0;
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Name the night</Text>
          <TextInput
            autoFocus
            selectTextOnFocus
            value={text}
            onChangeText={setText}
            maxLength={40}
            placeholder="Karaoke outing!"
            placeholderTextColor={theme.color.inkDim}
            returnKeyType="done"
            onSubmitEditing={() => ok && onDone(text)}
            style={styles.input}
            accessibilityLabel="Night name"
          />
          <View style={styles.row}>
            <Button kind="ghost" label="Cancel" onPress={onClose} />
            <Button label="Save" disabled={!ok} onPress={() => onDone(text)} />
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
  input: { ...theme.type.big, color: theme.color.ink, borderBottomWidth: 3, borderColor: theme.color.accent, paddingVertical: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
});
