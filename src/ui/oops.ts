import { Alert } from 'react-native';

export function oops(e: unknown, what: string): void {
  const message = (e as Error)?.message ?? String(e);
  Alert.alert(what, message + '\nTry again.');
}

export async function guarded<T>(what: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    oops(e, what);
    return undefined;
  }
}
