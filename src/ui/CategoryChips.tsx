import { ScrollView, StyleSheet, Text } from 'react-native';
import { Tap } from './Tap';
import { CATEGORIES, type Category } from '../core/categories';
import { theme } from './theme';

// Pick one or more: a bill can be drinks and food. The last one picked can't be turned off.
export function CategoryChips({ value, onChange }: { value: Category[]; onChange: (c: Category[]) => void }) {
  const toggle = (c: Category) => {
    if (!value.includes(c)) onChange([...value, c]);
    else if (value.length > 1) onChange(value.filter(x => x !== c));
  };
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {CATEGORIES.map(c => {
        const on = value.includes(c.key);
        return (
          <Tap
            key={c.key}
            accessibilityRole="checkbox"
            accessibilityLabel={c.label}
            accessibilityState={{ checked: on }}
            onPress={() => toggle(c.key)}
            style={[styles.chip, on && styles.on]}
          >
            <Text style={[styles.text, on && styles.onText]}>{c.emoji} {c.label}</Text>
          </Tap>
        );
      })}
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
