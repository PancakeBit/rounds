import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from './theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

interface Props {
  value: string;
  onChange: (v: string) => void;
  decimals: number;
}

export function AmountPad({ value, onChange, decimals }: Props) {
  function press(k: string) {
    if (k === '⌫') return onChange(value.slice(0, -1));
    if (k === '.') {
      if (decimals === 0 || value.includes('.')) return;
      return onChange(value === '' ? '0.' : `${value}.`);
    }
    const frac = value.split('.')[1];
    if (frac !== undefined && frac.length >= decimals) return;
    if (value.replace('.', '').length >= 9) return;
    onChange(value === '0' ? k : value + k);
  }
  return (
    <View style={styles.grid}>
      {KEYS.map(k => {
        const hidden = k === '.' && decimals === 0;
        return (
          <Pressable
            key={k}
            disabled={hidden}
            accessibilityLabel={k === '⌫' ? 'Delete' : k === '.' ? 'Decimal point' : k}
            onPress={() => {
              Haptics.selectionAsync();
              press(k);
            }}
            style={({ pressed }) => [styles.key, pressed && styles.down, hidden && styles.hidden]}
          >
            <Text style={styles.text}>{k}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  key: { width: '33.33%', height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.md },
  down: { backgroundColor: theme.color.surface },
  hidden: { opacity: 0 },
  text: { ...theme.type.display, color: theme.color.ink },
});
