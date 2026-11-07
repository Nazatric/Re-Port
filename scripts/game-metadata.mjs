// Match original-game metadata conservatively: complete title, compatible source platform
// and (when known) a plausible release year. Never match remakes by fuzzy title.
export function metadataKey(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[™®©]/g, '').replace(/^the\s+/, '').replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
}

export function metadataGenres(raw) {
  const text = String(raw || '').toLowerCase();
  const genres = [];
  const add = (condition, id) => { if (condition) genres.push(id); };
  add(/\baction\b/.test(text), 'action');
  add(/\b(?:shooter|shooting|shoot.?em.?up)\b/.test(text), 'shooter');
  add(/\badventure\b|visual novel/.test(text), 'adventure');
  add(/role.playing|\brpg\b/.test(text), 'rpg');
  add(/platformer|platform game/.test(text), 'platformer');
  add(/\bracing\b/.test(text), 'racing');
  add(/\bstrategy\b/.test(text), 'strategy');
  add(/\bhorror\b/.test(text), 'horror');
  add(/\bfighting\b|beat.?em.?up/.test(text), 'fighting');
  add(/\bsimulation\b/.test(text) && !/\bracing\b/.test(text), 'simulation');
  add(/\bpuzzle\b/.test(text), 'puzzle');
  add(/\bsports\b/.test(text), 'sports');
  add(/\bsandbox\b/.test(text), 'sandbox');
  add(/\b(?:casual|party|pinball|music|rhythm)\b/.test(text), 'casual');
  return genres;
}

export function createMetadataIndex(rows) {
  const index = new Map();
  for (const row of rows || []) {
    const [title, platform, year, genre] = row;
    const key = metadataKey(title);
    if (key.length < 4) continue;
    const list = index.get(key) || [];
    list.push({ title, platform, year, genres: metadataGenres(genre) });
    index.set(key, list);
  }
  return index;
}

export function originalPlatforms(game, index) {
  // A release year is essential: a remake can share a name with the original.
  if (!game.year) return [];
  const rows = (index.get(metadataKey(game.title)) || []).filter((r) => r.year && Math.abs(game.year - r.year) <= 2);
  if (!rows.length) return [];
  const known = [game.platform, ...(game.platforms || [])].filter((p) => p && !['unknown', 'other', 'engine'].includes(p));
  // For an already-known platform, demand an independent match before adding other releases.
  if (known.length && !rows.some((r) => known.includes(r.platform))) return [];
  return [...new Set(rows.map((r) => r.platform))];
}

export function matchMetadata(game, index) {
  const platforms = new Set([game.platform, ...(game.platforms || [])].filter((p) => p && !['unknown', 'other', 'engine'].includes(p)));
  // With neither a platform nor a release year, the same title might be a different remake.
  if (!platforms.size && !game.year) return null;
  // When the source platform is unspecified, require all exact-title records to agree
  // on genre and release era instead of treating the game's platform as known.
  const matches = (index.get(metadataKey(game.title)) || []).filter((r) => (!platforms.size || platforms.has(r.platform)) && r.genres.length &&
    (!game.year || !r.year || Math.abs(game.year - r.year) <= 2));
  if (!matches.length) return null;
  const years = matches.map((r) => r.year).filter(Boolean);
  if (!game.year && years.length > 1 && Math.max(...years) - Math.min(...years) > 2) return null;
  // Conflicting rows for a title/platform are ambiguous; do not silently choose one.
  const sets = new Set(matches.map((r) => [...r.genres].sort().join(',')));
  if (sets.size !== 1) return null;
  return { genres: matches[0].genres, source: 'OpenGameDB' };
}
