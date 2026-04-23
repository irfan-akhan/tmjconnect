import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReport } from '../../src/hooks/useReports';
import type { ReportUrgency } from '../../src/lib/reports.api';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

export default function ReportDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useReport(id);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={colors.ink.primary} />
        </Pressable>
        <Text style={styles.topTitle}>Report</Text>
        <View style={{ width: 24 }} />
      </View>

      {q.isPending ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.navy.standard} />
        </View>
      ) : q.data ? (
        <ScrollView contentContainerStyle={styles.content}>
          <UrgencyHeader urgency={q.data.report.urgency} submittedAt={q.data.report.submitted_at} status={q.data.report.status} />

          <View style={styles.card}>
            <Text style={styles.label}>Your message</Text>
            <Text style={styles.body}>{q.data.report.description}</Text>
            {q.data.report.pain_level != null ? (
              <View style={styles.painRow}>
                <Text style={styles.label}>Pain level</Text>
                <Text style={styles.painValue}>{q.data.report.pain_level}/10</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.sectionTitle}>Responses</Text>
          {q.data.responses.length === 0 ? (
            <View style={styles.emptyResp}>
              <Ionicons name="time-outline" size={20} color={colors.ink.tertiary} />
              <Text style={styles.emptyRespText}>
                Awaiting your provider&rsquo;s response.
              </Text>
            </View>
          ) : (
            q.data.responses.map((r) => (
              <View key={r.id} style={styles.responseCard}>
                <View style={styles.responseHeader}>
                  <Ionicons name="person-circle" size={20} color={colors.navy.standard} />
                  <Text style={styles.responseAuthor}>Your provider</Text>
                  <Text style={styles.responseDate}>
                    {new Date(r.responded_at).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.responseBody}>{r.message}</Text>
              </View>
            ))
          )}
        </ScrollView>
      ) : (
        <View style={styles.loading}>
          <Text style={styles.emptyRespText}>Could not load this report.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function UrgencyHeader({
  urgency,
  submittedAt,
  status,
}: {
  urgency: ReportUrgency;
  submittedAt: string;
  status: string;
}) {
  const tone = toneFor(urgency);
  return (
    <View style={[styles.header, { backgroundColor: tone.soft }]}>
      <View style={[styles.urgencyPill, { backgroundColor: tone.strong }]}>
        <Text style={styles.urgencyText}>{urgency}</Text>
      </View>
      <Text style={[styles.headerTitle, { color: tone.strong }]}>
        Submitted {new Date(submittedAt).toLocaleDateString()}
      </Text>
      <Text style={[styles.headerStatus, { color: tone.strong }]}>Status: {status}</Text>
    </View>
  );
}

function toneFor(u: ReportUrgency) {
  if (u === 'urgent') return { soft: colors.danger.soft, strong: colors.danger.strong };
  if (u === 'concerning') return { soft: colors.warning.soft, strong: colors.warning.strong };
  return { soft: colors.success.soft, strong: colors.success.strong };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface.border,
  },
  topTitle: { ...typography.bodyStrong, color: colors.ink.primary },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  header: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  urgencyPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  urgencyText: { ...typography.tiny, color: '#fff', fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  headerTitle: { ...typography.bodyStrong },
  headerStatus: { ...typography.caption, marginTop: 2 },
  card: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  label: { ...typography.caption, color: colors.ink.tertiary, marginBottom: spacing.xs },
  body: { ...typography.body, color: colors.ink.primary },
  painRow: { marginTop: spacing.md, flexDirection: 'row', justifyContent: 'space-between' },
  painValue: { ...typography.bodyStrong, color: colors.ink.primary },
  sectionTitle: { ...typography.h3, color: colors.ink.primary, marginBottom: spacing.sm },
  emptyResp: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.surface.muted, borderRadius: radius.md },
  emptyRespText: { ...typography.body, color: colors.ink.secondary },
  responseCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  responseHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  responseAuthor: { ...typography.label, color: colors.ink.primary, flex: 1 },
  responseDate: { ...typography.caption, color: colors.ink.tertiary },
  responseBody: { ...typography.body, color: colors.ink.primary },
});
