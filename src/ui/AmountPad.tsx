import { StyleSheet, Text, View } from 'react-native';
import { Tap } from './Tap';
import { theme } from './theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function AmountPad({ value, onChange }: Props) {
  function press(k: string) {
    if (k === '⌫') return onChange(value.slice(0, -1));
    if (k === '.') {
      if (value.includes('.')) return;
      return onChange(value === '' ? '0.' : `${value}.`);
    }
    const frac = value.split('.')[1];
    if (frac !== undefined && frac.length >= 2) return;
    if (value.replace('.', '').length >= 9) return;
    onChange(value === '0' ? k : value + k);
  }
  return (
    <View style={styles.grid}>
      {KEYS.map(k => {
        return (
          <View key={k} style={styles.cell}>
            <Tap
              accessibilityRole="button"
              accessibilityLabel={k === '⌫' ? 'Delete' : k === '.' ? 'Decimal point' : k}
              onPress={() => press(k)}
              sink={0.86}
              ring={theme.color.accent}
              style={styles.key}
            >
              <Text style={styles.text}>{k}</Text>
            </Tap>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '33.33%', padding: 3 },
  key: { height: 60, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radius.md, backgroundColor: theme.color.surface },
  text: { ...theme.type.display, color: theme.color.ink },
});
