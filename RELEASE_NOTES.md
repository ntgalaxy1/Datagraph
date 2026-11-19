## Browser auto-installer included

`install.php` now handles prerequisites, existing-admin verification, MySQL table creation, JSON migration, automatic private config, pre-install backup, safe interrupted-install resume and final self-delete/permanent lock. See INSTALLER_GUIDE_FA.md. Database/user creation remains a cPanel Wizard step.

# Spreadsheet Inventory + MySQL + Google Sheets update

- New spreadsheet-style admin with category tabs, sticky headers, keyboard navigation, row save/draft indicators and global partial-model search.
- Immediate authenticated MySQL price replacement, initial/previous price fields, specs/stock, optimistic revisions and price audit records.
- Excel/CSV column auto-mapping with manual review, currency selection, preview and transactional ID/natural-key deduplication; XLSX export.
- No-Terminal cPanel database migration UI, private connector credentials and automatic pre-migration file backup.
- Token-authenticated Google Apps Script connector, immediate background site sync attempt, installable Sheet edit trigger and five-minute reconciliation/cron.
- Sheet-first conflict policy, fingerprint comparison, stale snapshot sequence checks, pending edit tracking and SQL-aware 30-day backups.
- Incremental deployment archive does not overwrite live data or the admin password hash.

Read SPREADSHEET_ADMIN_GUIDE.md. Live Google account authorization and cPanel installation are operator steps, not completed by generating this release.

---

# Datagraphlist Web + Android — release package

- Default A5 invoice print/PNG with A4 selector, single-sheet fitting and bottom-left store stamp area.
- Compiled locked footer: no CMS footer edits or runtime catalog override.
- PHP private daily/manual backup engine, authenticated downloads, 30-day retention and operator cron/setup scripts.
- Idempotent JSON database migration and backup retention tests.
- Production admin bootstrap now fails closed without a configured secret/hash. Existing configured hashes are preserved.
- Android online WebView companion: ir.datagraphlist.app, version 1.0.0 (1), target API 36, localized labels, adaptive brand icon, native printing/PNG save and external contact intents.
- CI builds web, checks PHP/database migrations, builds/lints Android and produces signed APK/AAB when repository signing secrets are configured.

## Required operator actions

Install cron, set private backup path and production admin credential, provision your own Android signing secrets, deploy a real assetlinks.json with your installed app signing certificate, publish privacy/store documents and complete store review. No store approval or live deployment is implied. Read README.md before replacing live data.
