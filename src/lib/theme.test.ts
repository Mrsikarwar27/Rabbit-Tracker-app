/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCENT_PRESETS,
  DEFAULT_ACCENT,
  buildTokens,
  contrastRatio,
  findPreset,
  isValidHex,
  normalizeHex,
  resolveTheme,
} from './theme';

test('normalizeHex accepts the usual hex shapes and rejects junk', () => {
  assert.equal(normalizeHex('#A6F36A'), '#A6F36A');
  assert.equal(normalizeHex('a6f36a'), '#A6F36A');
  assert.equal(normalizeHex('  #a6f36a  '), '#A6F36A');
  assert.equal(normalizeHex('#abc'), '#AABBCC');
  assert.equal(normalizeHex('#A6F36A80'), '#A6F36A'); // alpha dropped
  assert.equal(normalizeHex('#GGGGGG'), null);
  assert.equal(normalizeHex('rgb(1,2,3)'), null);
  assert.equal(normalizeHex(''), null);
  assert.equal(normalizeHex('#12345'), null);
  assert.equal(isValidHex('#A6F36A'), true);
  assert.equal(isValidHex('nope'), false);
});

test('every preset accent produces readable tokens in both modes', () => {
  for (const preset of ACCENT_PRESETS) {
    for (const mode of ['light', 'dark'] as const) {
      const t = buildTokens(mode, preset.hex);
      const label = `${preset.label}/${mode}`;

      // Text on the accent must be readable.
      assert.ok(
        contrastRatio(t.primary, t.onPrimary) >= 4.5,
        `${label}: primary/onPrimary contrast ${contrastRatio(t.primary, t.onPrimary).toFixed(2)}`,
      );
      // Primary text on the app background.
      assert.ok(
        contrastRatio(t.textPrimary, t.background) >= 7,
        `${label}: text/background contrast ${contrastRatio(t.textPrimary, t.background).toFixed(2)}`,
      );
      // Secondary text on the card surface.
      assert.ok(
        contrastRatio(t.textSecondary, t.surface) >= 4.5,
        `${label}: secondary/surface contrast ${contrastRatio(t.textSecondary, t.surface).toFixed(2)}`,
      );
      // Tertiary captions stay legible.
      assert.ok(
        contrastRatio(t.textTertiary, t.background) >= 3,
        `${label}: tertiary/background contrast ${contrastRatio(t.textTertiary, t.background).toFixed(2)}`,
      );
      // Semantic colours keep their meaning and stay readable.
      assert.ok(contrastRatio(t.success, t.background) >= 3, `${label}: success contrast`);
      assert.ok(contrastRatio(t.error, t.background) >= 3, `${label}: error contrast`);
      // Container pairs stay readable too.
      assert.ok(
        contrastRatio(t.onPrimaryContainer, t.primaryContainer) >= 4.5,
        `${label}: primary container contrast ${contrastRatio(t.onPrimaryContainer, t.primaryContainer).toFixed(2)}`,
      );
      assert.ok(
        contrastRatio(t.onSecondaryContainer, t.secondaryContainer) >= 4.5,
        `${label}: secondary container contrast ${contrastRatio(t.onSecondaryContainer, t.secondaryContainer).toFixed(2)}`,
      );
    }
  }
});

test('the same accent yields different primaries per mode', () => {
  const dark = buildTokens('dark', DEFAULT_ACCENT);
  const light = buildTokens('light', DEFAULT_ACCENT);
  assert.notEqual(dark.primary, light.primary);
  assert.equal(dark.mode, 'dark');
  assert.equal(light.mode, 'light');
});

test('resolveTheme honours the mode preference and the system scheme', () => {
  assert.equal(resolveTheme('dark', 'light').mode, 'dark');
  assert.equal(resolveTheme('light', 'dark').mode, 'light');
  assert.equal(resolveTheme('system', 'light').mode, 'light');
  assert.equal(resolveTheme('system', 'dark').mode, 'dark');
  // Unknown/absent system scheme falls back to dark instead of crashing.
  assert.equal(resolveTheme('system', null).mode, 'dark');
  assert.equal(resolveTheme('system', undefined).mode, 'dark');
});

test('changing the accent changes every accent-driven token', () => {
  const lime = buildTokens('dark', '#A6F36A');
  const rose = buildTokens('dark', '#FF8BA7');
  assert.notEqual(lime.primary, rose.primary);
  assert.notEqual(lime.surface, rose.surface);
  assert.notEqual(lime.border, rose.border);
  // Semantics that must not change with the accent.
  assert.equal(lime.success, rose.success);
  assert.equal(lime.error, rose.error);
});

test('a malformed accent falls back to the default instead of breaking the theme', () => {
  const broken = buildTokens('dark', 'not-a-colour');
  const fallback = buildTokens('dark', DEFAULT_ACCENT);
  assert.equal(broken.primary, fallback.primary);
});

test('findPreset matches a stored accent back to its preset', () => {
  assert.equal(findPreset('#A6F36A')?.key, 'lime');
  assert.equal(findPreset('a6f36a')?.key, 'lime');
  assert.equal(findPreset('#123456'), undefined);
});
