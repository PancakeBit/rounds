import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from './Button';
import { theme } from './theme';

interface Props {
  visible: boolean;
  initial: string;
  onDone: (title: string) => void;
  onClose: () => void;
  title?: string;
  placeholder?: string;
  maxLength?: number;
}

// Renaming something: a night that has already started, or the group.
export function NameModal({ visible, initial, onDone, onClose, title = 'Name the night', placeholder = 'Karaoke outing!', maxLength = 40 }: Props) {
  const [text, setText] = useState(initial);
  useEffect(() => {
    if (visible) setText(initial);
  }, [visible, initial]);
  const ok = text.trim().length > 0;
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            autoFocus
            selectTextOnFocus
            value={text}
            onChangeText={setText}
            maxLength={maxLength}
            placeholder={placeholder}
            placeholderTextColor={theme.color.inkDim}
            returnKeyType="done"
            onSubmitEditing={() => ok && onDone(text)}
            style={styles.input}
            accessibilityLabel={title}
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
