import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { formatMoney, isCurrencyCode, minorDigits } from '../core/money';
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
  // With rounds logged, only a code with the same decimal places is safe: old amounts keep their meaning.
  const digitsClash = valid && locked === true && minorDigits(code) !== minorDigits(currency);

  let note: string | null = null;
  if (locked !== null) {
    if (!valid) note = 'Use a 3-letter code like USD, EUR, PHP.';
    else if (digitsClash) note = `Locked to ${minorDigits(currency)} decimal places because rounds are already logged. ${code} uses ${minorDigits(code)}.`;
    else if (locked) note = `Looks like ${formatMoney(1234, code)}. Rounds are logged, so only codes with ${minorDigits(currency)} decimal places work.`;
    else note = `Looks like ${formatMoney(1234, code)}`;
  }

  return (
    <View style={styles.body}>
      <Stack.Screen options={{ title: 'Settings' }} />
      <Text style={styles.label}>Currency</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        editable={locked !== null}
        autoCapitalize="characters"
        maxLength={3}
        style={[styles.input, locked === null && styles.locked]}
      />
      {note && <Text style={styles.dim}>{note}</Text>}
      {locked !== null && (
        <Button label="Save" disabled={!valid || digitsClash || code === currency} onPress={async () => { const ok = await guarded("Couldn't save that", async () => { await setCurrency(code); return true; }); if (ok) router.back(); }} />
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
