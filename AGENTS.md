# Repository instructions for Codex

## Project invariant

This is a **single-user, offline-first, browser-local baby care log for an iPhone**.

Read `CODEX_TASK.md` and `docs/ACCEPTANCE.md` before modifying code. Favor incremental, reviewable patches over a rewrite. The `dist/` directory is the current source as well as deployment output, and the target is GitHub Pages with no build step.

## Must preserve

- Home quick actions: bottle feeding, diaper, bilirubin, temperature; no sleep feature.
- Weight and actual medication on health screen.
- Each new bottle record defaults `has_fortifier` to false.
- Existing IndexedDB schema and local data continuity, including historical database identifier.
- Import compatibility with both `tangtang-journal-backup` and `xiaoman-journal-backup`.
- The current warm-white / muted-color mobile UI and usable night theme.
- No child or parent account registration and no network database.

## Security and privacy

- Never commit actual baby details, medical readings, export files, or secrets.
- Avoid third-party analytics, CDNs, remote fonts, remote API calls and unnecessary external dependencies.
- Never diagnose jaundice, recommend medication doses, or compute fortifier doses.
- Never execute destructive reset/migration against an existing user's IndexedDB without explicit confirmation and verified backup.
- A public repository and a public Pages website are public; obtain the user's choice before creating or switching GitHub visibility.

## Deployment and testing

- GitHub Pages may serve the project beneath `/<repo>/`, so root-relative asset or Service Worker paths must be eliminated or resolved safely.
- Create a GitHub Actions Pages deployment from `dist/`, with only necessary permissions. Verify the final live URL and all assets.
- Check `node --check dist/app.js`, `node --check dist/sw.js`, and JSON manifest parsing. Add tests covering import/export roundtrip and legacy format.
- If iPhone Safari tests are unavailable, report that limitation accurately; do not fabricate a successful real-device test.
- Do not report deployment success from Git push alone; wait for Pages status and verify the site URL.

## Final handoff

Give the user the repository URL, Pages URL, current commit, test summary, iPhone Home Screen instructions, and the one-time JSON migration steps from the old ChatGPT Site.
