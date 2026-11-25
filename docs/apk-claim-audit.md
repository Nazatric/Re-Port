# APK claim audit

Checked against the GitHub API (`scripts/audit-apk-claims.mjs`, `scripts/audit-repo-match.mjs`). Every catalog port with `apk: true` was checked: does its download release contain a `.apk` file, and does the repository name, description or README name the game?

## Results (before the fix)

| Result | Ports |
|---|---|
| apk-ok | 623 |
| archived | 40 |
| release-without-apk | 3 |
| repo-missing | 6 |
| apk-in-other-release | 5 |

Repository-name match: title 563, none 68, words 37 (the `none` group is listed below for review).

## Fixed

- Download pointed at the newest release that carries an APK (8 ports): Belthasar, PrimeRecomp, Pokewilds (2 entries), vs-smb-recomp, T6 Requiem, Xrevive, OpenRAC launcher.
- Spider-Man: Edge of Time (Project 2099): download now links straight to `Project2099-Android-Beta1.apk`. The APK exists in release `android-v1.0.0-beta.1`, but the README says the game data must come from the player.
- Sonic the Hedgehog (2006): the Marathon test-edition repo no longer exists; replaced with `SansNope/MarathonRecomp-Android` (APK in v0.3.4.1).
- Zuma Deluxe: removed the dead ZumaPortable repo; the Android port stays.
- Removed four games whose only repo is gone and no replacement was found: Casualties: Unknown, Metroid Prime, Metroid Prime 2: Echoes, The Dishwasher: Dead Samurai. Catalog is now 901 games.

## Kept after review

Multi-game engines and packs (IdTech4A++, Classic Core Engines, Shipwright and 2 Ship 2 Harkinian, Stratagus, Xash3D, RSDK, Starship, SpaghettiKart, CPyMO) are real APK ports that run several games. Archived repos still host working APKs and are kept.

## Repository-name review list (`none`)

- Chex Quest | IdTech4A++ | https://github.com/glKarin/com.n0n3m4.diii4a
- Chex Quest 2 | IdTech4A++ | https://github.com/glKarin/com.n0n3m4.diii4a
- Chex Quest 3 | IdTech4A++ | https://github.com/glKarin/com.n0n3m4.diii4a
- Command & Conquer: Generals: Zero Hour | SandboxRTS-Android | https://github.com/ramazangithub/SandboxRTS-Android
- Day Of Defeat Classic | Xash3D FWGS | https://github.com/fwgs/xash3d-fwgs
- Final Doom - Evilution | IdTech4A++ | https://github.com/glKarin/com.n0n3m4.diii4a
- Final Doom - The Plutonia Experiment | IdTech4A++ | https://github.com/glKarin/com.n0n3m4.diii4a
- Gameplay Football | Blurz Native Football | https://github.com/kinopiowarrior/StarDroid
- Grand Theft Auto III | re3 Frosted Winter Port (experimental) | https://github.com/codepdbh/re3-frosted-winter-port-experimental
- Grand Theft Auto V | XHYN V | https://github.com/XHYN-PH/XHYN-V-reborn
- HacX | IdTech4A++ | https://github.com/glKarin/com.n0n3m4.diii4a
- Heretic: Shadow of the Serpent Riders | IdTech4A++ | https://github.com/glKarin/com.n0n3m4.diii4a
- Hexen II: Mission Pack – Portal of Praevus | IdTech4A++ | https://github.com/glKarin/com.n0n3m4.diii4a
- Majora's Mask | 2 Ship 2 Harkinian, linkzenic fork | https://github.com/linkzenic/2ship2harkinian-Android
- Majora's Mask | linkzenic | https://github.com/linkzenic/Zelda64Recomp-Android
- Marathon 2: Durandal | Aleph One | https://github.com/daniele-rapagnani/alephone-android
- Marathon Infinity | Aleph One | https://github.com/daniele-rapagnani/alephone-android
- Mario Kart 64 | SpaghettiKart (Android) | https://github.com/izzy2lost/SpaghettiKart
- Master Levels for Doom II | IdTech4A++ | https://github.com/glKarin/com.n0n3m4.diii4a
- OpenArena | IdTech4A++ | https://github.com/glKarin/com.n0n3m4.diii4a
- Pokémon HeartGold | HeartSoulRecomp | https://github.com/aabrole/HeartSoulRecomp
- Pokémon SoulSilver | HeartSoulRecomp | https://github.com/aabrole/HeartSoulRecomp
- Quake Mission Pack 1: Scourge of Armagon | IdTech4A++ | https://github.com/glKarin/com.n0n3m4.diii4a
- Quake Mission Pack 2: Dissolution of Eternity | IdTech4A++ | https://github.com/glKarin/com.n0n3m4.diii4a
- Quake Mission Pack 3: Dimension of the Past | IdTech4A++ | https://github.com/glKarin/com.n0n3m4.diii4a
- Samurai vs. Zombies Defense | Decomp-And-Recomp | https://github.com/Decomp-And-Recomp/Samurai-Vs-Zombies
- SEGA Rally Championship | Sega Rally (Port0r) | https://github.com/jacquesdupontd/port0r
- Sonic the Hedgehog 1 and 2 | Retro Engine v4 | https://github.com/RSDKModding/RSDKv4-Decompilation
- Spear of Destiny | IdTech4A++ | https://github.com/glKarin/com.n0n3m4.diii4a
- Star Fox 64 | Starship (Android) | https://github.com/izzy2lost/Starship
- Strife: Veteran Edition | IdTech4A++ | https://github.com/glKarin/com.n0n3m4.diii4a
- The Elder Scrolls III: Morrowind | OpenMW Android | https://github.com/Sisah2/openmw-android
- The Legend of Zelda: A Link to the Past | Zelda3Launcher | https://github.com/Waterdish/zelda3-android
- The Legend of Zelda: Majora's Mask | 2 Ship 2 Harkinian (Android) | https://github.com/linkzenic/2ship2harkinian-Android
- The Legend of Zelda: Majora's Mask | Zelda64 Recompiled (Android) | https://github.com/linkzenic/Zelda64Recomp-Android
- The Legend of Zelda: Majora's Mask | 2 Ship 2 Harkinian (Outdated) | https://github.com/Waterdish/2ship2harkinian-Android
- The Legend of Zelda: Majora's Mask | 2 Ship 2 Harkinian (2s2h) | https://github.com/Jameriquiah/2ship2harkinian
- The Legend of Zelda: Majora's Mask 3D | Majora ReMasked | https://github.com/OTPR26/DekUI-Fork
- The Legend of Zelda: Ocarina of Time | Shipwright Android (Outdated) | https://github.com/Waterdish/Shipwright-Android
- The Legend of Zelda: Ocarina of Time | Ship of Harkinian (Android) | https://github.com/linkzenic/Shipwright-Ports
- The Legend of Zelda: Ocarina of Time | Shipwright Android | https://github.com/please-be-nice/Shipwright-android
- The Legend of Zelda: Ocarina of Time 3D | Ocarina ReTuned (GitHub) | https://github.com/OTPR26/Ocarina-ReTuned
- The Legend of Zelda: Twilight Princess | Dusklight | https://github.com/TwilitRealm/dusklight
- The Legend of Zelda: Twilight Princess | Twilight Princess (Dusklight Dual Screen) | https://github.com/igawa6/dusklight
- They Hunger | Xash3D FWGS | https://github.com/fwgs/xash3d-fwgs
- Ultimate Spider-Man Total Mayhem | Spider-Man Total Mayhem Revived | https://github.com/RedMemories/SpiderManTotalMayhem
- Visual novels | CPyMO | https://github.com/Strrationalism/CPyMO
- Warcraft II: Beyond The Dark Portal | Stratagus | https://github.com/drodin/Stratagus
- Warcraft II: Tides of Darkness | Warcraft II (Android) | https://github.com/blairisme/warcraft
- Warcraft II: Tides of Darkness | Stratagus | https://github.com/drodin/Stratagus
- Warcraft: Orcs & Humans | Stratagus (Warcraft: Orcs & Humans) | https://github.com/drodin/Stratagus
- Chex Quest | Chex Quest (Classic Core Engines) | https://github.com/sandstranger/com.mobilerpgpack.phone
- Chex Quest 3 | Classic Core Engines | https://github.com/sandstranger/com.mobilerpgpack.phone
- Classic Core Engines | Classic Core Engines | https://github.com/sandstranger/com.mobilerpgpack.phone
- Final Doom - Evilution | Classic Core Engines | https://github.com/sandstranger/com.mobilerpgpack.phone
- Final Doom - The Plutonia Experiment | Classic Core Engines | https://github.com/sandstranger/com.mobilerpgpack.phone
- Final Doom (Playstation) | Final Doom (PlayStation, Classic Core Engines) | https://github.com/sandstranger/com.mobilerpgpack.phone
- HacX | HacX (Classic Core Engines) | https://github.com/sandstranger/com.mobilerpgpack.phone
- Heretic: Shadow of the Serpent Riders | Heretic (Classic Core Engines) | https://github.com/sandstranger/com.mobilerpgpack.phone
- Hexen II: Mission Pack – Portal of Praevus | Hexen II: Portal of Praevus (Classic Core Engines) | https://github.com/sandstranger/com.mobilerpgpack.phone
- OpenArena | OpenArena (Classic Core Engines) | https://github.com/sandstranger/com.mobilerpgpack.phone
- Quake II Mission Pack: Ground Zero | Classic Core Engines | https://github.com/sandstranger/com.mobilerpgpack.phone
- Quake II Mission Pack: The Reckoning | Classic Core Engines | https://github.com/sandstranger/com.mobilerpgpack.phone
- Quake III Arena | Quake III Arena (Classic Core Engines) | https://github.com/sandstranger/com.mobilerpgpack.phone
- Quake Mission Pack 1: Scourge of Armagon | Quake: Scourge of Armagon (Classic Core Engines) | https://github.com/sandstranger/com.mobilerpgpack.phone
- Quake Mission Pack 2: Dissolution of Eternity | Quake: Dissolution of Eternity (Classic Core Engines) | https://github.com/sandstranger/com.mobilerpgpack.phone
- Quake Mission Pack 3: Dimension of the Past | Classic Core Engines | https://github.com/sandstranger/com.mobilerpgpack.phone
- Widelans | Classic Core Engines | https://github.com/sandstranger/com.mobilerpgpack.phone

Not verified from the sandbox: non-GitHub links (Telegram, itch.io, mirrors), and whether each APK installs and runs.
