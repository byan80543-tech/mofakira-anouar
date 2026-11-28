# توقيع مفكرة أنوار — TWA

## هوية الإصدار

- مصدر التطبيق الوحيد: https://mofakira-anouar.pages.dev/mofakira-anouar/
- Android package ID: `com.anwar.mofakira.twa`
- Key alias: `anwar-twa`
- Minimum Android API: 24
- Keystore filename used in CI: `twa-release.keystore`
- SHA-256 certificate fingerprint: `DA:39:FD:DF:01:92:50:07:C0:25:89:A8:13:CE:38:59:89:10:FA:2F:D3:5F:C0:0C:07:A9:3D:18:74:F0:E8:8C`
- Certificate validity: 28 November 2026 through 15 April 2054

The private JKS keystore is not committed to this repository and must never be uploaded to GitHub as a file or artifact.

## Required GitHub Actions secrets

Add these two repository secrets under **Settings → Secrets and variables → Actions → New repository secret**:

1. `ANWAR_TWA_KEYSTORE_BASE64`: the single-line Base64 content of `Anwar-TWA-Release-Base64.txt`.
2. `ANWAR_TWA_KEYSTORE_PASSWORD`: the Store password from the private password note. The key password is intentionally the same value.

Do not add the keystore or the password note to the repository. Keep at least two offline backups in locations you control. Loss of the keystore prevents signing updates with the same Android package identity.

## Build the signed release

After adding the two secrets:

1. Open GitHub Actions for this repository.
2. Select **Build signed original-site TWA release**.
3. Select branch `twa-packaging` and run the workflow.
4. Download artifact `anwar-original-site-twa-signed-release`.

The workflow runs Bubblewrap's normal Android signing path, verifies the APK with Android `apksigner`, verifies the AAB signature, and checks that the APK certificate fingerprint matches the Digital Asset Links declaration. It never uploads the private keystore.

## Publish the website association

The file `.well-known/assetlinks.json` is prepared in this branch. The Pages deployment workflow copies `.well-known/*` to the deployment root, so after the reviewed changes are merged to `main`, the expected URL is:

`https://mofakira-anouar.pages.dev/.well-known/assetlinks.json`

Before declaring full-screen TWA verification complete, verify that this URL returns HTTP 200 directly (no redirect), with JSON content type, and that its fingerprint matches the certificate used to sign the installed APK.

## Current local signed outputs

A local fallback APK/AAB was signed and JAR signature-verified for continuity. The APK is signed with the JAR/v1 scheme only; it is not a substitute for the Bubblewrap release workflow above, which uses `apksigner` to produce modern APK signature schemes.
