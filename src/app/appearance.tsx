import React, { useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useHabitStore';
import { ScreenHeader } from '@/components/ScreenHeader';
import {
  Card,
  Chip,
  OutlineButton,
  PrimaryButton,
  ProgressRing,
  SectionLabel,
  Slider,
} from '@/components/ui';
import {
  ACCENT_PRESETS,
  CORNER_RADIUS_RANGE,
  DEFAULT_ACCENT,
  findPreset,
  normalizeHex,
} from '@/lib/theme';
import type { CardStyle, ListDensity, ThemePreference } from '@/lib/types';

const MODES: readonly { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const CARD_STYLES: readonly { value: CardStyle; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'minimal', label: 'Minimal' },
];

const DENSITIES: readonly { value: ListDensity; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
];

/**
 * Settings → Appearance.
 *
 * Everything on this screen is a live control: the moment a colour, mode or
 * density is chosen, the whole app repaints from the same token set.
 */
export default function Appearance() {
  const {
    tokens,
    mode,
    accent,
    appearance,
    setMode,
    setAccent,
    setCardStyle,
    setCornerRadius,
    setDensity,
    setReducedMotion,
    resetAppearance,
  } = useTheme();
  const insets = useSafeAreaInsets();

  const [hexInput, setHexInput] = useState(accent);
  const [touched, setTouched] = useState(false);

  const normalized = useMemo(() => normalizeHex(hexInput), [hexInput]);
  const valid = normalized !== null;
  const dirty = valid && normalized.toUpperCase() !== accent.toUpperCase();
  const activePreset = findPreset(accent);
  const previewSwatch = normalized ?? accent;

  const applyCustom = () => {
    setTouched(true);
    if (!normalized) return;
    setAccent(normalized);
    setHexInput(normalized);
    setTouched(false);
  };

  const cancelCustom = () => {
    setHexInput(accent);
    setTouched(false);
  };

  const selectPreset = (hex: string) => {
    setAccent(hex);
    setHexInput(hex);
    setTouched(false);
  };

  return (
    <View style={[styles.screen, { backgroundColor: tokens.background }]}>
      <StatusBar
        barStyle={tokens.mode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={tokens.background}
      />
      <ScreenHeader
        title="Appearance"
        subtitle="Colours, shape and density"
        showBack
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Live preview ───────────────────────────────────────────────── */}
        <Card style={styles.previewCard}>
          <SectionLabel>LIVE PREVIEW</SectionLabel>
          <View style={styles.previewBody}>
            <View style={styles.previewTop}>
              <ProgressRing value={0.6} size={72} strokeWidth={7}>
                <Text style={[styles.previewRingValue, { color: tokens.textPrimary }]}>60%</Text>
              </ProgressRing>
              <View style={styles.previewInfo}>
                <View
                  style={[
                    styles.previewChip,
                    {
                      backgroundColor: tokens.primaryContainer,
                      borderColor: tokens.primary,
                    },
                  ]}
                >
                  <Text style={[styles.previewChipText, { color: tokens.onPrimaryContainer }]}>
                    Selected
                  </Text>
                </View>
                <Text style={[styles.previewTitle, { color: tokens.textPrimary }]}>Morning run</Text>
                <Text style={[styles.previewMeta, { color: tokens.textSecondary }]}>
                  Health · 3/3 done · ⏰ 07:30
                </Text>
              </View>
              <View
                style={[
                  styles.previewCheck,
                  { backgroundColor: tokens.primary, borderColor: tokens.primary },
                ]}
              >
                <Text style={[styles.previewCheckMark, { color: tokens.onPrimary }]}>✓</Text>
              </View>
            </View>

            <View style={styles.previewRow}>
              <View style={[styles.previewButton, { backgroundColor: tokens.primary }]}>
                <Text style={[styles.previewButtonText, { color: tokens.onPrimary }]}>
                  Primary action
                </Text>
              </View>
              <View
                style={[
                  styles.previewOutline,
                  { borderColor: tokens.border, backgroundColor: tokens.surfaceContainer },
                ]}
              >
                <Text style={[styles.previewOutlineText, { color: tokens.textPrimary }]}>
                  Secondary
                </Text>
              </View>
              <View
                style={[
                  styles.previewSwitch,
                  { backgroundColor: tokens.primary, borderColor: tokens.primary },
                ]}
              >
                <View style={[styles.previewThumb, { backgroundColor: tokens.onPrimary }]} />
              </View>
            </View>
          </View>
        </Card>

        {/* ── Theme mode ─────────────────────────────────────────────────── */}
        <Card style={styles.card}>
          <SectionLabel>THEME MODE</SectionLabel>
          <Text style={[styles.hint, { color: tokens.textSecondary }]}>
            System follows your device&apos;s light/dark setting.
          </Text>
          <View style={styles.segment}>
            {MODES.map((m) => (
              <Chip
                key={m.value}
                label={m.label}
                active={mode === m.value}
                onPress={() => setMode(m.value)}
              />
            ))}
          </View>
        </Card>

        {/* ── Accent palettes ────────────────────────────────────────────── */}
        <Card style={styles.card}>
          <SectionLabel>ACCENT PALETTE</SectionLabel>
          <Text style={[styles.hint, { color: tokens.textSecondary }]}>
            The accent drives buttons, progress, rings, selected tabs and
            completion controls across the app.
          </Text>
          <View style={styles.swatchGrid}>
            {ACCENT_PRESETS.map((preset) => {
              const active = activePreset?.key === preset.key;
              return (
                <Pressable
                  key={preset.key}
                  onPress={() => selectPreset(preset.hex)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${preset.label} accent`}
                  style={styles.swatchCell}
                >
                  <View
                    style={[
                      styles.swatch,
                      {
                        backgroundColor: preset.hex,
                        borderColor: active ? tokens.textPrimary : 'transparent',
                        borderWidth: active ? 3 : 0,
                      },
                    ]}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.swatchLabel,
                      { color: active ? tokens.textPrimary : tokens.textSecondary },
                    ]}
                  >
                    {preset.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* ── Custom colour ─────────────────────────────────────────────── */}
        <Card style={styles.card}>
          <SectionLabel>CUSTOM ACCENT</SectionLabel>
          <Text style={[styles.hint, { color: tokens.textSecondary }]}>
            Enter any hex colour, e.g. #A6F36A. Invalid values are rejected.
          </Text>

          <View style={styles.customRow}>
            <View
              style={[
                styles.customSwatch,
                { backgroundColor: previewSwatch, borderColor: tokens.border },
              ]}
            />
            <TextInput
              value={hexInput}
              onChangeText={(text) => {
                setHexInput(text);
                setTouched(true);
              }}
              onBlur={() => setTouched(false)}
              placeholder="#A6F36A"
              placeholderTextColor={tokens.textTertiary}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={9}
              accessibilityLabel="Custom accent hex colour"
              style={[
                styles.customInput,
                {
                  color: tokens.textPrimary,
                  backgroundColor: tokens.surfaceContainer,
                  borderColor: touched && !valid ? tokens.error : tokens.border,
                },
              ]}
            />
          </View>

          {touched && !valid ? (
            <Text style={[styles.error, { color: tokens.error }]}>
              ⚠️ That is not a valid hex colour. Use 3 or 6 hex digits, e.g. #A6F36A.
            </Text>
          ) : dirty ? (
            <Text style={[styles.hint, { color: tokens.textSecondary }]}>
              Ready to apply {normalized}.
            </Text>
          ) : null}

          <View style={styles.customActions}>
            <PrimaryButton
              label={dirty ? 'Apply colour' : 'Applied'}
              onPress={applyCustom}
              disabled={!valid || !dirty}
              style={styles.flexButton}
            />
            <OutlineButton
              label="Cancel"
              onPress={cancelCustom}
              disabled={!dirty}
              style={styles.cancelButton}
            />
          </View>
        </Card>

        {/* ── Shape & density ────────────────────────────────────────────── */}
        <Card style={styles.card}>
          <SectionLabel>SHAPE & DENSITY</SectionLabel>
          <Text style={[styles.hint, { color: tokens.textSecondary }]}>Card style</Text>
          <View style={styles.segment}>
            {CARD_STYLES.map((s) => (
              <Chip
                key={s.value}
                label={s.label}
                active={appearance.cardStyle === s.value}
                onPress={() => setCardStyle(s.value)}
              />
            ))}
          </View>

          <Text style={[styles.hint, { color: tokens.textSecondary, marginTop: 16 }]}>
            Habit list density
          </Text>
          <View style={styles.segment}>
            {DENSITIES.map((d) => (
              <Chip
                key={d.value}
                label={d.label}
                active={appearance.density === d.value}
                onPress={() => setDensity(d.value)}
              />
            ))}
          </View>

          <View style={styles.sliderHeader}>
            <Text style={[styles.hint, { color: tokens.textSecondary, marginTop: 16 }]}>
              Corner radius
            </Text>
            <Text style={[styles.sliderValue, { color: tokens.primary }]}>
              {appearance.cornerRadius}dp
            </Text>
          </View>
          <Slider
            value={appearance.cornerRadius}
            min={CORNER_RADIUS_RANGE.min}
            max={CORNER_RADIUS_RANGE.max}
            step={CORNER_RADIUS_RANGE.step}
            onChange={setCornerRadius}
            accessibilityLabel="Corner radius"
          />
        </Card>

        {/* ── Motion & system colours ────────────────────────────────────── */}
        <Card style={styles.card}>
          <SectionLabel>MOTION & SYSTEM</SectionLabel>

          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={[styles.switchTitle, { color: tokens.textPrimary }]}>Reduced motion</Text>
              <Text style={[styles.switchCaption, { color: tokens.textSecondary }]}>
                Minimise animated transitions and celebratory effects.
              </Text>
            </View>
            <Pressable
              onPress={() => setReducedMotion(!appearance.reducedMotion)}
              accessibilityRole="switch"
              accessibilityState={{ checked: appearance.reducedMotion }}
              accessibilityLabel="Reduced motion"
              style={[
                styles.switch,
                {
                  backgroundColor: appearance.reducedMotion ? tokens.primary : tokens.surfaceContainer,
                  borderColor: appearance.reducedMotion ? tokens.primary : tokens.borderStrong,
                },
              ]}
            >
              <View
                style={[
                  styles.thumb,
                  {
                    backgroundColor: appearance.reducedMotion ? tokens.onPrimary : tokens.textSecondary,
                    transform: [{ translateX: appearance.reducedMotion ? 22 : 0 }],
                  },
                ]}
              />
            </Pressable>
          </View>

          <View style={[styles.switchRow, { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: tokens.border }]}>
            <View style={styles.switchText}>
              <Text style={[styles.switchTitle, { color: tokens.textPrimary }]}>
                System dynamic colours
              </Text>
              <Text style={[styles.switchCaption, { color: tokens.textSecondary }]}>
                {Platform.OS === 'android'
                  ? 'Not available in this build — Android 12+ wallpaper colours need native APIs this app does not bundle. The custom palettes above are used on every platform.'
                  : 'Not available on this platform. The custom palettes above are used everywhere.'}
              </Text>
            </View>
            <View
              style={[
                styles.switch,
                styles.switchDisabled,
                { backgroundColor: tokens.surfaceContainer, borderColor: tokens.border },
              ]}
            >
              <View style={[styles.thumb, { backgroundColor: tokens.textTertiary }]} />
            </View>
          </View>
        </Card>

        {/* ── Reset ──────────────────────────────────────────────────────── */}
        <OutlineButton
          label="Reset to default appearance"
          tone="danger"
          onPress={() => {
            resetAppearance();
            setHexInput(DEFAULT_ACCENT);
            setTouched(false);
          }}
          style={styles.resetButton}
        />

        <Text style={[styles.footer, { color: tokens.textTertiary }]}>
          Changes apply instantly and are remembered on this device.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  card: {
    marginTop: 16,
  },
  previewCard: {
    marginTop: 16,
  },
  previewBody: {
    marginTop: 14,
  },
  previewTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewRingValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  previewInfo: {
    flex: 1,
    marginLeft: 14,
  },
  previewChip: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 6,
  },
  previewChipText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  previewMeta: {
    fontSize: 11.5,
    marginTop: 3,
  },
  previewCheck: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCheckMark: {
    fontSize: 14,
    fontWeight: '800',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  previewButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewButtonText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  previewOutline: {
    flex: 1,
    minHeight: 40,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewOutlineText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  previewSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    padding: 3,
    justifyContent: 'center',
  },
  previewThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  hint: {
    fontSize: 12.5,
    marginTop: 8,
    lineHeight: 17,
  },
  segment: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  swatchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 14,
  },
  swatchCell: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  swatchLabel: {
    fontSize: 10.5,
    marginTop: 6,
    fontWeight: '600',
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  customSwatch: {
    width: 46,
    height: 46,
    borderRadius: 15,
    borderWidth: 1,
  },
  customInput: {
    flex: 1,
    marginLeft: 12,
    minHeight: 46,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 1,
  },
  error: {
    fontSize: 12.5,
    marginTop: 10,
    fontWeight: '600',
  },
  customActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  flexButton: {
    flex: 1,
  },
  cancelButton: {
    minWidth: 96,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  sliderValue: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    minHeight: 56,
  },
  switchText: {
    flex: 1,
    paddingRight: 14,
  },
  switchTitle: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  switchCaption: {
    fontSize: 11.5,
    marginTop: 3,
    lineHeight: 16,
  },
  switch: {
    width: 52,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    padding: 3,
    justifyContent: 'center',
  },
  switchDisabled: {
    opacity: 0.55,
  },
  thumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  resetButton: {
    marginTop: 22,
  },
  footer: {
    fontSize: 11.5,
    textAlign: 'center',
    marginTop: 18,
  },
});
