/* Source-platform means the ORIGINAL game platform; it is not proof of an Android target. */
export function githubRepo(url) {
  try {
    const u = new URL(url);
    if (u.hostname.toLowerCase() !== 'github.com') return '';
    const parts = u.pathname.split('/').filter(Boolean);
    return parts.length >= 2 ? `${parts[0]}/${parts[1].replace(/\.git$/i, '')}`.toLowerCase() : '';
  } catch { return ''; }
}

/** An actual Android package, not OBB data, CPU architecture, a Windows EXE or an iOS IPA. */
export const isAndroidPackage = (name) => /\.(?:apk|apks|xapk)$/i.test(String(name || ''));

/** Strong, directional statements about a target, not generic ARM64 or an Android original. */
export function explicitAndroidTarget(text) {
  const s = String(text || '').replace(/\s+/g, ' ');
  if (/\b(?:not|no|without) (?:yet )?(?:support(?:ed)? (?:for )?|available (?:for )?)?android\b|\bandroid (?:support|version|port|build) (?:is )?(?:planned|coming|not (?:yet )?(?:available|supported)|unavailable)\b/i.test(s)) return false;
  if (/\b(?:port|remake|recompilation) of (?:the )?android (?:version|build|game)\b/i.test(s)) return false;
  return /\bandroid(?:\s*[/,&]\s*(?:ios|windows|linux|macos))*\s+port\b|\b(?:for|on|to|supports?|targets?|runs? on|running on|available (?:on|for))\s+(?:native\s+)?android\b|\bandroid\s+(?:and\s+(?:windows|ios|linux|macos|desktop)|port|build|version|release|apk|app|support|target|phones|devices|project)\b/i.test(s);
}

/** Reject a link to a specific non-Android package/store even if the wider project is multiplatform. */
export function nonAndroidLink(url) {
  try {
    const u = new URL(url);
    if (['hrydgard/ppsspp', 'flyinghead/flycast'].includes(githubRepo(url))) return true;
    if (/(^|\.)(?:apps\.apple\.com|itunes\.apple\.com|dos\.zone)$/.test(u.hostname.toLowerCase())) return true;
    if (/\.(?:ipa|exe|msi|dmg|appimage)(?:$|[?#])/i.test(u.pathname + u.search)) return true;
    return /(?:^|[\/_-])(?:ios|iphone|ipad)(?:$|[\/_-])/i.test(u.pathname) && !/android/i.test(u.pathname);
  } catch { return true; }
}

export function documentedEvidence({ url, text = '', repoEvidence = {}, list = '' }) {
  if (nonAndroidLink(url)) return '';
  const repo = githubRepo(url);
  const ev = repo ? repoEvidence[repo] : null;
  if (ev?.missing) return '';
  if (ev?.apkEvidenceVersion === 1 && ev.hasApk && ev.apkAssets > 0) return 'github-apk';
  if (ev?.androidReadme === true) return 'github-readme';
  if (repo) return ''; // GitHub research candidates need direct project evidence.
  if (explicitAndroidTarget(text)) return list === 'Awesome Android Native Ports' ? 'android-list' : 'source-android';
  return '';
}

/** OpenPortsGames describes destination platforms, unlike a game's original platform. */
export function openPortsEvidence(port, repoEvidence = {}) {
  const url = (port.sources || []).find((s) => /^https?:\/\//i.test(s)) || '';
  if (!Array.isArray(port.platforms) || !port.platforms.some((p) => String(p).toLowerCase() === 'android')) return '';
  if (nonAndroidLink(url)) return '';
  const ev = repoEvidence[githubRepo(url)];
  if (ev?.missing) return '';
  // A mixed-platform index is a discovery lead, not independent project proof.
  if (githubRepo(url) && !(ev?.apkEvidenceVersion === 1 && ev.hasApk && ev.apkAssets > 0) && !ev?.androidReadme) return '';
  if (!githubRepo(url) && !/(?:play\.google\.com|f-droid\.org|\.apk(?:$|[?#])|android)/i.test(url)) return '';
  const text = [port.title, port.notes, port.warning].filter(Boolean).join(' ');
  if (/\b(?:not|without) (?:yet )?(?:available (?:for )?|support(?:ed)? (?:for )?)?android\b|android (?:port|build|support) (?:is )?(?:planned|not available|not supported)\b/i.test(text)) return '';
  return ev?.apkEvidenceVersion === 1 && ev.hasApk && ev.apkAssets > 0 ? 'github-apk' : ev?.androidReadme ? 'github-readme' : 'openports-android';
}

/** The primary URL, metadata and siblings must be drawn from the same ranking. */
export function rankPorts(ports) {
  const rank = (p) => (p.downloads || 0) * 100 + (p.stars || 0) + (p.source === 'OpenPortsGames' ? 3 : 0);
  return ports.slice().sort((a, b) => rank(b) - rank(a));
}

export function readmeAndroidLine(content, key) {
  const text = Buffer.from(content || '', 'base64').toString('utf8');
  // Ports of an Android original *to* another device are the opposite direction.
  if (/(?:wrapper|port)\s*\/?.{0,20}\b(?:of|from)\b.{0,80}android.{0,80}\b(?:ps vita|playstation vita|nintendo switch)\b/i.test(text.slice(0, 1200))) return '';
  const beginning = text.slice(0, 4000).replace(/\s+/g, ' ');
  if (/not enough.{0,60}usable state|(?:might )?not (?:yet )?be buildable|not (?:yet )?buildable|android.{0,100}(?:not yet public|not (?:yet )?available|not supported)|ports? (?:for )?.{0,100}android.{0,100}in development.{0,250}not included in the current public version/i.test(beginning)) return '';
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/[*_`]/g, '').trim();
    if (!/\bandroid\b/i.test(line) || /^[-*]\s*\[ \]/.test(line)) continue;
    const context = `${line} ${lines[i + 1] || ''} ${lines[i + 2] || ''}`;
    if (/android.{0,160}(?:dosbox|emulat(?:or|ion)|msdos|chrome|browser)|(?:dosbox|emulat(?:or|ion)).{0,100}android|last android release|drop your .{0,80}apk|android version(?:'s)? (?:data|release)/i.test(context)) continue;
    const external = /https?:\/\/github\.com\/[^\s)<>]+/i.exec(line)?.[0];
    const nextExternal = /https?:\/\/github\.com\/[^\s)<>]+/i.exec(context)?.[0];
    if (external && githubRepo(external) !== key && /\bfork\b/i.test(line)) continue;
    if ((/^[-*]?\s*\[android port\]/i.test(line) || /^\|\s*android\b/i.test(line) || /^(?:there.?s|there is) an android port/i.test(line)) && (external || nextExternal) && githubRepo(external || nextExternal) !== key) continue;
    if (/\b(?:no|not|without)\b.{0,35}\bandroid\b|\bandroid\b.{0,30}\b(?:not supported|not available|planned|coming soon)\b/i.test(context)) continue;
    if (explicitAndroidTarget(line) || /^(?:#+\s*android(?:\s+(?:build|install|support|instructions|setup))?\s*$|\|\s*android\s*(?:\([^)]*\))?\s*\|)/i.test(line)) return line.slice(0, 240);
  }
  return '';
}
