import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../theme/tokens';

/**
 * TMJCONNECT wordmark. Matches the centered text logo that sits at the top of
 * every auth screen in the design boards. Currently text-only; swap to SVG
 * once the brand team delivers a final mark.
 */
export function Wordmark({ align = 'center' }: { align?: 'left' | 'center' }) {
  return (
    <View style={[styles.wrap, align === 'center' && styles.center]}>
      <Text style={styles.text}>TMJ</Text>
      <View style={styles.dot} />
      <Text style={styles.text}>CONNECT</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  center: { justifyContent: 'center' },
  text: {
    ...typography.h3,
    color: colors.navy.deep,
    letterSpacing: 2,
    fontWeight: '700',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gold.standard,
  },
});
