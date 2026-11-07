# Re:Port

A library of **unofficial native Android ports**: source ports, engine rebuilds, decompilation projects and static recompilations of PC and console games. Mobile portrait first, with a 2010s glossy "Aero" look inspired by the Xbox 360 dashboard, Windows Phone Metro tiles and PS3 cover flow.

- 821 games, 14 engines and launchers, about 1,040 ports, 24 source platforms, 15 collections
- The **Download** button on a port opens the developer's release page: `/releases/latest` for GitHub projects, or the Telegram post, Discord server, Google Play listing, itch.io page and so on where the port is published
- Real artwork on every screen: box art, Steam library art and screenshots, developer avatars, and a Poly Haven sky behind the headers
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
| `npm run sync` | Fetch every list in `data/sources.json` and import its games |
| `node scripts/enrich-art.mjs` | Add Libretro box art and gameplay screenshots (cached, resumable) |
| `npm run audit` | Check that GitHub, Play Store and itch.io release links still exist (dead ones are dropped on the next data build) |
| `node scripts/e2e-smoke.mjs` | 70+ browser checks in real Chromium (needs `npm i -D playwright` and a running `vite preview`) |
| `node scripts/test-cover-flow.mjs` | Cover-flow gesture and layout regressions against `npm run dev` on port 5173 |

## Cover flow

`src/components/CoverFlow.tsx` is a dependency-free cover-flow component. Its stylesheet is isolated in `src/components/cover-flow.css`; there are no Swiper styles, scroll-timeline animations, negative caption offsets, cloned slides, or competing transforms.

Touch uses browser-native scrolling. Mouse drag, scoped keyboard controls, neighboring-cover selection and repeated arrow taps use the same measured snap positions. The selected cover is face-on; its title and controls are separate layout rows below the artwork. Hidden caption measurements reserve the longest title's space without exposing duplicate titles to assistive technology. Empty/single-item lists, cancellation, resizing, reduced motion and larger text are covered by the interaction fixture in `tests/cover-flow.html`.

Browser tests simulate real touch input through Chromium's input protocol, check that vertical swipes still scroll the page, and assert that the active cover, title and controls do not intersect. The fixture is a test-only Vite entry, not part of the production application.

## Data pipeline

### Adding a new game list

Everything a source needs lives in **`data/sources.json`**. Add one object to `"lists"`:

```json
{ "id": "my-list", "name": "My List", "url": "https://…", "type": "markdown-table",
  "target": "my-list.md", "credit": "Curated by …", "license": "CC BY 4.0", "enabled": true }
```

Then run `npm run sync`. `scripts/fetch-sources.mjs` downloads every enabled list into
`data/source/`, so a list that updates upstream is picked up automatically on the next sync and on
the nightly scheduled run — no new app release needed. The app reads the published
`public/catalog.json` at runtime, so installed copies grow with it.

Supported `type` values: `csv`, `markdown-table`, `openportsgames`, `decomp-games`, `github-issue-table`,
and `artwork` (a metadata source rather than a list).

### How entries become catalog cards

```
data/sources.json                      every list, one entry each
  ├─ napl-sheet.csv                    community sheet (ports, statuses, links)
  ├─ openports.json                    OpenPortsGames: 2,699 ports with cover, genre, year
  ├─ decompgames.json                  Awesome Decomp Games: 2,435 projects + screenshots
  ├─ awesome-*.md                      curated markdown lists
  └─ portcove.json                     candidate research
        │  scripts/import-catalog-lists.mjs   group by normalised title → one card per game,
        │                                     every list's port attached, strongest ranked first
        │  scripts/enrich-art.mjs             Libretro box art + in-game screenshots
        │  scripts/verify-android.mjs         GitHub release evidence: stars, APK downloads
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

To refresh: `npm run sync && npm run data` (and `node scripts/enrich-art.mjs` for artwork).
`enrich-art.mjs` is resumable and cached in `data/source/art-map.json`, so run it repeatedly to cover
more console games. Set `CACHE_ONLY=1` on the importer to rebuild without network access.

Re:Port never stores or links to game files or ROM download sites. Mirror and 4pda links are labelled in the app.

## Building the Android APK

GitHub Actions builds a fresh APK whenever the app changes on `main`/`master`, immediately after the scheduled catalog update, when started manually, and for version tags. Tags also attach the APK to the release:

```bash
git tag v1.0.0 && git push origin v1.0.0
```

The workflow is `.github/workflows/android-apk.yml`: install, test, check types, regenerate and verify the catalog, build with the repository's published catalog URL and exact Git build ID, verify the bundle and Android catalog asset, and create a signed release APK using the prepared Android icons and splash screens. Configure the persistent release key first using [the Android release instructions](docs/android-release.md). You can also run it locally with `npx cap add android && npx cap sync && npx cap open android`.

Settings shows the app build and catalog revision. If those do not match the newest workflow run, the installed APK is stale. The native app unregisters old web service workers on startup so an earlier APK cannot keep serving an old home screen after an update; library data itself continues to refresh from the published catalog.

The APK stays small because it only contains the app shell and the catalog text. Artwork is downloaded on first view and cached on demand (limit 600 images, clearable in Settings).

## Port submissions

The Submit screen validates the form on device and stores the entry in a local queue. When you have a review backend, set `VITE_SUBMIT_URL` at build time. The app then POSTs this JSON, and only keeps items that could not be delivered:

```json
{ "title": "", "project": "", "developer": "", "url": "", "platform": "pc", "genre": "", "files": "files", "controller": "", "notes": "", "contact": "", "app": "portdeck", "version": 1 }
```

Report requests from game pages use the same endpoint with `project: "REPORT"` and a `REPORT:` prefix in `notes`. The code lives in `src/lib/submissions.ts`.

## Credits

NAPL community sheet, Awesome Android Native Ports (abduznik), LaunchBox Games Database, Steam, Wikipedia (CC BY-SA 4.0), Wikidata, Poly Haven (CC0), GitHub, wsrv.nl image CDN, Open Sans (SIL OFL). Game names, logos and cover art belong to their owners and are shown for identification only.
