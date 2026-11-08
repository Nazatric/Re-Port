# Changelog

The notable changes in each Re:Port release are recorded here.

## Unreleased

- Validate remote catalogs and recover from corrupt cached entries before replacing the bundled Android-evidenced library.
- Check catalog sources concurrently with timeouts, a transient retry, a keyless mirror for the configured public GitHub catalog, and deduplicated refreshes.
- Make GitHub release refresh bypass its cache and distinguish a failed release lookup from a project with no releases.
- Preserve a filter change made during a pending search, avoid repeated full sorts when calculating filter counts, and fall back to the original Steam hero image when its proxy fails.
- Clarify native artwork caching and debug signing, refresh the technical documentation, and update vulnerable development dependencies.

## V1.0

The first public Android release brings the Re:Port library together in a single universal APK.

### Discover

- Browse Android-supported source ports, engine rebuilds, decompilations, and recompilation projects in one library.
- Search the catalog and explore collections, with filters for original platform, source, compatibility, file requirements, and controller support.
- Open a game for its project links, available downloads, artwork, screenshots, and source information.
- Keep a local list of favourites and return to recently viewed games.

### Made for your phone

- Move through the Spotlight cover flow and browse with touch-friendly navigation.
- Choose Azure, Graphite, Lime, or system appearance, and adjust text size, contrast, and motion.
- View screenshots in a viewport-contained gallery with on-screen controls, keyboard navigation, and focus restoration.
- Use the bundled catalog offline; artwork and catalog updates are fetched when a connection is available.

### Catalog and reliability

- Android evidence is checked per port, while mixed-platform lists are used as leads rather than treated as proof.
- Genre and original-platform metadata use conservative matching and documented corrections; uncertain values can remain unknown.
- Automated checks cover the catalog, Android evidence, types, mobile layout, screenshot viewer, and cover-flow interactions.

### Before installing

- The universal APK uses the Android debug build variant and is intended for testing. An installation signed with a different key must be removed first, which may erase local app data.
- Re:Port does not include game files. Requirements, availability, and device compatibility depend on the individual port project.
- Some metadata and artwork are incomplete, and screenshots may show a different version of a game.

[Download V1.0](https://github.com/Nazatric/Re-Port/releases/tag/v1.0)
