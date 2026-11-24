# Re:Port — feature inventory and better alternatives

Research date: 2026-11-07. Branch: `arena/dcbf2003-re-port` (remote head `fbe6769`).

How to read this: every claim is marked **[verified]** (checked in this repo or in a live CI run), **[sourced]** (from a web search result, linked), or **[unverified]** (general engineering knowledge that still needs a test). Nothing here is a guarantee of "no errors". The recommendations are ordered by impact.

---

## 1. Where the project stands

### Current features (from README and code)
| Feature | State |
|---|---|
| Browse with search, filters (platform, collection, files needed) | Shipped. Shuffle per visit is **not** on the branch yet. |
| Game detail pages (project links, requirements, release links) | Shipped. Load fix (`0f7b337`) is on the branch. |
| Favorites and recently viewed | Shipped (state in `src/state.tsx`). |
| Themes, profile name, animated GIF avatar | Shipped. Gamepad ring padding is on the branch (`36538ed`). |
| Cover flow, reflections, glossy surfaces (home blades) | Shipped. Heaviest part for scrolling. |
| Bundled catalog, offline browsing | 907 games, `catalog.json` is **1.7 MB** [verified]. |
| Artwork (covers, heroes, screenshots) served from GitHub releases `art-0..art-7` | Working. 3,199 assets, 862 covers [verified in an earlier run]. |
| Android APK via Capacitor | **5.06 MB** on run `43169283379` [verified]. Version **1.2.0** [verified]. |
| Port link audit (`docs/port-link-audit.md`) | Done once. Not automated. |
| Smoke tests (Playwright, web and bridge) | Passing locally. Android CI passes on `fbe6769` [verified]. |

### Requests still open from the batch
- Card art fills its box at any aspect ratio, with no border or padding (procedural, not per-game).
- Remove the "APK release" tag from cards.
- Browse randomness and no stretched images (Battlefield 2).
- No unrelated images. Remove the Beats of Rage NSFW image. Doom 2016 must not appear under Doom 1993.
- Fix every broken link and replace unverifiable links with real ones.
- Faster cover loading and detail pages that always load.
- Smooth navigation and animations (browse scroll is ~38 fps average and ~233 ms worst in the sandbox profiler, after the earlier fixes [measured, relative only]).
- Keep the APK at ~5 MB. Artwork must not be inside the APK.

### Problems I found in my own process (must be fixed before anything else)
1. **The branch is missing most of the batch.** The remote branch has `fbe6769`, which is the CI fix plus everything up to `60d115a`. The batch work (shuffle, artwork shape, port audit doc, Doom and Beats of Rage fixes, artwork scripts) is **not committed**. It is still in the working tree, as 18 modified files and several untracked folders. My earlier message said it was stashed. That was wrong: the `git stash` list is now empty [verified].
2. **Do not reset the working tree.** Doing so would delete that uncommitted work. The first step is to commit it to a separate branch or a patch file, then review it.
3. **The local checkout is at base `5b23652`**, not at the remote head. Fast-forwarding would conflict with the uncommitted files, so the reconciliation has to be deliberate.

---

## 2. Technology alternatives, ranked by impact

### 2.1 App framework: keep Capacitor
| Option | Evidence | Verdict |
|---|---|---|
| **Keep Capacitor** (current) | Smallest Android app among cross-platform options. Vendor benchmarks put it at about 3–5 MB and about 4.5 MB for a blank project [sourced: oflight.co.jp, ttlab.hopto.org, lueurexterne.com]. Scroll on large lists is "hard" on a WebView [sourced, same sources]. | **Recommended.** The app is already a web app. The real problem is WebView rendering cost, which is fixed in code (see 2.2–2.4), not by switching frameworks. |
| React Native (New Architecture) | Better scroll and animation in vendor tables. Blank app about 7.8 MB [sourced]. | Rewrite of the whole UI. Not worth it for a directory app. |
| Tauri 2 Mobile | Small and fast in vendor benchmarks. Android support is newer and the benchmark numbers are from vendor blogs [sourced]. | Too early for a shipped Android app. Revisit later. |
| Flutter | Strong rendering in vendor scores [sourced]. Full rewrite. | No. |

Conclusion: keep Capacitor. The "10x" gains come from rendering work, not from a new framework.

### 2.2 List virtualization for the browse grid
The browse grid renders hundreds of cards. Virtualization keeps only the visible cards in the DOM. Vendor numbers show about 6–12 ms initial render versus about 200 ms without it [sourced: pkgpulse.com, March 2026; these are community benchmarks, so treat them as approximate].

| Option | Notes | Verdict |
|---|---|---|
| **react-virtuoso** (`VirtuosoGrid`) | Built-in grid support, handles variable row heights, sticky headers [sourced]. | **Recommended for browse.** Easiest path to a masonry-like grid that stays smooth. |
| TanStack Virtual | Headless, very small, works with any layout. Grid and variable heights need more code [sourced]. | Good if you want full control of the layout. |
| react-window | Needs workarounds for dynamic heights [sourced]. | No. |

Caveat [unverified]: the masonry layout must have fixed card frames. The branch already fixes frames (`36538ed`), so virtualization should be simple.

### 2.3 Search
The catalog has 907 entries. Speed is not the deciding factor at this size [unverified; all options are fast enough]. Choose by features.

| Option | Evidence | Verdict |
|---|---|---|
| **MiniSearch** | Fielded search (title, engine, collection), boosting, prefix and fuzzy matching. About 29 KB [sourced: npm-compare, uFuzzy benchmark page]. | **Recommended.** Best fit for "search by title with fields and fuzzy typo handling". |
| uFuzzy | Very fast and tiny. Less feature-rich, so you build field handling yourself [sourced]. | Good if you only search titles. |
| Fuse.js | About 30× slower than the fastest option in one benchmark [sourced]. Fine at 907 items, but slower. | Acceptable fallback. |
| Orama | Heavy: large init time and memory in one benchmark [sourced]. | No, at this size. |

### 2.4 Artwork sources (fixes "wrong image", "no image", "stretched")
Key point: match by **stable IDs**, not titles. Title matching is why Doom 1993 got Doom 2016's art.

| Source | Free tier and terms | Best for | Verdict |
|---|---|---|---|
| **SteamGridDB** | Free, needs a personal API key [sourced]. Has grid (600×900), hero (1920×620), logo and icon, looked up by Steam AppID [sourced]. | Exact art shapes that match the cards. Solves the stretched-image problem at the source. | **Recommended for covers and heroes.** |
| **IGDB** (Twitch) | Free for **non-commercial use**, 4 requests/second, Twitch OAuth client credentials, Apicalypse query language [sourced: buildstudio.com.ng, gamebrain.co]. | Metadata, release years, screenshots, IDs. | **Recommended for metadata and screenshots.** Non-commercial terms are fine for this free app, but do not add ads or paid features without checking. |
| **RAWG** | Free key, 20,000 requests/month, **requires a visible backlink to RAWG** wherever data is used [sourced: freeapihub.com, buildstudio.com.ng]. | Fallback only. | Use only as a fallback, with the attribution link in the UI. |
| Steam CDN (by AppID) | Used already in the build pipeline [verified in the stash]. | Cover images for games with a Steam AppID. | Keep. |
| Wikipedia and Wikidata | Free, needs a clear User-Agent [unverified]. | Years and IDs. | Keep for verification. |
| Commons / Openverse search | Caused the NSFW image and unrelated images [verified in the batch]. | — | **Remove.** Do not use image search for game art. |

Rules that fix the open complaints:
1. Store the canonical ID per game in the catalog (Steam AppID, IGDB ID, SteamGridDB game ID) and resolve art by ID.
2. Accept an image only if the ID matches **and** the release year matches.
3. If no source has art, show the generated card, not an unrelated image.

### 2.5 Card art that fills its box at any aspect ratio (procedural)
Recommended approach [unverified in this app, standard CSS]:
- Fixed frame with `aspect-ratio` set by the card type (e.g. 2:3 for covers).
- `img { width: 100%; height: 100%; object-fit: cover; }`.
- Trade-off: `cover` crops the edges of wide art. That is what "fill the box with no padding" means. `contain` would leave borders, which the user rejected.
- Pick the art that matches the frame shape (SteamGridDB grids are already 2:3), so cropping is minimal.

### 2.6 Image hosting: keep the APK small
| Option | Notes | Verdict |
|---|---|---|
| GitHub releases (current, `art-0..art-7`) | Works. Publish step hit rate limits (403) earlier [verified]. Needs retry and backoff (already added). | Keep for now. |
| Cloudflare R2 or another object store with a CDN | Commonly used for this, with no egress fees on R2 [unverified; check current pricing and free-tier limits before adopting]. | Better long-term: no rate-limit problems and faster loads. Needs an account and a secret. |
| Serve from the repo | Repo growth and size limits. | No. |

Also [unverified]: cache images on the device after first load, and serve WebP or AVIF at the displayed size (the pipeline already converts to WebP).

### 2.7 Animation and scroll performance (WebView)
Measured, relative numbers from this project:
- Removing per-card glass shadows raised browse scroll from ~12 fps to ~22 fps. Removing the sheen pseudo-element also gave ~22 fps. Adding `will-change: transform` on `.masonry-item` gave ~46 fps [measured, injected CSS, not yet in a real build].

Recommendations:
- Animate only `transform` and `opacity` [unverified, standard rule].
- Avoid `backdrop-filter` and large `box-shadow` on scrolling items. Use them only on static chrome.
- Use `content-visibility: auto` on off-screen sections [unverified on Android WebView; test it].
- Keep the warm-up of tabs (already in `36538ed`).
- View Transitions API for page changes [unverified on Android WebView; check the WebView version support before relying on it].
- Verify in a **real release build** on a device or emulator, not only the sandbox (software rendering, relative numbers only).

### 2.8 Link checking: replace the hand-rolled audit
| Option | Evidence | Verdict |
|---|---|---|
| **lychee** (Rust) with `lycheeverse/lychee-action` | Respects rate limits, retries with backoff, checks Markdown, HTML and text, has a GitHub Action and JSON output [sourced: lychee GitHub README]. | **Recommended.** Run it in CI on every push, with `GITHUB_TOKEN` to avoid GitHub rate limits. |
| linkinator | Node, retries and backoff, JSON output, config file [sourced]. Does not respect rate limits [sourced]. | Good for a JS-only pipeline. |
| broken-link-checker | No rate limits or retries [sourced]. | No. |

Important: the sandbox cannot reach `github.com` (TLS fails) [verified]. So GitHub link results must come from CI or from a browser. Lychee in CI solves this.

### 2.9 Testing
| Layer | Current | Recommended |
|---|---|---|
| Web UI | Playwright smoke scripts (`run-smoke.mjs`, `smoke-web.mjs`, `smoke-overlays.mjs`) | Keep. Add a small test for card art frames and browse shuffle. |
| Android on device | None (only "APK builds") | **Maestro** for on-device flows. MIT, YAML, runs on Android emulators and Capacitor apps [sourced: maestro.dev; a RevenueCat Capacitor test app uses it, sourced from GitHub PR #699]. Vendor flakiness claims are unverified. |
| Unit | `scripts/smoke-features.mjs` | Keep. Optionally move to Vitest for catalog and ID-matching logic. |

### 2.10 Release signing and distribution
- Current APK uses a **debug certificate**, as the README warns [verified].
- Recommended: create a release keystore, store it in CI secrets, sign the release build, and enrol in **Play App Signing** [sourced: capgo.app keystore guide]. This also makes updates survive installs.
- Keep the keystore out of Git.

### 2.11 Error reporting (optional)
A crash and error reporter would catch "detail pages sometimes don't load" in the field instead of by guesswork. Candidates include Sentry (free tier) [unverified; check the current free limits and the privacy policy, since this is a directory app]. Off by default if you want no tracking.

---

## 3. Feature-by-feature plan

| # | Request | Best alternative | Status |
|---|---|---|---|
| 1 | Minecraft Java has a cover | Already has one (`art-6`, catalog) | Done, not a bug |
| 2 | Smooth nav and animations | Virtualized browse (react-virtuoso), CSS transform and opacity only, `will-change` on cards | Partly on branch (`36538ed`). `will-change` not yet in a real build |
| 3 | Gamepad ring not obstructed | Padding on avatar row | Done (`36538ed`), screenshot checked |
| 4 | APK version 1.2 | `package.json` 1.2.0 | Done on branch, CI shows 1.2.0 |
| 5 | Card art fills box, any ratio | `object-fit: cover` in an `aspect-ratio` frame, SteamGridDB shapes | In the uncommitted working tree |
| 6 | Remove "APK release" tag | Delete the tag component | In the uncommitted working tree |
| 7 | Browse randomness, no stretched images | Shuffle per visit within the APK tier | In the uncommitted working tree |
| 8 | No unrelated or NSFW images | Remove Commons and Openverse fallbacks, ID-based art | In the uncommitted working tree |
| 9 | Doom 1993 must not show 2016 art | Store and match Steam AppID and year | In the uncommitted working tree |
| 10 | Broken links fixed | lychee in CI, port audit repeated | Audit done once; CI automation not yet added |
| 11 | Detail pages always load | Remove media gate, Back button for missing games | `0f7b337` on branch |
| 12 | Faster cover loading | Cache, WebP, CDN (R2) later | Partly done |
| 13 | APK stays ~5 MB | Artwork stays out of the APK | Done on branch (5.06 MB) |
| 14 | Logs committed to branch | Commit run logs to `docs/logs/` or as artifacts | Not done |

---

## 4. Recommended order of work
1. **Protect the batch.** Commit the uncommitted working tree to a new branch or a patch file, and review it. Do not reset anything.
2. **Reconcile** that work onto `fbe6769` and run `npm run typecheck`, `npm test`, `npm run build`, and the Playwright smoke tests.
3. **Fix the art pipeline by ID** (SteamGridDB + IGDB, drop Commons and Openverse). This fixes most of the image complaints.
4. **Card frames and tag removal** (`object-fit: cover`, remove "APK release").
5. **Browse virtualization** (react-virtuoso) and CSS cleanup. Measure in a release build.
6. **Automate links** with lychee in CI.
7. **Maestro flows** for the Android app.
8. **Release keystore and Play App Signing** before any public release.
9. Optional: error reporting, CDN hosting.

---

## 5. Sources
- Capacitor vs React Native vs Tauri benchmarks: https://www.oflight.co.jp/en/columns/flutter-rn-capacitor-tauri-performance ; https://ttlab.hopto.org/blog/culture/2026-05-25-cross-platform-mobile-react-native-flutter-expo-capacitor-tauri-kotlin-mp-lynx-2026-deep-dive?lang=en ; https://blog.lueurexterne.com/en/blog/capacitor-vs-react-native-in-2026-which-hybrid-mobile-app-solution/
- Virtualization comparison: https://www.pkgpulse.com/guides/tanstack-virtual-vs-react-window-vs-react-virtuoso-2026
- Fuzzy search benchmarks: https://github.com/zoubingwu/bench-fuzzy-search ; https://github.com/leeoniya/uFuzzy ; https://npm-compare.com/@leeoniya/ufuzzy,fuse.js,fuzzy,fuzzysearch,fuzzyset.js,string-similarity
- IGDB terms: https://www.buildstudio.com.ng/apis/igdb-api ; https://apideposu.com/en/blog/best-free-gaming-apis
- SteamGridDB: https://clirank.dev/apis/games-and-entertainment/steamgriddb-api ; https://indieforgames.com/steamgriddb-guide/
- RAWG terms: https://freeapihub.com/apis/rawg-video-games-api ; https://www.buildstudio.com.ng/apis/rawg-video-games-api
- lychee: https://github.com/lycheeverse/lychee
- Maestro: https://maestro.dev/insights/best-mobile-app-testing-frameworks ; https://github.com/RevenueCat/purchases-capacitor/pull/699
- Keystore and Play App Signing: https://capgo.app/tools/android-keystore-generator/

Caveat on sources: several are vendor or SEO blog posts with differing numbers. Use them to shortlist, then verify on this project.
