import React, { useMemo, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/hooks/useHabitStore';
import {
  CARD_BORDER_WIDTH,
  CARD_RADIUS,
  ROW_MIN_HEIGHT,
  ROW_PADDING,
} from '@/lib/theme';

/**
 * Shared, theme-aware building blocks.
 *
 * Every colour comes from the token set produced by the theme store, so an
 * accent change repaints the whole app without touching a single component.
 */

/* ── text ──────────────────────────────────────────────────────────────── */

/** Small uppercase section heading. */
export function SectionLabel({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { tokens } = useTheme();
  return (
    <Text
      style={[
        styles.section,
        { color: tokens.textSecondary },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/* ── surfaces ──────────────────────────────────────────────────────────── */

export function Card({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const { tokens, appearance } = useTheme();
  const radius = appearance.cornerRadius ?? CARD_RADIUS[appearance.cardStyle];  return (
    <View
      style={[
        {
          backgroundColor: tokens.surface,
          borderRadius: radius,
          borderWidth: CARD_BORDER_WIDTH[appearance.cardStyle],
          borderColor: tokens.border,
          padding: padded ? 16 : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/* ── buttons ───────────────────────────────────────────────────────────── */

export function PrimaryButton({
  label,
  onPress,
  disabled,
  style,
  icon,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: string;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.primaryButton,
        {
          backgroundColor: tokens.primary,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <Text style={[styles.primaryLabel, { color: tokens.onPrimary }]}>
        {icon ? `${icon}  ` : ''}
        {label}
      </Text>
    </Pressable>
  );
}

export function OutlineButton({
  label,
  onPress,
  disabled,
  style,
  tone = 'neutral',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  tone?: 'neutral' | 'danger';
}) {
  const { tokens } = useTheme();
  const color = tone === 'danger' ? tokens.error : tokens.textPrimary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.outlineButton,
        {
          borderColor: tone === 'danger' ? tokens.error : tokens.border,
          opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
        },
        style,
      ]}
    >
      <Text style={[styles.outlineLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

/* ── selection controls ────────────────────────────────────────────────── */

export function Chip({
  label,
  active,
  onPress,
  count,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  count?: number;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? tokens.primaryContainer : tokens.surfaceContainer,
          borderColor: active ? tokens.primary : tokens.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.chipLabel,
          { color: active ? tokens.onPrimaryContainer : tokens.textSecondary },
        ]}
      >
        {label}
        {count !== undefined ? `  ${count}` : ''}
      </Text>
    </Pressable>
  );
}

/** Material 3 style switch. */
export function AppSwitch({
  value,
  onValueChange,
  label,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
  label?: string;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      hitSlop={8}
      style={[
        styles.switchTrack,
        {
          backgroundColor: value ? tokens.primary : tokens.surfaceContainer,
          borderColor: value ? tokens.primary : tokens.borderStrong,
        },
      ]}
    >
      <View
        style={[
          styles.switchThumb,
          {
            backgroundColor: value ? tokens.onPrimary : tokens.textSecondary,
            transform: [{ translateX: value ? 22 : 0 }],
          },
        ]}
      />
    </Pressable>
  );
}

/* ── progress ──────────────────────────────────────────────────────────── */

export function ProgressBar({
  value,
  height = 6,
  color,
  style,
}: {
  /** 0..1 */
  value: number;
  height?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { tokens } = useTheme();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View
      style={[
        {
          height,
          borderRadius: height / 2,
          backgroundColor: tokens.surfaceContainer,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <View
        style={{
          height: '100%',
          width: `${Math.round(clamped * 100)}%`,
          borderRadius: height / 2,
          backgroundColor: color ?? tokens.primary,
        }}
      />
    </View>
  );
}

/**
 * Material 3 progress ring.
 *
 * Drawn with plain React Native views (no SVG / native module) so it works
 * in every Expo Go build: the arc is a ring of short overlapping segments
 * positioned around the circle.
 */
export function ProgressRing({
  value,
  size = 96,
  strokeWidth = 8,
  children,
}: {
  /** 0..1 */
  value: number;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}) {
  const { tokens } = useTheme();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const radius = (size - strokeWidth) / 2;
  const segments = 40;
  const step = 360 / segments;
  const arc = (2 * Math.PI * radius) / segments;
  const filled = Math.round(clamped * segments);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Track */}
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: strokeWidth,
          borderColor: tokens.surfaceContainer,
        }}
      />
      {/* Arc */}
      {Array.from({ length: filled }, (_, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: size,
            height: size,
            transform: [{ rotate: `${i * step - 90}deg` }],
          }}
        >
          <View
            style={{
              position: 'absolute',
              left: size / 2 - (arc * 1.25) / 2,
              top: size / 2 - radius - strokeWidth / 2,
              width: arc * 1.25,
              height: strokeWidth,
              borderRadius: strokeWidth / 2,
              backgroundColor: tokens.primary,
            }}
          />
        </View>
      ))}
      <View style={styles.ringCenter}>{children}</View>
    </View>
  );
}

/* ── slider ────────────────────────────────────────────────────────────── */

/**
 * Dependency-free slider (PanResponder based).
 *
 * Used for the corner-radius preference — no extra native slider library,
 * so it behaves identically in Expo Go on every platform.
 */
export function Slider({
  value,
  min = 0,
  max = 1,
  step,
  onChange,
  accessibilityLabel,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (next: number) => void;
  accessibilityLabel?: string;
}) {
  const { tokens } = useTheme();
  const [width, setWidth] = useState(0);
  const range = max - min || 1;
  const ratio = Math.max(0, Math.min(1, (value - min) / range));
  const thumb = 24;

  const responder = useMemo(() => {
    const emit = (x: number) => {
      if (width <= 0) return;
      const raw = Math.max(0, Math.min(1, x / width));
      let next = min + raw * range;
      if (step) next = Math.round(next / step) * step;
      onChange(Math.max(min, Math.min(max, next)));
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => emit(e.nativeEvent.locationX),
      onPanResponderMove: (e) => emit(e.nativeEvent.locationX),
    });
  }, [min, max, step, onChange, range, width]);

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      {...responder.panHandlers}
      style={styles.sliderTouch}
    >
      <View style={[styles.sliderTrack, { backgroundColor: tokens.surfaceContainer }]}>
        <View
          style={[
            styles.sliderFill,
            { width: `${ratio * 100}%`, backgroundColor: tokens.primary },
          ]}
        />
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.sliderThumb,
          {
            backgroundColor: tokens.primary,
            borderColor: tokens.surface,
            left: Math.max(0, ratio * (width - thumb)),
          },
        ]}
      />
    </View>
  );
}

/* ── rows ──────────────────────────────────────────────────────────────── */

/** Standard list row height/spacing driven by the density preference. */
export function useRowMetrics() {
  const { appearance } = useTheme();
  return {
    paddingVertical: ROW_PADDING[appearance.density],
    minHeight: ROW_MIN_HEIGHT[appearance.density],
  };
}

const styles = StyleSheet.create({
  section: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primaryLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  outlineButton: {
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  outlineLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  chip: {
    minHeight: 36,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  chipLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  switchTrack: {
    width: 52,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    padding: 3,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  ringCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderTouch: {
    height: 40,
    justifyContent: 'center',
    marginTop: 4,
  },
  sliderTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  sliderFill: {
    height: '100%',
    borderRadius: 4,
  },
  sliderThumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
  },
});
