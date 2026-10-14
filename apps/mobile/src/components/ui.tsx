import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { formatMoney } from '@compences/core';
import { cardShadow, fonts, radius, spacing } from '../lib/theme';
import { useTheme } from '../lib/use-theme';
import { useReducedMotion } from './motif';

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return <View style={[{ flex: 1, backgroundColor: colors.surface }, style]}>{children}</View>;
}

/** White on ivory, lifted by a hairline and a long, soft shadow. */
export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors, isDark } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surfaceRaised,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius.lg,
          padding: spacing.lg,
          ...cardShadow(isDark),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** A screen's title, in the serif. */
export function Title({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={{
        color: colors.ink,
        fontFamily: fonts.serif,
        fontSize: 28,
        lineHeight: 32,
        letterSpacing: -0.4,
      }}
    >
      {children}
    </Text>
  );
}

/** A card's title, in the serif. */
export function Heading({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text style={{ color: colors.ink, fontFamily: fonts.serif, fontSize: 17, lineHeight: 22 }}>
      {children}
    </Text>
  );
}

/**
 * A section's name in small gold capitals with a hairline running off to its
 * right, as the web's SectionLabel draws it.
 */
export function SectionLabel({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Text
        accessibilityRole="header"
        style={{
          color: colors.gold,
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 1.5,
          textTransform: 'uppercase',
        }}
      >
        {children}
      </Text>
      <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
    </View>
  );
}

/**
 * An amount in the serif that counts up to its value as it arrives, and
 * straight to it for anybody whose phone is set to reduce motion. Screen
 * readers only ever get the final figure.
 */
export function Amount({
  value,
  currency,
  size = 30,
  style,
}: {
  value: number;
  currency: string;
  size?: number;
  style?: TextStyle;
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reduced) {
      from.current = value;
      return;
    }
    const start = from.current;
    const began = Date.now();
    let frame = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - began) / 900);
      const eased = 1 - (1 - t) ** 3;
      setShown(Math.round(start + (value - start) * eased));
      if (t < 1) frame = requestAnimationFrame(step);
      else from.current = value;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  return (
    <Text
      accessibilityLabel={formatMoney(value, currency)}
      style={[
        {
          color: colors.ink,
          fontFamily: fonts.serif,
          fontSize: size,
          lineHeight: size * 1.15,
          letterSpacing: -0.5,
          fontVariant: ['tabular-nums', 'lining-nums'],
        },
        style,
      ]}
    >
      {formatMoney(reduced ? value : shown, currency)}
    </Text>
  );
}

export function Body({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  const { colors } = useTheme();
  return (
    <Text style={{ color: muted ? colors.inkMuted : colors.ink, fontSize: 14, lineHeight: 20 }}>
      {children}
    </Text>
  );
}

export function Caption({ children, tone }: { children: ReactNode; tone?: 'danger' | 'warning' }) {
  const { colors } = useTheme();
  return (
    <Text style={{ color: tone ? colors[tone] : colors.inkSubtle, fontSize: 12 }}>{children}</Text>
  );
}

/**
 * Primary is ink, not colour: with a festival's colour on every button there
 * would be none left for the festival. `festive` wears it; `inverse` and
 * `glass` are for a festival's banner, where ink would vanish. A press sinks a
 * little, so it is felt before the next screen answers.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  compact = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'festive' | 'inverse' | 'glass';
  loading?: boolean;
  disabled?: boolean;
  /** A smaller button, for a banner or a row. Its touch target stays 44. */
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const inactive = disabled || loading;
  const look = {
    primary: { fill: colors.ink, text: colors.surface, border: 'transparent' },
    secondary: { fill: colors.surfaceRaised, text: colors.ink, border: colors.border },
    festive: { fill: colors.accent, text: colors.accentInk, border: 'transparent' },
    inverse: { fill: '#ffffff', text: '#1b1611', border: 'transparent' },
    glass: {
      fill: 'rgba(255,255,255,0.16)',
      text: '#ffffff',
      border: 'rgba(255,255,255,0.3)',
    },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={inactive ? undefined : onPress}
      hitSlop={compact ? { top: 6, bottom: 6 } : undefined}
      style={({ pressed }) => ({
        backgroundColor: look.fill,
        borderColor: look.border,
        borderWidth: look.border === 'transparent' ? 0 : StyleSheet.hairlineWidth,
        borderRadius: compact ? radius.sm : radius.md,
        paddingVertical: compact ? 8 : 13,
        paddingHorizontal: compact ? 14 : spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: inactive ? 0.55 : 1,
        transform: [{ scale: pressed && !inactive ? 0.97 : 1 }],
        minHeight: compact ? 34 : 48,
      })}
    >
      {loading ? (
        <ActivityIndicator color={look.text} />
      ) : (
        <Text style={{ color: look.text, fontWeight: '600', fontSize: compact ? 13 : 15 }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Input(props: TextInputProps & { label?: string }) {
  const { colors } = useTheme();
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? (
        <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '500' }}>{label}</Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.inkSubtle}
        accessibilityLabel={label}
        style={[
          {
            backgroundColor: colors.surfaceRaised,
            borderColor: colors.border,
            borderWidth: StyleSheet.hairlineWidth,
            borderRadius: radius.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: 12,
            color: colors.ink,
            fontSize: 15,
            minHeight: 48,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const { colors } = useTheme();
  const color =
    tone === 'success'
      ? colors.success
      : tone === 'warning'
        ? colors.warning
        : tone === 'danger'
          ? colors.danger
          : tone === 'info'
            ? colors.accent
            : colors.inkMuted;

  return (
    <View
      style={{
        borderRadius: radius.pill,
        paddingHorizontal: 8,
        paddingVertical: 3,
        backgroundColor: `${color}1A`,
        borderColor: `${color}55`,
        borderWidth: StyleSheet.hairlineWidth,
      }}
    >
      <Text style={{ color, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <View style={{ alignItems: 'center', padding: spacing.xxl, gap: spacing.xs }}>
      <Heading>{title}</Heading>
      {description ? <Body muted>{description}</Body> : null}
    </View>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}
