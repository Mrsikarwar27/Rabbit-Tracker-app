import type { ThemePreference } from './types';

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
