# Focus For You Android push

Cloudflare Worker + private Workers KV + Firebase Cloud Messaging HTTP v1.
Firestore is read with the caller's Firebase ID token, so its rules remain in
force. The service account signs OAuth requests for FCM only; it needs no
Firestore, Auth-admin, Editor, or Owner role.

## One-time deployment

1. Keep Cloudflare **Workers Free** and Firebase **Spark**. Enable the Firebase
   Cloud Messaging API for `focus-for-you-dd88b`.
2. In Google Cloud IAM, create a dedicated service account in that project.
   Give it only **Firebase Cloud Messaging API Admin**
   (`roles/firebasecloudmessaging.admin`). Create its JSON key, keep it private,
   and never place it in this repository or send it to the browser/APK.
3. From this folder, authenticate Wrangler to the Cloudflare account. Create
   a KV namespace: `npx wrangler kv namespace create PUSH_KV`. Put its returned
   namespace ID into `wrangler.toml`, replacing the placeholder. KV must have
   no public API or public browser binding.
4. Store the project's Firebase web API key with
   `npx wrangler secret put FIREBASE_API_KEY`. Store the **entire dedicated
   service-account JSON** with `npx wrangler secret put FCM_SERVICE_ACCOUNT_JSON`.
   These commands prompt for the values; do not paste secrets into source files
   or command arguments. Worker variables are `FIREBASE_PROJECT_ID` and
   `SITE_ORIGIN`; the required KV binding is `PUSH_KV`.
5. Deploy: `npx wrangler deploy`. Configure the resulting HTTPS Worker origin
   in the app's push client. No paid plan or datastore-admin credential is needed.

Firestore rules must allow a verified active room member to read the authoritative
nudge, room, both memberships, and sender public profile. A nudge author's read
must stay gated by the target's current non-banned/non-deleting state as well as
the sender's valid membership. The Worker also reads the caller's own
`deletions/{uid}` and `appBans/{uid}`, plus the sender's own room ban/kick
records. The nudge gate and sender membership/sanctions are checked again after
OAuth acquisition, immediately before FCM delivery. A permission/connection error aborts delivery.

## API

POST JSON with `Authorization: Bearer <Firebase ID token>`. Never send Google
OAuth tokens or caller-selected notification text. Browser CORS accepts only
`https://focusforyou.github.io`; native calls without an Origin still require auth.

- `/register`: `{ "deviceId": "stable-device-id", "token": "FCM-registration-token" }`.
  Verified, non-banned, non-deleting accounts; at most six registered devices per
  UID. Reusing a physical token changes its account ownership. Register on token
  rotation and sign-in, rather than on every timer tick.
- `/unregister`: `{ "deviceId": "stable-device-id" }`. Call before logout or
  account switching. Requires a valid account token, including banned accounts.
- `/send`: `{ "roomId": "YKS", "targetUid": "recipient-firebase-uid" }`, only
  **after** the sender's Firestore nudge write has completed. The Worker derives
  the sender, username, event ID and notification content from server documents.
  Events older than 30 seconds are rejected. Success does not guarantee delivery
  by Android/FCM, and does not reveal recipients' tokens or device counts.
- `/delete-account`: `{}`. Run after creating the Firestore deletion lock and
  before deleting Firebase Auth. It removes private device/token registrations
  and leaves a UID-only anti-registration tombstone. Banned/deleting/unverified
  users may use this endpoint with a still-valid Firebase token. **On any HTTP or
  network error, retain Auth and retry deletion; do not report completion.**

FCM sends `@username seni dürttü!`, with `roomId`, `senderUsername`, `nudgeId`
data and Android channel `focus_nudges`. The Android app must create that channel,
request notification permission where required, and suppress an event already
seen in-app by its `nudgeId`. FCM background notifications work when Android can
deliver them; manually force-stopping the app can prevent delivery until reopened.

## Limits and retention

KV registrations and ownership hashes are private. API responses never return
tokens. Registrations persist until logout/unregister/account deletion; event
deduplication keys expire after 120 seconds. UID-only deletion tombstones persist
to block a concurrent old registration. Do not log request bodies or auth headers.

Workers KV is **eventually consistent**, not an atomic global lock. Concurrent
registrations can overwrite each other (every stored list remains bounded to six).
Logout, token ownership changes and deletion may propagate between locations
with delay. Authoritative Firestore security checks remain necessary. Local
in-flight deduplication, 120-second KV receipts and deterministic Android tags
reduce duplicate delivery, but do not promise globally exactly-once notifications.
A partial FCM/network failure can retry the same event and overwrite its Android
notification tag. The 30-second server event window bounds replay.

Free quotas are finite: KV currently includes 100,000 reads and 1,000 writes per
day; Worker Free includes 100,000 requests per day. Reaching a free limit may stop
notifications. Remain on the free plans; this implementation does not upgrade
plans or create billing accounts.

Official references: [FCM auth and permissions](https://firebase.google.com/docs/cloud-messaging/send/v1-api),
[Firebase Auth REST](https://firebase.google.com/docs/reference/rest/auth),
[KV limits](https://developers.cloudflare.com/kv/platform/limits/),
[KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/).

Run focused tests from the parent repository:
`node --test tests/push-worker.test.cjs`.
