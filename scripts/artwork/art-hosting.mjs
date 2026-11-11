/** Where the build-time artwork lives: GitHub release assets, sharded so each release stays well under
 *  GitHub's 1000-asset limit. The tag for a file is a stable hash of its name, so every build agrees. */
export const ART_REPO = "Nazatric/Re-Port";
export const ART_SHARDS = 8;

const safe = (s) => String(s).toLowerCase().replace(/[^a-z0-9-]+/g, "-");

export const artFileName = (gameId, kind) => `${safe(gameId)}-${kind}.webp`;

export function artTag(name) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619) >>> 0;
  return `art-${h % ART_SHARDS}`;
}

export const artUrl = (name) => `https://github.com/${ART_REPO}/releases/download/${artTag(name)}/${name}`;
