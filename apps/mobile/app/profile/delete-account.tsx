import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { ProfileScreenHeader } from '../../src/components/ProfileScreenHeader';
import { TextField } from '../../src/components/TextField';
import { useAuth } from '../../src/context/AuthContext';
import { useDeleteAccount } from '../../src/hooks/useProfile';
import { ApiError, BASE_URL } from '../../src/lib/api';
import { getAccessToken } from '../../src/lib/tokens';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

const CONFIRM_WORD = 'PERMANENT';

export default function DeleteAccount() {
  const router = useRouter();
  const { signOut } = useAuth();
  const del = useDeleteAccount();
  const [confirmation, setConfirmation] = useState('');
  const [exporting, setExporting] = useState(false);

  const canConfirm = confirmation.trim().toUpperCase() === CONFIRM_WORD;

  const onExport = async () => {
    // Lazy-load the native modules so the screen still renders in Expo Go /
    // on a dev-client that was built before these modules were installed.
    // If either require throws, we fall back to a plain fetch + alert.
    let FileSystem: typeof import('expo-file-system') | null = null;
    let Sharing: typeof import('expo-sharing') | null = null;
    try {
      FileSystem = require('expo-file-system');
    } catch { /* dev-client lacks expo-file-system; rebuild to enable */ }
    try {
      Sharing = require('expo-sharing');
    } catch { /* dev-client lacks expo-sharing; rebuild to enable */ }

    setExporting(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not authenticated');

      if (!FileSystem) {
        // Fallback: fire the request so the server creates an audit log,
        // then tell the user we can't save the file without a rebuild.
        await fetch(`${BASE_URL}/patients/me/export`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        Alert.alert(
          'Rebuild required',
          'Downloading the export file needs a dev-client rebuild. Run `npm run prebuild && npm run ios` (or android), then try again.',
        );
        return;
      }

      const filename = `tmjconnect-export-${new Date().toISOString().slice(0, 10)}.json`;
      const target = `${FileSystem.cacheDirectory}${filename}`;

      const result = await FileSystem.downloadAsync(
        `${BASE_URL}/patients/me/export`,
        target,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (result.status !== 200) {
        throw new ApiError(result.status, 'Export failed');
      }

      if (Sharing && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(result.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Save your TMJConnect data',
          UTI: 'public.json',
        });
      } else {
        Alert.alert('Export saved', `Saved to device cache at ${filename}.`);
      }
    } catch (err) {
      Alert.alert(
        'Could not export',
        err instanceof ApiError ? err.message : 'Check your connection and try again.',
      );
    } finally {
      setExporting(false);
    }
  };

  const onDelete = () => {
    if (!canConfirm) return;
    Alert.alert(
      'Delete your account?',
      'This will permanently remove your symptom logs, reports, and profile after a 30-day grace period.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              await del.mutateAsync();
              await signOut();
              router.replace('/(auth)/sign-in');
            } catch (err) {
              Alert.alert(
                'Could not delete',
                err instanceof ApiError ? err.message : 'Check your connection and try again.',
              );
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileScreenHeader title="Delete Account" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.banner}>
          <Ionicons name="warning" size={18} color={colors.danger.strong} />
          <Text style={styles.bannerText}>This action is permanent.</Text>
        </View>

        <Text style={styles.body}>
          Deleting your account removes your symptom logs, reports, and personal information after a
          30-day grace period. Your providers will be notified, and any shared data will be revoked.
        </Text>

        <Text style={styles.sectionLabel}>Export your data first</Text>
        <Pressable onPress={onExport} style={styles.exportRow} disabled={exporting}>
          <Ionicons name="download-outline" size={18} color={colors.navy.standard} />
          <Text style={styles.exportText}>
            {exporting ? 'Requesting…' : 'Download Selected Data'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.ink.tertiary} />
        </Pressable>

        <Text style={styles.sectionLabel}>Type {CONFIRM_WORD} to confirm</Text>
        <TextField
          value={confirmation}
          onChangeText={setConfirmation}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder={CONFIRM_WORD}
        />
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Delete Account"
          variant="danger"
          onPress={onDelete}
          disabled={!canConfirm}
          loading={del.isPending}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.danger.soft,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  bannerText: { ...typography.bodyStrong, color: colors.danger.strong },
  body: { ...typography.body, color: colors.ink.secondary, marginBottom: spacing.xl },
  sectionLabel: { ...typography.label, color: colors.ink.primary, marginBottom: spacing.sm, marginTop: spacing.md },
  exportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.surface.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface.card,
    marginBottom: spacing.md,
  },
  exportText: { ...typography.bodyStrong, color: colors.navy.standard, flex: 1 },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.surface.border,
    backgroundColor: colors.surface.background,
  },
});
