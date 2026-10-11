import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { formatMoney } from '../core/money';
import { getSetting, setSetting } from '../db/repo';

interface Settings {
  currency: string;
  setCurrency: (code: string) => Promise<void>;
}

const SettingsContext = createContext<Settings | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [currency, setCurrencyState] = useState<string | null>(null);

  useEffect(() => {
    getSetting(db, 'currency')
      .then(v => setCurrencyState(v ?? 'USD'))
      .catch(e => {
        console.warn('Could not read the currency setting, using USD', e);
        setCurrencyState('USD');
      });
  }, [db]);

  const setCurrency = useCallback(async (code: string) => {
    await setSetting(db, 'currency', code);
    setCurrencyState(code);
  }, [db]);

  if (!currency) return null;
  return <SettingsContext.Provider value={{ currency, setCurrency }}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Settings {
  const v = useContext(SettingsContext);
  if (!v) throw new Error('useSettings used outside SettingsProvider');
  return v;
}

export function useMoney(): (minor: number) => string {
  const { currency } = useSettings();
  return useCallback((minor: number) => formatMoney(minor, currency), [currency]);
}
