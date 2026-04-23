import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

let Video: any = null;
let ResizeMode: any = {};
try {
  const av = require('expo-av');
  Video = av.Video;
  ResizeMode = av.ResizeMode;
} catch {
  // expo-av not available (Expo Go) — fall back to static player
}
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { useAssignments } from '../../src/hooks/usePatient';
import { useCompleteAssignment } from '../../src/hooks/useExercises';
import { ApiError } from '../../src/lib/api';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';

export default function ExerciseDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const assignments = useAssignments();
  const complete = useCompleteAssignment();

  const item = assignments.data?.find((a) => a.assignment_id === id);

  const onMarkComplete = async () => {
    if (!id) return;
    try {
      const result = await complete.mutateAsync({
        assignmentId: id,
        duration_seconds: item?.duration_seconds,
      });
      Alert.alert(
        result.alreadyCompleted ? 'Already logged today' : 'Nice work!',
        result.alreadyCompleted
          ? 'You\u2019ve already marked this exercise complete today.'
          : 'This exercise is marked complete for today.',
        [{ text: 'Done', onPress: () => router.back() }],
      );
    } catch (err) {
      Alert.alert('Could not save', err instanceof ApiError ? err.message : 'Check your connection.');
    }
  };

  if (!item) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Exercise not found.</Text>
          <Button title="Go back" variant="secondary" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const mins = Math.max(1, Math.round(item.duration_seconds / 60));
  const steps = item.instructions.split(/\n|\d+\.\s/).map((s) => s.trim()).filter(Boolean);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {item.video_url && Video ? (
        <VideoPlayer
          uri={item.video_url}
          poster={item.thumbnail_url}
          title={item.title}
          meta={`${item.sets} × ${mins} min · ${item.category}`}
          onBack={() => router.back()}
        />
      ) : (
        <StaticPlayer
          thumbnail={item.thumbnail_url}
          title={item.title}
          meta={`${item.sets} × ${mins} min · ${item.category}`}
          onBack={() => router.back()}
        />
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>About this exercise</Text>
        <Text style={styles.body}>{item.description}</Text>

        <Text style={styles.sectionTitle}>Instructions</Text>
        {steps.map((s, i) => (
          <View key={i} style={styles.stepRow}>
            <View style={styles.stepDot}>
              <Text style={styles.stepDotText}>{i + 1}</Text>
            </View>
            <Text style={styles.stepText}>{s}</Text>
          </View>
        ))}

        <View style={styles.providerCard}>
          <Ionicons name="person-circle-outline" size={24} color={colors.navy.standard} />
          <Text style={styles.providerText}>
            Assigned by Dr. {item.provider_first_name} {item.provider_last_name}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Mark as Complete"
          variant="accent"
          onPress={onMarkComplete}
          loading={complete.isPending}
        />
      </View>
    </SafeAreaView>
  );
}

// ─── Video player ──────────────────────────────────────────────────────────

function VideoPlayer({
  uri,
  poster,
  title,
  meta,
  onBack,
}: {
  uri: string;
  poster: string | null;
  title: string;
  meta: string;
  onBack: () => void;
}) {
  const videoRef = useRef<any>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(true);

  const togglePlay = useCallback(async () => {
    if (!videoRef.current) return;
    if (playing) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
  }, [playing]);

  return (
    <View style={styles.player}>
      <Video
        ref={videoRef}
        source={{ uri }}
        posterSource={poster ? { uri: poster } : undefined}
        usePoster={!!poster}
        posterStyle={styles.posterImage}
        resizeMode={ResizeMode.COVER}
        shouldPlay={false}
        isLooping
        style={StyleSheet.absoluteFill}
        onPlaybackStatusUpdate={(status) => {
          if (status.isLoaded) {
            setPlaying(status.isPlaying);
            setLoading(false);
          }
        }}
        onLoadStart={() => setLoading(true)}
      />

      <Pressable style={styles.back} onPress={onBack} hitSlop={10}>
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </Pressable>

      <Pressable style={styles.playCircle} onPress={togglePlay} accessibilityRole="button">
        {loading ? (
          <ActivityIndicator color="#fff" size="large" />
        ) : (
          <Ionicons name={playing ? 'pause' : 'play'} size={40} color="#fff" />
        )}
      </Pressable>

      <View style={styles.playerFooter}>
        <Text style={styles.playerTitle}>{title}</Text>
        <Text style={styles.playerMeta}>{meta}</Text>
      </View>
    </View>
  );
}

// ─── Static fallback (no video_url) ───────────────────────────────────────

function StaticPlayer({
  thumbnail,
  title,
  meta,
  onBack,
}: {
  thumbnail: string | null;
  title: string;
  meta: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.player}>
      {thumbnail ? (
        <Image source={{ uri: thumbnail }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel="Exercise thumbnail" />
      ) : null}
      <View style={[StyleSheet.absoluteFill, styles.overlay]} />

      <Pressable style={styles.back} onPress={onBack} hitSlop={10}>
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </Pressable>
      <View style={styles.playCircle}>
        <Ionicons name="play" size={40} color="#fff" />
      </View>
      <View style={styles.playerFooter}>
        <Text style={styles.playerTitle}>{title}</Text>
        <Text style={styles.playerMeta}>{meta}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  player: {
    aspectRatio: 16 / 10,
    backgroundColor: colors.navy.deep,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: { backgroundColor: 'rgba(0,0,0,0.25)' },
  posterImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  back: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  playCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  playerFooter: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 2,
  },
  playerTitle: { ...typography.h3, color: '#fff' },
  playerMeta: { ...typography.caption, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xl },
  sectionTitle: { ...typography.h3, color: colors.ink.primary, marginTop: spacing.lg, marginBottom: spacing.sm },
  body: { ...typography.body, color: colors.ink.secondary },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.md },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.navy.ghost,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepDotText: { fontSize: 12, fontWeight: '700', color: colors.navy.deep },
  stepText: { ...typography.body, color: colors.ink.primary, flex: 1 },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface.muted,
    marginTop: spacing.lg,
  },
  providerText: { ...typography.caption, color: colors.ink.secondary, flex: 1 },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.surface.border,
    backgroundColor: colors.surface.background,
  },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
  notFoundText: { ...typography.body, color: colors.ink.secondary },
});
