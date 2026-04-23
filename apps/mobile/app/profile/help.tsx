import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileScreenHeader } from '../../src/components/ProfileScreenHeader';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

type Guide = { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string };

const GUIDES: Guide[] = [
  { icon: 'videocam-outline', title: 'Watching exercise videos', subtitle: 'How to play and complete assigned exercises' },
  { icon: 'pulse-outline', title: 'Logging your symptoms', subtitle: 'Pain level, types, triggers, and notes' },
  { icon: 'document-text-outline', title: 'Submitting reports', subtitle: 'When and how to send reports to your provider' },
  { icon: 'link-outline', title: 'Connecting with your provider', subtitle: 'Using invite codes' },
];

export default function HelpSupport() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileScreenHeader title="Help & Support" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable
          style={styles.tour}
          onPress={() => router.push('/onboarding/intro')}
          accessibilityRole="button"
        >
          <View style={styles.tourIcon}>
            <Ionicons name="play-circle" size={32} color={colors.gold.standard} />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.tourTitle}>Replay App Tour</Text>
            <Text style={styles.tourMeta}>See the onboarding slides again</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
        </Pressable>

        <Text style={styles.sectionTitle}>How-To Guides</Text>
        {GUIDES.map((g, i) => (
          <View key={i} style={styles.guideRow}>
            <View style={styles.guideNum}>
              <Ionicons name={g.icon} size={18} color={colors.navy.standard} />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.guideTitle}>{g.title}</Text>
              <Text style={styles.guideMeta}>{g.subtitle}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Contact</Text>
        <View style={styles.legalCard}>
          <Pressable
            style={styles.legalRow}
            onPress={() => Linking.openURL('mailto:support@tmjconnect.com')}
          >
            <Ionicons name="mail-outline" size={18} color={colors.navy.standard} />
            <Text style={styles.legalText}>Email Support</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.ink.tertiary} />
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Legal</Text>
        <View style={styles.legalCard}>
          <Pressable style={styles.legalRow} onPress={() => router.push('/updated-terms')}>
            <Ionicons name="document-outline" size={18} color={colors.navy.standard} />
            <Text style={styles.legalText}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.ink.tertiary} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.legalRow} onPress={() => router.push('/updated-terms')}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.navy.standard} />
            <Text style={styles.legalText}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.ink.tertiary} />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },
  tour: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.navy.deep,
    borderRadius: radius.lg,
    marginBottom: spacing.xl,
  },
  tourIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tourTitle: { ...typography.bodyStrong, color: '#fff' },
  tourMeta: { ...typography.caption, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  sectionTitle: {
    ...typography.caption,
    color: colors.ink.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface.border,
  },
  guideNum: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.navy.ghost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideTitle: { ...typography.bodyStrong, color: colors.ink.primary },
  guideMeta: { ...typography.caption, color: colors.ink.secondary, marginTop: 2 },
  flex1: { flex: 1 },
  legalCard: {
    backgroundColor: colors.surface.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.surface.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  legalText: { ...typography.bodyStrong, color: colors.ink.primary, flex: 1 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.surface.border },
});
