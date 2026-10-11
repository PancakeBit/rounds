// Which photo collage layouts a night can use, given which photos it actually has.
// Any of the four photo sets can be missing or partial, so each layout states what it needs.

export interface Shots {
  startGroup: boolean;
  endGroup: boolean;
  startFaces: number; // people with a start photo
  endFaces: number; // people with an end photo
  pairs: number; // people with both
}

export type LayoutId =
  | 'cover' | 'bubbles' | 'twoGroups' | 'beforeAfter' | 'pairs' | 'filmstrip'
  | 'photobooth' | 'polaroids' | 'contact' | 'faceWall' | 'timeline' | 'single';

const total = (s: Shots) => Number(s.startGroup) + Number(s.endGroup) + s.startFaces + s.endFaces;
const faces = (s: Shots) => s.startFaces + s.endFaces;
const hasStart = (s: Shots) => s.startGroup || s.startFaces > 0;
const hasEnd = (s: Shots) => s.endGroup || s.endFaces > 0;
const anyGroup = (s: Shots) => s.startGroup || s.endGroup;

// Order is the Shuffle order.
const LAYOUTS: { id: LayoutId; fits: (s: Shots) => boolean }[] = [
  { id: 'cover', fits: anyGroup },
  { id: 'beforeAfter', fits: s => hasStart(s) && hasEnd(s) },
  { id: 'polaroids', fits: s => total(s) >= 2 },
  { id: 'faceWall', fits: s => faces(s) >= 3 },
  { id: 'twoGroups', fits: s => s.startGroup && s.endGroup },
  { id: 'filmstrip', fits: s => total(s) >= 3 },
  { id: 'pairs', fits: s => s.pairs >= 2 },
  { id: 'bubbles', fits: s => anyGroup(s) && faces(s) >= 2 },
  { id: 'contact', fits: s => total(s) >= 4 },
  { id: 'photobooth', fits: s => faces(s) >= 3 },
  { id: 'timeline', fits: s => hasStart(s) && hasEnd(s) && total(s) >= 3 },
  { id: 'single', fits: s => total(s) >= 1 },
];

export function fittingLayouts(s: Shots): LayoutId[] {
  return LAYOUTS.filter(l => l.fits(s)).map(l => l.id);
}

// The plain single frame is only used when nothing richer fits.
function choices(s: Shots): LayoutId[] {
  const fit = fittingLayouts(s);
  return fit.length > 1 ? fit.filter(l => l !== 'single') : fit;
}

// Picked from the night's id, so a night always opens on the same layout and nights differ from each other.
export function defaultLayout(s: Shots, seed: number): LayoutId | null {
  const c = choices(s);
  return c.length ? c[Math.abs(Math.trunc(seed)) % c.length] : null;
}

export function nextLayout(s: Shots, current: LayoutId): LayoutId {
  const c = choices(s);
  if (c.length === 0) return current;
  const i = c.indexOf(current);
  return c[(i + 1) % c.length];
}

// Structural, so this stays free of the db and RN imports.
interface ShotNight { groupPhotoStart: string | null; groupPhoto: string | null }
interface ShotMember { photoStart: string | null; photoEnd: string | null }

// Counts the photos a night actually has. `groupPhoto` is the end-of-night group shot.
export function shotsOf(night: ShotNight, members: ShotMember[]): Shots {
  return {
    startGroup: !!night.groupPhotoStart,
    endGroup: !!night.groupPhoto,
    startFaces: members.filter(m => m.photoStart).length,
    endFaces: members.filter(m => m.photoEnd).length,
    pairs: members.filter(m => m.photoStart && m.photoEnd).length,
  };
}
