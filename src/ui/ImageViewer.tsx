import { Image, Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tap } from './Tap';
import { theme } from './theme';

// A picture full screen: a receipt, or a QR code held up for someone to scan. Tap anywhere to close.
export function ImageViewer({ uri, caption, onClose }: { uri: string | null; caption?: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={uri != null} transparent animationType="fade" onRequestClose={onClose}>
      <Tap onPress={onClose} ring={null} sink={1} style={[styles.backdrop, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]} accessibilityLabel="Close">
        {caption ? <Text style={styles.caption}>{caption}</Text> : null}
        <View style={styles.frame}>
          {uri && <Image source={{ uri }} style={styles.image} resizeMode="contain" />}
        </View>
        <Text style={styles.hint}>Tap to close</Text>
      </Tap>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000e', paddingHorizontal: 16, gap: 12 },
  frame: { flex: 1 },
  image: { flex: 1, width: '100%' },
  caption: { ...theme.type.title, color: theme.color.ink, textAlign: 'center' },
  hint: { ...theme.type.small, color: theme.color.inkDim, textAlign: 'center' },
});
