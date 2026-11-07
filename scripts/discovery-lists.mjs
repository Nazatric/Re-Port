import { githubRepo } from './android-policy.mjs';

// These feeds are discovery leads, NOT evidence of Android support. Keep only factual identifiers,
// original-platform hints and attribution; their generated prose, ratings and claimed download
// counts are not copied. Every GitHub repo is independently verified before import.
export const DISCOVERY_SOURCES = [
  { id: 'droid-recomp', name: 'DroidRecomp', url: 'https://raw.githubusercontent.com/MooPuu/droid-recomp/main/catalog.json', sourceUrl: 'https://github.com/MooPuu/droid-recomp', license: 'MIT' },
  { id: 'android-ports-master', name: 'Android Ports Master', url: 'https://raw.githubusercontent.com/keika-sy/android-ports-master/main/data/ports.json', sourceUrl: 'https://github.com/keika-sy/android-ports-master', license: 'not specified' },
  { id: 'porthub', name: 'PortHub Catalog', url: 'https://raw.githubusercontent.com/orev7s/porthub-catalog/main/games.json', sourceUrl: 'https://github.com/orev7s/porthub-catalog', license: 'source-dependent; OpenPortsGames CC BY 4.0' },
  { id: 'porting-room', name: 'Porting Room', url: 'https://raw.githubusercontent.com/vimehub/porting-room/main/games.json', sourceUrl: 'https://github.com/vimehub/porting-room', license: 'not specified' },
];

function rootGitHub(input) {
  const cleaned = String(input || '').trim().replace(/[.,)]+$/, '');
  const repo = githubRepo(cleaned);
  if (!repo) return '';
  try {
    const u = new URL(cleaned), parts = u.pathname.split('/').filter(Boolean);
    return `https://github.com/${parts[0]}/${parts[1].replace(/\.git$/i, '')}`;
  } catch { return ''; }
}

export function normalizeDiscovery(id, data) {
  let candidates = [];
  if (id === 'android-ports-master' && Array.isArray(data)) {
    candidates = data.map((r) => ({ title: r.game, project: r.project, platform: r.platform, url: r.url }));
  } else if (id === 'porthub' && Array.isArray(data?.games)) {
    candidates = data.games.filter((r) => r.android?.supported === true).map((r) => ({ title: r.originalTitle || r.title, project: r.title, platform: r.platforms?.[0], year: r.year, url: r.links?.repo }));
  } else if (id === 'droid-recomp' && Array.isArray(data?.apps)) {
    candidates = data.apps.map((r) => ({ title: r.game, project: r.name, platform: r.origin, url: r.repo_url }));
  } else if (id === 'porting-room' && Array.isArray(data?.games)) {
    candidates = data.games.flatMap((r) => (r.ports || []).filter((p) => /\bandroid\b/i.test(p.platform || '')).map((p) => ({ title: r.name, project: p.name, platform: r.platform, year: r.year, url: p.url })));
  }
  const out = [], seen = new Set();
  for (const candidate of candidates) {
    const url = rootGitHub(candidate.url);
    const title = String(candidate.title || '').trim().replace(/\s+/g, ' ');
    if (!url || !title || title.length > 160 || /^(?:awesome-|list of |(?:game )?(?:engines?|launchers?|emulators?|frameworks?)\b)/i.test(title)) continue;
    const key = `${title.toLowerCase()}|${url.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const year = Number(candidate.year);
    out.push({ title, project: String(candidate.project || '').trim().slice(0, 160), platform: String(candidate.platform || '').trim().slice(0, 80), year: year >= 1970 && year <= 2030 ? year : 0, url });
  }
  return out;
}
