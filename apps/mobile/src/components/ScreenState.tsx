import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../theme/tokens';

export function LoadingState({ message }: { message?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.navy.standard} size="large" />
      {message ? <Text style={styles.loadingText}>{message}</Text> : null}
    </View>
  );
}

export function EmptyState({
  icon = 'folder-open-outline',
  title,
  message,
  action,
  onAction,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.center}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={32} color={colors.ink.tertiary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {action && onAction ? (
        <Pressable onPress={onAction} style={styles.actionBtn}>
          <Text style={styles.actionText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ErrorState({
  message = 'Something went wrong.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.center}>
      <View style={[styles.iconCircle, styles.errorCircle]}>
        <Ionicons name="warning-outline" size={32} color={colors.danger.base} />
      </View>
      <Text style={styles.title}>Oops</Text>
      <Text style={styles.message}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} style={styles.retryBtn}>
          <Ionicons name="refresh" size={16} color="#fff" />
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  errorCircle: {
    backgroundColor: colors.danger.soft,
  },
  title: { ...typography.h3, color: colors.ink.primary, textAlign: 'center' },
  message: { ...typography.body, color: colors.ink.secondary, textAlign: 'center', maxWidth: 280 },
  loadingText: { ...typography.caption, color: colors.ink.secondary, marginTop: spacing.sm },
  actionBtn: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.navy.standard,
  },
  actionText: { ...typography.label, color: colors.navy.standard, fontWeight: '600' },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.navy.standard,
  },
  retryText: { ...typography.label, color: '#fff', fontWeight: '600' },
});
