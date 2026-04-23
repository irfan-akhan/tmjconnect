import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { TextField } from '../src/components/TextField';
import { useLogMedication, useMedicationCorrelation } from '../src/hooks/useTracking';
import { ApiError } from '../src/lib/api';
import { colors, radius, spacing, typography } from '../src/theme/tokens';

const COMMON_MEDS = ['Ibuprofen', 'Acetaminophen', 'Naproxen', 'Muscle relaxant', 'Night guard'];

export default function MedicationLogScreen() {
  const router = useRouter();
  const log = useLogMedication();
  const corr = useMedicationCorrelation(30);
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [notes, setNotes] = useState('');

  const onLog = async (medName: string) => {
    try {
      await log.mutateAsync({ medication_name: medName, dosage: dosage || undefined, notes: notes || undefined });
      setName('');
      setDosage('');
      setNotes('');
      Alert.alert('Logged!', `${medName} recorded.`);
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Try again.');
    }
  };

  const cd = corr.data;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.ink.primary} />
        </Pressable>
        <Text style={styles.title}>Medication Log</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick Log</Text>
          <Text style={styles.helper}>Tap a common medication or enter your own.</Text>
          <View style={styles.chips}>
            {COMMON_MEDS.map((m) => (
              <Pressable key={m} style={styles.chip} onPress={() => onLog(m)}>
                <Text style={styles.chipText}>{m}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Custom Entry</Text>
          <TextField placeholder="Medication name" value={name} onChangeText={setName} />
          <TextField placeholder="Dosage (e.g. 400mg)" value={dosage} onChangeText={setDosage} style={styles.mt} />
          <TextField placeholder="Notes (optional)" value={notes} onChangeText={setNotes} style={styles.mt} />
          <View style={styles.mt}>
            <Button title="Log Medication" onPress={() => name && onLog(name)} loading={log.isPending} disabled={!name} />
          </View>
        </View>

        {cd && cd.medication_days_count > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>30-Day Impact</Text>
            <View style={styles.compRow}>
              <View style={styles.compBox}>
                <Text style={[styles.compValue, { color: colors.success.base }]}>{cd.medication_days_avg_pain}</Text>
                <Text style={styles.compLabel}>With medication</Text>
                <Text style={styles.compSub}>{cd.medication_days_count} days</Text>
              </View>
              <View style={styles.compBox}>
                <Text style={[styles.compValue, { color: colors.danger.base }]}>{cd.no_medication_days_avg_pain}</Text>
                <Text style={styles.compLabel}>Without</Text>
                <Text style={styles.compSub}>{cd.no_medication_days_count} days</Text>
              </View>
            </View>
          </View>
        ) : null}
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill, backgroundColor: colors.gold.ghost,
    borderWidth: 1, borderColor: colors.gold.ghostStrong,
  },
  chipText: { ...typography.label, color: colors.navy.deep, fontWeight: '600' },
  mt: { marginTop: spacing.sm },
  compRow: { flexDirection: 'row', gap: spacing.md },
  compBox: { flex: 1, alignItems: 'center', padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface.muted },
  compValue: { fontSize: 28, fontWeight: '700' },
  compLabel: { ...typography.label, color: colors.ink.secondary, marginTop: 2 },
  compSub: { ...typography.tiny, color: colors.ink.tertiary, marginTop: 2 },
});
