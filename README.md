# Re:Port

Re:Port is a directory of unofficial Android game ports, engine rebuilds and recompilations. The Android client in **`native/`** is written in Kotlin and Jetpack Compose; it does not use Capacitor or a WebView.

## Native Android app

The native app bundles the existing catalog from `src/data/catalog.json`: 2,484 games, 13 engines and 3,475 port entries in the current snapshot. The original source metadata, release links, cover URLs and available Steam screenshot URLs are retained. Artwork is loaded at its original URL, cached on device with Coil and replaced by a title card when unavailable. Not every catalog entry has artwork or screenshots, and remote sources may become unavailable.

The Compose client includes Home cover flow, searchable and filterable Library, Browse by genre/platform/source, Saved and Recently Viewed, game details and port links, screenshots, release information, themes, accessibility/data settings, offline catalog storage and an optional catalog refresh. Suggestions and reports are stored locally for the user to copy; no review backend is configured. The native interface is a recreation of the prior design, not a pixel-identical conversion, and device testing and feature-parity review are still needed.

### Build

Install Android SDK 36 and JDK 21, then:

```sh
cd native
./gradlew testDebugUnitTest assembleDebug
```

The APK is at `native/app/build/outputs/apk/debug/app-debug.apk`. GitHub Actions builds an APK artifact named `RePort-apk-*`. The artifact filename is simply RePort, but it uses the Android debug build variant. The debug signing key can differ between builds; installing over an APK signed with another key requires uninstalling first, which can remove app data. A production release needs a persistent signing key; see `docs/android-release.md`.

Android may display its mandatory system launch window on newer versions. Compose renders the actual app directly, without a WebView or an intentional branded splash delay. Native UI does not guarantee zero lag: artwork/network conditions and device performance still need testing.

## Catalog and legacy reference

`data/source/`, `data/sources.json`, and the existing scripts retain the upstream inputs and catalog-generation pipeline. `src/data/catalog.json` is the bundled offline snapshot and `public/catalog.json` is the published refreshable copy. The earlier React implementation remains in the repository as a reference for migration and data maintenance; it is **not included in the native APK**. The native build is independent of Node and the old Capacitor project.

## Credits

Community research, OpenPortsGames, Awesome Decomp Games, NAPL, LaunchBox Games Database, Steam, Wikipedia (CC BY-SA 4.0), Wikidata, GitHub and Libretro. Game names, logos and artwork belong to their respective owners. Re:Port never hosts game files or ROMs.
