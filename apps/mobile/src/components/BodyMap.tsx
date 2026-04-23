import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { BodyArea } from '../lib/patient.api';
import { colors, radius, spacing, typography } from '../theme/tokens';

type Side = 'left' | 'right' | 'center';

type Zone = {
  id: string;
  area: string;
  side: Side;
  label: string;
  /** Center of the tap hotspot in SVG user space (viewBox 240×340). */
  x: number;
  y: number;
};

const VIEWBOX_W = 240;
const VIEWBOX_H = 340;

/**
 * Anatomical pain hotspots laid out on a front-facing bust silhouette.
 * L/R positions mirror across x=120. TMJ patients most often report pain
 * at temple / ear / jaw — those sit near the joint for easy tapping.
 */
const ZONES: readonly Zone[] = [
  { id: 'top-center',      area: 'top of head', side: 'center', label: 'Top of head', x: 120, y: 32  },
  { id: 'forehead-center', area: 'forehead',    side: 'center', label: 'Forehead',    x: 120, y: 72  },
  { id: 'temple-left',     area: 'temple',      side: 'left',   label: 'Temple',      x: 70,  y: 92  },
  { id: 'temple-right',    area: 'temple',      side: 'right',  label: 'Temple',      x: 170, y: 92  },
  { id: 'ear-left',        area: 'ear',         side: 'left',   label: 'Ear',         x: 42,  y: 128 },
  { id: 'ear-right',       area: 'ear',         side: 'right',  label: 'Ear',         x: 198, y: 128 },
  { id: 'cheek-left',      area: 'cheek',       side: 'left',   label: 'Cheek',       x: 82,  y: 148 },
  { id: 'cheek-right',     area: 'cheek',       side: 'right',  label: 'Cheek',       x: 158, y: 148 },
  { id: 'jaw-left',        area: 'jaw',         side: 'left',   label: 'Jaw',         x: 78,  y: 198 },
  { id: 'jaw-right',       area: 'jaw',         side: 'right',  label: 'Jaw',         x: 162, y: 198 },
  { id: 'chin-center',     area: 'chin',        side: 'center', label: 'Chin',        x: 120, y: 224 },
  { id: 'neck-center',     area: 'neck',        side: 'center', label: 'Neck',        x: 120, y: 258 },
  { id: 'shoulder-left',   area: 'shoulder',    side: 'left',   label: 'Shoulder',    x: 55,  y: 300 },
  { id: 'shoulder-right',  area: 'shoulder',    side: 'right',  label: 'Shoulder',    x: 185, y: 300 },
];

// Simple stylized bust silhouette (head + neck + shoulders) — decorative only.
const HEAD_PATH =
  'M 40 85 Q 40 15 120 15 Q 200 15 200 85 Q 200 150 180 195 Q 160 225 120 235 Q 80 225 60 195 Q 40 150 40 85 Z';
const NECK_PATH = 'M 100 235 L 100 272 L 140 272 L 140 235 Z';
const SHOULDERS_PATH =
  'M 8 310 Q 8 272 100 272 L 140 272 Q 232 272 232 310 L 232 340 L 8 340 Z';
const EAR_LEFT_PATH = 'M 40 115 Q 30 115 30 128 Q 30 142 40 142 Z';
const EAR_RIGHT_PATH = 'M 200 115 Q 210 115 210 128 Q 210 142 200 142 Z';

function sideSuffix(side: Side) {
  if (side === 'left') return ' · L';
  if (side === 'right') return ' · R';
  return '';
}

function sameZone(b: BodyArea, z: Zone) {
  return b.area === z.area && b.side === z.side;
}

/**
 * Tap-to-mark pain locations on a head/bust diagram. Each tap toggles one
 * `{area, side}` entry. Selected spots light up in gold; unselected spots
 * breathe with a soft pulse to hint that they're tappable. Selections also
 * appear as removable chips below the diagram.
 */
export function BodyMap({
  value,
  onChange,
}: {
  value: BodyArea[];
  onChange: (v: BodyArea[]) => void;
}) {
  // Native-driver pulse on an overlay View — avoids animating SVG attributes
  // directly, which has crashed on some react-native-svg builds.
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1800,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.4] });
  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.28, 0],
  });

  const toggle = (z: Zone) => {
    const existing = value.some((b) => sameZone(b, z));
    if (existing) {
      onChange(value.filter((b) => !sameZone(b, z)));
    } else {
      onChange([...value, { area: z.area, side: z.side }]);
    }
  };

  const remove = (b: BodyArea) => {
    onChange(value.filter((x) => !(x.area === b.area && x.side === b.side)));
  };

  const selectedIds = new Set(
    ZONES.filter((z) => value.some((b) => sameZone(b, z))).map((z) => z.id),
  );

  // Mirror "both" entries onto each side dot so legacy data from the old
  // picker still highlights correctly.
  const bothAreas = new Set(value.filter((b) => b.side === 'both').map((b) => b.area));

  return (
    <View style={styles.wrap}>
      <View style={styles.map}>
        <Svg
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          width="100%"
          height="100%"
          pointerEvents="none"
        >
          <Path d={HEAD_PATH} fill={colors.navy.ghost} stroke={colors.navy.ghostStrong} strokeWidth={1.25} />
          <Path d={EAR_LEFT_PATH} fill={colors.navy.ghost} stroke={colors.navy.ghostStrong} strokeWidth={1.25} />
          <Path d={EAR_RIGHT_PATH} fill={colors.navy.ghost} stroke={colors.navy.ghostStrong} strokeWidth={1.25} />
          <Path d={NECK_PATH} fill={colors.navy.ghost} stroke={colors.navy.ghostStrong} strokeWidth={1.25} />
          <Path d={SHOULDERS_PATH} fill={colors.navy.ghost} stroke={colors.navy.ghostStrong} strokeWidth={1.25} />
        </Svg>

        {ZONES.map((z) => {
          const sel = selectedIds.has(z.id) || bothAreas.has(z.area);
          return (
            <Pressable
              key={z.id}
              onPress={() => toggle(z)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`${z.label}${sideSuffix(z.side)}`}
              accessibilityState={{ selected: sel }}
              style={[
                styles.hotspot,
                {
                  left: `${(z.x / VIEWBOX_W) * 100}%`,
                  top: `${(z.y / VIEWBOX_H) * 100}%`,
                },
              ]}
            >
              {!sel ? (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.pulse,
                    { opacity: pulseOpacity, transform: [{ scale: pulseScale }] },
                  ]}
                />
              ) : null}
              <View style={sel ? styles.dotSelected : styles.dot} />
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.hint}>Tap where it hurts. Tap again to remove.</Text>

      {value.length === 0 ? (
        <View style={styles.emptyRow}>
          <Ionicons name="hand-left-outline" size={14} color={colors.ink.tertiary} />
          <Text style={styles.emptyText}>No locations selected yet.</Text>
        </View>
      ) : (
        <View style={styles.chips}>
          {value.map((b, i) => {
            const title =
              b.area.charAt(0).toUpperCase() + b.area.slice(1) + sideSuffix(b.side as Side);
            return (
              <Pressable
                key={`${b.area}-${b.side}-${i}`}
                onPress={() => remove(b)}
                style={styles.chip}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${title}`}
              >
                <Text style={styles.chipText}>{title}</Text>
                <Ionicons name="close" size={13} color={colors.navy.deep} />
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const DOT_SIZE = 16;
const DOT_SELECTED_SIZE = 22;
const HOTSPOT_SIZE = 28;

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  map: {
    aspectRatio: VIEWBOX_W / VIEWBOX_H,
    alignSelf: 'center',
    width: '85%',
    maxWidth: 320,
    position: 'relative',
  },
  hotspot: {
    position: 'absolute',
    width: HOTSPOT_SIZE,
    height: HOTSPOT_SIZE,
    marginLeft: -HOTSPOT_SIZE / 2,
    marginTop: -HOTSPOT_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: colors.navy.standard,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: colors.navy.ghost,
    borderWidth: 1,
    borderColor: colors.navy.ghostStrong,
    opacity: 0.7,
  },
  dotSelected: {
    width: DOT_SELECTED_SIZE,
    height: DOT_SELECTED_SIZE,
    borderRadius: DOT_SELECTED_SIZE / 2,
    backgroundColor: 'rgba(212, 168, 67, 0.5)',
  },
  hint: {
    ...typography.caption,
    color: colors.ink.tertiary,
    textAlign: 'center',
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.xs,
  },
  emptyText: { ...typography.caption, color: colors.ink.tertiary, fontStyle: 'italic' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.gold.ghost,
    borderWidth: 1,
    borderColor: colors.gold.ghostStrong,
  },
  chipText: { ...typography.label, color: colors.navy.deep, fontWeight: '600' },
});
