import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { MiniLineChart } from '../src/components/MiniLineChart';
import { TextField } from '../src/components/TextField';
import { useLogMobility, useMobilityTrend } from '../src/hooks/useTracking';
import { ApiError } from '../src/lib/api';
import { colors, radius, spacing, typography } from '../src/theme/tokens';

const FINGER_PRESETS = [
  { label: '1 finger', mm: 15 },
  { label: '2 fingers', mm: 30 },
  { label: '3 fingers', mm: 45 },
];

export default function JawMobilityScreen() {
  const router = useRouter();
  const trend = useMobilityTrend(60);
  const log = useLogMobility();
  const [mm, setMm] = useState('');
  const [notes, setNotes] = useState('');

  const onLog = async (measurement: number) => {
    try {
      await log.mutateAsync({ measurement_mm: measurement, method: measurement <= 45 ? 'fingers' : 'ruler', notes: notes || undefined });
      setMm('');
      setNotes('');
      Alert.alert('Logged!', `${measurement}mm recorded.`);
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.ink.primary} />
        </Pressable>
        <Text style={styles.title}>Jaw Mobility</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>How far can you open?</Text>
          <Text style={styles.helper}>Tap a preset or enter mm directly.</Text>

          <View style={styles.presets}>
            {FINGER_PRESETS.map((p) => (
              <Pressable key={p.label} style={styles.preset} onPress={() => onLog(p.mm)}>
                <Text style={styles.presetMm}>{p.mm}mm</Text>
                <Text style={styles.presetLabel}>{p.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.manualRow}>
            <View style={styles.flex1}>
              <TextField placeholder="Custom mm" value={mm} onChangeText={setMm} keyboardType="numeric" />
            </View>
            <Button
              title="Log"
              onPress={() => {
                const v = parseInt(mm, 10);
                if (v >= 1 && v <= 80) onLog(v);
                else Alert.alert('Invalid', 'Enter 1–80 mm.');
              }}
              loading={log.isPending}
              disabled={!mm}
            />
          </View>

          <TextField placeholder="Notes (optional)" value={notes} onChangeText={setNotes} style={styles.notes} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>60-Day Trend</Text>
          <MiniLineChart
            data={(trend.data ?? []).map((p) => ({ label: p.date.slice(5), value: p.avg_mm }))}
            color={colors.success.base}
            yLabel="Max opening (mm)"
          />
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={18} color={colors.navy.standard} />
          <Text style={styles.infoText}>
            Normal jaw opening is 40–55mm (about 3 fingers). Track regularly so your provider can monitor your progress.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.surface.border,
  },
  title: { ...typography.h2, color: colors.ink.primary },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  card: {
    backgroundColor: colors.surface.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.surface.border, padding: spacing.lg,
  },
  cardTitle: { ...typography.bodyStrong, color: colors.ink.primary, marginBottom: spacing.xs },
  helper: { ...typography.caption, color: colors.ink.secondary, marginBottom: spacing.md },
  presets: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  preset: {
    flex: 1, alignItems: 'center', padding: spacing.md,
    borderRadius: radius.md, backgroundColor: colors.navy.ghost,
    borderWidth: 1, borderColor: colors.navy.ghostStrong,
  },
  presetMm: { ...typography.bodyStrong, color: colors.navy.deep },
  presetLabel: { ...typography.tiny, color: colors.ink.secondary, marginTop: 2 },
  manualRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  flex1: { flex: 1 },
  notes: { marginTop: spacing.sm },
  infoCard: {
    flexDirection: 'row', gap: spacing.sm, padding: spacing.md,
    borderRadius: radius.md, backgroundColor: colors.navy.ghost,
  },
  infoText: { ...typography.caption, color: colors.ink.secondary, flex: 1 },
});
