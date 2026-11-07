import fs from 'node:fs';

/** Read only the game tables, not the readme's unrelated tools, links or navigation. */
export function androidListRows(file) {
  if (!fs.existsSync(file)) return [];
  const out = [];
  let section = '';
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const heading = /^##\s+(.+)/.exec(line);
    if (heading) section = heading[1];
    if (!section || /^(?:contents|tools|related lists|contributing|disclaimer|credits)/i.test(section)) continue;
    const match = /^\|\s*\[([^\]]+)\]\((https?:\/\/[^)]+)\)\s*\|\s*([^|]+)\|/.exec(line);
    if (!match) continue;
    const [, label, url, description] = match;
    // Broad engines and multi-title collections cannot safely be represented as one game.
    if (/\b(?:games|and more|collection|series|various|engines)\b/i.test(label)) continue;
    const parenthetical = /\s+\(([^)]+)\)$/.exec(label);
    const project = parenthetical && !/^\d{4}$/.test(parenthetical[1]) ? parenthetical[1] : '';
    const title = project ? label.slice(0, parenthetical.index).trim() : label;
    out.push({ title, project, url, description: description.trim(), list: 'Awesome Android Native Ports' });
  }
  return out;
}
