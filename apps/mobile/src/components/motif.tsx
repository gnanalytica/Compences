import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  MOTIF_LIGHT,
  motifLayers,
  motifViewBox,
  type MotifId,
  type MotifLayer,
  type MotifMotion,
  type MotifPaint,
} from '@compences/core';

/** Whether the phone is set to reduce motion, kept current as it changes. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (live) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

/** Seconds per loop, as on the web (globals.css); a calm look takes twice as long. */
const SECONDS: Record<MotifMotion, number> = {
  flicker: 1.7,
  twinkle: 2.8,
  sway: 5.5,
  swing: 3.8,
  drift: 7,
  bloom: 3.3,
  float: 4.2,
  turn: 120,
  rise: 3.4,
  wave: 6,
  pulse: 3.2,
  fall: 6.5,
};

/** The loops that go there and back, rather than round and round. */
const ALTERNATE = new Set<MotifMotion>(['sway', 'swing', 'drift', 'float', 'wave', 'pulse']);

/**
 * One moving layer: a clock from 0 to 1, looped on the native thread, read
 * into the same transform the web's keyframes describe. `unit` turns the
 * drawing's 120-point canvas into points on screen.
 */
function useLoop(motion: MotifMotion, delay: number, calm: boolean) {
  const clock = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    const duration = SECONDS[motion] * 1000 * (calm ? 2 : 1);
    const easing =
      motion === 'turn' || motion === 'fall' ? Easing.linear : Easing.inOut(Easing.sin);
    const forward = Animated.timing(clock, {
      toValue: 1,
      duration,
      easing,
      useNativeDriver: true,
    });
    const loop = ALTERNATE.has(motion)
      ? Animated.loop(
          Animated.sequence([
            forward,
            Animated.timing(clock, { toValue: 0, duration, easing, useNativeDriver: true }),
          ]),
        )
      : Animated.loop(forward, { resetBeforeIteration: true });
    const timer = setTimeout(() => loop.start(), delay * 1000);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [clock, motion, delay, calm]);
  return clock;
}

function motionStyle(motion: MotifMotion, clock: Animated.Value, unit: number) {
  const at = (input: number[], output: number[] | string[]) =>
    clock.interpolate({ inputRange: input, outputRange: output as number[] });
  switch (motion) {
    case 'flicker':
      return {
        transform: [
          { scaleX: at([0, 0.25, 0.5, 0.75, 1], [1, 0.97, 1.02, 0.98, 1]) },
          { scaleY: at([0, 0.25, 0.5, 0.75, 1], [1, 1.06, 0.96, 1.04, 1]) },
        ],
      };
    case 'twinkle':
      return {
        opacity: at([0, 0.5, 1], [1, 0.3, 1]),
        transform: [{ scale: at([0, 0.5, 1], [1, 0.6, 1]) }],
      };
    case 'sway':
      return { transform: [{ rotate: at([0, 1], ['-2.5deg', '2.5deg']) }] };
    case 'swing':
      return { transform: [{ rotate: at([0, 1], ['-6deg', '6deg']) }] };
    case 'drift':
      return {
        transform: [
          { translateX: at([0, 1], [0, 2 * unit]) },
          { translateY: at([0, 1], [0, -4 * unit]) },
          { scale: at([0, 1], [1, 1.05]) },
        ],
      };
    case 'bloom':
      return {
        opacity: at([0, 0.35, 0.75, 1], [0, 1, 1, 0]),
        transform: [{ scale: at([0, 0.75, 1], [0.35, 1, 1.08]) }],
      };
    case 'float':
      return {
        transform: [
          { translateY: at([0, 1], [0, -5 * unit]) },
          { rotate: at([0, 1], ['0deg', '1.5deg']) },
        ],
      };
    case 'turn':
      return { transform: [{ rotate: at([0, 1], ['0deg', '360deg']) }] };
    case 'rise':
      return {
        opacity: at([0, 0.3, 1], [0, 0.9, 0]),
        transform: [{ translateY: at([0, 1], [6 * unit, -16 * unit]) }],
      };
    case 'wave':
      return {
        transform: [
          { translateX: at([0, 1], [-2 * unit, 2 * unit]) },
          { translateY: at([0, 1], [0, -2 * unit]) },
          { rotate: at([0, 1], ['-0.8deg', '0.8deg']) },
        ],
      };
    case 'pulse':
      return {
        opacity: at([0, 1], [0.75, 1]),
        transform: [{ scale: at([0, 1], [0.96, 1.04]) }],
      };
    case 'fall':
      return {
        opacity: at([0, 0.15, 0.85, 1], [0, 1, 1, 0]),
        transform: [
          { translateY: at([0, 1], [-8 * unit, 26 * unit]) },
          { rotate: at([0, 1], ['0deg', '160deg']) },
        ],
      };
  }
}

type Paints = { line: string; light: string; soft: number };

function Layer({ layer, paints }: { layer: MotifLayer; paints: Paints }) {
  const paint = (value: MotifPaint | undefined) =>
    value === undefined
      ? 'none'
      : value === 'line' || value === 'soft'
        ? paints.line
        : value === 'light'
          ? paints.light
          : value;
  return (
    <>
      {layer.paths.map((path, index) => (
        <Path
          key={index}
          d={path.d}
          fill={paint(path.fill)}
          fillOpacity={path.fill === 'soft' ? paints.soft : 1}
          stroke={paint(path.stroke)}
          strokeWidth={path.width ?? 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          opacity={path.opacity}
        />
      ))}
    </>
  );
}

function Moving({
  layer,
  viewBox,
  paints,
  unit,
  calm,
}: {
  layer: MotifLayer & { motion: MotifMotion };
  viewBox: string;
  paints: Paints;
  unit: number;
  calm: boolean;
}) {
  const clock = useLoop(layer.motion, layer.delay ?? 0, calm);
  const [x, y] = layer.origin ?? [60, 60];
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { transformOrigin: `${(x / 120) * 100}% ${(y / 120) * 100}%` },
        motionStyle(layer.motion, clock, unit),
      ]}
    >
      <Svg width="100%" height="100%" viewBox={viewBox}>
        <Layer layer={layer} paints={paints} />
      </Svg>
    </Animated.View>
  );
}

/**
 * A festival's motif (core/motifs.ts), the same drawing the web shows. Large,
 * all of it and moving on a banner; small, only its essentials and still on a
 * tile. Every movement runs on the native thread and stops for anybody whose
 * phone is set to reduce motion. Decorative, so hidden from screen readers.
 */
export function Motif({
  id,
  size,
  compact = false,
  calm = false,
  color,
  light = MOTIF_LIGHT,
  soft = 0.16,
  style,
}: {
  id: MotifId;
  size: number;
  compact?: boolean;
  calm?: boolean;
  /** The line colour: white on a banner, the festival's colour on a pale tile. */
  color: string;
  light?: string;
  soft?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const layers = motifLayers(id, compact);
  const viewBox = motifViewBox(id, compact);
  const paints = { line: color, light, soft };
  if (!layers.length) return null;
  const still = compact || reduced;
  const fixed = still ? layers : layers.filter((layer) => !layer.motion);
  const moving = still ? [] : layers.filter((layer) => layer.motion);
  const frame: ReactNode = (
    <Svg width="100%" height="100%" viewBox={viewBox}>
      {fixed.map((layer, index) => (
        <Layer key={index} layer={layer} paints={paints} />
      ))}
    </Svg>
  );
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: size, height: size }, style]}
    >
      <View style={StyleSheet.absoluteFill}>{frame}</View>
      {moving.map((layer, index) => (
        <Moving
          key={index}
          layer={layer as MotifLayer & { motion: MotifMotion }}
          viewBox={viewBox}
          paints={paints}
          unit={size / 120}
          calm={calm}
        />
      ))}
    </View>
  );
}
