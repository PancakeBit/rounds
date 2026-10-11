import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { defaultLayout, fittingLayouts, nextLayout, shotsOf, type Shots } from './collage';

const shots = (s: Partial<Shots>): Shots => ({ startGroup: false, endGroup: false, startFaces: 0, endFaces: 0, pairs: 0, ...s });

describe('fittingLayouts', () => {
  it('nothing to show: no layouts', () => {
    expect(fittingLayouts(shots({}))).toEqual([]);
    expect(defaultLayout(shots({}), 7)).toBeNull();
  });
  it('one face only: just the single frame', () => {
    expect(fittingLayouts(shots({ startFaces: 1 }))).toEqual(['single']);
  });
  it('group shot only: cover and single, no face layouts', () => {
    const l = fittingLayouts(shots({ endGroup: true }));
    expect(l).toContain('cover');
    expect(l).toContain('single');
    expect(l).not.toContain('faceWall');
    expect(l).not.toContain('beforeAfter');
  });
  it('no group, start and end faces: before/after and pairs, no cover', () => {
    const l = fittingLayouts(shots({ startFaces: 3, endFaces: 3, pairs: 3 }));
    expect(l).toEqual(expect.arrayContaining(['beforeAfter', 'pairs', 'faceWall', 'photobooth', 'timeline']));
    expect(l).not.toContain('cover');
    expect(l).not.toContain('twoGroups');
  });
  it('both group shots: twoGroups fits', () => {
    expect(fittingLayouts(shots({ startGroup: true, endGroup: true }))).toContain('twoGroups');
  });
  it('start only (faces and group): no before/after', () => {
    const l = fittingLayouts(shots({ startGroup: true, startFaces: 4 }));
    expect(l).not.toContain('beforeAfter');
    expect(l).not.toContain('timeline');
    expect(l).toContain('bubbles');
  });
});

describe('defaultLayout', () => {
  it('is stable for a night and skips the plain single frame when anything richer fits', () => {
    const s = shots({ startFaces: 2, endGroup: true });
    expect(defaultLayout(s, 3)).toBe(defaultLayout(s, 3));
    for (let seed = 0; seed < 20; seed++) expect(defaultLayout(s, seed)).not.toBe('single');
  });
  it('different nights get different layouts', () => {
    const s = shots({ startGroup: true, endGroup: true, startFaces: 4, endFaces: 4, pairs: 4 });
    const seen = new Set(Array.from({ length: 30 }, (_, i) => defaultLayout(s, i)));
    expect(seen.size).toBeGreaterThan(5);
  });
});

describe('nextLayout', () => {
  it('cycles through every fitting layout and wraps', () => {
    const s = shots({ startFaces: 3, endFaces: 3, pairs: 2 });
    const all = fittingLayouts(s).filter(l => l !== 'single');
    let cur = defaultLayout(s, 0)!;
    const seen = new Set([cur]);
    for (let i = 0; i < all.length; i++) {
      cur = nextLayout(s, cur);
      seen.add(cur);
    }
    expect(seen).toEqual(new Set(all));
  });
  it('property: default and next are always layouts that fit', () => {
    fc.assert(fc.property(
      fc.boolean(), fc.boolean(), fc.integer({ min: 0, max: 10 }), fc.integer({ min: 0, max: 10 }), fc.integer({ min: 0, max: 1000 }),
      (sg, eg, sf, ef, seed) => {
        const s = shots({ startGroup: sg, endGroup: eg, startFaces: sf, endFaces: ef, pairs: Math.min(sf, ef) });
        const fit = fittingLayouts(s);
        const d = defaultLayout(s, seed);
        if (fit.length === 0) return d === null;
        return d !== null && fit.includes(d) && fit.includes(nextLayout(s, d));
      },
    ));
  });
});

describe('shotsOf', () => {
  it('counts group shots, faces per phase and people with both', () => {
    const m = (photoStart: string | null, photoEnd: string | null) => ({ photoStart, photoEnd });
    expect(shotsOf({ groupPhotoStart: null, groupPhoto: 'file://end.jpg' }, [m('a', 'b'), m('c', null), m(null, 'd'), m(null, null)])).toEqual({
      startGroup: false, endGroup: true, startFaces: 2, endFaces: 2, pairs: 1,
    });
  });
  it('an empty night has nothing', () => {
    expect(shotsOf({ groupPhotoStart: null, groupPhoto: null }, [])).toEqual(shots({}));
  });
});
