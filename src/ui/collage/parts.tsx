import type { ReactNode } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { Night, NightMember } from '../../db/repo';
import { theme } from '../theme';

// Shared pieces for the collage layouts. Everything here is static: the collage is captured
// to a PNG, so nothing animates and every "random" choice comes from an index.

const C = theme.color;

export type Phase = 'start' | 'end';
export interface Face { member: NightMember; uri: string; phase: Phase }
export interface Shot { uri: string; kind: 'group' | 'face'; phase: Phase; member?: NightMember }

export interface CollageData {
  night: Night;
  members: NightMember[];
  width: number;
  pad: number;
  startGroup: string | null;
  endGroup: string | null;
  startFaces: Face[];
  endFaces: Face[];
  pairs: { member: NightMember; start: string; end: string }[];
  startTime: string;
  endTime: string;
  date: string;
}

export function timeLabel(ms: number | null): string {
  if (ms == null) return 'Late';
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function dateLabel(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function collageData(night: Night, members: NightMember[], width: number): CollageData {
  const startFaces: Face[] = [];
  const endFaces: Face[] = [];
  const pairs: CollageData['pairs'] = [];
  for (const m of members) {
    if (m.photoStart) startFaces.push({ member: m, uri: m.photoStart, phase: 'start' });
    if (m.photoEnd) endFaces.push({ member: m, uri: m.photoEnd, phase: 'end' });
    if (m.photoStart && m.photoEnd) pairs.push({ member: m, start: m.photoStart, end: m.photoEnd });
  }
  return {
    night, members, width,
    pad: Math.round(width * 0.045),
    startGroup: night.groupPhotoStart,
    endGroup: night.groupPhoto,
    startFaces, endFaces, pairs,
    startTime: timeLabel(night.startedAt),
    endTime: timeLabel(night.endedAt),
    date: dateLabel(night.startedAt),
  };
}

// Every photo of the night in time order: start group, start faces, end group, end faces.
export function allShots(d: CollageData): Shot[] {
  const out: Shot[] = [];
  if (d.startGroup) out.push({ uri: d.startGroup, kind: 'group', phase: 'start' });
  for (const f of d.startFaces) out.push({ uri: f.uri, kind: 'face', phase: 'start', member: f.member });
  if (d.endGroup) out.push({ uri: d.endGroup, kind: 'group', phase: 'end' });
  for (const f of d.endFaces) out.push({ uri: f.uri, kind: 'face', phase: 'end', member: f.member });
  return out;
}

// Caption for a shot: a person's name, or which group shot it is.
export function shotCaption(d: CollageData, s: Shot): string {
  if (s.kind === 'face') return s.member?.name ?? '';
  if (d.startGroup && d.endGroup) return s.phase === 'start' ? 'START' : 'END';
  return 'THE CREW';
}

// A tilt of 3 to 8 degrees, alternating sides, fixed by position.
export function tilt(i: number): number {
  return (i % 2 === 0 ? -1 : 1) * (3 + ((i * 7 + 3) % 6));
}

export const two = (n: number) => String(n).padStart(2, '0');

// The capture root: exact width, solid slate, nothing escapes it.
export function Root({ width, children, style }: { width: number; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View collapsable={false} style={[styles.root, { width }, style]}>
      {children}
    </View>
  );
}

export function Photo({ uri, width, height, radius = 0, style }: { uri: string; width: number; height: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: C.surface }, style]}>
      <Image source={{ uri }} style={{ width, height }} resizeMode="cover" accessibilityIgnoresInvertColors />
    </View>
  );
}

// A square face: the photo, or the person's emoji on a tile tinted with their colour.
export function FaceTile({ member, uri, size, radius = theme.radius.sm, ring = false }: { member: NightMember; uri?: string | null; size: number; radius?: number; ring?: boolean }) {
  const border = ring ? { borderWidth: Math.max(2, Math.round(size / 30)), borderColor: member.color } : null;
  if (uri) return <Photo uri={uri} width={size} height={size} radius={radius} style={border} />;
  return (
    <View style={[styles.emojiTile, { width: size, height: size, borderRadius: radius }, border]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: member.color, opacity: 0.28 }]} />
      <Text style={{ fontSize: size * 0.48 }}>{member.emoji}</Text>
    </View>
  );
}

// A chalk polaroid: the frame is chalk, the caption is written in slate on the bottom lip.
export function Polaroid({ uri, width, photoHeight, caption, mark, rotate = 0, style }: {
  uri: string; width: number; photoHeight?: number; caption?: string; mark?: string; rotate?: number; style?: StyleProp<ViewStyle>;
}) {
  const edge = Math.max(5, Math.round(width * 0.05));
  const inner = width - edge * 2;
  const lip = caption ? Math.max(26, Math.round(width * 0.17)) : edge * 2.4;
  return (
    <View style={[styles.polaroid, { width, padding: edge, paddingBottom: 0, transform: [{ rotate: `${rotate}deg` }] }, style]}>
      <Photo uri={uri} width={inner} height={photoHeight ?? inner} />
      <View style={{ height: lip, justifyContent: 'center' }}>
        {caption ? (
          <View style={styles.capRow}>
            <Text style={[styles.caption, { fontSize: Math.min(theme.font.big, lip * 0.62) }]} numberOfLines={1} adjustsFontSizeToFit>
              {caption}
            </Text>
            {mark ? <View style={[styles.capMark, { backgroundColor: mark }]} /> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

// Title, date kicker and start→end times. `size` scales the title.
export function Header({ d, size = theme.font.display, align = 'left', lines = 2, style }: {
  d: CollageData; size?: number; align?: 'left' | 'center'; lines?: number; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ alignItems: align === 'center' ? 'center' : 'flex-start' }, style]}>
      <Text style={styles.kicker} numberOfLines={1} adjustsFontSizeToFit>{d.date}</Text>
      <Text style={[styles.title, { fontSize: size, lineHeight: size * 1.04, textAlign: align }]} numberOfLines={lines} adjustsFontSizeToFit>
        {d.night.title}
      </Text>
      <Text style={styles.times} numberOfLines={1}>{d.startTime} → {d.endTime}</Text>
    </View>
  );
}

export function Footer({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.footer, style]}>
      <View style={styles.footDot} />
      <Text style={styles.footText}>ROUNDS</Text>
    </View>
  );
}

// "+3" chalked in a ring, for photos that didn't fit.
export function MoreBadge({ n, size = 44, style }: { n: number; size?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.more, { width: size, height: size, borderRadius: size / 2, transform: [{ rotate: '-8deg' }] }, style]}>
      <Text style={[styles.moreText, { fontSize: size * 0.42 }]} numberOfLines={1} adjustsFontSizeToFit>+{n}</Text>
    </View>
  );
}

// A static hand-drawn ring around its parent. The parent must leave `inset` of room around itself.
export function ChalkRing({ inset = 6, color = C.accent, rotate = -4 }: { inset?: number; color?: string; rotate?: number }) {
  return (
    <View
      pointerEvents="none"
      style={[styles.ring, { top: -inset, bottom: -inset, left: -inset, right: -inset, borderColor: color, transform: [{ rotate: `${rotate}deg` }] }]}
    />
  );
}

// A chalk arrow of `length` pointing along `angle` degrees (0 = right, 90 = down), centred at (x, y).
export function ChalkArrow({ x, y, length, angle, color = C.ink, thickness = 3 }: { x: number; y: number; length: number; angle: number; color?: string; thickness?: number }) {
  const head = Math.max(10, length * 0.22);
  const stroke = { position: 'absolute' as const, height: thickness, borderRadius: thickness / 2, backgroundColor: color };
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: x - length / 2, top: y - thickness / 2, width: length, height: thickness, transform: [{ rotate: `${angle}deg` }] }}
    >
      <View style={[stroke, { left: 0, width: length, top: 0 }]} />
      <View style={[stroke, { right: 0, width: head, top: 0, transformOrigin: 'right center', transform: [{ rotate: '35deg' }] }]} />
      <View style={[stroke, { right: 0, width: head, top: 0, transformOrigin: 'right center', transform: [{ rotate: '-35deg' }] }]} />
    </View>
  );
}

// A hand-ruled chalk line, as a plain rule.
export function Rule({ vertical = false, style }: { vertical?: boolean; style?: StyleProp<ViewStyle> }) {
  return <View style={[vertical ? { width: 2, alignSelf: 'stretch' } : { height: 2, alignSelf: 'stretch' }, { backgroundColor: C.line }, style]} />;
}

export const styles = StyleSheet.create({
  root: { backgroundColor: C.bg, overflow: 'hidden' },
  emojiTile: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: C.surface },
  polaroid: { backgroundColor: C.ink, borderRadius: 2 },
  capRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  caption: { ...theme.type.big, color: C.bg, textTransform: 'uppercase', flexShrink: 1 },
  capMark: { width: 10, height: 10, borderRadius: 5 },
  kicker: { ...theme.type.label, color: C.accent },
  title: { ...theme.type.display, color: C.ink, textTransform: 'uppercase' },
  times: { ...theme.type.bodyBold, color: C.inkDim, marginTop: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  footDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.owes },
  footText: { ...theme.type.label, fontSize: theme.font.small, color: C.inkDim },
  more: { borderWidth: 3, borderColor: C.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  moreText: { ...theme.type.big, color: C.ink },
  ring: { position: 'absolute', borderWidth: 3, borderRadius: 999, opacity: 0.95 },
});
