import { StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../Avatar';
import { theme } from '../theme';
import {
  allShots, ChalkArrow, Footer, Header, MoreBadge, Photo, Polaroid, Root, shotCaption, tilt, type CollageData, type Face,
} from './parts';

// Layouts built around one or two big prints: cover, single, bubbles, twoGroups, polaroids.

const C = theme.color;

// One face per person, end photo first, so nobody appears twice.
function onePerPerson(d: CollageData): Face[] {
  const out: Face[] = [];
  for (const m of d.members) {
    if (m.photoEnd) out.push({ member: m, uri: m.photoEnd, phase: 'end' });
    else if (m.photoStart) out.push({ member: m, uri: m.photoStart, phase: 'start' });
  }
  return out;
}

// 1. Magazine cover: the end group shot full-bleed (else the start one), a stacked title over it,
// face stickers along the bottom. When both group shots exist the start one is a small inset print.
export function Cover({ d }: { d: CollageData }) {
  const W = d.width;
  const H = Math.round(W * 1.32);
  const hero = (d.endGroup ?? d.startGroup)!;
  const inset = d.endGroup && d.startGroup ? d.startGroup : null;
  const faces = onePerPerson(d);
  const sticker = Math.round(W * 0.15);
  const maxStickers = Math.max(1, Math.floor((W - d.pad * 2 - sticker) / (sticker * 0.72)) + 1);
  const shown = faces.length > maxStickers ? faces.slice(0, maxStickers - 2) : faces;
  const extra = faces.length - shown.length;
  return (
    <Root width={W}>
      <View style={{ width: W, height: H }}>
        <Photo uri={hero} width={W} height={H} />
        <View style={[cover.scrim, { height: H * 0.42 }]} />
        <View style={[cover.scrimLow, { height: sticker + d.pad * 2 }]} />
        <View style={{ position: 'absolute', top: d.pad, left: d.pad, right: d.pad }}>
          <Text style={cover.kicker} numberOfLines={1} adjustsFontSizeToFit>{d.date}</Text>
          <Text style={[cover.title, { fontSize: W * 0.27, lineHeight: W * 0.28 }]} numberOfLines={3} adjustsFontSizeToFit>
            {d.night.title}
          </Text>
          <Text style={cover.times} numberOfLines={1}>{d.startTime} → {d.endTime}</Text>
        </View>
        {inset ? (
          <Polaroid
            uri={inset}
            width={Math.round(W * 0.3)}
            caption="START"
            rotate={5}
            style={{ position: 'absolute', right: d.pad, bottom: sticker + d.pad * 2.2 }}
          />
        ) : null}
        {faces.length > 0 ? (
          <View style={[cover.strip, { left: d.pad, bottom: d.pad, height: sticker }]}>
            {shown.map((f, i) => (
              <View key={f.member.id} style={{ marginLeft: i === 0 ? 0 : -sticker * 0.28, transform: [{ rotate: `${tilt(i) / 2}deg` }] }}>
                <Avatar person={f.member} photo={f.uri} size={sticker} />
              </View>
            ))}
            {extra > 0 ? <MoreBadge n={extra} size={sticker * 0.8} style={{ marginLeft: 4 }} /> : null}
          </View>
        ) : null}
      </View>
      <Footer style={{ padding: d.pad, paddingTop: d.pad * 0.6, paddingBottom: d.pad * 0.6 }} />
    </Root>
  );
}

const cover = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: C.bg, opacity: 0.62 },
  scrimLow: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bg, opacity: 0.45 },
  kicker: { ...theme.type.label, color: C.accent },
  title: { ...theme.type.hero, color: C.ink, textTransform: 'uppercase' },
  times: { ...theme.type.bodyBold, color: C.ink },
  strip: { position: 'absolute', flexDirection: 'row', alignItems: 'center' },
});

// 12. One big polaroid of the best photo, the title written as its caption.
export function Single({ d }: { d: CollageData }) {
  const W = d.width;
  const best =
    d.endGroup ?? d.startGroup ?? d.endFaces[0]?.uri ?? d.startFaces[0]?.uri ?? null;
  const pw = Math.round(W * 0.8);
  return (
    <Root width={W} style={{ padding: d.pad, paddingTop: d.pad * 2 }}>
      {best ? (
        <View style={{ alignItems: 'center' }}>
          <Polaroid uri={best} width={pw} photoHeight={Math.round(pw * 1.05)} caption={d.night.title} rotate={-2} />
        </View>
      ) : null}
      <View style={{ marginTop: d.pad * 1.6, alignItems: 'center' }}>
        <Text style={single.date} numberOfLines={1} adjustsFontSizeToFit>{d.date}</Text>
        <Text style={single.times} numberOfLines={1}>{d.startTime} → {d.endTime}</Text>
      </View>
      <Footer style={{ marginTop: d.pad }} />
    </Root>
  );
}

const single = StyleSheet.create({
  date: { ...theme.type.label, color: C.accent },
  times: { ...theme.type.title, color: C.ink, marginTop: 4 },
});

// 8. A group shot with everyone's face stuck round its border like stickers.
// Uses the end group shot when there are two; the start one is left out of this layout.
export function Bubbles({ d }: { d: CollageData }) {
  const W = d.width;
  const group = (d.endGroup ?? d.startGroup)!;
  const all = onePerPerson(d);
  const faces = all.slice(0, 12);
  const extra = all.length - faces.length;
  const base = Math.round(W * (faces.length > 8 ? 0.15 : 0.18));
  const sizeOf = (i: number) => Math.round(base * (1 + ((i * 5) % 3) * 0.14));
  const big = Math.round(base * 1.28);
  const m = Math.ceil(big / 2) + 4;
  const pw = W - m * 2;
  const ph = Math.round(pw * 1.12);
  // Walk the photo's border clockwise from the top-left, a sticker every perimeter / n.
  const per = 2 * (pw + ph);
  const spots = faces.map((_, i) => {
    let t = ((i + 0.35) / faces.length) * per;
    if (t < pw) return { x: t, y: 0 };
    t -= pw;
    if (t < ph) return { x: pw, y: t };
    t -= ph;
    if (t < pw) return { x: pw - t, y: ph };
    t -= pw;
    return { x: 0, y: ph - t };
  });
  return (
    <Root width={W} style={{ paddingTop: d.pad }}>
      <Header d={d} style={{ paddingHorizontal: d.pad, marginBottom: d.pad * 0.6 }} />
      <View style={{ width: W, height: ph + m * 2 }}>
        <Photo uri={group} width={pw} height={ph} radius={theme.radius.md} style={{ position: 'absolute', left: m, top: m, borderWidth: 3, borderColor: C.ink }} />
        {faces.map((f, i) => {
          const s = sizeOf(i);
          return (
            <View key={f.member.id} style={{ position: 'absolute', left: m + spots[i].x - s / 2, top: m + spots[i].y - s / 2, transform: [{ rotate: `${tilt(i)}deg` }] }}>
              <Avatar person={f.member} photo={f.uri} size={s} />
            </View>
          );
        })}
        {extra > 0 ? <MoreBadge n={extra} size={base} style={{ position: 'absolute', right: m + 8, bottom: m + 8 }} /> : null}
      </View>
      <Footer style={{ paddingHorizontal: d.pad, paddingBottom: d.pad * 0.8 }} />
    </Root>
  );
}

// 5. Start and end group shots as two overlapping prints, with times and a chalk arrow between them.
export function TwoGroups({ d }: { d: CollageData }) {
  const W = d.width;
  const pw = Math.round(W * 0.66);
  const lip = Math.max(26, Math.round(pw * 0.17));
  const edge = Math.max(5, Math.round(pw * 0.05));
  const photoH = Math.round((pw - edge * 2) * 0.86);
  const printH = photoH + edge + lip;
  const overlap = Math.round(printH * 0.22);
  const top = d.pad;
  const h = top + printH * 2 - overlap + d.pad * 1.4;
  const side = W - pw - d.pad * 2; // the free column beside each print
  return (
    <Root width={W} style={{ paddingTop: d.pad }}>
      <Header d={d} lines={2} style={{ paddingHorizontal: d.pad }} />
      <View style={{ width: W, height: h }}>
        <Polaroid uri={d.startGroup!} width={pw} photoHeight={photoH} caption="START" rotate={-3} style={{ position: 'absolute', left: d.pad, top }} />
        <View style={[two.label, { right: d.pad, top: top + printH * 0.22, width: side - 6, alignItems: 'flex-end' }]}>
          <Text style={two.word}>START</Text>
          <Text style={two.time} numberOfLines={1} adjustsFontSizeToFit>{d.startTime}</Text>
        </View>
        <Polaroid
          uri={d.endGroup!}
          width={pw}
          photoHeight={photoH}
          caption="END"
          rotate={3}
          style={{ position: 'absolute', right: d.pad, top: top + printH - overlap }}
        />
        <ChalkArrow x={d.pad + side * 0.5} y={top + printH + overlap * 0.3} length={Math.min(side * 0.9, 70)} angle={70} color={C.accent} thickness={4} />
        <View style={[two.label, { left: d.pad, top: top + printH + overlap * 1.4, width: side - 6 }]}>
          <Text style={[two.word, { color: C.accent }]}>END</Text>
          <Text style={two.time} numberOfLines={1} adjustsFontSizeToFit>{d.endTime}</Text>
        </View>
      </View>
      <Footer style={{ paddingHorizontal: d.pad, paddingBottom: d.pad * 0.8 }} />
    </Root>
  );
}

const two = StyleSheet.create({
  label: { position: 'absolute' },
  word: { ...theme.type.label, color: C.inkDim },
  time: { ...theme.type.big, color: C.ink },
});

// 3. Polaroids scattered down the board, tilted by index, overlapping a little. Eight at most.
export function Polaroids({ d }: { d: CollageData }) {
  const W = d.width;
  const shots = allShots(d);
  const shown = shots.slice(0, 8);
  const extra = shots.length - shown.length;
  const pw = Math.round(W * (shown.length <= 2 ? 0.56 : 0.47));
  const lip = Math.max(26, Math.round(pw * 0.17));
  const edge = Math.max(5, Math.round(pw * 0.05));
  const ph = pw - edge * 2 + edge + lip;
  const step = Math.round(ph * 0.74);
  const drop = Math.round(ph * 0.3);
  const spots = shown.map((_, i) => {
    const lastAlone = i === shown.length - 1 && shown.length % 2 === 1 && shown.length > 1;
    const col = i % 2;
    const jitter = ((i * 13) % 5) * 3;
    const x = lastAlone ? (W - pw) / 2 : col === 0 ? d.pad + jitter : W - pw - d.pad - jitter;
    const y = Math.floor(i / 2) * step + (col === 1 ? drop : 0);
    return { x, y };
  });
  const height = Math.max(...spots.map(s => s.y)) + ph + d.pad;
  return (
    <Root width={W} style={{ paddingTop: d.pad }}>
      <Header d={d} style={{ paddingHorizontal: d.pad, marginBottom: d.pad }} />
      <View style={{ width: W, height }}>
        {shown.map((s, i) => (
          <Polaroid
            key={`${s.phase}-${s.kind}-${s.member?.id ?? 'g'}`}
            uri={s.uri}
            width={pw}
            caption={shotCaption(d, s)}
            mark={s.member?.color}
            rotate={tilt(i)}
            style={{ position: 'absolute', left: spots[i].x, top: spots[i].y }}
          />
        ))}
        {extra > 0 ? <MoreBadge n={extra} size={Math.round(W * 0.16)} style={{ position: 'absolute', right: d.pad + 6, bottom: d.pad + 6 }} /> : null}
      </View>
      <Footer style={{ paddingHorizontal: d.pad, paddingBottom: d.pad * 0.8 }} />
    </Root>
  );
}
