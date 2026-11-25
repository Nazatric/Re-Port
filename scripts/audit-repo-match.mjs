// For every APK-claiming port: does the repository (name, description or README) name the game?
// Usage: node scripts/audit-repo-match.mjs <apk-claims.json from audit-apk-claims.mjs> [outFile]
import { readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
const claims = JSON.parse(await readFile(process.argv[2], "utf8"));

const norm = (s) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
const stop = new Set(["the", "a", "an", "of", "and", "edition", "remastered", "remake", "version", "for", "in", "to", "game"]);
// Title with the subtitle split off ("Spider-Man: Edge of Time" -> "spider man"), so both halves count.
const titleForms = (title) => {
  const base = title.replace(/\(.*?\)/g, " ");
  const forms = new Set([norm(base), norm(base.split(/[:\-–—]/)[0])]);
  return [...forms].filter((f) => f.length >= 3);
};
const words = (title) => norm(title).split(" ").filter((w) => w.length > 2 && !stop.has(w));

async function gh(path) {
  try { const { stdout } = await run("gh", ["api", path], { maxBuffer: 20 * 1024 * 1024 }); return JSON.parse(stdout); } catch { return null; }
}
const repoOfUrl = (u) => { const m = /github\.com\/([^/]+)\/([^/#?]+)/.exec(u || ""); return m ? [m[1], m[2].replace(/\.git$/, "")] : null; };

const okRows = claims.results.filter((r) => r.verdict === "apk-ok" || r.verdict === "apk-in-other-release" || r.verdict === "archived");
const repos = new Map();
for (const r of okRows) { const k = repoOfUrl(r.url); if (k) repos.set(k.join("/").toLowerCase(), k); }
const info = new Map();
let i = 0;
const list = [...repos.values()];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (i < list.length) {
    const [o, r] = list[i++];
    const meta = await gh(`repos/${o}/${r}`);
    const readme = await gh(`repos/${o}/${r}/readme`);
    const text = readme?.content ? Buffer.from(readme.content, "base64").toString("utf8") : "";
    info.set(`${o}/${r}`.toLowerCase(), { desc: meta?.description ?? "", name: r, text: text.slice(0, 20000) });
  }
}));

const verdicts = okRows.map((r) => {
  const k = repoOfUrl(r.url);
  const meta = info.get(k.join("/").toLowerCase()) ?? { desc: "", name: "", text: "" };
  const hay = norm(`${meta.name} ${meta.desc} ${meta.text}`);
  const forms = titleForms(r.title);
  const titleHit = forms.some((f) => hay.includes(f) || hay.split(" ").join(" ").includes(f));
  const ws = words(r.title);
  const wordHit = ws.length > 0 && ws.every((w) => hay.includes(w));
  return { ...r, match: titleHit ? "title" : wordHit ? "words" : "none" };
});
const counts = {};
for (const v of verdicts) counts[v.match] = (counts[v.match] ?? 0) + 1;
const out = { generated: new Date().toISOString(), counts, none: verdicts.filter((v) => v.match === "none").map(({ gameId, title, port, url, download, verdict, apks, releaseTag }) => ({ gameId, title, port, url, download, verdict, apks, releaseTag })) };
const file = process.argv[3] ?? "/tmp/repo-match.json";
await writeFile(file, JSON.stringify(out, null, 1) + "\n");
console.log(JSON.stringify(counts));
