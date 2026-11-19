# Google Drive source import — 2026-11-19

## Source

- Archive: `DataGraph-Gemini-Full-Source.zip`
- Drive modification time: `2026-11-19T16:51:47.131Z`
- Archive size: 1,099,354 bytes; 101 files (excluding directory entries).
- SHA-256: `b5f7e852c71d8fc70121840527c34c7db899730ed09f9c1242bc6bbb7830e138`
- Destination: `ntgalaxy1/Datagraph`.

This was the newest full-source DataGraph archive found in the connected Drive. All 101 source files are included, not just the compiled website: React/TypeScript UI, PHP/MySQL APIs and installer, Gemini integration, Google Sheets integration, optional Python preview backend, catalog/workbook seeds, assets, Android project, tests, workflows and documentation.

## Small repository-readiness adjustments

- Restore executable permissions on `android/gradlew` after ZIP extraction.
- Ignore local download/import scratch space and runtime Gemini configuration/quota files, in addition to the archive's existing credential/build exclusions.
- Run Android release signing only for version tags or explicit manual requests, so ordinary source pushes and pull requests do not require production signing keys. Signed releases still fail closed when signing credentials are missing.
- Correct the obsolete default-password comment in `public/sync-catalog.php`; runtime authentication is unchanged and requires an operator-configured password/hash.

Application behavior and the pinned dependency versions are otherwise preserved. In particular, SheetJS remains the upstream `0.20.3` tarball with the original lockfile integrity; it has not been downgraded to the older npm `xlsx` release.

## Important boundaries

This is a source-code import, not a production deployment or a copy of the live site's database. The included catalog/workbooks are the archive's seed data. Never replace live data or private configuration with seeds during an update. Private admin hashes, Gemini keys, MySQL/Sheets credentials, Android signing keys, downloaded ZIPs, dependency directories and build output do not belong in Git.

Hosting needs PHP/MySQL for shared administration; GitHub Pages alone cannot run those APIs. See [README.md](README.md), [INSTALLER_GUIDE_FA.md](INSTALLER_GUIDE_FA.md), [SPREADSHEET_ADMIN_GUIDE.md](SPREADSHEET_ADMIN_GUIDE.md) and [GEMINI_GUIDE_FA.md](GEMINI_GUIDE_FA.md). Real Google/Gemini connections and signed Android releases require the owner's configuration and are not validated by importing the source.
