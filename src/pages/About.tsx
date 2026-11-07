import { Icon } from '../components/Icons';
import { Hero, BackButton } from '../components/ui';
import { Link } from '../lib/router';
import { catalog } from '../lib/catalog';

const CREDITS: [string, string, string][] = [
  ['NAPL, the Native Android Port List', 'Community-maintained sheet of ports, links, versions and compatibility notes.', 'https://fe2rr.github.io/index.html'],
  ['Awesome Android Native Ports', 'Curated list by abduznik covering source ports, decompilations and static recompilations.', 'https://github.com/abduznik/awesome-android-native-ports'],
  ['Reddit port lists', 'Community tips from SBCGaming and AndroidGaming, checked against developer releases before inclusion.', 'https://www.reddit.com/r/SBCGaming/comments/1tlanti/created_a_list_of_unofficial_android_ports/'],
  ['ProtoDroid', 'Current native Android port of Prototype by Nazatric; replaces the older discontinued ProtoRe listing.', 'https://github.com/Nazatric/ProtoDroid'],
  ['LibertyRecompAndroid', 'Android release and status notes for the Xbox 360 recompilation of Grand Theft Auto IV.', 'https://github.com/vaduur/LibertyRecompAndroid'],
  ['Open Nectar', 'Native Pikmin and Pikmin 2 Android releases, validated against the project README.', 'https://github.com/SSunnKing/Open-Nectar---Pikmin-Native-PC-Mobile-Port'],
  ['LaunchBox Games Database', 'Box art, release years and descriptions for most entries.', 'https://gamesdb.launchbox-app.com/'],
  ['Steam', 'Library artwork and screenshots for PC games that match by exact title.', 'https://store.steampowered.com/'],
  ['Wikipedia and Wikidata', 'Cover art, summaries (CC BY-SA 4.0) and genres for list imports.', 'https://www.wikipedia.org/'],
  ['Poly Haven', 'CC0 sky photography used behind the page headers.', 'https://polyhaven.com/'],
  ['GitHub', 'Developer avatars and live release details through the public API.', 'https://github.com/'],
  ['wsrv.nl', 'Image CDN that resizes artwork to WebP so it loads fast and stays small.', 'https://wsrv.nl/'],
  ['Open Sans', 'Typeface, SIL Open Font License, bundled with the app.', 'https://fontsource.org/fonts/open-sans'],
];

export default function About() {
  return (
    <>
      <Hero title="About" left={<BackButton fallback="/settings" />} />
      <main id="main" tabIndex={-1} className="wrap safe-bottom -mt-4 space-y-6 outline-none">
        <section className="panel space-y-3 p-4 text-[0.95rem] leading-relaxed">
          <h2 className="text-lg font-bold">What Re:Port is</h2>
          <p>
            Re:Port is a library of unofficial native Android ports: source ports, engine rebuilds, decompilation projects and static recompilations of PC and console games.
          </p>
          <p>The Download button on every port opens the developer's release page. For GitHub projects that is the latest release. Other ports open the Telegram post, Discord server, Google Play listing or website where they are published.</p>
        </section>

        <section className="panel space-y-3 p-4 text-[0.95rem] leading-relaxed">
          <h2 className="text-lg font-bold">Good to know</h2>
          <ul className="space-y-3">
            {[
              ['info', 'Every port is unofficial and is not affiliated with the original publishers or studios.'],
              ['folder', 'Re:Port never hosts APKs or game files. Most ports need a copy of the game that you own.'],
              ['warn', 'Mirror and 4pda links are marked, because they are not the developer\'s own page. Check files before installing.'],
              ['verified', 'Compatibility labels come from community reports and can be out of date. Report anything that looks wrong.'],
            ].map(([icon, text]) => (
              <li key={text} className="flex gap-3">
                <Icon name={icon as 'info'} size={20} className="mt-0.5 shrink-0 text-[var(--link)]" />
                {text}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="h-credits" className="panel p-4">
          <h2 id="h-credits" className="mb-3 text-lg font-bold">
            Sources and credits
          </h2>
          <ul className="grid gap-3">
            {CREDITS.map(([name, text, url]) => (
              <li key={name}>
                <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 rounded-xl p-1 active:bg-[var(--surface-2)]">
                  <Icon name="external" size={18} className="mt-1 shrink-0 text-[var(--link)]" />
                  <span>
                    <b className="block">{name}</b>
                    <span className="text-sm text-ink2">{text}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-ink2">
            Game names, logos and cover art belong to their respective owners and are shown for identification only. Catalog snapshot {catalog.generated}.
          </p>
        </section>

        <div className="flex flex-wrap gap-2">
          <Link to="/library" className="btn-a small">
            Open the library
          </Link>
        </div>
      </main>
    </>
  );
}
