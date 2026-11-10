# Changelog

## 1.1.0

### New
- **Languages:** Settings → Language with English (default), Español, Português, हिन्दी and 中文. All interface text, dates and filter labels follow the chosen language. Game titles and catalog descriptions stay in their original language.
- **Night Aero theme:** AMOLED variant (pure black, default) and a Normal blue Aero variant.
- **Cover flow:** shows 8 random featured games, changing automatically every hour.
- **Artwork:** missing covers are looked up at runtime from keyless sources; verified Libretro and PortHub-feed covers added.
- **Catalog:** 907 games and 1,130 ports. New verified native Android ports include Mickey & Donald Collection, Persona Q/Q2, San Francisco Rush 2049, Contra: Legacy of War, Fallout: New Vegas (recomp), Sonic P-06, Wind Waker HD, DKC2, Super Smash Bros. Ultimate (recomp), Noita, Parasite Eve 1/2, Persona 1/2, Tomba 1/2 and more.
- **Local views:** real on-device view counts; sort and filter by your views and by Metascore.
- **Update checker:** Settings → App update checks GitHub releases, with loading, new-version, up-to-date and error states.

### Changed
- Metacritic scores are labelled "Metascore"; prices removed everywhere.
- Display name is optional and no longer requested on first launch; edit it in Settings.
- Home collection cards show real cover previews.

### Performance
- First visits to Browse, Library and Settings are faster: screens are prepared in the background after launch.
- Theme switching and opening detail pages with large media are lighter.
- Update check result is cached for 10 minutes.

### Fixed
- Android CI: smoke tests updated for the current theme and profile flow.
- CI runs cancel superseded builds and cache the Playwright browser (about 5 minutes down to about 2).

### Notes
- Re:Port is a directory. It does not bundle game data, ROMs or keys.
- Android APK is a debug-signed build from GitHub Actions.
