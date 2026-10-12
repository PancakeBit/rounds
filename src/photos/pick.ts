import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

// Asks camera or gallery, then returns the chosen picture's URI, or null if they backed out.
// The URI is a temporary copy; keep it with keepPicture.
export function pickPicture(title: string, opts: { square?: boolean } = {}): Promise<string | null> {
  return new Promise(resolve => {
    // A button press can be followed by a dismiss; the first answer given is the one that counts.
    let chosen = false;
    const go = (source: 'camera' | 'library') => {
      chosen = true;
      from(source, !!opts.square).then(resolve, () => resolve(null));
    };
    Alert.alert(title, undefined, [
      { text: 'Take a photo', onPress: () => go('camera') },
      { text: 'From gallery', onPress: () => go('library') },
      { text: 'Cancel', style: 'cancel', onPress: () => { chosen = true; resolve(null); } },
    ], { cancelable: true, onDismiss: () => { if (!chosen) resolve(null); } });
  });
}

async function from(source: 'camera' | 'library', square: boolean): Promise<string | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera is off', 'Allow the camera for Rounds in your phone settings, or pick from the gallery.');
      return null;
    }
  }
  // Square pictures (profile photos) get the system's crop step.
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9, ...(square ? { allowsEditing: true, aspect: [1, 1] as [number, number] } : {}) };
  const r = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  return r.canceled ? null : r.assets[0]?.uri ?? null;
}
