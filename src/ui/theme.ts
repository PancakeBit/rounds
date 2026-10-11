import type { TextStyle } from 'react-native';

// Values come from .design-identity.md (a pub darts chalkboard). Change them there first.

const face = {
  display: 'BigShouldersDisplay_900Black',
  displayBold: 'BigShouldersDisplay_700Bold',
  body: 'Barlow_500Medium',
  bodyBold: 'Barlow_700Bold',
};

const color = {
  bg: '#11211A', // slate
  surface: '#1D3028',
  ink: '#C9E0DE', // chalk
  inkDim: '#90ABA7',
  accent: '#4AC777', // board green
  owed: '#4AC777',
  owes: '#F66D62', // board red, lifted to 5.8:1 for text
  line: '#33483E',
};

// Scale: base 17, ratio 1.333.
const font = { hero: 96, display: 40, big: 30, title: 23, body: 17, small: 13 };

const type = {
  hero: { fontFamily: face.display, fontSize: font.hero, fontVariant: ['tabular-nums'] },
  display: { fontFamily: face.display, fontSize: font.display, fontVariant: ['tabular-nums'] },
  big: { fontFamily: face.display, fontSize: font.big, fontVariant: ['tabular-nums'] },
  title: { fontFamily: face.displayBold, fontSize: font.title, letterSpacing: 0.5 },
  label: { fontFamily: face.displayBold, fontSize: font.body, letterSpacing: 3, textTransform: 'uppercase' },
  body: { fontFamily: face.body, fontSize: font.body },
  bodyBold: { fontFamily: face.bodyBold, fontSize: font.body },
  small: { fontFamily: face.body, fontSize: font.small },
  smallBold: { fontFamily: face.bodyBold, fontSize: font.small, letterSpacing: 0.5 },
} satisfies Record<string, TextStyle>;

export const theme = { color, font, face, type, radius: { sm: 4, md: 6, lg: 10 }, tap: 56 };

// Chalk-stick colours for each friend's avatar ring.
export const CREW_COLORS = ['#C9E0DE', '#4AC777', '#F66D62', '#E8D27A', '#8CC3E8', '#E2A2C8', '#F0A86A', '#B9A6E8'];
export const CREW_EMOJI = ['🦊', '🐸', '🐙', '🦄', '🐯', '🐼', '🦖', '🐝', '🐧', '🦉', '🐳', '🌵'];
