import type { Category, ThemePreference } from './types';

export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textDim: string;
  accent: string;
  accentText: string; // readable text on accent
  danger: string;
  success: string;
  overlay: string;
  tabBar: string;
}

export const DARK: Palette = {
  bg: '#101114',
  surface: '#1C1D22',
  surfaceAlt: '#24252B',
  border: '#2C2D33',
  borderStrong: '#3A3B42',
  text: '#FFFFFF',
  textMuted: '#A1A1AA',
  textDim: '#71717A',
  accent: '#A6F36A',
  accentText: '#101114',
  danger: '#FF6B6B',
  success: '#A6F36A',
  overlay: 'rgba(0,0,0,0.62)',
  tabBar: '#16171B',
};

export const LIGHT: Palette = {
  bg: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceAlt: '#EFF1F4',
  border: '#E4E6EA',
  borderStrong: '#D2D5DB',
  text: '#17181C',
  textMuted: '#5C5F66',
  textDim: '#8A8D94',
  accent: '#5CB531',
  accentText: '#FFFFFF',
  danger: '#D8484B',
  success: '#5CB531',
  overlay: 'rgba(23,24,28,0.45)',
  tabBar: '#FFFFFF',
};

export function paletteFor(preference: ThemePreference, systemScheme: 'dark' | 'light'): Palette {
  const resolved =
    preference === 'system' ? systemScheme : preference;
  return resolved === 'light' ? LIGHT : DARK;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Semantic design tokens used by the habit screens/hooks.
 *
 * `Palette` describes raw colors; `ThemeTokens` is the flattened, screen-facing
 * contract (bg/card/text/sub/muted/border/accent/onAccent/danger + `mode`).
 * Screens branch on `mode` for status-bar contrast, so it must always be a
 * concrete 'dark' | 'light' — never undefined.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface ThemeTokens {
  mode: 'dark' | 'light';
  bg: string;
  card: string;
  text: string;
  sub: string;
  muted: string;
  border: string;
  accent: string;
  onAccent: string;
  danger: string;
}

/** Accent swatches offered in the habit form. Index 0 is the default color. */
export const PALETTE: readonly string[] = [
  '#A6F36A', // signature green
  '#6EC3FF', // sky blue
  '#FFB86C', // tangerine
  '#FF7DA6', // pink
  '#B89CFF', // violet
  '#4DDBC4', // teal
  '#FFD35C', // amber
];

/** Emoji shortcuts shown per category in the habit form. */
export const CATEGORY_EMOJI: Record<Category, readonly string[]> = {
  Health: ['💧', '🥗', '🪥', '😴', '🧘', '💊', '🥛', '🚶', '🧴', '🍎'],
  Fitness: ['💪', '🏃', '🚴', '🏊', '⚽', '🏋️', '🤸', '🧗', '🥊', '🛼'],
  Learning: ['📚', '✍️', '🧠', '🎓', '📖', '🔬', '💻', '🎸', '🎨', '🗣️'],
  Productivity: ['⚡', '🎯', '📝', '🧹', '💰', '📵', '🗂️', '⏰', '📊', '✅'],
  Personal: ['🌱', '🙏', '🌙', '☀️', '🎵', '🌸', '🐶', '☕', '📷', '🪴'],
};

function tokensFrom(palette: Palette, mode: 'dark' | 'light'): ThemeTokens {
  return {
    mode,
    bg: palette.bg,
    card: palette.surface,
    text: palette.text,
    sub: palette.textMuted,
    muted: palette.textDim,
    border: palette.border,
    accent: palette.accent,
    onAccent: palette.accentText,
    danger: palette.danger,
  };
}

const DARK_TOKENS = tokensFrom(DARK, 'dark');
const LIGHT_TOKENS = tokensFrom(LIGHT, 'light');

/**
 * Resolve a theme preference into concrete tokens.
 *
 * `systemScheme` comes from RN's `useColorScheme()`, which is
 * `'light' | 'dark' | null | undefined` — an unknown/absent system scheme
 * falls back to dark rather than leaving tokens undefined.
 */
export function resolveTheme(
  preference: ThemePreference,
  systemScheme: 'light' | 'dark' | null | undefined,
): ThemeTokens {
  const resolved = preference === 'system' ? (systemScheme ?? 'dark') : preference;
  return resolved === 'light' ? LIGHT_TOKENS : DARK_TOKENS;
}
