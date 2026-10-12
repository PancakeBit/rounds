import { Image, StyleSheet, Text, View } from 'react-native';
import { theme } from './theme';

interface Props {
  person: { name: string; emoji: string; color: string; photoUri?: string | null };
  photo?: string | null;
  size?: number;
  showName?: boolean;
  dimmed?: boolean;
  noProfile?: boolean; // the night line-up: an empty slot must look empty until tonight's photo is taken
}

// A night photo when there is one, else their profile picture, else their emoji, all in the same chalk ring.
export function Avatar({ person, photo: nightPhoto, size = 48, showName = false, dimmed = false, noProfile = false }: Props) {
  const photo = nightPhoto || (noProfile ? null : person.photoUri);
  const ring = Math.max(2, Math.round(size / 22));
  const inner = size - ring * 2;
  return (
    <View style={[styles.wrap, { opacity: dimmed ? 0.35 : 1 }]}>
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, borderWidth: ring, borderColor: person.color }]}>
        {photo ? (
          <Image source={{ uri: photo }} style={{ width: inner, height: inner, borderRadius: inner / 2 }} accessibilityIgnoresInvertColors />
        ) : (
          <Text style={{ fontSize: size * 0.5 }}>{person.emoji}</Text>
        )}
      </View>
      {showName && <Text style={[styles.name, { maxWidth: size + 24 }]} numberOfLines={1}>{person.name}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: theme.color.surface },
  name: { ...theme.type.smallBold, color: theme.color.ink, marginTop: 4 },
});
