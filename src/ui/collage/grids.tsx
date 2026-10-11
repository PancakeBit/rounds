import { StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../Avatar';
import { theme } from '../theme';
import {
  allShots, ChalkArrow, ChalkRing, FaceTile, Footer, Header, MoreBadge, Photo, Root, Rule, two, type CollageData, type Face,
} from './parts';

// Grid-shaped layouts: beforeAfter, faceWall, contact, pairs.

const C = theme.color;

// 2. Two halves side by side, START and END. Each shows its group shot (with a row of faces under it
// when it has both), or a grid of that phase's faces.
export function BeforeAfter({ d }: { d: CollageData }) {
  const W = d.width;
  const gap = d.pad;
  const colW = Math.floor((W - d.pad * 2 - gap) / 2);
  const half = (phase: 'start' | 'end') => {
    const group = phase === 'start' ? d.startGroup : d.endGroup;
    const faces = phase === 'start' ? d.startFaces : d.endFaces;
    const time = phase === 'start' ? d.startTime : d.endTime;
    const tone = phase === 'start' ? C.ink : C.accent;
    return (
      <View style={{ width: colW }}>
        <View style={[ba.label, { borderColor: tone }]}>
          <Text style={[ba.labelText, { color: tone }]} numberOfLines={1} adjustsFontSizeToFit>
            {phase === 'start' ? 'START' : 'END'} · {time}
          </Text>
        </View>
        {group ? (
          <>
            <Photo uri={group} width={colW} height={Math.round(colW * 1.3)} radius={theme.radius.sm} />
            {faces.length > 0 ? <FaceRow faces={faces} width={colW} /> : null}
          </>
        ) : (
          <FaceGrid faces={faces} width={colW} />
        )}
      </View>
    );
  };
  return (
    <Root width={W} style={{ padding: d.pad }}>
      <Header d={d} style={{ marginBottom: d.pad }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {half('start')}
        <Rule vertical style={{ marginHorizontal: (gap - 2) / 2, backgroundColor: C.inkDim, opacity: 0.6 }} />
        {half('end')}
      </View>
      <Footer style={{ marginTop: d.pad }} />
    </Root>
  );
}

// Up to four small faces in a row; a +N for the rest.
function FaceRow({ faces, width }: { faces: Face[]; width: number }) {
  const size = Math.floor((width - 6 * 3) / 4);
  const shown = faces.length > 4 ? faces.slice(0, 3) : faces;
  const extra = faces.length - shown.length;
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
      {shown.map(f => <Avatar key={f.member.id} person={f.member} photo={f.uri} size={size} />)}
      {extra > 0 ? <MoreBadge n={extra} size={size} /> : null}
    </View>
  );
}

// Faces two across, eight at most.
function FaceGrid({ faces, width }: { faces: Face[]; width: number }) {
  const gap = 6;
  const cols = faces.length === 1 ? 1 : 2;
  const size = Math.floor((width - gap * (cols - 1)) / cols);
  const shown = faces.length > 8 ? faces.slice(0, 7) : faces;
  const extra = faces.length - shown.length;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {shown.map(f => (
        <View key={f.member.id} style={{ width: size }}>
          <FaceTile member={f.member} uri={f.uri} size={size} />
          <Text style={[ba.name, { color: f.member.color }]} numberOfLines={1} adjustsFontSizeToFit>{f.member.name}</Text>
        </View>
      ))}
      {extra > 0 ? (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <MoreBadge n={extra} size={size * 0.6} />
        </View>
      ) : null}
    </View>
  );
}

const ba = StyleSheet.create({
  label: { borderBottomWidth: 3, paddingBottom: 4, marginBottom: 10, alignSelf: 'stretch' },
  labelText: { ...theme.type.label },
  name: { ...theme.type.smallBold, marginTop: 3, textTransform: 'uppercase' },
});

// 4. A mosaic of every face, start and end, with the title in a big tile in the middle.
// Spare cells carry the start and end times.
export function FaceWall({ d }: { d: CollageData }) {
  const W = d.width;
  const faces = [...d.startFaces, ...d.endFaces];
  const cols = faces.length >= 6 ? 4 : 3;
  const gap = 5;
  const cell = (W - d.pad * 2 - gap * (cols - 1)) / cols;
  const rows = Math.max(2, Math.ceil((faces.length + 4) / cols));
  const tc = Math.floor((cols - 2) / 2);
  const tr = Math.floor((rows - 2) / 2);
  const isTitle = (r: number, c: number) => r >= tr && r < tr + 2 && c >= tc && c < tc + 2;
  const at = (n: number) => n * (cell + gap);
  const cells: { r: number; c: number }[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!isTitle(r, c)) cells.push({ r, c });
  const spare = cells.slice(faces.length);
  const spareText = [
    { word: 'START', time: d.startTime, tone: C.ink },
    { word: 'END', time: d.endTime, tone: C.accent },
  ];
  const big = cell * 2 + gap;
  return (
    <Root width={W} style={{ padding: d.pad }}>
      <View style={{ height: at(rows) - gap }}>
        {faces.map((f, i) => (
          <View key={`${f.phase}-${f.member.id}`} style={{ position: 'absolute', left: at(cells[i].c), top: at(cells[i].r) }}>
            <FaceTile member={f.member} uri={f.uri} size={cell} ring />
            <View style={[wall.phase, { backgroundColor: f.phase === 'start' ? C.ink : C.accent }]} />
          </View>
        ))}
        {spare.map((s, i) => {
          const t = spareText[i];
          return (
            <View key={`spare-${i}`} style={[wall.spare, { left: at(s.c), top: at(s.r), width: cell, height: cell }]}>
              {t ? (
                <>
                  <Text style={[wall.spareWord, { color: t.tone }]} numberOfLines={1}>{t.word}</Text>
                  <Text style={wall.spareTime} numberOfLines={1} adjustsFontSizeToFit>{t.time}</Text>
                </>
              ) : null}
            </View>
          );
        })}
        <View style={[wall.title, { left: at(tc), top: at(tr), width: big, height: big, padding: big * 0.07 }]}>
          <Text style={wall.date} numberOfLines={1} adjustsFontSizeToFit>{d.date}</Text>
          <Text style={[wall.titleText, { fontSize: big * 0.3, lineHeight: big * 0.31 }]} numberOfLines={3} adjustsFontSizeToFit>
            {d.night.title}
          </Text>
          <Text style={wall.count} numberOfLines={1}>{faces.length} FACES</Text>
        </View>
      </View>
      <Footer style={{ marginTop: d.pad * 0.8 }} />
    </Root>
  );
}

const wall = StyleSheet.create({
  phase: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4 },
  spare: { position: 'absolute', borderWidth: 2, borderColor: C.line, borderStyle: 'dashed', borderRadius: theme.radius.sm, alignItems: 'center', justifyContent: 'center', padding: 4 },
  spareWord: { ...theme.type.label, fontSize: theme.font.small },
  spareTime: { ...theme.type.title, color: C.ink },
  title: { position: 'absolute', backgroundColor: C.ink, borderRadius: theme.radius.sm, justifyContent: 'space-between' },
  date: { ...theme.type.label, fontSize: theme.font.small, color: C.bg },
  titleText: { ...theme.type.hero, color: C.bg, textTransform: 'uppercase' },
  count: { ...theme.type.smallBold, color: C.bg },
});

// 9. A contact sheet: every photo three across with frame numbers, and one marked by hand
// with a chalk ring (a group shot when there is one).
export function Contact({ d }: { d: CollageData }) {
  const W = d.width;
  const shots = allShots(d);
  const gap = 10;
  const cell = Math.floor((W - d.pad * 2 - gap * 2) / 3);
  const endPick = shots.findIndex(s => s.kind === 'group' && s.phase === 'end');
  const pickAt = endPick >= 0 ? endPick : Math.max(0, shots.findIndex(s => s.kind === 'group'));
  // At most four rows: past 12 photos, 11 frames (always including the marked one) and a +N badge.
  const MAX = 12;
  let shown = shots;
  if (shots.length > MAX) {
    shown = shots.slice(0, MAX - 1);
    if (pickAt >= MAX - 1) shown[MAX - 2] = shots[pickAt];
  }
  const pickIndex = shown.indexOf(shots[pickAt]);
  const hidden = shots.length - shown.length;
  return (
    <Root width={W} style={{ padding: d.pad }}>
      <View style={sheet.head}>
        <View style={{ flex: 1 }}>
          <Header d={d} size={theme.font.big} />
        </View>
        <Text style={sheet.roll}>{two(shots.length)} EXP</Text>
      </View>
      <Rule style={{ marginVertical: d.pad * 0.7 }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: gap, rowGap: gap + 2 }}>
        {shown.map((s, i) => (
          <View key={`${s.phase}-${s.kind}-${s.member?.id ?? 'g'}`} style={{ width: cell }}>
            <View>
              <Photo uri={s.uri} width={cell} height={cell} style={{ borderWidth: 2, borderColor: C.line }} />
              {i === pickIndex ? <ChalkRing inset={7} color={C.owes} rotate={-6} /> : null}
            </View>
            <View style={sheet.under}>
              <Text style={sheet.num}>{two(i + 1)}</Text>
              <Text style={[sheet.who, { color: s.member?.color ?? C.inkDim }]} numberOfLines={1} adjustsFontSizeToFit>
                {s.member ? s.member.name : s.phase === 'start' ? 'START' : 'END'}
              </Text>
            </View>
          </View>
        ))}
        {hidden > 0 && (
          <View style={{ width: cell, height: cell, alignItems: 'center', justifyContent: 'center' }}>
            <MoreBadge n={hidden} size={cell * 0.6} />
          </View>
        )}
      </View>
      <Footer style={{ marginTop: d.pad }} />
    </Root>
  );
}

const sheet = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  roll: { ...theme.type.label, fontSize: theme.font.small, color: C.inkDim },
  under: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 },
  num: { ...theme.type.smallBold, color: C.inkDim, fontVariant: ['tabular-nums'] },
  who: { ...theme.type.smallBold, flexShrink: 1, textTransform: 'uppercase' },
});

// 7. One row per person with both photos: their name in their colour, start face, an arrow, end face.
export function Pairs({ d }: { d: CollageData }) {
  const W = d.width;
  const rows = d.pairs.slice(0, 8);
  const extra = d.pairs.length - rows.length;
  const face = Math.round(W * 0.23);
  const arrow = Math.round(W * 0.1);
  const nameW = W - d.pad * 2 - face * 2 - arrow - 24;
  return (
    <Root width={W} style={{ padding: d.pad }}>
      <Header d={d} style={{ marginBottom: d.pad * 0.8 }} />
      <View style={pairs.row}>
        <View style={{ width: nameW }} />
        <Text style={[pairs.head, { width: face }]} numberOfLines={1} adjustsFontSizeToFit>{d.startTime}</Text>
        <View style={{ width: arrow }} />
        <Text style={[pairs.head, { width: face, color: C.accent }]} numberOfLines={1} adjustsFontSizeToFit>{d.endTime}</Text>
      </View>
      {rows.map((p, i) => (
        <View key={p.member.id}>
          {i > 0 ? <Rule /> : null}
          <View style={[pairs.row, { paddingVertical: 8 }]}>
            <View style={{ width: nameW }}>
              <Text style={[pairs.name, { color: p.member.color }]} numberOfLines={2} adjustsFontSizeToFit>{p.member.name}</Text>
            </View>
            <FaceTile member={p.member} uri={p.start} size={face} />
            <View style={{ width: arrow, height: face }}>
              <ChalkArrow x={arrow / 2} y={face / 2} length={arrow * 0.8} angle={i % 2 === 0 ? -6 : 6} color={p.member.color} />
            </View>
            <FaceTile member={p.member} uri={p.end} size={face} ring />
          </View>
        </View>
      ))}
      {extra > 0 ? <Text style={pairs.more}>+{extra} more</Text> : null}
      <Footer style={{ marginTop: d.pad * 0.8 }} />
    </Root>
  );
}

const pairs = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  head: { ...theme.type.label, fontSize: theme.font.small, color: C.ink, textAlign: 'center', marginBottom: 4 },
  name: { ...theme.type.big, textTransform: 'uppercase' },
  more: { ...theme.type.bodyBold, color: C.inkDim, marginTop: 6 },
});
