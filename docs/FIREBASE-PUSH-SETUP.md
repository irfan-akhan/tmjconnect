# Firebase Push Setup

TMJConnect sends push notifications through Firebase Admin SDK on the API and Firebase Cloud Messaging tokens from the mobile app. Expo push tokens will not work with this server path.

## Firebase project

1. Create or open the Firebase project for TMJConnect.
2. Add the Android app with package name `com.tmjconnect.app`.
3. Add the iOS app with bundle ID `com.tmjconnect.app`.
4. Download the client config files:
   - Android: `google-services.json`
   - iOS: `GoogleService-Info.plist`
5. Place them locally in `apps/mobile/firebase/`:
   - `apps/mobile/firebase/google-services.json`
   - `apps/mobile/firebase/GoogleService-Info.plist`

Those files are intentionally gitignored. Do not paste their contents into chat or commit them.

## iOS APNs

For iOS delivery, Firebase must be able to send through APNs.

1. In Apple Developer, create or select an APNs Auth Key for the app team.
2. In Firebase Console, open Project Settings -> Cloud Messaging.
3. Upload the APNs Auth Key and set the key ID and team ID.
4. Make sure the iOS app bundle ID in Firebase matches `com.tmjconnect.app`.

## API server credentials

The API uses a Firebase service account through environment variables. In production, add these to `/etc/tmjconnect/api.env`:

```bash
FIREBASE_PROJECT_ID=tmjconnect-your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tmjconnect-your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Do not commit the service account JSON. The service account should have only the permission needed to send FCM messages, such as `cloudmessaging.messages.create`.

After updating the env file, restart the API process and confirm it starts without the Firebase stub-mode warning.

## Mobile builds

The mobile app now uses `@react-native-firebase/app` and `@react-native-firebase/messaging`, so push delivery requires a native build. Expo Go will not provide these native modules.

After placing the Firebase client config files, rebuild the dev client or production app:

```bash
npm run dev:client --workspace=apps/mobile
# or create a new EAS build for the target platform
```

The app registers an FCM token after sign-in, after notification permission is granted, and whenever the authenticated app returns to the foreground. The API rejects Expo push tokens so mismatched clients are visible in the notification outbox instead of being marked as sent.

## Smoke test

1. Install a fresh native build on a physical device.
2. Sign in and grant notification permission.
3. Confirm `PATCH /auth/fcm-token` stores a token that does not start with `ExponentPushToken` or `ExpoPushToken`.
4. Trigger a known push workflow, such as assigning an exercise or reviewing a report.
5. Check the admin notification outbox for `sent_at` on the push row or a retryable `last_error`.
