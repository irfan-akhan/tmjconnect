import { Ionicons } from '@expo/vector-icons';
import { onlineManager } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { queuedCount } from '../lib/offlineQueue';
import { colors, spacing, typography } from '../theme/tokens';

export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [queued, setQueued] = useState(0);

  useEffect(() => {
    setOnline(onlineManager.isOnline());
    return onlineManager.subscribe((isOnline) => {
      setOnline(isOnline);
      if (!isOnline) {
        try { setQueued(queuedCount()); } catch { /* db not ready */ }
      }
    });
  }, []);

  // Refresh count periodically while offline so new enqueues show up.
  useEffect(() => {
    if (online) return;
    const id = setInterval(() => {
      try { setQueued(queuedCount()); } catch { /* silent */ }
    }, 5000);
    return () => clearInterval(id);
  }, [online]);

  if (online) return null;

  return (
    <View style={styles.bar} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
      <Text style={styles.text}>
        Offline{queued > 0 ? ` — ${queued} change${queued === 1 ? '' : 's'} queued` : ' — changes will sync when you reconnect.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.ink.primary,
    paddingVertical: Platform.OS === 'ios' ? 6 : 8,
    paddingHorizontal: spacing.md,
  },
  text: { ...typography.tiny, color: '#fff' },
});
