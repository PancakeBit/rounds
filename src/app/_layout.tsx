import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { BigShouldersDisplay_700Bold, BigShouldersDisplay_900Black, useFonts } from '@expo-google-fonts/big-shoulders-display';
import { Barlow_500Medium, Barlow_700Bold } from '@expo-google-fonts/barlow';
import { migrate } from '../db/schema';
import { SettingsProvider } from '../state/settings';
import { theme } from '../ui/theme';

export default function RootLayout() {
  // The keys become the family names that theme.face refers to.
  const [fontsLoaded, fontError] = useFonts({ BigShouldersDisplay_700Bold, BigShouldersDisplay_900Black, Barlow_500Medium, Barlow_700Bold });
  if (fontError) console.warn('Font load failed, using system fonts', fontError);
  if (!fontsLoaded && !fontError) return null;
  return (
    <SQLiteProvider databaseName="rounds.db" onInit={migrate}>
      <SettingsProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.color.bg },
            headerTintColor: theme.color.ink,
            headerTitleStyle: { fontFamily: theme.face.displayBold, fontSize: theme.font.title },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: theme.color.bg },
          }}
        />
      </SettingsProvider>
    </SQLiteProvider>
  );
}
