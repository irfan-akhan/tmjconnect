import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { ProfileScreenHeader } from '../../src/components/ProfileScreenHeader';
import { TextField } from '../../src/components/TextField';
import { useMe } from '../../src/hooks/usePatient';
import { useUpdateProfile } from '../../src/hooks/useProfile';
import { ApiError } from '../../src/lib/api';
import { uploadAvatar } from '../../src/lib/uploads.api';
import { colors, radius, spacing, typography } from '../../src/theme/tokens';
import { initials } from '../../src/utils/format';

export default function EditProfile() {
  const router = useRouter();
  const me = useMe();
  const update = useUpdateProfile();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (!me.data) return;
    setFirstName(me.data.first_name);
    setLastName(me.data.last_name);
    setDob(me.data.date_of_birth ?? '');
    setCity(me.data.city ?? '');
    setState(me.data.state ?? '');
  }, [me.data]);

  const onPickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Please allow photo access to change your profile picture.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    setUploadingAvatar(true);
    try {
      // Infer MIME + filename. expo-image-picker gives the local `uri` — that's
      // what React Native's FormData expects on the native side.
      const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const mime = asset.mimeType ?? (ext === 'png' ? 'image/png' : 'image/jpeg');
      const uploaded = await uploadAvatar({
        uri: asset.uri,
        name: `avatar.${ext}`,
        type: mime,
      });
      await update.mutateAsync({ avatar_url: uploaded.url });
    } catch (err) {
      Alert.alert(
        'Upload failed',
        err instanceof ApiError ? err.message : 'Could not upload. Try again.',
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const onSave = async () => {
    setError(null);
    try {
      await update.mutateAsync({
        first_name: firstName,
        last_name: lastName,
        date_of_birth: dob || null,
        city: city || null,
        state: state || null,
      });
      router.back();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save. Try again.');
    }
  };

  if (me.isPending) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ProfileScreenHeader title="Edit Profile" />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.navy.standard} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ProfileScreenHeader title="Edit Profile" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.avatarWrap}>
          {me.data?.avatar_url ? (
            <Image source={{ uri: me.data.avatar_url }} style={styles.avatar} accessibilityLabel="Profile picture" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>
                {me.data ? initials(me.data.first_name, me.data.last_name) : '··'}
              </Text>
            </View>
          )}
          <Pressable onPress={onPickAvatar} style={styles.cameraBadge} hitSlop={6} disabled={uploadingAvatar}>
            {uploadingAvatar ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="camera" size={16} color="#fff" />
            )}
          </Pressable>
        </View>

        <TextField label="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
        <TextField label="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
        <Pressable onPress={() => router.push('/profile/change-email')}>
          <TextField
            label="Email"
            value={me.data?.email ?? ''}
            editable={false}
            hint="Tap to change email (requires password + new-email verification)."
            pointerEvents="none"
            rightAction={{ label: 'Change', onPress: () => router.push('/profile/change-email') }}
          />
        </Pressable>
        <TextField
          label="Phone"
          value={me.data?.phone ?? ''}
          editable={false}
          hint="Phone is set at signup and can\u2019t be edited here."
        />
        <TextField label="Date of birth" value={dob} onChangeText={setDob} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
        <View style={styles.row}>
          <TextField label="City" value={city} onChangeText={setCity} containerStyle={styles.flex} />
          <TextField label="State" value={state} onChangeText={setState} containerStyle={styles.flex} />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Save Profile"
          onPress={onSave}
          loading={update.isPending}
          style={{ backgroundColor: colors.success.base }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarWrap: { alignSelf: 'center', marginBottom: spacing.xl, marginTop: spacing.md },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: { backgroundColor: colors.navy.standard, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  cameraBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.navy.standard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  error: { ...typography.caption, color: colors.danger.strong, marginTop: spacing.sm },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.surface.border,
    backgroundColor: colors.surface.background,
  },
});
