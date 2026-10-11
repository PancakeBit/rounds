import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { formatMoney, isCurrencyCode } from '../core/money';
import { hasAnyExpenses } from '../db/repo';
import { useSettings } from '../state/settings';
import { Button } from '../ui/Button';
import { theme } from '../ui/theme';

export default function Settings() {
  const db = useSQLiteContext();
  const { currency, setCurrency } = useSettings();
  const [text, setText] = useState(currency);
  const [locked, setLocked] = useState(true);

  useEffect(() => {
    hasAnyExpenses(db).then(setLocked);
  }, [db]);

  const code = text.trim().toUpperCase();
  const valid = isCurrencyCode(code);

  return (
    <View style={styles.body}>
      <Stack.Screen options={{ title: 'Settings' }} />
      <Text style={styles.label}>Currency</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        editable={!locked}
        autoCapitalize="characters"
        maxLength={3}
        style={[styles.input, locked && styles.locked]}
      />
      {locked ? (
        <Text style={styles.dim}>Locked to {currency} because rounds are already logged. Changing it would change what old amounts mean.</Text>
      ) : (
        <Text style={styles.dim}>{valid ? `Looks like ${formatMoney(1234, code)}` : 'Use a 3-letter code like USD, EUR, PHP.'}</Text>
      )}
      {!locked && (
        <Button label="Save" disabled={!valid || code === currency} onPress={async () => { await setCurrency(code); router.back(); }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 20, gap: 12 },
  label: { ...theme.type.title, color: theme.color.ink },
  input: {
    minHeight: theme.tap, ...theme.type.display, color: theme.color.ink,
    backgroundColor: theme.color.surface, borderRadius: theme.radius.md, paddingHorizontal: 16,
  },
  locked: { opacity: 0.5 },
  dim: { ...theme.type.body, color: theme.color.inkDim },
});
