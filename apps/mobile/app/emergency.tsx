import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { colors, radius, spacing, typography } from '../src/theme/tokens';

export default function Emergency() {
  const router = useRouter();

  const call911 = () => {
    Alert.alert(
      'Call 911?',
      'This will place a call to emergency services. Only use this if you are experiencing a medical emergency.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call 911',
          style: 'destructive',
          onPress: () => {
            Linking.openURL('tel:911').catch(() => {});
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.banner}>
        <Ionicons name="warning" size={18} color="#fff" />
        <Text style={styles.bannerText}>Emergency Report</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="alert" size={44} color={colors.danger.strong} />
        </View>

        <Text style={styles.title}>Is this a medical emergency?</Text>
        <Text style={styles.body}>
          If you&rsquo;re experiencing chest pain, severe difficulty breathing, signs of stroke, or any
          life-threatening symptom, call 911 now. TMJConnect is not monitored for emergencies.
        </Text>

        <Button title="Call 911 Now" variant="danger" onPress={call911} style={styles.call} />

        <View style={styles.notice}>
          <Ionicons name="information-circle" size={18} color={colors.warning.strong} />
          <Text style={styles.noticeText}>
            For non-emergency urgent concerns, submit a report with &ldquo;Urgent&rdquo; severity and your
            provider will be notified immediately.
          </Text>
        </View>

        <Pressable
          onPress={() => {
            router.replace('/report-submit');
          }}
          style={styles.secondary}
          accessibilityRole="button"
        >
          <Ionicons name="document-text-outline" size={20} color={colors.navy.standard} />
          <Text style={styles.secondaryText}>Submit an urgent report instead</Text>
        </Pressable>

        <Pressable onPress={() => router.back()} style={styles.cancel} hitSlop={8}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.danger.base,
  },
  bannerText: { ...typography.bodyStrong, color: '#fff', letterSpacing: 0.5 },
  content: { padding: spacing.xl, alignItems: 'center' },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.danger.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xl,
  },
  title: { ...typography.h1, color: colors.ink.primary, textAlign: 'center', marginBottom: spacing.sm },
  body: { ...typography.body, color: colors.ink.secondary, textAlign: 'center', marginBottom: spacing.lg },
  call: { alignSelf: 'stretch', marginBottom: spacing.lg },
  notice: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.warning.soft,
    marginBottom: spacing.lg,
    alignSelf: 'stretch',
  },
  noticeText: { ...typography.caption, color: colors.warning.strong, flex: 1 },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.surface.border,
    alignSelf: 'stretch',
  },
  secondaryText: { ...typography.bodyStrong, color: colors.navy.standard },
  cancel: { marginTop: spacing.lg },
  cancelText: { ...typography.label, color: colors.ink.secondary },
});
