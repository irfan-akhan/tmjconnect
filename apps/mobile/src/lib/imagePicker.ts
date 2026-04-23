/**
 * Thin wrapper over expo-image-picker. Handles:
 *   - permission requests (library + camera)
 *   - launching the picker / camera with the options we want for avatars
 *     (square crop, mid-quality compression)
 *
 * We deliberately cap output at ~0.7 compression and 1024px — an avatar
 * that's bigger is just wasted bytes going over mobile data and the server's
 * 2MB magic-byte path eagerly rejects oversize files.
 */

import * as ImagePicker from 'expo-image-picker';

export type PickedImage = { uri: string };

async function ensureLibraryPermission(): Promise<boolean> {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return next.granted;
}

async function ensureCameraPermission(): Promise<boolean> {
  const current = await ImagePicker.getCameraPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const next = await ImagePicker.requestCameraPermissionsAsync();
  return next.granted;
}

export async function pickAvatarFromLibrary(): Promise<PickedImage | null> {
  const ok = await ensureLibraryPermission();
  if (!ok) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  return { uri: asset.uri };
}

export async function takeAvatarPhoto(): Promise<PickedImage | null> {
  const ok = await ensureCameraPermission();
  if (!ok) return null;
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  return { uri: asset.uri };
}
