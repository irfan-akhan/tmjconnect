import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { useAuth } from '../../src/context/AuthContext';
import { markOnboarded } from '../../src/lib/onboarding';
import { updatePatientMe } from '../../src/lib/patient.api';
import { ApiError } from '../../src/lib/api';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say'] as const;

const CONDITIONS = [
  'TMJ Disorder',
  'Bruxism',
  'Jaw Pain',
  'Facial Pain',
  'Headaches / Migraines',
  'Neck Pain',
  'Other',
] as const;

export default function ProfileSetup() {
  const { completeOnboarding } = useAuth();
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [condition, setCondition] = useState('');
  const [saving, setSaving] = useState(false);

  const onContinue = async () => {
    setSaving(true);
    try {
      await updatePatientMe({
        ...(dob ? { date_of_birth: dob } : {}),
        ...(gender && gender !== 'Prefer not to say' ? { gender: gender.toLowerCase() } : {}),
        ...(city ? { city } : {}),
        ...(state ? { state } : {}),
      });
    } catch (err) {
      if (err instanceof ApiError) {
        Alert.alert('Could not save', err.message);
        setSaving(false);
        return;
      }
    }
    await markOnboarded();
    completeOnboarding();
  };

  const onSkip = async () => {
    await markOnboarded();
    completeOnboarding();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.iconCircle}>
          <Ionicons name="person" size={32} color={colors.navy.standard} />
        </View>
        <Text style={styles.title}>About You</Text>
        <Text style={styles.subtitle}>
          Help your provider give better recommendations. You can always update these in your profile.
        </Text>

        <Text style={styles.label}>Date of Birth</Text>
        <TextField
          placeholder="YYYY-MM-DD"
          value={dob}
          onChangeText={setDob}
          keyboardType="numbers-and-punctuation"
        />

        <Text style={styles.label}>Gender</Text>
        <View style={styles.chipRow}>
          {GENDER_OPTIONS.map((g) => (
            <ChipBtn key={g} label={g} selected={gender === g} onPress={() => setGender(gender === g ? '' : g)} />
          ))}
        </View>

        <Text style={styles.label}>Primary Condition</Text>
        <View style={styles.chipRow}>
          {CONDITIONS.map((c) => (
            <ChipBtn key={c} label={c} selected={condition === c} onPress={() => setCondition(condition === c ? '' : c)} />
          ))}
        </View>

        <Text style={styles.label}>Location</Text>
        <View style={styles.locationRow}>
          <View style={styles.flex1}>
            <TextField placeholder="City" value={city} onChangeText={setCity} />
          </View>
          <View style={styles.stateField}>
            <TextField placeholder="State" value={state} onChangeText={setState} />
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Continue" onPress={onContinue} loading={saving} />
        <Button title="Skip for now" variant="secondary" onPress={onSkip} />
      </View>
    </SafeAreaView>
  );
}

function ChipBtn({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Text
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.navy.ghost,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    alignSelf: 'center',
  },
  title: { ...typography.h1, color: colors.ink.primary, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.ink.secondary, textAlign: 'center', marginBottom: spacing.xl },
  label: { ...typography.bodyStrong, color: colors.ink.primary, marginTop: spacing.lg, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    ...typography.label,
    color: colors.ink.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.card,
    overflow: 'hidden',
  },
  chipSelected: {
    backgroundColor: colors.navy.standard,
    borderColor: colors.navy.standard,
    color: '#fff',
  },
  locationRow: { flexDirection: 'row', gap: spacing.md },
  flex1: { flex: 1 },
  stateField: { width: 100 },
  footer: {
    padding: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.surface.border,
    gap: spacing.sm,
  },
});
