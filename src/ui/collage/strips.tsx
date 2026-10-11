import type { ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../Avatar';
import { theme } from '../theme';
import {
  allShots, FaceTile, Footer, Header, MoreBadge, Photo, Root, shotCaption, two, type CollageData, type Face, type Shot,
} from './parts';

// Strip-shaped layouts: filmstrip, photobooth, timeline.

const C = theme.color;

// Sprocket holes down one edge of a film segment.
function Sprockets({ height, side }: { height: number; side: 'left' | 'right' }) {
  const pitch = 16;
  const n = Math.max(1, Math.floor(height / pitch));
  const top = (height - n * pitch) / 2;
  return (
    <View style={[film.holes, side === 'left' ? { left: 6 } : { right: 6 }, { top }]}>
      {Array.from({ length: n }, (_, i) => <View key={i} style={film.hole} />)}
    </View>
  );
}

// 6. A vertical film strip on the slate, frames in time order, each labelled beside the strip.
export function Filmstrip({ d }: { d: CollageData }) {
  const W = d.width;
  const shots = allShots(d);
  const shown = shots.slice(0, 10);
  const extra = shots.length - shown.length;
  const stripW = Math.round(W * 0.64);
  const edge = 24;
  const frameW = stripW - edge * 2;
  const labelW = W - d.pad * 2 - stripW - 12;
  const frameH = (s: Shot) => Math.round(frameW * (s.kind === 'group' ? 0.75 : 1));
  const leader = 34;
  return (
    <Root width={W} style={{ paddingVertical: d.pad }}>
      <Header d={d} style={{ paddingHorizontal: d.pad, marginBottom: d.pad }} />
      <View style={{ paddingHorizontal: d.pad }}>
        <View style={[film.seg, { width: stripW, height: leader }]}>
          <Sprockets height={leader} side="left" />
          <Sprockets height={leader} side="right" />
          <Text style={film.brand} numberOfLines={1}>ROUNDS 400 · {two(shown.length)}</Text>
        </View>
        {shown.map((s, i) => {
          const h = frameH(s) + 26;
          return (
            <View key={`${s.phase}-${s.kind}-${s.member?.id ?? 'g'}`} style={film.row}>
              <View style={[film.seg, { width: stripW, height: h }]}>
                <Sprockets height={h} side="left" />
                <Sprockets height={h} side="right" />
                <View style={{ position: 'absolute', left: edge, top: 4 }}>
                  <Photo uri={s.uri} width={frameW} height={frameH(s)} radius={2} />
                  <Text style={film.num}>{two(i + 1)}</Text>
                </View>
              </View>
              <View style={{ width: labelW, paddingTop: 6 }}>
                <Text style={[film.label, { color: s.member?.color ?? (s.phase === 'start' ? C.ink : C.accent) }]} numberOfLines={2} adjustsFontSizeToFit>
                  {shotCaption(d, s)}
                </Text>
                {s.kind === 'group' || i === 0 || shown[i - 1].phase !== s.phase ? (
                  <Text style={film.time} numberOfLines={1} adjustsFontSizeToFit>{s.phase === 'start' ? d.startTime : d.endTime}</Text>
                ) : null}
              </View>
            </View>
          );
        })}
        <View style={film.row}>
          <View style={[film.seg, { width: stripW, height: leader }]}>
            <Sprockets height={leader} side="left" />
            <Sprockets height={leader} side="right" />
          </View>
          {extra > 0 ? <MoreBadge n={extra} size={40} style={{ marginTop: -10 }} /> : null}
        </View>
      </View>
      <Footer style={{ paddingHorizontal: d.pad, marginTop: d.pad * 0.8 }} />
    </Root>
  );
}

const film = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  seg: { backgroundColor: C.surface, borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.line },
  holes: { position: 'absolute', gap: 6 },
  hole: { width: 10, height: 10, borderRadius: 2, backgroundColor: C.bg },
  brand: { ...theme.type.smallBold, color: C.inkDim, textAlign: 'center', marginTop: 8, letterSpacing: 2 },
  num: { ...theme.type.small, color: C.inkDim, marginTop: 3, fontVariant: ['tabular-nums'] },
  label: { ...theme.type.title, textTransform: 'uppercase' },
  time: { ...theme.type.smallBold, color: C.inkDim, marginTop: 2 },
});

interface Strip { frames: { uri: string; face?: Face }[]; word: string; time: string }

// The frames for one phase: its faces (four at most), topped up with its group shot when short.
function phaseStrip(d: CollageData, phase: 'start' | 'end'): Strip {
  const faces = phase === 'start' ? d.startFaces : d.endFaces;
  const group = phase === 'start' ? d.startGroup : d.endGroup;
  const frames: Strip['frames'] = faces.slice(0, 4).map(f => ({ uri: f.uri, face: f }));
  if (frames.length < 3 && group) frames.unshift({ uri: group });
  return { frames, word: phase === 'start' ? 'START' : 'END', time: phase === 'start' ? d.startTime : d.endTime };
}

// 10. Photobooth strips: a start strip and an end strip when both phases have faces, else one strip.
export function Photobooth({ d }: { d: CollageData }) {
  const W = d.width;
  const a = phaseStrip(d, 'start');
  const b = phaseStrip(d, 'end');
  let strips: Strip[];
  if (d.startFaces.length > 0 && d.endFaces.length > 0 && a.frames.length >= 2 && b.frames.length >= 2) strips = [a, b];
  else {
    const faces = [...d.startFaces, ...d.endFaces];
    const only = d.startFaces.length === 0 ? 'END' : d.endFaces.length === 0 ? 'START' : 'THE NIGHT';
    strips = [{
      frames: faces.slice(0, 4).map(f => ({ uri: f.uri, face: f })),
      word: only,
      time: only === 'START' ? d.startTime : only === 'END' ? d.endTime : `${d.startTime} → ${d.endTime}`,
    }];
  }
  const stripW = Math.round(W * (strips.length === 2 ? 0.39 : 0.5));
  const edge = Math.round(stripW * 0.07);
  const frame = stripW - edge * 2;
  const totalFaces = d.startFaces.length + d.endFaces.length;
  const shownFaces = strips.reduce((n, s) => n + s.frames.filter(f => f.face).length, 0);
  return (
    <Root width={W} style={{ padding: d.pad }}>
      <Header d={d} align="center" style={{ marginBottom: d.pad * 1.2 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: W * 0.06 }}>
        {strips.map((s, k) => (
          <View
            key={s.word}
            style={[booth.strip, { width: stripW, padding: edge, gap: edge, transform: [{ rotate: `${k === 0 ? -2 : 2.5}deg` }], marginTop: k === 1 ? 18 : 0 }]}
          >
            {s.frames.map((f, i) =>
              f.face ? (
                <FaceTile key={i} member={f.face.member} uri={f.uri} size={frame} radius={1} />
              ) : (
                <Photo key={i} uri={f.uri} width={frame} height={frame} radius={1} />
              ),
            )}
            <View style={{ alignItems: 'center', paddingVertical: 2 }}>
              <Text style={booth.word} numberOfLines={1} adjustsFontSizeToFit>{s.word}</Text>
              <Text style={booth.time} numberOfLines={1} adjustsFontSizeToFit>{s.time}</Text>
            </View>
          </View>
        ))}
      </View>
      {totalFaces > shownFaces ? (
        <Text style={booth.more}>+{totalFaces - shownFaces} more faces</Text>
      ) : null}
      <Footer style={{ marginTop: d.pad * 1.2 }} />
    </Root>
  );
}

const booth = StyleSheet.create({
  strip: { backgroundColor: C.ink, borderRadius: 2 },
  word: { ...theme.type.big, color: C.bg, textTransform: 'uppercase' },
  time: { ...theme.type.smallBold, color: C.bg },
  more: { ...theme.type.bodyBold, color: C.inkDim, textAlign: 'center', marginTop: 14 },
});

function duration(d: CollageData): string | null {
  if (d.night.endedAt == null) return null;
  const mins = Math.max(0, Math.round((d.night.endedAt - d.night.startedAt) / 60000));
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h}H ${two(mins % 60)}M` : `${mins}M`;
}

// 11. A chalk line down the board with stops for the start and the end, each with its time and photos.
// When a phase has a group shot and faces, the group shot gets its own stop in the middle
// (the end group shot if both phases qualify): it's the moment the crew was all together.
export function Timeline({ d }: { d: CollageData }) {
  const W = d.width;
  const lineX = 18;
  const body = W - d.pad * 2 - lineX - 22;
  const mid: 'start' | 'end' | null =
    d.endGroup && d.endFaces.length > 0 ? 'end' : d.startGroup && d.startFaces.length > 0 ? 'start' : null;
  const span = duration(d);

  const faces = (list: Face[]) => {
    const size = Math.round(Math.min(64, (body - 6 * 4) / 5));
    const shown = list.length > 10 ? list.slice(0, 9) : list;
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {shown.map(f => <Avatar key={f.member.id} person={f.member} photo={f.uri} size={size} />)}
        {list.length > shown.length ? <MoreBadge n={list.length - shown.length} size={size} /> : null}
      </View>
    );
  };
  const group = (uri: string) => <Photo uri={uri} width={body} height={Math.round(body * 0.66)} radius={theme.radius.sm} style={{ borderWidth: 2, borderColor: C.ink }} />;

  const stops: { key: string; time: string; word: string; tone: string; content: ReactElement }[] = [];
  const startGroup = d.startGroup && mid !== 'start' ? d.startGroup : null;
  stops.push({
    key: 'start', time: d.startTime, word: 'START', tone: C.ink,
    content: <View style={{ gap: 10 }}>{startGroup ? group(startGroup) : null}{d.startFaces.length ? faces(d.startFaces) : null}</View>,
  });
  if (mid) {
    stops.push({
      key: 'mid', time: span ?? 'LATER', word: 'ALL TOGETHER', tone: C.owes,
      content: group((mid === 'end' ? d.endGroup : d.startGroup)!),
    });
  }
  const endGroup = d.endGroup && mid !== 'end' ? d.endGroup : null;
  stops.push({
    key: 'end', time: d.endTime, word: 'END', tone: C.accent,
    content: <View style={{ gap: 10 }}>{endGroup ? group(endGroup) : null}{d.endFaces.length ? faces(d.endFaces) : null}</View>,
  });

  return (
    <Root width={W} style={{ padding: d.pad }}>
      <Header d={d} style={{ marginBottom: d.pad }} />
      <View>
        <View style={[line.chalk, { left: lineX }]} />
        {stops.map(s => (
          <View key={s.key} style={{ flexDirection: 'row', marginBottom: d.pad * 1.2 }}>
            <View style={{ width: lineX * 2 + 4, alignItems: 'center', paddingTop: 4 }}>
              <View style={[line.dot, { borderColor: s.tone }]} />
            </View>
            <View style={{ width: body }}>
              <View style={line.when}>
                <Text style={line.time} numberOfLines={1} adjustsFontSizeToFit>{s.time}</Text>
                <Text style={[line.word, { color: s.tone }]} numberOfLines={1}>{s.word}</Text>
              </View>
              {s.content}
            </View>
          </View>
        ))}
      </View>
      <Footer />
    </Root>
  );
}

const line = StyleSheet.create({
  chalk: { position: 'absolute', top: 12, bottom: 24, width: 4, borderRadius: 2, backgroundColor: C.ink, opacity: 0.8 },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 4, backgroundColor: C.bg },
  when: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 8, flexWrap: 'wrap' },
  time: { ...theme.type.display, color: C.ink, flexShrink: 1 },
  word: { ...theme.type.label },
});
