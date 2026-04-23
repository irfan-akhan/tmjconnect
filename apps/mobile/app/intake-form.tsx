import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text,
  TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { ChipGroup } from '../src/components/ChipGroup';
import { useMyIntakeAssignments, useSubmitIntakeResponse } from '../src/hooks/useIntakeForms';
import { colors, radius, spacing, typography } from '../src/theme/tokens';
import type { FieldDef } from '../src/lib/intake.api';

export default function IntakeFormScreen() {
  const { formId } = useLocalSearchParams<{ formId: string }>();
  const router = useRouter();
  const assignments = useMyIntakeAssignments();
  const assignment = assignments.data?.find((a) => a.form_id === formId);
  const submit = useSubmitIntakeResponse(formId ?? '');

  const [answers, setAnswers] = useState<Record<string, unknown>>({});

  if (!formId || assignments.isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.navy.standard} style={{ marginTop: spacing.xxl }} />
      </SafeAreaView>
    );
  }

  if (!assignment) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={24} color={colors.ink.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Form Not Found</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyText}>This form is no longer available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const fields = (assignment.form_fields as FieldDef[]).sort((a, b) => a.order - b.order);

  function setAnswer(label: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [label]: value }));
  }

  async function onSubmit() {
    const missing = fields.filter((f) => f.required && (answers[f.label] === undefined || answers[f.label] === '' || (Array.isArray(answers[f.label]) && (answers[f.label] as unknown[]).length === 0)));
    if (missing.length > 0) {
      Alert.alert('Required fields', `Please fill in: ${missing.map((f) => f.label).join(', ')}`);
      return;
    }

    const formatted = fields.map((f) => ({
      field_label: f.label,
      field_type: f.type,
      value: answers[f.label] ?? null,
    }));

    await submit.mutateAsync(formatted);
    Alert.alert('Submitted', 'Your response has been recorded.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.ink.primary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{assignment.form_title}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {assignment.form_description ? (
          <View style={styles.descCard}>
            <Text style={styles.descText}>{assignment.form_description}</Text>
            <Text style={styles.providerLabel}>From {assignment.provider_name}</Text>
          </View>
        ) : null}

        {fields.map((field, i) => (
          <View key={i} style={styles.fieldCard}>
            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              {field.required && <Text style={styles.required}>Required</Text>}
            </View>
            <FieldRenderer field={field} value={answers[field.label]} onChange={(v) => setAnswer(field.label, v)} />
          </View>
        ))}

        <Button
          title={submit.isPending ? 'Submitting...' : 'Submit Response'}
          onPress={onSubmit}
          disabled={submit.isPending}
          style={styles.submitBtn}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function FieldRenderer({ field, value, onChange }: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (field.type) {
    case 'text':
      return (
        <TextInput
          style={styles.textInput}
          value={(value as string) ?? ''}
          onChangeText={onChange}
          placeholder={field.placeholder ?? 'Type your answer...'}
          placeholderTextColor={colors.ink.tertiary}
          multiline
        />
      );

    case 'number':
      return (
        <TextInput
          style={styles.textInput}
          value={value != null ? String(value) : ''}
          onChangeText={(t) => onChange(t ? Number(t) : undefined)}
          placeholder={field.placeholder ?? 'Enter a number'}
          placeholderTextColor={colors.ink.tertiary}
          keyboardType="numeric"
        />
      );

    case 'scale': {
      const min = field.min ?? 0;
      const max = field.max ?? 10;
      const levels = Array.from({ length: max - min + 1 }, (_, i) => min + i);
      return (
        <View style={styles.scaleRow}>
          {levels.map((n) => (
            <Pressable
              key={n}
              onPress={() => onChange(n)}
              style={[
                styles.scaleBtn,
                value === n && styles.scaleBtnActive,
              ]}
            >
              <Text style={[styles.scaleBtnText, value === n && styles.scaleBtnTextActive]}>
                {n}
              </Text>
            </Pressable>
          ))}
        </View>
      );
    }

    case 'select':
      return (
        <View style={styles.selectWrap}>
          {(field.options ?? []).map((opt) => (
            <Pressable
              key={opt}
              onPress={() => onChange(opt)}
              style={[styles.selectOption, value === opt && styles.selectOptionActive]}
            >
              <Text style={[styles.selectOptionText, value === opt && styles.selectOptionTextActive]}>
                {opt}
              </Text>
            </Pressable>
          ))}
        </View>
      );

    case 'checkbox':
      return (
        <ChipGroup
          options={field.options ?? []}
          selected={Array.isArray(value) ? (value as string[]) : []}
          onToggle={(v) => {
            const current = Array.isArray(value) ? (value as string[]) : [];
            onChange(current.includes(v) ? current.filter((x) => x !== v) : [...current, v]);
          }}
        />
      );

    default:
      return null;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
  },
  headerTitle: { ...typography.h2, color: colors.ink.primary, flex: 1, textAlign: 'center' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  emptyText: { ...typography.body, color: colors.ink.tertiary },

  descCard: {
    backgroundColor: colors.navy.ghost,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold.standard,
  },
  descText: { ...typography.body, color: colors.ink.secondary, lineHeight: 22 },
  providerLabel: { ...typography.caption, color: colors.ink.tertiary, marginTop: spacing.sm },

  fieldCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    padding: spacing.lg,
  },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  fieldLabel: { ...typography.bodyStrong, color: colors.ink.primary },
  required: { ...typography.tiny, color: colors.danger.base, fontWeight: '700', textTransform: 'uppercase' },

  textInput: {
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink.primary,
    backgroundColor: colors.surface.muted,
    minHeight: 48,
  },

  scaleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  scaleBtn: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1, borderColor: colors.surface.border,
    backgroundColor: colors.surface.muted,
    alignItems: 'center', justifyContent: 'center',
  },
  scaleBtnActive: {
    backgroundColor: colors.navy.standard,
    borderColor: colors.navy.standard,
  },
  scaleBtnText: { fontSize: 14, fontWeight: '700', color: colors.ink.secondary },
  scaleBtnTextActive: { color: '#fff' },

  selectWrap: { gap: 8 },
  selectOption: {
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surface.border,
    backgroundColor: colors.surface.muted,
  },
  selectOptionActive: {
    backgroundColor: colors.navy.ghost,
    borderColor: colors.navy.standard,
  },
  selectOptionText: { ...typography.body, color: colors.ink.primary },
  selectOptionTextActive: { color: colors.navy.deep, fontWeight: '600' },

  submitBtn: { marginTop: spacing.md },
});
