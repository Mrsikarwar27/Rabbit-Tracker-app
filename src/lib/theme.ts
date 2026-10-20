import type { CardStyle, ListDensity, ThemePreference } from './types';

/**
 * ────────────────────────────────────────────────────────────────────────────
 * Material 3 inspired design system.
 *
 * One generator, two consumers:
 *   • `resolveTheme(mode, systemScheme, accent)` → `ThemeTokens` (the semantic
 *     contract every screen and component reads from).
 *   • `paletteFor(...)` → the legacy `Palette` shape kept for the older
 *     `AppProvider`; it is *derived* from the same generator, so there is
 *     exactly one definition of every colour in the app.
 *
 * Colour model
 * ────────────
 * The user picks an *accent* (a single source tone). Everything else is
 * derived from it with a Material 3 style tonal approach:
 *   • light mode darkens the accent until white text on it passes 4.5:1,
 *   • dark mode lightens it until the near-black text passes 4.5:1,
 *   • containers/secondary tones are mixed from the accent so surfaces stay
 *     recognisably "the same accent" without losing readability.
 * Success / warning / error stay semantic (green / amber / red) so their
 * meaning never changes when the accent changes.
 * ────────────────────────────────────────────────────────────────────────────
 */

/* ── colour maths ───────────────────────────────────────────────────────── */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

const HEX_RE = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * Normalize any user-supplied colour string to `#RRGGBB`.
 * Returns `null` for anything that is not a valid hex colour, so malformed
 * input can never reach the style sheet.
 */
export function normalizeHex(input: string): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  const match = HEX_RE.exec(trimmed);
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3 || hex.length === 4) {
    // #RGB / #RGBA → drop alpha, expand shorthand
    hex = hex.slice(0, 3)
      .split('')
      .map((c) => c + c)
      .join('');
  } else if (hex.length === 8) {
    // #RRGGBBAA → drop alpha
    hex = hex.slice(0, 6);
  }
  return `#${hex.toUpperCase()}`;
}

/** True when the string is a colour the app can apply. */
export function isValidHex(input: string): boolean {
  return normalizeHex(input) !== null;
}

export function hexToRgb(hex: string): Rgb {
  const normalized = normalizeHex(hex) ?? '#000000';
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[r, g, b].map((n) => clamp(n).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export function hexToHsl(hex: string): Hsl {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let rgb: [number, number, number];
  if (hue < 60) rgb = [c, x, 0];
  else if (hue < 120) rgb = [x, c, 0];
  else if (hue < 180) rgb = [0, c, x];
  else if (hue < 240) rgb = [0, x, c];
  else if (hue < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return rgbToHex({
    r: (rgb[0] + m) * 255,
    g: (rgb[1] + m) * 255,
    b: (rgb[2] + m) * 255,
  });
}

/** WCAG relative luminance. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channel = (v: number) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two colours (1 → 21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Black or white — whichever reads better on the given background. */
export function readableForeground(background: string): string {
  return contrastRatio(background, '#FFFFFF') >= contrastRatio(background, '#000000')
    ? '#FFFFFF'
    : '#000000';
}

/** Blend `overlay` into `base` by `amount` (0 → base, 1 → overlay). */
export function mix(base: string, overlay: string, amount: number): string {
  const a = hexToRgb(base);
  const b = hexToRgb(overlay);
  const t = Math.max(0, Math.min(1, amount));
  return rgbToHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  });
}

/**
 * Move the accent's lightness until it reaches `minRatio` against `against`.
 * Darkening is used for light surfaces, lightening for dark surfaces.
 */
function tuneForContrast(accent: string, against: string, minRatio = 4.5): string {
  const { h, s, l } = hexToHsl(accent);
  const direction = relativeLuminance(against) > 0.4 ? -1 : 1;
  let lightness = l;
  for (let i = 0; i < 60; i += 1) {
    const candidate = hslToHex({ h, s, l: lightness });
    if (contrastRatio(candidate, against) >= minRatio) return candidate;
    lightness += direction * 0.02;
    if (lightness <= 0.02 || lightness >= 0.98) break;
  }
  return hslToHex({ h, s, l: Math.max(0.02, Math.min(0.98, lightness)) });
}

/* ── accent presets ─────────────────────────────────────────────────────── */

export interface AccentPreset {
  key: string;
  label: string;
  /** The source tone; the UI shows this exact hex in the swatch grid. */
  hex: string;
}

export const DEFAULT_ACCENT = '#A6F36A';

/** Selectable accent palettes. */
export const ACCENT_PRESETS: readonly AccentPreset[] = [
  { key: 'lime', label: 'Lime', hex: '#A6F36A' },
  { key: 'material-blue', label: 'Material Blue', hex: '#4D7CFF' },
  { key: 'ocean-blue', label: 'Ocean Blue', hex: '#4F8CFF' },
  { key: 'emerald', label: 'Emerald', hex: '#39C98A' },
  { key: 'purple', label: 'Purple', hex: '#B69CFF' },
  { key: 'rose', label: 'Rose', hex: '#FF8BA7' },
  { key: 'amber', label: 'Amber', hex: '#FFC66D' },
  { key: 'teal', label: 'Teal', hex: '#48CFCB' },
  { key: 'material-3', label: 'Material 3', hex: '#6750A4' },
];

/** The preset matching a stored accent hex, if any. */
export function findPreset(accent: string): AccentPreset | undefined {
  const normalized = normalizeHex(accent);
  if (!normalized) return undefined;
  return ACCENT_PRESETS.find(
    (p) => normalizeHex(p.hex)?.toUpperCase() === normalized.toUpperCase(),
  );
}

/* ── semantic tokens ────────────────────────────────────────────────────── */

export interface ThemeTokens {
  mode: 'dark' | 'light';

  /* Material 3 semantic names */
  background: string;
  surface: string;
  surfaceVariant: string;
  surfaceContainer: string;
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderStrong: string;
  success: string;
  warning: string;
  error: string;
  onError: string;
  overlay: string;

  /* Short aliases used across the existing component API */
  bg: string;
  card: string;
  text: string;
  sub: string;
  muted: string;
  accent: string;
  onAccent: string;
  danger: string;
}

/** Neutral bases for the two modes (the reference's charcoal / paper). */
const DARK_BASE = {
  background: '#121316',
  surface: '#1F1F23',
  surfaceContainer: '#292A2D',
  surfaceVariant: '#242529',
  textPrimary: '#E3E2E6',
  textSecondary: '#A1A1AA',
  textTertiary: '#7A7A82',
  border: '#2E2F35',
  borderStrong: '#414939',
  success: '#4ADE80',
  warning: '#FBBF24',
  error: '#F87171',
  overlay: 'rgba(0,0,0,0.62)',
};

const LIGHT_BASE = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceContainer: '#EFF1F4',
  surfaceVariant: '#EFF1F4',
  textPrimary: '#17181C',
  textSecondary: '#5C5F66',
  textTertiary: '#7D8087',
  border: '#E4E6EA',
  borderStrong: '#D2D5DB',
  success: '#15803D',
  warning: '#B45309',
  error: '#DC2626',
  overlay: 'rgba(23,24,28,0.45)',
};

/**
 * Build the full token set for a mode + accent pair.
 *
 * `accent` is the user's source tone; the tokens are the derived, readable
 * version of it.
 */
export function buildTokens(
  mode: 'dark' | 'light',
  accentInput: string = DEFAULT_ACCENT,
): ThemeTokens {
  const base = mode === 'dark' ? DARK_BASE : LIGHT_BASE;
  const accent = normalizeHex(accentInput) ?? DEFAULT_ACCENT;

  // Primary is tuned so that `onPrimary` always passes 4.5:1.
  const primary = tuneForContrast(accent, mode === 'dark' ? base.background : base.surface);
  // Light scheme: white on the (darkened) primary. Dark scheme: the soft
  // near-black used by the reference design, with a pure-black fallback for
  // accents that need the extra contrast.
  const onPrimary =
    mode === 'dark'
      ? contrastRatio(primary, '#121316') >= 4.5
        ? '#121316'
        : '#000000'
      : '#FFFFFF';

  // Secondary is a desaturated sibling of the primary.
  const { h, s } = hexToHsl(primary);
  const secondaryBase = hslToHex({ h, s: Math.min(s, 0.22), l: mode === 'dark' ? 0.72 : 0.42 });
  const secondary = mode === 'dark' ? secondaryBase : tuneForContrast(secondaryBase, base.surface, 4.5);
  const onSecondary = readableForeground(secondary);

  const primaryContainer =
    mode === 'dark' ? mix(primary, base.background, 0.68) : mix(primary, '#FFFFFF', 0.82);
  const onPrimaryContainer =
    mode === 'dark' ? mix(primary, '#FFFFFF', 0.45) : mix(primary, '#000000', 0.35);

  const secondaryContainer =
    mode === 'dark' ? mix(secondary, base.background, 0.72) : mix(secondary, '#FFFFFF', 0.84);
  const onSecondaryContainer =
    mode === 'dark' ? mix(secondary, '#FFFFFF', 0.35) : mix(secondary, '#000000', 0.4);

  return {
    mode,

    background: mix(base.background, accent, mode === 'dark' ? 0.035 : 0.025),
    surface: mix(base.surface, accent, mode === 'dark' ? 0.045 : 0.02),
    surfaceVariant: mix(base.surfaceVariant, accent, mode === 'dark' ? 0.05 : 0.03),
    surfaceContainer: mix(base.surfaceContainer, accent, mode === 'dark' ? 0.065 : 0.04),
    primary,
    onPrimary,
    primaryContainer,
    onPrimaryContainer,
    secondary,
    onSecondary,
    secondaryContainer,
    onSecondaryContainer,
    textPrimary: base.textPrimary,
    textSecondary: base.textSecondary,
    textTertiary: base.textTertiary,
    border: mix(base.border, accent, mode === 'dark' ? 0.16 : 0.1),
    borderStrong: mix(base.borderStrong, accent, mode === 'dark' ? 0.2 : 0.14),
    success: base.success,
    warning: base.warning,
    error: base.error,
    onError: readableForeground(base.error),
    overlay: base.overlay,

    bg: mix(base.background, accent, mode === 'dark' ? 0.035 : 0.025),
    card: mix(base.surface, accent, mode === 'dark' ? 0.045 : 0.02),
    text: base.textPrimary,
    sub: base.textSecondary,
    muted: base.textTertiary,
    accent: primary,
    onAccent: onPrimary,
    danger: base.error,
  };
}

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
  accent: string = DEFAULT_ACCENT,
): ThemeTokens {
  const resolved = preference === 'system' ? (systemScheme ?? 'dark') : preference;
  return buildTokens(resolved, accent);
}

/* ── legacy palette shape ───────────────────────────────────────────────── */

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

/** Derive the legacy palette from the token set (single source of truth). */
export function paletteFromTokens(tokens: ThemeTokens): Palette {
  return {
    bg: tokens.background,
    surface: tokens.surface,
    surfaceAlt: tokens.surfaceContainer,
    border: tokens.border,
    borderStrong: tokens.borderStrong,
    text: tokens.textPrimary,
    textMuted: tokens.textSecondary,
    textDim: tokens.textTertiary,
    accent: tokens.primary,
    accentText: tokens.onPrimary,
    danger: tokens.error,
    success: tokens.success,
    overlay: tokens.overlay,
    tabBar: tokens.background,
  };
}

export const DARK: Palette = paletteFromTokens(buildTokens('dark'));
export const LIGHT: Palette = paletteFromTokens(buildTokens('light'));

export function paletteFor(
  preference: ThemePreference,
  systemScheme: 'dark' | 'light',
  accent: string = DEFAULT_ACCENT,
): Palette {
  const resolved = preference === 'system' ? systemScheme : preference;
  return paletteFromTokens(buildTokens(resolved, accent));
}

/* ── appearance helpers ─────────────────────────────────────────────────── */

/** Corner radius per card style. */
export const CARD_RADIUS: Record<CardStyle, number> = {
  standard: 20,
  rounded: 28,
  minimal: 12,
};

/** Border width per card style (minimal cards are borderless). */
export const CARD_BORDER_WIDTH: Record<CardStyle, number> = {
  standard: 1,
  rounded: 1,
  minimal: 0,
};

/** Corner radius bounds for the slider preference. */
export const CORNER_RADIUS_RANGE = { min: 0, max: 32, step: 2 } as const;

/** Vertical padding of a habit row per density. */
export const ROW_PADDING: Record<ListDensity, number> = {
  compact: 10,
  comfortable: 14,
};

/** Minimum touch target of a habit row per density. */
export const ROW_MIN_HEIGHT: Record<ListDensity, number> = {
  compact: 46,
  comfortable: 56,
};

/** Gap between cards per density. */
export const SECTION_GAP: Record<ListDensity, number> = {
  compact: 14,
  comfortable: 20,
};

/* ── habit colour swatches (per-habit, independent of the app accent) ───── */

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
export const CATEGORY_EMOJI: Record<string, readonly string[]> = {
  health: ['💧', '🥗', '🪥', '😴', '🧘', '💊', '🥛', '🚶', '🧴', '🍎'],
  fitness: ['💪', '🏃', '🚴', '🏊', '⚽', '🏋️', '🤸', '🧗', '🥊', '🛼'],
  learning: ['📚', '✍️', '🧠', '🎓', '📖', '🔬', '💻', '🎸', '🎨', '🗣️'],
  productivity: ['⚡', '🎯', '📝', '🧹', '💰', '📵', '🗂️', '⏰', '📊', '✅'],
  personal: ['🌱', '🙏', '🌙', '☀️', '🎵', '🌸', '🐶', '☕', '📷', '🪴'],
};
