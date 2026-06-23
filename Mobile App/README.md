# Property Submitter — iOS (React Native + Expo)

Mobile app for the Deal Pipeline platform. Submitters can register, log in, manage their property listings, save drafts, upload photos, and track approval status — all from iOS (and Android, since RN is cross-platform).

> **You're on Windows.** You can develop, edit, and run on the Expo Go / dev client just fine. **Compiling and signing the native iOS app requires macOS or EAS Build (cloud).** Both are covered below.

---

## 1. Project layout

```
mobile/
├── app/                       # expo-router file-based routes
│   ├── _layout.tsx            # Root layout, auth gate, providers
│   ├── index.tsx
│   ├── (auth)/                # Login / Register / Forgot / Reset
│   ├── (tabs)/                # Properties / Drafts / Profile
│   ├── profile/               # Profile sub-screens
│   └── properties/            # New / Edit / Detail
├── src/
│   ├── api/                   # axios client + per-resource modules
│   ├── components/            # Button / Input / Screen / PropertyForm
│   ├── config/env.ts          # Reads expoConfig.extra
│   ├── context/AuthContext.tsx
│   ├── storage/secure.ts      # SecureStore (iOS Keychain)
│   ├── theme/                 # Colors / spacing / typography
│   ├── types/                 # Shared TS types
│   └── utils/validation.ts    # zod schemas (login, register, property…)
├── app.config.ts              # Env-aware Expo config (dev/staging/prod)
├── eas.json                   # EAS build & submit profiles
├── babel.config.js
├── tsconfig.json
└── package.json
```

---

## 2. First-time setup (Windows OK)

Prerequisites:

- **Node.js 20+** (`node -v`)
- **Git**
- **Xcode 15+** *(only required if you intend to build locally on a Mac)*
- An **Apple Developer account** ($99/yr) — needed to ship to TestFlight / App Store

Install:

```powershell
cd H:\wamp64\www\deal-pipeline\mobile
npm install
npm install -g eas-cli   # for cloud builds
```

Copy environment defaults and fill in the API URLs:

```powershell
copy .env.example .env
notepad .env
```

> **Tip — running the backend locally for device testing:**
> An iPhone on your LAN cannot reach `localhost:3000` on your PC. Find your machine's LAN IP (`ipconfig` → IPv4 Address, e.g. `192.168.1.10`) and put it in `API_URL_DEV=http://192.168.1.10:3000`. Make sure Windows Firewall allows incoming connections to port 3000.
>
> Also add that origin to the backend's CORS allow-list in `backend/src/index.js` (currently only `localhost:5173`).

---

## 3. Running the app (development)

You have two options for the dev environment:

### Option A — Expo Go (fastest, no native build)

```powershell
npm run start:dev
```

Scan the QR code with the **Expo Go** app from the App Store. Limitation: Apple Sign-In and any custom native module won't work in Expo Go — you need Option B for those.

### Option B — Custom dev client (required for Apple Sign-In)

You need to compile the native client once. From a **Mac**:

```bash
npm run ios
```

…or build it in the cloud (works from Windows):

```powershell
eas login
eas init                    # one-time, populates EAS_PROJECT_ID
npm run build:ios:dev       # produces .ipa for simulator + device
```

Install the resulting build on your device, then run:

```powershell
npm run start:dev
```

The dev client connects to the Metro bundler on your PC.

---

## 4. Environments — dev / staging / production

`app.config.ts` reads `APP_ENV` and produces a different `name`, `bundleIdentifier`, and API URL per environment. Three separate apps install side-by-side on the same device.

| Env          | Bundle ID                                      | API URL source         |
|--------------|------------------------------------------------|------------------------|
| development  | `com.dealpipeline.propertysubmitter.dev`       | `API_URL_DEV` in `.env` |
| staging      | `com.dealpipeline.propertysubmitter.staging`   | `API_URL_STAGING`       |
| production   | `com.dealpipeline.propertysubmitter`           | `API_URL_PROD`          |

Build commands:

```powershell
npm run build:ios:dev       # internal distribution + simulator build
npm run build:ios:staging   # internal distribution
npm run build:ios:prod      # App Store submission build
npm run submit:ios          # uploads the prod build to App Store Connect
```

EAS handles signing automatically. The first time you run a production build it will create or fetch an iOS distribution certificate and provisioning profile from your Apple Developer account.

---

## 5. Backend integration

The mobile client talks to the existing Node/Express + DynamoDB backend at `H:\wamp64\www\deal-pipeline\backend`. Endpoints used:

| Mobile feature              | Backend endpoint                              |
|-----------------------------|-----------------------------------------------|
| Login                       | `POST /api/submitters/login`                  |
| Logout                      | `POST /api/submitters/logout`                 |
| Current user                | `GET  /api/auth/me`                           |
| Register (request approval) | `POST /api/auth/register-request`             |
| Forgot password             | `POST /api/password/request-reset`            |
| Validate reset token        | `GET  /api/password/validate-token/:token`    |
| Reset password              | `POST /api/password/reset`                    |
| My profile                  | `GET  /api/profile/me`                        |
| Update profile              | `PUT  /api/profile/update`                    |
| Change password             | `POST /api/profile/change-password`           |
| List my submissions         | `GET  /api/deals/my-submissions`              |
| Get single property         | `GET  /api/deals/:id`                         |
| Create property             | `POST /api/deals`                             |
| Update property             | `PATCH /api/deals/:id`                        |
| Unsubmit (delete) property  | `POST /api/deals/:id/unsubmit`                |
| List my drafts              | `GET  /api/drafts/mine`                       |
| Create / update / delete draft | `POST/PUT/DELETE /api/drafts/:id`          |
| S3 presigned upload URL     | `POST /api/upload/presigned-url`              |
| Batch presigned URLs        | `POST /api/upload/batch-presigned-urls`       |

### Auth headers

Every authenticated request sends:

- `Authorization: Bearer <jwt>`
- `x-session-token: <sessionToken>` — for the backend's single-session enforcement (a login from another device invalidates the previous session).

If the backend returns `401 SESSION_INVALIDATED`, the API client clears local credentials and the AuthProvider routes the user back to the login screen.

### Tokens at rest

Both the JWT and session token live in **iOS Keychain** via `expo-secure-store`, scoped to `WHEN_UNLOCKED_THIS_DEVICE_ONLY` (no iCloud sync). The cached user profile is in the same store.

---

## 6. Apple Sign-In (todo on backend)

The login screen already triggers `expo-apple-authentication` on iOS and receives an `identityToken`. To complete the flow, add a backend endpoint:

```js
// backend/src/routes/authRoutes.js
router.post('/apple', async (req, res) => {
  const { identityToken, rawNonce } = req.body;
  // 1. Fetch Apple's JWKS from https://appleid.apple.com/auth/keys
  // 2. Verify identityToken signature, audience (your bundle id), expiry
  // 3. Look up or create the submitter by `sub` (Apple user id) or email claim
  // 4. Issue your normal { token, sessionToken, user } response
});
```

Library suggestion: [`apple-signin-auth`](https://www.npmjs.com/package/apple-signin-auth) handles step 1+2.

Then in `app/(auth)/login.tsx`, replace the `Alert` in `onApplePress` with a call to that endpoint and persist the response identically to a password login.

In Apple Developer portal: enable **Sign in with Apple** capability for each of the three bundle IDs (dev / staging / prod).

---

## 7. Firebase setup (push notifications, optional analytics)

Firebase is **not** required for the core flow — push notifications can also be done with Expo Push, which is simpler. If you want Firebase specifically:

1. **Create a Firebase project** at [console.firebase.google.com](https://console.firebase.google.com).
2. Add an iOS app **per environment** (3 total) using the bundle IDs above.
3. Download each `GoogleService-Info.plist` and place them in `mobile/firebase/`:
   - `GoogleService-Info.dev.plist`
   - `GoogleService-Info.staging.plist`
   - `GoogleService-Info.prod.plist`
4. Add the Expo Firebase plugins:
   ```powershell
   npx expo install @react-native-firebase/app @react-native-firebase/messaging
   ```
5. Wire the per-env plist into `app.config.ts`:
   ```ts
   ios: {
     // …
     googleServicesFile:
       APP_ENV === 'production' ? './firebase/GoogleService-Info.prod.plist' :
       APP_ENV === 'staging'    ? './firebase/GoogleService-Info.staging.plist' :
                                  './firebase/GoogleService-Info.dev.plist',
   },
   plugins: [
     // …
     '@react-native-firebase/app',
     '@react-native-firebase/messaging',
   ],
   ```
6. Rebuild the dev client (`npm run build:ios:dev`) — Firebase requires native code, so Expo Go will no longer work; you must use the dev client from now on.

> The `*.plist` and `google-services.json` files are already gitignored.

---

## 8. Git setup

This folder is part of the existing `deal-pipeline` repo. If you'd rather track it separately, from this directory:

```powershell
git init
git add .
git commit -m "Initial mobile app scaffold"
git branch -M main
git remote add origin <your-new-repo-url>
git push -u origin main
```

---

## 9. App signing & provisioning

EAS handles this end-to-end:

1. `eas login` — sign in with your Apple ID.
2. `eas credentials` — review certificates / provisioning profiles per profile.
3. First production build (`npm run build:ios:prod`) prompts for Apple Developer credentials and creates:
   - iOS Distribution Certificate (one per Apple team)
   - App Store provisioning profile (one per bundle ID)
4. EAS stores them server-side and reuses them on subsequent builds.

If you prefer manual signing, generate certificates at [developer.apple.com/account/resources](https://developer.apple.com/account/resources) and follow the EAS [local credentials docs](https://docs.expo.dev/app-signing/local-credentials/).

---

## 10. Common tasks

```powershell
npm run typecheck       # tsc --noEmit
npm run lint            # eslint
npm run start:dev       # Metro bundler, dev env
npm run start:staging   # Metro bundler, staging env
npm run build:ios:dev   # cloud build, internal distribution
```

Clear caches if Metro acts up:

```powershell
npx expo start --dev-client --clear
```

---

## 11. What's NOT yet implemented

These were intentionally left for follow-up since each is more than a one-shot scaffold:

- **Apple Sign-In backend handshake** — UI is ready, see §6.
- **Google Sign-In** (marked optional in the spec).
- **Firebase Cloud Messaging push wiring** — see §7. Expo Push is a simpler alternative.
- **In-app map preview** for property location — `expo-location` is wired and you have lat/lng on the type, but the map view is not built. Suggest `react-native-maps`.
- **Property image reordering** — current PropertyForm supports add + long-press to remove only.
- **Pagination on `my-submissions`** — backend currently returns the full list.

The scaffold is wired so you can drop these in without restructuring.
