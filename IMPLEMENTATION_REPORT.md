# Implementation and verification report

## Implemented

- A5 default / A4 selector, dynamic @page rules, proportional high-resolution PNG exports and bottom-left stamp boxes in PC and laptop invoices.
- Prop-free, compiled website footer; no editable footer fields; server strips obsolete footer override properties.
- JSON schema migration, strong production admin bootstrap, authenticated mutation endpoints, private ZIP backups with 30-day retention, authenticated POST downloads, manual admin controls and CLI cron entry point.
- Origin-restricted native Android WebView companion, localized names, ir.datagraphlist.app, versionName 1.0.0 / versionCode 1, SDK 36, adaptive actual-logo icon, splash screen, R8 and signing-ready Gradle configuration.
- GitHub Actions for web packaging, PHP/migration tests, Android debug/lint, signed APK/AAB builds and tag-triggered GitHub Releases.
- Updated Vite to 6.4.6 and SheetJS to official 0.20.3 package; npm audit reported zero known advisories at verification time (not a penetration-test guarantee).

## Checks actually executed in this environment

- TypeScript `tsc --noEmit`: PASS.
- Production Vite build and standalone generation: PASS.
- PHP syntax checks: PASS.
- Backup function test: ZIP contains JSON database, uploads and manifest; 31-day archives deleted / 29-day archives retained: PASS.
- PHP HTTP integration: wrong credentials denied (403), authenticated create/list/download succeeded, ZIP valid, path traversal denied (400), footer injection stripped: PASS.
- Optional Python API: anonymous catalog mutation denied (403); hidden credential path returned 404.
- JSON migration: correct and idempotent: PASS.
- Browser: A5 is default, A4 selection works, both PDF outputs are one page, stamp present in PC and laptop outputs.
- PNG: A5 1397×1985 and A4 1985×2807 pixels (2.5× rendering).
- Mobile browser smoke test (360px): laptop/calculator/admin have no document-level horizontal overflow.
- Android `assembleDebug` + `lintRelease`: BUILD SUCCESSFUL. Lint warnings remain (e.g. JavaScript is deliberately enabled for the trusted React website); no lint errors.
- Android release R8/package/bundle compilation: BUILD SUCCESSFUL using `-x verifyReleaseSigning` solely to validate compilation. Those local validation release artifacts are UNSIGNED and are NOT supplied as signed production releases.
- Debug APK signature validated with apksigner. Debug APK is test-only and uses a .debug package suffix.

## Not performed / operator steps

- No production-domain deployment, cPanel cron installation or actual scheduled backup run was performed.
- No real signing key was provided; no owner-signed release APK/AAB is claimed. GitHub Secrets must be configured first.
- No GitHub remote push, hosted Actions run, Play/Bazaar submission or store approval has occurred.
- No physical Android device/emulator acceptance testing has been performed. Native print/file picker/external intents need a device test.
- Verified App Links require deployment of real certificate fingerprints; the repository contains only an example, not fake verification.
- Superseded by the spreadsheet release: MySQL migration is now implemented; JSON remains seed/legacy mode. SQL backups are included after activation.
- Privacy policy, Data Safety, app-access instructions and store listing assets are operator deliverables before publication.
- Footer immutability is a CMS/runtime boundary, not protection against someone with source/hosting administrator access.


## Spreadsheet / MySQL release — additional verification

- Authenticated browser migration of the real sample catalog: 1380 parts + 56 laptops = 1436 rows, no lost rows.
- Real MariaDB 11.8 integration: upsert/dedup, previous/initial price preservation, partial import preservation, optimistic 409 conflicts, Sheet-first conflict behavior and an actual SQL backup/restore round-trip passed.
- Browser with PHP + MySQL: login, DB configuration, partial live search, quick Enter price save, row specification/stock edits, XLSX export/readback, CSV column mapping/import, embedded Apps Script modal and 390px document-overflow test passed.
- HTTP checks: invalid admin/token denied (403), stale row rejected (409), negative stock rejected (422), saved sync secret absent from settings response.
- Apps Script mock runtime tests: token auth, headers, initial push/read, stale fingerprint conflict and 500-row batched write passed. This is NOT live Google account testing.
- Public catalog reads now prefer MySQL and bypass stale browser snapshots. Public-catalog responses use a consistent database transaction.
- Direct site edits attempt immediate background Sheets reconciliation when configured. cPanel cron and installed Google triggers provide retries. No distributed atomic transaction or guaranteed subsecond synchronization is claimed.
- Existing cPanel data/admin hash are deliberately excluded from the incremental deployment ZIP. Domain deployment, real MySQL configuration, real Google authorization/deployment and cron installation have NOT been performed.
- See SPREADSHEET_ADMIN_GUIDE.md for installation without Terminal and important import/conflict/delete limitations.


## Browser installer addition

- install.php provides server-rendered Persian browser form with responsive layout, prerequisites, CSRF session protection, HTTPS requirement and existing-admin ownership authentication/rate limiting.
- Shared installer service is used by both browser installer and admin DB setup; private config and completion lock are written outside the document root.
- Database advisory/file locks serialize installation. A private journal supports safe resume after DB commit/config-publish interruption without reseeding. Pre-existing unrelated/committed databases are not overwritten.
- Real MySQL integration test passed: full sample catalog migration, automatic pre-backup, 0600 private config, permanent reinstallation lock, resume preserving a post-migration product edit.
- HTTP test passed: missing CSRF rejected, wrong admin rejected, DB error did not echo the password, installation succeeded, installer file deleted, re-uploaded installer remained locked.
- Self-deletion is best effort; existing config/completion marker enforce the lock even when filesystem deletion is unavailable.
- No production installation was performed. Existing site admin credentials and JSON are preserved; cPanel database/user creation is still an operator step.
