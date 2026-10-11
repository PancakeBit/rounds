import type { ReactElement } from 'react';
import { fittingLayouts, shotsOf, type LayoutId } from '../../core/collage';
import type { Night, NightMember } from '../../db/repo';
import { BeforeAfter, Contact, FaceWall, Pairs } from './grids';
import { collageData, Root } from './parts';
import { Bubbles, Cover, Polaroids, Single, TwoGroups } from './prints';
import { Filmstrip, Photobooth, Timeline } from './strips';

export { shotsOf };

// The night's photo collage, `width` wide and as tall as the layout needs. Captured to a PNG,
// so it is fully static. Only pass a layout that fittingLayouts() allows for this night.
export function Collage({ layout, night, members, width }: { layout: LayoutId; night: Night; members: NightMember[]; width: number }): ReactElement {
  const d = collageData(night, members, width);
  // A stale layout (photos changed since it was picked) falls back to one that fits, never a crash.
  const fit = fittingLayouts(shotsOf(night, members));
  if (fit.length === 0) return <Root width={width} />;
  switch (fit.includes(layout) ? layout : fit[0]) {
    case 'cover': return <Cover d={d} />;
    case 'beforeAfter': return <BeforeAfter d={d} />;
    case 'polaroids': return <Polaroids d={d} />;
    case 'faceWall': return <FaceWall d={d} />;
    case 'twoGroups': return <TwoGroups d={d} />;
    case 'filmstrip': return <Filmstrip d={d} />;
    case 'pairs': return <Pairs d={d} />;
    case 'bubbles': return <Bubbles d={d} />;
    case 'contact': return <Contact d={d} />;
    case 'photobooth': return <Photobooth d={d} />;
    case 'timeline': return <Timeline d={d} />;
    case 'single': return <Single d={d} />;
  }
}
