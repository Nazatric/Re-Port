import { Info } from "lucide-react";
import { collections, data, games, type Game } from "@/data/ports";
import { useApp } from "@/state";
import { GameCard } from "./Browse";
import { BackHeader, Glass, RePortLogo, SectionHeader } from "@/components/ui";

export function CollectionPage({ name }: { name: string }) {
  const { push } = useApp();
  const col = collections.find((c) => c.name === name);
  const list: Game[] = col ? games.filter((g) => g.collections.includes(col.id)) : games.filter((g) => g.genres.includes(name));
  return (
    <div className="v-scroll h-full overflow-y-auto pb-12">
      <BackHeader title={name} />
      <div className="px-4"><Glass className="p-4">
        <div className="text-[19px] font-bold text-ink">{name}</div>
        <div className="text-[12px] text-ink-soft tabular-nums">{list.length} community ports{col?.blurb ? ` · ${col.blurb}` : ""}</div>
      </Glass></div>
      <div className="masonry mt-4 px-4">
        {list.slice(0, 60).map((g) => <GameCard key={g.id} game={g} onOpen={() => push({ type: "game", id: g.id })} />)}
      </div>
      {list.length > 60 && <div className="px-4 py-4 text-center text-[11.5px] text-ink-soft">Showing 60 of {list.length}. Use Browse filters for more.</div>}
    </div>
  );
}

export function AboutPage() {
  const { showToast } = useApp();
  return (
    <div className="v-scroll h-full overflow-y-auto pb-12">
      <BackHeader title="About" />
      <div className="flex flex-col items-center px-6 pt-6 text-center">
        <RePortLogo size={96} />
        <div className="t-light t-white-shadow mt-4 text-[32px] font-bold leading-none text-ink">Re:Port</div>
        <div className="mt-1 text-[12.5px] text-ink-soft">Unofficial Android game port directory</div>
        <div className="t-light mt-3 text-[14px] italic text-ink">A directory, not an emulator.</div>
        <p className="mt-3 max-w-[330px] text-[12.5px] leading-relaxed text-ink-soft">
          Re:Port catalogs {games.length} community native ports — source ports, engine rebuilds,
          decompilations and static recompilations — merged without duplicates from community indexes.
          Every port links to its own project source and release page.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button onClick={() => showToast(`Catalog revision ${data.revision || "v1"}`)} className="glass press h-10 rounded-full px-4 text-[12.5px] font-semibold text-ink">Bundled offline</button>
          <button onClick={() => showToast("Catalog is generated from community sources")} className="glass press h-10 rounded-full px-4 text-[12.5px] font-semibold text-ink">Catalog provenance</button>
        </div>
      </div>
      <section className="mt-6 px-4">
        <SectionHeader title="How downloads work" />
        <Glass className="divide-y divide-black/[0.06] px-4">
          {[
            ["GitHub releases", "The release index is read and an arm64-v8a / universal APK is selected, then handed to the system downloader."],
            ["Other sources", "Telegram, project sites, mirrors and stores open in your browser at their real download page."],
            ["Game files", "Most ports ship the engine only. Bring the original files from a copy you own."],
            ["Offline catalog", `${data.sources.length} community sources merged into one de-duplicated local catalog. No account or key required.`],
          ].map(([k, v]) => <div key={k} className="py-2.5">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink"><Info size={13} className="text-lime-deep" />{k}</div>
            <div className="mt-0.5 text-[11.5px] text-ink-soft">{v}</div>
          </div>)}
        </Glass>
      </section>
      <div className="mt-6 px-6 text-center text-[11px] leading-relaxed text-ink-soft">
        Game names, logos and artwork belong to their respective owners. Catalog data is community sourced.
      </div>
    </div>
  );
}
