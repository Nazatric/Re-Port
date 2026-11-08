import type { Game, Port } from './types';

/**
 * Every remote picture goes through the wsrv.nl image CDN so it is resized and sent as WebP.
 * That keeps data use small and lets the service worker cache real (non-opaque) responses.
 */
const PROXY = 'https://wsrv.nl/';

export function proxied(url: string, width: number, quality = 80): string {
  return `${PROXY}?url=${encodeURIComponent(url)}&w=${Math.round(width)}&output=webp&q=${quality}&we`;
}

export function srcSetFor(url: string, widths: number[], quality = 80): string {
  return widths.map((w) => `${proxied(url, w, quality)} ${w}w`).join(', ');
}

const STEAM = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps';
export const steamCapsule = (id: number) => `${STEAM}/${id}/library_600x900.jpg`;
export const steamCapsule2x = (id: number) => `${STEAM}/${id}/library_600x900_2x.jpg`;
export const steamHero = (id: number) => `${STEAM}/${id}/library_hero.jpg`;
export const steamHeader = (id: number) => `${STEAM}/${id}/header.jpg`;

export interface ImageCandidate {
  src: string;
  srcSet?: string;
  cors: boolean;
}

export const COVER_WIDTHS = [240, 420, 600, 900, 1200];

/**
 * Cover candidates, best first.
 * Large slots (cover flow, detail page) try the full-resolution original before any resized copy,
 * because the resized copy was the source of the soft covers. Small grid cards use the resized copy.
 * Every candidate is retried once by the component before the next one is tried.
 */
export function coverCandidates(g: Game, maxWidth = 360): ImageCandidate[] {
  const list: ImageCandidate[] = [];
  const large = maxWidth >= 360;
  const widths = COVER_WIDTHS.filter((w) => w <= Math.max(maxWidth, 240) * 2.5);
  const launch = g.cover || '';
  // Generated title cards are a fallback, not a replacement for real Steam artwork.
  const generated = /\/covers\/generated\/[^/]+\.svg(?:\?|$)/i.test(launch);
  if (large && launch && !generated) list.push({ src: launch, cors: false });
  if (launch && !generated) list.push({ src: proxied(launch, maxWidth, 90), srcSet: srcSetFor(launch, widths, 90), cors: true });
  if (g.steam) {
    const hi = steamCapsule2x(g.steam.id);
    const lo = steamCapsule(g.steam.id);
    list.push({ src: proxied(hi, maxWidth, 90), srcSet: srcSetFor(hi, widths, 90), cors: true });
    list.push({ src: proxied(lo, maxWidth, 90), cors: true });
    list.push({ src: lo, cors: false });
  }
  if (launch && !large && !generated) list.push({ src: launch, cors: false });
  if (g.coverFallback && g.coverFallback !== launch) {
    list.push({ src: proxied(g.coverFallback, maxWidth, 90), srcSet: srcSetFor(g.coverFallback, widths, 90), cors: true });
    list.push({ src: g.coverFallback, cors: false });
  }
  if (launch && generated) list.push({ src: launch, cors: false });
  return list;
}

/** Adds a harmless cache-buster so a transient network failure can be retried once. */
export function retryUrl(src: string): string {
  return `${src}${src.includes('?') ? '&' : '?'}retry=1`;
}

export function heroCandidates(g: Game, width = 1000): ImageCandidate[] {
  const list: ImageCandidate[] = [];
  if (g.steam) {
    const originals = [steamHero(g.steam.id), steamHeader(g.steam.id), g.steam.shots[0]].filter((url): url is string => Boolean(url));
    for (const original of originals) {
      list.push({ src: proxied(original, width, 82), cors: true });
      list.push({ src: original, cors: false });
    }
  }
  return list;
}

export function avatarSrc(owner: string, size = 96): string {
  return proxied(`https://github.com/${owner}.png`, size, 85);
}

export function portAvatarOwner(p: Port): string {
  try {
    const u = new URL(p.url);
    if (u.host === 'github.com') return u.pathname.split('/').filter(Boolean)[0] || '';
  } catch {
    /* ignore */
  }
  return '';
}

/** Poly Haven (CC0) sky used as hero backdrop. Falls back to pure CSS gradients when offline. */
export const SKY_URL = 'https://cdn.polyhaven.com/asset_img/thumbs/kloofendal_48d_partly_cloudy_puresky.png?width=1024';
export const skySrc = (w = 900) => proxied(SKY_URL, w, 68);

/** Collect only real catalog images, preserving the curated source order and removing duplicates. */
export function gameScreenshots(game: Game): string[] {
  const urls = [...(Array.isArray(game.shots) ? game.shots : []), ...(Array.isArray(game.steam?.shots) ? game.steam.shots : [])];
  return [...new Set(urls.filter((url): url is string => typeof url === 'string' && /^https:\/\//i.test(url)))];
}
