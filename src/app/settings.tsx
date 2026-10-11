import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { formatMoney, isCurrencyCode } from '../core/money';
import { hasAnyExpenses } from '../db/repo';
import { useSettings } from '../state/settings';
import { Button } from '../ui/Button';
import { guarded, oops } from '../ui/oops';
import { theme } from '../ui/theme';

export default function Settings() {
  const db = useSQLiteContext();
  const { currency, setCurrency } = useSettings();
  const [text, setText] = useState(currency);
  const [locked, setLocked] = useState<boolean | null>(null);

  useEffect(() => {
    hasAnyExpenses(db).then(setLocked).catch(e => oops(e, "Couldn't check the currency lock"));
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
        editable={locked === false}
        autoCapitalize="characters"
        maxLength={3}
        style={[styles.input, locked !== false && styles.locked]}
      />
      {locked === null ? null : locked ? (
        <Text style={styles.dim}>Locked to {currency} because rounds are already logged. Changing it would change what old amounts mean.</Text>
      ) : (
        <Text style={styles.dim}>{valid ? `Looks like ${formatMoney(1234, code)}` : 'Use a 3-letter code like USD, EUR, PHP.'}</Text>
      )}
      {locked === false && (
        <Button label="Save" disabled={!valid || code === currency} onPress={async () => { const ok = await guarded("Couldn't save that", async () => { await setCurrency(code); return true; }); if (ok) router.back(); }} />
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
