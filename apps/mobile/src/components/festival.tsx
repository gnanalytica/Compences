import { useId, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { Festival } from '@compences/core';
import { Motif } from './motif';
import { fonts, lookColours, spacing } from '../lib/theme';
import { useTheme } from '../lib/use-theme';

/**
 * A festival's banner colour: glow in one corner, deepening to a colour dark
 * enough that white text on it reads. Drawn as an SVG gradient, which React
 * Native has no style for.
 */
export function HeroBackground({
  colours,
  from = [92, 0],
  style,
}: {
  colours: readonly [string, string, string];
  from?: readonly [number, number];
  style?: StyleProp<ViewStyle>;
}) {
  // One gradient per banner: two on a screen must not share an id.
  const id = `hero${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <Svg
      style={[StyleSheet.absoluteFill, style]}
      width="100%"
      height="100%"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <Defs>
        <RadialGradient
          id={id}
          cx={from[0]}
          cy={from[1]}
          rx={130}
          ry={125}
          fx={from[0]}
          fy={from[1]}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={colours[0]} />
          <Stop offset="0.46" stopColor={colours[1]} />
          <Stop offset="1" stopColor={colours[2]} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
    </Svg>
  );
}

/**
 * An event's banner: its festival's colour, and the thing the festival is
 * decorated with drawn in a column to the right of the words — a lamp for
 * Deepavali, lanterns for Eid, a star for Christmas — moving the way it does.
 * White type, the title in the serif. A day of mourning gets the colour and
 * nothing else. The web draws the same thing (components/festival.tsx).
 */
export function FestivalHero({
  festival,
  eyebrow,
  title,
  meta,
  children,
  top = 0,
  bottom = spacing.xl,
  motifSize = 168,
  titleSize = 30,
}: {
  festival: Festival;
  eyebrow?: string;
  title: string;
  meta?: string;
  /** Actions under the words. */
  children?: ReactNode;
  /** Room for the status bar and a back button, when the banner runs under them. */
  top?: number;
  bottom?: number;
  motifSize?: number;
  titleSize?: number;
}) {
  const { isDark } = useTheme();
  const look = lookColours(festival, isDark);
  return (
    <View style={{ overflow: 'hidden' }}>
      <HeroBackground colours={look.hero} />
      <Motif
        id={festival.motif}
        size={motifSize}
        calm={festival.mood !== 'festive'}
        color="rgba(255,255,255,0.62)"
        soft={0.26}
        style={{ position: 'absolute', right: -10, top: top + 22, opacity: 0.85 }}
      />
      <View style={{ paddingTop: top + spacing.lg, paddingHorizontal: 20, paddingBottom: bottom }}>
        <View style={{ maxWidth: '64%', gap: 4 }}>
          {eyebrow ? (
            <Text
              style={{
                color: 'rgba(255,255,255,0.78)',
                fontSize: 10.5,
                fontWeight: '600',
                letterSpacing: 1.7,
                textTransform: 'uppercase',
              }}
            >
              {eyebrow}
            </Text>
          ) : null}
          <Text
            accessibilityRole="header"
            style={{
              color: '#ffffff',
              fontFamily: fonts.serif,
              fontSize: titleSize,
              lineHeight: titleSize * 1.12,
              letterSpacing: -0.4,
            }}
          >
            {title}
          </Text>
          {meta ? (
            <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 13 }}>{meta}</Text>
          ) : null}
        </View>
        {children ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 14 }}>
            {children}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** A small square of the festival — its colour and its motif, whole and still. */
export function FestivalTile({ festival, size = 44 }: { festival: Festival; size?: number }) {
  const { isDark } = useTheme();
  const look = lookColours(festival, isDark);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <HeroBackground colours={look.hero} from={[100, 0]} />
      <Motif id={festival.motif} size={size * 0.76} compact color="#ffffff" />
    </View>
  );
}
