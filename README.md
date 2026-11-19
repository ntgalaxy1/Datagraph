> **Browser installer included:** Upload the incremental package, open `https://datagraphlist.ir/install.php`, and enter the cPanel DB credentials plus your existing site admin password. Tables, JSON migration, private config, pre-install backup and final self-delete/permanent lock are automatic. Create the MySQL database/user first using cPanel Wizard. See [INSTALLER_GUIDE_FA.md](INSTALLER_GUIDE_FA.md).

> **Spreadsheet Admin / MySQL update:** Start with [SPREADSHEET_ADMIN_GUIDE.md](SPREADSHEET_ADMIN_GUIDE.md). This release adds the spreadsheet editor, live price changes, Excel/CSV mapping and two-way Google Sheets connector with Sheet-first conflict resolution. Do not overwrite live data or the existing admin password hash during deployment.

# Datagraphlist | سامانه هوشمند فاکتور فروشگاه دیتاگراف

Web PC builder, laptop catalog, installment calculator, A5/A4 invoice image/PDF exports, protected content administration, private 30-day backups, and an online Android companion.

## Project layout

```text
src/                       React + TypeScript frontend
src/components/LockedFooter.tsx  Compiled, prop-free footer (not CMS driven)
public/sync-catalog.php     Authenticated production catalog/backup API
public/backup-lib.php       Private ZIP snapshot + 30-day retention
public/backup-cli.php       CLI-only daily cron entry point
public/data/catalog.json   Production JSON database seed
backend/main.py            Optional development/preview FastAPI backend
migrations/002_catalog.py  Idempotent JSON schema migration
ops/                       Initial admin setup and cron example
android/                   Native Android Java/WebView project
.github/workflows/         CI, signed releases, optional Pages demo
```

**Architecture (updated):** production uses PHP 8.2+ and the new MySQL inventory after the authenticated migration. JSON remains a seed/legacy mode until MySQL is configured. Backups include a consistent `database.sql` dump after migration, plus `data/`, uploads, assets and the private connector configuration. See `SPREADSHEET_ADMIN_GUIDE.md` for the no-Terminal installation. Android opens `https://datagraphlist.ir/`; it is not an offline database replica.

## 1. Web development

Requirements: Node.js 22, npm, Python 3 (standalone builder); PHP 8.2+ with ZIP for production/admin backups.

```bash
npm ci
npx tsc --noEmit
npm run dev
npm run build
python3 scripts/standalone.py
```

`dist/` is the deployable website. The single-file preview is written to `DataGraph-Smart-App.html` in the repository root (ignored by Git). Static previews/Pages do not run PHP backups, server password changes or shared writes. The historical demo password works only for file/localhost previews; it is **not a production credential**.

### Optional Python preview

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
npm run build
mkdir -p web_bundle && cp -r dist/. web_bundle/
# Export a strong DATAGRAPH_ADMIN_PASSWORD only when authenticated mutations are needed.
uvicorn backend.main:app --host 0.0.0.0 --port 3000
```

The Python server is a preview adapter, not a substitute for the PHP backup service. Mutation endpoints reject requests without a matching `X-Admin-Key`. Production deployment described below uses PHP.

## 2. Production installation: cPanel / DirectAdmin

1. Take an off-server backup of the existing website before deployment.
2. Upload the CONTENTS of `dist/` to `public_html`, including `.htaccess`. Keep HTTPS enabled and mod_rewrite active.
3. For an existing installation, **do not overwrite your live `data/catalog.json`, workbook, uploads or `.admin_secret.json` with repository seed data**. Update application files first; preserve live data. Deploy during a maintenance window.
4. Ensure PHP has ZIP enabled and write access to `data/`. PHP must have permission to create the private directory outside the document root.
5. Create `/home/CPANEL_USER/datagraph-private` with mode `0700`. Set `DATAGRAPH_PRIVATE_DIR` in the PHP-FPM environment if this is not the default sibling directory. It must not be inside `public_html`, exposed through an alias or symlink, or included in deployment archives.
6. If no admin hash exists, initialize a unique password from a shell (12+ characters). Do not put it in shell history:

```bash
read -rsp 'New admin password: ' DATAGRAPH_ADMIN_PASSWORD; echo
export DATAGRAPH_ADMIN_PASSWORD
php ops/setup-admin.php /home/CPANEL_USER/public_html
unset DATAGRAPH_ADMIN_PASSWORD
```

`ops/setup-admin.php` is an operator tool from the source archive, not a public browser endpoint. Run it from a private checkout. Existing hashed passwords are preserved unless this command is explicitly run. A missing production admin configuration fails closed (503), rather than enabling a known password. `.env.example` documents variables; PHP does **not** auto-load `.env`.

7. Run the migration from the private checkout:

```bash
python3 migrations/002_catalog.py /home/CPANEL_USER/public_html/data/catalog.json
```

It creates a pre-migration copy and is safe to rerun. Move the `.pre-v2.json` copy to private storage after verifying the result. Footer fields are discarded; `initial_price` is introduced without changing selling prices.

8. Check HTTPS, login/logout, catalog save/reload from another browser, image/PDF exports, contact intents, and backup creation/download before going live.

### Footer contract

The entire public website footer is compiled in `LockedFooter.tsx`: text, address, numbers, links and centered `Powered by Naser Tavakkoli · @nt.galaxy`. It accepts no CMS props. The CMS has no footer editor; server writes discard obsolete footer fields. Store settings may still control contacts inside invoices/header, **not the locked website footer**. Changing the locked footer requires a reviewed source change and rebuild. A server/repository owner can of course modify source files; no web application can make code physically immutable to its host administrator.

## 3. A5 default / A4 optional outputs

Immediately before print or image export, select **A5 (default)** or **A4**. The selection controls print `@page`, spacing, font sizes and PNG page dimensions:

- A5: 148 × 210 mm; 8 mm margins.
- A4: 210 × 297 mm; 12 mm margins.
- Both PC and laptop invoices contain a bottom-left `مهر و امضای فروشگاه` box.
- Tall content is scaled down to one sheet. Excessively large laptop lists may become too small to read; choose A4 or split the quote. No finite sheet can preserve legibility for unlimited rows.
- In browser print settings use scale 100%, disable browser header/footer, and do not override the selected paper size. Some printer drivers can override CSS.

## 4. Daily automated backups / 30-day rolling retention

Archives include `data/`, `uploads/` (if present), `assets/`, and a UTC/schema manifest. When MySQL is configured, they also contain `database.sql` and `private/inventory-config.json` (sensitive DB/sync credentials). Archives contain sensitive business information and possibly the password hash; they are stored mode `0600`, outside the web root, and are downloaded only after POST authentication. ZIP files are not encrypted at rest: enable disk encryption/private encrypted off-server replication when required.

Configure cPanel Cron Jobs (replace paths; server timezone applies):

```cron
15 2 * * * DATAGRAPH_PRIVATE_DIR=/home/CPANEL_USER/datagraph-private /usr/local/bin/php /home/CPANEL_USER/public_html/backup-cli.php >> /home/CPANEL_USER/datagraph-private/backup-cron.log 2>&1
```

Manual operator test:

```bash
DATAGRAPH_PRIVATE_DIR=/home/CPANEL_USER/datagraph-private php /home/CPANEL_USER/public_html/backup-cli.php
```

Admin UI: **ورود مدیر → پشتیبان‌گیری → پشتیبان‌گیری اکنون**. List/download controls show retained archives. Pruning removes archives with modification times older than 30 × 24 hours during scheduled creation/list operations; 29-day files remain. An exclusive backup lock prevents concurrent jobs; catalog saves publish atomically. Monitor disk space, cron exit status and logs. **Creating a cron example does not install or activate cron on your host.**

### Restore drill (operator only)

1. Put site into maintenance mode, download a known-good private ZIP and verify its source.
2. Test archive integrity: `unzip -t backup-....zip`.
3. Extract into a private staging folder, never directly over production or using an untrusted uploaded archive.
4. Inspect `manifest.json`, validate `data/catalog.json`, and preserve a copy of the current live data.
5. Restore `data/`, `uploads/`, `assets/` with owner-only secret permissions; restore password hashes intentionally. Do not expose hidden files.
6. Run the migration if necessary; test login and catalog before ending maintenance. There is deliberately no unaudited browser ZIP-restore endpoint.

Tests:

```bash
php tests/backup_test.php
python3 tests/test_migration.py
```

## 5. Android: online companion

| Field | Value |
|---|---|
| applicationId / namespace | `ir.datagraphlist.app` |
| Persian launcher name (fa locale) | سامانه هوشمند فاکتور فروشگاه دیتاگراف |
| English/default launcher name | Datagraphlist |
| versionName / versionCode | `1.0.0` / `1` |
| compileSdk / targetSdk / minSdk | 36 / 36 / 26 |
| Website | `https://datagraphlist.ir/` |

App names follow device locale; Android does not provide separate launcher and settings labels per store. Use the Persian title in Bazaar's listing and English title in Google Play's listing. Future uploads must increment versionCode.

Only INTERNET is requested. Dialing uses ACTION_DIAL (no CALL_PHONE permission), WhatsApp/Instagram open external HTTPS intents, and document picking/saving uses Android's system document UI (no broad storage permission). Cleartext/mixed content and file access are disabled. The native print/export bridge is restricted to the two exact HTTPS production origins and main frame using AndroidX WebKit. Android prints respect the A5/A4 selector; users can still override media in the OS print UI. Verify on physical Android devices before store submission.

### Build a debug APK

Install Android Studio/SDK with platform 36/build-tools 36.0.0 and JDK 17 or 21:

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
cd android
./gradlew :app:assembleDebug :app:lintRelease
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk` (debug ID suffix `.debug`, not for stores).

### Generate YOUR production signing key locally

Never send keystores/passwords in chat, commit them, or put them under public_html:

```bash
keytool -genkeypair -v -keystore "$HOME/datagraphlist-release.jks" \
  -alias datagraphlist -keyalg RSA -keysize 4096 -validity 10000
# Prompts request passwords and identity. Keep an encrypted offline copy.
```

For Google Play App Signing, use an upload key according to Play Console guidance. If Bazaar and Play must update one another, understand that their installed signing certificates must match; the Play upload key is not necessarily the installed app signing key.

Set environment variables using secure prompts, then:

```bash
export ANDROID_KEYSTORE_PATH="$HOME/datagraphlist-release.jks"
export ANDROID_KEY_ALIAS=datagraphlist
read -rsp 'Store password: ' ANDROID_STORE_PASSWORD; echo; export ANDROID_STORE_PASSWORD
read -rsp 'Key password: ' ANDROID_KEY_PASSWORD; echo; export ANDROID_KEY_PASSWORD
cd android
./gradlew :app:assembleRelease :app:bundleRelease
"$ANDROID_HOME/build-tools/36.0.0/apksigner" verify --verbose app/build/outputs/apk/release/app-release.apk
unset ANDROID_STORE_PASSWORD ANDROID_KEY_PASSWORD
```

Release APK: `app/build/outputs/apk/release/app-release.apk` (Bazaar).
Release AAB: `app/build/outputs/bundle/release/app-release.aab` (Play).
R8 shrinking/minification and resource shrinking are enabled. Missing signing secrets intentionally fail release builds. This repository never substitutes a debug/test key for your release identity.

### Verified deep links

Copy `public/.well-known/assetlinks.json.example` to `public/.well-known/assetlinks.json`, replace the certificate fingerprint with the **real installed app signing certificate SHA-256**, and deploy it at:
`https://datagraphlist.ir/.well-known/assetlinks.json` (and the www domain if supported).

Use `keytool -list -v -keystore ...` to inspect your certificate; for Play App Signing use the app-signing certificate in Play Console, NOT the upload certificate. `.well-known` has an explicit .htaccess exception; no placeholder verification file is deployed automatically.

### Store release checklist — acceptance is not guaranteed by a build

- Review current Play/Bazaar policies at upload time; target API 36 is configured.
- Publish a real privacy policy at a reachable HTTPS URL and complete Data Safety/content-rating/app-access forms based on actual server logging and collected data. No analytics/ads/payment SDK is bundled.
- Provide accurate screenshots, listing titles, support contact and reviewer access where necessary.
- Complete closed testing/developer verification when required by your Play account; verify website ownership and adequate app utility for WebView minimum-functionality policies.
- Test offline failure handling, login, file upload, PNG saving, print/PDF, back gestures, verified links and all external intents on real devices.
- No Bazaar billing/update SDK is added because there are no in-app digital purchases or custom update flow. Add the current official SDK and permissions only if that functionality is introduced; do not claim payment compatibility without integration/testing.
- This is an online companion: it requires the deployed website and internet. An APK alone does not deploy backend changes.

## 6. GitHub setup from scratch

Create an empty GitHub repository (no autogenerated README) in your account. Extract the source archive, open a terminal in its root, and replace YOUR_USERNAME below. Authenticate with GitHub CLI/browser or a local credential manager; **never embed tokens in remote URLs**.

```bash
git init
git branch -M main
git add .
git commit -m "Initial Datagraphlist web and Android platform"
git remote add origin https://github.com/YOUR_USERNAME/datagraphlist.git
git push -u origin main
```

For an existing clone, skip init/first commit and use `git remote set-url origin ...` if an origin already exists. Add GitHub Actions secrets in **Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| ANDROID_KEYSTORE_BASE64 | base64 of YOUR keystore (Linux: `base64 -w0 "$HOME/datagraphlist-release.jks"`) |
| ANDROID_STORE_PASSWORD | keystore password |
| ANDROID_KEY_ALIAS | signing key alias |
| ANDROID_KEY_PASSWORD | private key password |

Do not print secret values into Actions logs. Fork pull requests run the debug/lint job only, never release signing.

On every push and pull request: TypeScript check, production web build, PHP syntax/backup/migration tests, and Android debug/lint. Signed APK/AAB builds run only on `v*` tags or a manual workflow run with `signed_release` enabled; they require all signing secrets and fail clearly if any are missing. Ordinary source uploads do not require Android signing credentials. Artifacts appear under the workflow run's Artifacts section. Workflows build/package; they do **not** automatically upload to cPanel, Play or Bazaar.

Create an actual release after configuring secrets:

```bash
git add .
git commit -m "Prepare release 1.0.0"  # only if changes exist
git tag -a v1.0.0 -m "Datagraphlist 1.0.0"
git push origin main
git push origin v1.0.0
```

If that tag already exists, do not force-overwrite published releases: choose a new version/tag and increment the Android versionCode/versionName where appropriate. Successful tag builds publish web ZIP/standalone HTML and signed APK/AAB to GitHub Releases. Pages deployment is an optional **manual** static demo workflow, not a PHP production deployment.

## Source import and Gemini assistant

The complete source was imported from `DataGraph-Gemini-Full-Source.zip` on 2026-11-19. See [IMPORT_NOTES.md](IMPORT_NOTES.md) for the archive checksum, included components, and the small repository-readiness adjustments. The AI-assisted invoice feature and its private API-key setup are documented in [GEMINI_GUIDE_FA.md](GEMINI_GUIDE_FA.md).

## Security / operational boundaries

- Use HTTPS, strong unique credentials and restricted hosting access. API secrets never belong in frontend bundles.
- PHP admin actions require the password over HTTPS, have file-backed attempt throttling, and hidden files are denied by Apache. Keep `.htaccess` protections enabled; Nginx requires equivalent deny rules.
- A server-side catalog save failure is reported, not falsely shown as a successful shared save.
- Backups contain sensitive data: protect local downloads and use separate off-server copies. Thirty-day rotation is not disaster recovery by itself.
- The app is not claimed to be penetration-tested or store-approved. Signing keys, cron installation, domain assetlinks, privacy policy and store submissions are operator responsibilities.

**Powered by Naser Tavakkoli · @nt.galaxy**
