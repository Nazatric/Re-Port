export type LinkKind =
  | 'github'
  | 'telegram'
  | 'discord'
  | 'playstore'
  | '4pda'
  | 'itch'
  | 'reddit'
  | 'gitlab'
  | 'fdroid'
  | 'gamejolt'
  | 'archive'
  | 'gamebanana'
  | 'site'
  | 'mirror'
  | 'web';

export type FilesNeeded = 'none' | 'rom' | 'files' | 'app';
export type WorksFlag = 'yes' | 'bug' | 'no';
export type ControllerFlag = 'both' | 'controller' | 'touch';
export type Status = 'working' | 'bugs' | 'untested' | 'broken';

export interface Port {
  name?: string;
  developer?: string;
  /** Source console/platform this particular port targets. */
  platform?: string;
  /** All source platforms when one project covers multiple releases. */
  platforms?: string[];
  kind: LinkKind;
  url: string;
  download: string;
  version?: string;
  updated?: string;
  added?: string;
  files?: FilesNeeded;
  filesNote?: string;
  works?: WorksFlag;
  controller?: ControllerFlag;
  notes?: string;
  instructions?: string;
  paid?: boolean;
  mirror?: boolean;
  views?: number;
  downloads?: number;
  stars?: number;
  /** Verified against GitHub releases: the project publishes an Android package. */
  apk?: boolean;
  lifecycle?: 'active' | 'experimental' | 'paused' | 'discontinued';
  engine?: string;
  source?: string;
  /** Why this specific port is included in the Android catalog. */
  androidEvidence?: 'napl-list' | 'github-apk' | 'github-readme' | 'openports-android' | 'source-android';
}

export interface SteamInfo {
  id: number;
  shots: string[];
  dev?: string;
}

export interface Game {
  id: string;
  title: string;
  year?: number;
  platform: string;
  platforms?: string[];
  genres: string[];
  /** Source of independently matched original-game genre metadata, when known. */
  genreSource?: string;
  summary: string;
  description: string;
  cover?: string;
  /** Additional platform-matched artwork, used when the preferred cover fails. */
  coverFallback?: string;
  launchbox?: string;
  descSource?: string;
  steam?: SteamInfo;
  /** Screenshots supplied by projects or other catalog artwork sources. */
  shots?: string[];
  shotNote?: string;
  updated?: string;
  added?: string;
  views: number;
  ports: Port[];
  supports?: string[];
}

export interface Platform {
  id: string;
  name: string;
  short: string;
  count: number;
}

export interface Collection {
  id: string;
  name: string;
  blurb: string;
}

export interface Catalog {
  androidPolicy?: number;
  generated: string;
  /** Monotonic build id, used to detect a genuinely newer published copy. */
  revision?: string;
  /** Upstream lists this catalog was built from. */
  sources?: string[];
  /** When the upstream lists were last fetched. */
  upstreamSyncedAt?: string;
  stats: Record<string, number>;
  platforms: Platform[];
  collections: Collection[];
  games: Game[];
}

export type SortKey = 'popular' | 'updated' | 'added' | 'title' | 'year';

export interface Filters {
  q: string;
  genre: string;
  platform: string;
  list: string;
  source: string;
  works: string;
  files: string;
  controller: string;
  sort: SortKey;
}

export type ThemeId = 'system' | 'lime' | 'azure' | 'graphite';

export interface Settings {
  theme: ThemeId;
  text: 0 | 1 | 2;
  motion: 'system' | 'reduce' | 'full';
  contrast: boolean;
  dataSaver: boolean;
  haptics: boolean;
  view: 'grid' | 'list';
}
