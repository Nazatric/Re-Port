# Re:Port

A library of **unofficial native Android ports**: source ports, engine rebuilds, decompilation projects and static recompilations of PC and console games. Mobile portrait first, with a 2010s glossy "Aero" look inspired by the Xbox 360 dashboard, Windows Phone Metro tiles and PS3 cover flow.

- The bundled catalog contains Android-targeted ports of PC and console games. Source platforms describe the original games, not the target OS.
- The **Download** button opens an Android-containing GitHub release when one is known, otherwise the project page or the source's Telegram, Discord, Google Play, itch.io or other link.
- Artwork from LaunchBox, Steam, Libretro and port projects, plus developer avatars and a Poly Haven sky. Some titles do not have available images.
- Artwork is **streamed and cached on demand**, nothing is bundled. The app shell, catalog, icons and fonts are local, so everything opens offline. Missing artwork falls back to generated covers
- Accessibility first: semantic landmarks, skip link, focus management on every page change, visible focus rings, 44px touch targets, text size, high contrast, reduced motion, screen-reader labels, status never conveyed by colour alone
- The custom cover flow uses native horizontal scrolling for touch inertia and snapping. Only the inner artwork is transformed, in a single requestAnimationFrame pass while scrolling. Long lists render in chunks with `content-visibility`; physical-device refresh-rate performance still needs device testing.

## About the stack (Kotlin and WASM)

This project is built with **React, TypeScript, Vite and Tailwind CSS**. The build environment used to create it cannot compile Kotlin or Kotlin/WASM, so there is no Kotlin code here. The same code ships to both targets:

- **Web / PWA**: `npm run build` produces `dist/index.html`, installable and offline-capable
- **Android (native APK)**: the web build is wrapped in a native WebView with [Capacitor](https://capacitorjs.com). The GitHub Actions workflow below produces the APK

The catalog is plain JSON (`src/data/catalog.json`), so a Kotlin Multiplatform client can reuse it unchanged later.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Build to `dist/` (single `index.html` plus manifest, service worker and icons) |
| `npm test` | Unit tests for catalog integrity, ranking, live updates, navigation, validation, and cover-flow geometry |
| `npm run typecheck` | TypeScript check |
| `npm run data` | Rebuild `src/data/catalog.json` from `data/source/` |
| `npm run sync` | Refresh the supported upstream source caches; import and build separately |
| `node scripts/enrich-console-art.mjs` | Rebuild the exact title-and-platform Libretro image index using GitHub CLI |
| `npm run audit` | Check that GitHub, Play Store and itch.io release links still exist (dead ones are dropped on the next data build) |
| `node scripts/e2e-smoke.mjs` | 70+ browser checks in real Chromium (needs `npm i -D playwright` and a running `vite preview`) |
| `node scripts/test-cover-flow.mjs` | Cover-flow gesture and layout regressions against `npm run dev` on port 5173 |

## Cover flow

`src/components/CoverFlow.tsx` is a dependency-free cover-flow component. Its stylesheet is isolated in `src/components/cover-flow.css`; there are no Swiper styles, scroll-timeline animations, negative caption offsets, cloned slides, or competing transforms.

Touch uses browser-native scrolling. Mouse drag, scoped keyboard controls, neighboring-cover selection and repeated arrow taps use the same measured snap positions. The selected cover is face-on; its title and controls are separate layout rows below the artwork. Hidden caption measurements reserve the longest title's space without exposing duplicate titles to assistive technology. Empty/single-item lists, cancellation, resizing, reduced motion and larger text are covered by the interaction fixture in `tests/cover-flow.html`.

Browser tests simulate real touch input through Chromium's input protocol, check that vertical swipes still scroll the page, and assert that the active cover, title and controls do not intersect. The fixture is a test-only Vite entry, not part of the production application.

## Data pipeline

### Adding a new game list

`data/sources.json` documents the sources; adding a manifest entry alone does not create a parser.
Add a source-specific parser in the sync/import scripts and tests before enabling a new list.
Mixed-platform lists are discovery leads, not proof of Android support. GitHub candidates require
an Android APK/APKS/XAPK release or a project README documenting an Android build. NAPL's
non-GitHub entries rely on its Android-specific list, with incompatible links rejected. The
Awesome Android list is parsed and its GitHub projects are checked independently. OBB files,
ARM64 alone, emulation and iOS/Windows links are not Android-port evidence. Evidence is not a
physical device test, and projects can change after a check; missing or ambiguous candidates
are excluded until evidence is found.

The scheduled workflow refreshes the sources before verification, spends a limited API budget
on new/stale candidates, then imports, builds, tests and publishes `public/catalog.json`.
Installed apps periodically check the published catalog without an APK release. GitHub schedules
run only on the repository's default branch: these changes must be merged there before the nightly
job runs, and APKs built here are configured to read the default branch after that merge. The new
APK rejects older, unfiltered remote/cache catalogs via an Android-policy marker; older installed
APKs need this one app update first.

### How entries become catalog cards

```
data/sources.json                      every list, one entry each
  ├─ napl-sheet.csv                    community sheet (ports, statuses, links)
  ├─ openports.json                    OpenPortsGames: 2,699 ports with cover, genre, year
  ├─ decompgames.json                  Awesome Decomp Games: 2,435 projects + screenshots
  ├─ awesome-*.md                      curated markdown lists
  └─ portcove.json                     candidate research
        │  scripts/verify-android.mjs         check GitHub Android packages and README claims
        │  scripts/import-catalog-lists.mjs   group titles, attach only evidenced ports
        │  scripts/enrich-console-art.mjs     Libretro box art + in-game screenshots
        v
data/source/extras.json + art-map.json
        │  scripts/build-data.mjs             merge, dedupe, rank, normalise genres/dates
        v
src/data/catalog.json  +  public/catalog.json  (the live-updated copy)
```

**Duplicates are merged, not shown twice.** Entries describing the same title become one card carrying
all of its ports (even when lists disagree on the release year); genuinely different games that share
a name stay separate when their years are far apart. Ports are ranked by real release downloads, then
GitHub stars, then list views — so the Download button opens the strongest source first.

To refresh: `npm run sync && npm run verify && node scripts/import-catalog-lists.mjs && npm run data` (and `node scripts/enrich-console-art.mjs` for artwork).
`enrich-console-art.mjs` records URLs for exact title-and-platform matches in `data/source/console-art.json`. Curated project screenshots and their version notes live in `data/source/verified-screenshots.json`. Both are merged into each catalog build; unavailable or ambiguous images are skipped. Screenshots can depict the original console game or a particular PC/Android project rather than every port, and retro source images may be low resolution. Set `CACHE_ONLY=1` on the importer to rebuild without network access.

Re:Port never stores or links to game files or ROM download sites. Mirror and 4pda links are labelled in the app.

## Building the Android APK

GitHub Actions builds a fresh APK for app changes, when started manually, and for version tags:

```bash
git tag v1.0.0 && git push origin v1.0.0
```

The workflow is `.github/workflows/android-apk.yml`: install, test, check types, regenerate and verify the catalog, check startup and page transitions, and build the Android APK using the prepared icons. The downloadable APK uses Android's debug build variant, even though its filename is simply RePort. It is intended for testing; replacing a differently signed installation requires uninstalling it first. You can also run it locally with `npx cap add android && npx cap sync && npx cap open android`.

Settings shows the app build and catalog revision. If those do not match the newest workflow run, the installed APK is stale. The native app unregisters old web service workers on startup so an earlier APK cannot keep serving an old home screen after an update; library data itself continues to refresh from the published catalog.

The APK stays small because it only contains the app shell and the catalog text. Artwork is downloaded on first view and cached on demand (limit 600 images, clearable in Settings).

## Port submissions

The Submit screen validates the form on device and stores the entry in a local queue. When you have a review backend, set `VITE_SUBMIT_URL` at build time. The app then POSTs this JSON, and only keeps items that could not be delivered:

```json
{ "title": "", "project": "", "developer": "", "url": "", "platform": "pc", "genre": "", "files": "files", "controller": "", "notes": "", "contact": "", "app": "portdeck", "version": 1 }
```

Report requests from game pages use the same endpoint with `project: "REPORT"` and a `REPORT:` prefix in `notes`. The code lives in `src/lib/submissions.ts`.

## Credits

NAPL community sheet, Awesome Android Native Ports (abduznik), LaunchBox Games Database, Steam, Wikipedia (CC BY-SA 4.0), Wikidata, Libretro community thumbnails and port project developers, Poly Haven (CC0), GitHub, wsrv.nl image CDN, Open Sans (SIL OFL). Game names, logos and cover art belong to their owners and are shown for identification only.
