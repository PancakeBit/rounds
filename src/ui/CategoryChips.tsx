import { ScrollView, StyleSheet, Text } from 'react-native';
import { Tap } from './Tap';
import { CATEGORIES, type Category } from '../core/categories';
import { theme } from './theme';

export function CategoryChips({ value, onChange }: { value: Category; onChange: (c: Category) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {CATEGORIES.map(c => (
        <Tap
          key={c.key}
          accessibilityRole="button"
          accessibilityState={{ selected: value === c.key }}
          onPress={() => onChange(c.key)}
          style={[styles.chip, value === c.key && styles.on]}
        >
          <Text style={[styles.text, value === c.key && styles.onText]}>{c.emoji} {c.label}</Text>
        </Tap>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 4 },
  chip: { minHeight: theme.tap, paddingHorizontal: 16, borderRadius: theme.radius.md, borderWidth: 2, borderColor: theme.color.line, justifyContent: 'center' },
  on: { backgroundColor: theme.color.ink, borderColor: theme.color.ink },
  text: { ...theme.type.bodyBold, color: theme.color.ink },
  onText: { color: theme.color.bg },
});
