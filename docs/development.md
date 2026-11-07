# Development

Re:Port is a React and TypeScript application built with Vite and Tailwind CSS. Capacitor wraps the same interface in an Android WebView. The project also builds as a web app; the distributed download is for Android.

## Getting started

Use Node.js 22 and install the locked dependencies:

```sh
npm ci
npm run dev
```

The development server prints its local address. For a production web build, run `npm run build`. The output is written to `dist/`.

| Command | Purpose |
| --- | --- |
| `npm test` | Run unit tests and Android catalog policy checks |
| `npm run typecheck` | Check TypeScript types |
| `npm run build` | Build the web app |
| `npm run data` | Rebuild the catalog from the local source data |
| `npm run sync` | Refresh supported upstream source caches |
| `npm run verify` | Check GitHub candidates for Android evidence |
| `npm run audit` | Check supported project and download links |
| `node scripts/test-app-transitions.mjs` | Run mobile layout, navigation, and screenshot viewer checks against the built app |
| `node scripts/test-cover-flow.mjs` | Exercise cover-flow gestures and layout in Chromium |

The browser checks need a Chromium installation. Set `CHROMIUM_PATH` if Playwright cannot find it. See the scripts for their server requirements.

## Android builds

The [Android workflow](../.github/workflows/android-apk.yml) installs dependencies, runs tests and browser checks, rebuilds the catalog, and packages the web app with Capacitor. It checks that the APK is universal before uploading it as a workflow artifact. The V1.0 release was published from the `v1.0` tag after those checks passed.

The distributed APK is the **debug build variant**, not a production-signed release. Android will not update an installation signed by a different key without uninstalling it first; uninstalling may erase local app data. For future production signing, see [Android release signing](android-release.md).

To create an Android project locally, install the Android SDK and JDK, then run:

```sh
npm run build
npx cap add android
npx cap sync android
npx cap open android
```

## Catalog and evidence

The catalog is generated from source data under `data/source/`; `data/sources.json` records source information. Adding a manifest entry alone does not create a parser. New feeds need an importer and tests, and mixed-platform lists are treated as discovery leads rather than proof of Android support.

GitHub candidates are checked for an Android APK, APKS or XAPK release, or a project README documenting an Android build. Non-GitHub entries from the Android-specific NAPL list rely on that list, with incompatible links rejected. An APK or README claim is evidence of a target, not a physical-device compatibility test. Some projects may need to be built from source. Ambiguous candidates are excluded until evidence is found.

The importer groups ports under game identities and the builder produces both `src/data/catalog.json` and `public/catalog.json`. The app periodically checks the published catalog, so catalog updates do not necessarily require a new APK. The scheduled workflow runs on the default branch. A remote catalog must satisfy the app's Android policy and per-port evidence checks.

To refresh the supported sources and rebuild locally:

```sh
npm run sync
npm run verify
node scripts/import-catalog-lists.mjs
npm run data
```

The verifier uses GitHub's API and may be limited by available requests. `CACHE_ONLY=1` on the importer uses the local cache without network access.

Original-game metadata is matched against a compact index of [OpenGameDB](https://github.com/karlforshaw/opengamedb), pinned to the revision recorded in `data/source/opengamedb-index.json`. Matches require a normalized exact title and compatible platform or release year; conflicts are skipped. Curated genre corrections and their references are in `data/source/genre-overrides.json`. Genres and platforms can be incomplete or disputed, so unknown values remain visible rather than inferred from descriptive text. To refresh the metadata index, obtain the recorded OpenGameDB CSV revision and run `python3 scripts/index-game-metadata.py /path/to/opengamedb`, then rebuild the catalog.

`node scripts/enrich-console-art.mjs` builds the conservative Libretro artwork index. Curated project screenshots and their version notes are in `data/source/verified-screenshots.json`. Artwork can depict the original console game or a particular port rather than every version.

## Port submissions

The Submit screen validates entries on the device and stores them in a local queue. A review backend can be configured with `VITE_SUBMIT_URL` at build time; submissions are sent as JSON and entries that cannot be delivered stay in the queue. Reports from game pages use the same endpoint. See `src/lib/submissions.ts` for the payload and validation.

## Sources and credits

The catalog draws on the NAPL community sheet, [Awesome Android Native Ports](https://github.com/abduznik/awesome-android-native-ports), [OpenPortsGames](https://openportsgames.com/), [Awesome Decomp Games](https://github.com/SubmitGame/awesome-decomp-games), [Android Ports Master](https://github.com/keika-sy/android-ports-master), [PortHub Catalog](https://github.com/orev7s/porthub-catalog), [DroidRecomp](https://github.com/MooPuu/droid-recomp), [Porting Room](https://github.com/vimehub/porting-room), project documentation, and community research. These lists can contain errors or non-Android entries; they are not interchangeable with independent evidence.

Metadata and artwork sources include OpenGameDB, LaunchBox Games Database, Steam, Wikipedia, Wikidata, Libretro community thumbnails and port project developers. The app also uses a Poly Haven sky, the wsrv.nl image CDN and Open Sans. Source-specific attribution and licensing information are recorded in `data/sources.json` and the source files. Game names, logos and cover art belong to their owners and are shown for identification.
