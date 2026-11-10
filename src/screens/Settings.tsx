import { useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Camera,
  Circle,
  Image as ImageIcon,
  Info,
  Palette,
  Search,
  Sparkles,
  Trash2,
  Upload,
  User,
  Vibrate,
  X,
} from "lucide-react";
import { useApp, type AvatarConfig, type ThemeName } from "@/state";
import { featuredGames, games } from "@/data/ports";
import {
  AVATAR_PRESETS,
  Glass,
  GlossButton,
  InitialAvatar,
  PresetGlyph,
  SettingRow,
  SettingToggle,
  processImageFileToDataUrl,
} from "@/components/ui";
import { cn } from "@/utils/cn";

const themes: { id: ThemeName; name: string; preview: string }[] = [
  { id: "nxe", name: "NXE Green", preview: "linear-gradient(180deg,#d9f183,#8cc63e 60%,#639f24)" },
  { id: "meadow", name: "Meadow", preview: "linear-gradient(180deg,#8fcfff,#e8f6ff 55%,#8cc63e)" },
  { id: "sky", name: "Sky", preview: "linear-gradient(180deg,#5fb4f7,#bfe6ff 60%,#fff)" },
  { id: "night", name: "Night · Aero", preview: "radial-gradient(120% 80% at 70% 20%, rgba(90,220,255,.65), transparent 55%), linear-gradient(150deg,#04101f,#0b3559 48%,#08182e)" },
];

export function SettingsScreen() {
  const { name, avatar, setAvatar, setEditNameOpen, settings, setSetting, push, showToast, haptic } = useApp();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await processImageFileToDataUrl(file);
      haptic();
      setAvatar((prev) => ({ ...prev, mode: "image", imageUrl: dataUrl }));
      showToast("Profile picture updated");
    } catch {
      showToast("Could not load that image");
    }
  };

  return (
    <div className="v-scroll h-full overflow-y-auto pb-[116px]">
      <header className="px-5 pt-[calc(var(--sat)+16px)]">
        <h1 className="t-light t-white-shadow text-[34px] leading-none text-ink">Settings</h1>
        <div className="mt-1.5 text-[12.5px] text-ink-soft">Unofficial Android game ports</div>
      </header>

      {/* Hidden file input for instant photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
        aria-label="Upload profile picture"
      />

      {/* Top Profile Banner */}
      <div className="mt-4 px-4">
        <Glass tint="lime" className="p-4">
          <div className="relative z-[2] flex items-center gap-3.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="press relative shrink-0 rounded-full focus:outline-none"
              aria-label="Change profile picture"
              title="Tap to upload photo"
            >
              <InitialAvatar name={name} size={62} />
              <span className="absolute -bottom-0.5 -right-0.5 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-[#1f7fd6] text-white shadow-md">
                <Camera size={13} strokeWidth={2.5} />
              </span>
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[18px] font-bold leading-tight text-white">
                {name || "Add your name"}
              </div>
              <div className="mt-0.5 text-[11.5px] text-white/90">
                {avatar.mode === "image" ? "Custom profile picture" : `Avatar: ${AVATAR_PRESETS.find((p) => p.id === avatar.preset)?.label ?? "Custom"}`}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <GlossButton
                  variant="white"
                  size="sm"
                  icon={Upload}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload photo
                </GlossButton>
                <GlossButton
                  variant="white"
                  size="sm"
                  onClick={() => setEditNameOpen(true)}
                >
                  Customize
                </GlossButton>
              </div>
            </div>
          </div>
        </Glass>
      </div>

      {/* Inline Quick Avatar & Profile Customizer */}
      <section className="mt-5 px-4">
        <div className="t-white-shadow mb-2 px-2 text-[12px] font-bold uppercase tracking-wider text-ink-soft">
          Profile & Avatar Picture
        </div>
        <Glass className="overflow-hidden">
          <SettingRow
            icon={User}
            color="#8cc63e"
            title="Display name"
            subtitle={name || "Not set"}
            chevron
            onClick={() => setEditNameOpen(true)}
          />
          <SettingRow
            icon={ImageIcon}
            color="#1f7fd6"
            title="Profile picture studio"
            subtitle="Upload photo, pick game cover or icon"
            chevron
            onClick={() => setEditNameOpen(true)}
          />

          {/* Quick inline icon + color picker */}
          <div className="relative z-[2] border-t border-black/[0.06] px-3.5 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-ink">Quick avatar style</span>
              {avatar.mode === "image" && (
                <button
                  type="button"
                  onClick={() => {
                    haptic();
                    setAvatar((prev) => ({ ...prev, mode: "preset", imageUrl: "" }));
                    showToast("Switched to icon avatar");
                  }}
                  className="press flex items-center gap-1 rounded-full bg-black/[0.06] px-2.5 py-1 text-[11px] font-semibold text-ink-soft"
                >
                  <Trash2 size={11} /> Remove custom photo
                </button>
              )}
            </div>

            {/* 12 Vector Presets */}
            <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto pb-1">
              {AVATAR_PRESETS.map((p) => {
                const selected = avatar.mode === "preset" && avatar.preset === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      haptic();
                      setAvatar((prev) => ({ ...prev, mode: "preset", preset: p.id }));
                    }}
                    className="press flex shrink-0 flex-col items-center gap-1"
                  >
                    <span
                      className={cn(
                        "icon-gloss grid h-11 w-11 place-items-center rounded-full text-white transition-transform",
                        selected && "ring-[2.5px] ring-lime-deep ring-offset-2 ring-offset-white",
                      )}
                      style={{ background: "linear-gradient(180deg, #c9ee6a, #5f9f22)" }}
                    >
                      <PresetGlyph preset={p.id} size={42} initials={name.trim().slice(0, 2).toUpperCase() || "RP"} />
                    </span>
                    <span className={cn("text-[10px] font-semibold", selected ? "text-lime-deep" : "text-ink-soft")}>
                      {p.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </Glass>
      </section>

      <section className="mt-5 px-4">
        <div className="t-white-shadow mb-2 px-2 text-[12px] font-bold uppercase tracking-wider text-ink-soft">Appearance</div>
        <Glass>
          <div className="relative z-[2] border-b border-black/[0.06] px-3.5 py-3">
            <div className="flex items-center gap-3"><span className="icon-gloss grid h-9 w-9 place-items-center rounded-full bg-gradient-to-b from-[#ff9ac8] to-[#b23a7d] text-white"><Palette size={18} className="relative z-[1]" /></span><div><div className="text-[14px] font-semibold text-ink">Theme</div><div className="text-[11.5px] text-ink-soft">Vector backdrop</div></div></div>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {themes.map((t) => {
                const active = settings.theme === t.id;
                return <button key={t.id} onClick={() => setSetting("theme", t.id)} className="press text-center">
                  <div className={cn("icon-gloss mx-auto h-[66px] w-full rounded-[14px] transition-shadow duration-300", active && "ring-[3px] ring-lime-deep ring-offset-2 ring-offset-white/60")} style={{ background: t.preview }} />
                  <div className={cn("mt-1.5 text-[11.5px] font-semibold", active ? "text-lime-deep" : "text-ink-soft")}>{t.name}</div>
                </button>;
              })}
            </div>
          </div>
          <SettingToggle k="animations" icon={Sparkles} color="#f5a623" title="Smooth animations" subtitle="Interruptible, transform-only motion" />
          <SettingToggle k="reflections" icon={Circle} color="#4fb6ff" title="Cover reflections" subtitle="Mirrored artwork in the cover flow" />
          <SettingToggle k="bubbles" icon={Circle} color="#8cc63e" title="Floating bubbles" subtitle="Background particles on the home screen" />
          <SettingToggle k="autoplay" icon={Sparkles} color="#8e6cff" title="Cover flow autoplay" subtitle="Rotate featured ports while idle" />
          <SettingToggle k="haptics" icon={Vibrate} color="#8e6cff" title="Haptic feedback" subtitle="Vibration on supported devices" last />
        </Glass>
      </section>

      <section className="mt-5 px-4">
        <div className="t-white-shadow mb-2 px-2 text-[12px] font-bold uppercase tracking-wider text-ink-soft">About</div>
        <Glass><SettingRow icon={Info} color="#1f7fd6" title="About Re:Port" subtitle="Catalog and downloads" chevron onClick={() => push({ type: "about" })} last /></Glass>
      </section>
      <div className="mt-8 px-6 text-center"><div className="t-light t-white-shadow text-[13px] italic text-ink-soft">A directory, not an emulator.</div></div>
    </div>
  );
}

type StudioTab = "presets" | "games" | "upload";

/** Full Profile & Avatar Customizer Modal (used on first-run onboarding AND when editing profile). */
export function NamePrompt({
  firstRun,
  onDone,
}: {
  firstRun: boolean;
  onDone: (name: string, avatar: AvatarConfig) => void;
}) {
  const { name, avatar, showToast, haptic } = useApp();
  const [value, setValue] = useState(name);
  const [draftAvatar, setDraftAvatar] = useState<AvatarConfig>(avatar);
  const [tab, setTab] = useState<StudioTab>("presets");
  const [gameQuery, setGameQuery] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const gameChoices = useMemo(() => {
    const q = gameQuery.trim().toLowerCase();
    const pool = q
      ? games.filter((g) => g.cover && !g.cover.startsWith("data:") && g.title.toLowerCase().includes(q))
      : [...featuredGames, ...games.filter((g) => g.cover && !g.cover.startsWith("data:"))];
    const seen = new Set<string>();
    return pool.filter((g) => {
      if (seen.has(g.id)) return false;
      seen.add(g.id);
      return true;
    }).slice(0, 24);
  }, [gameQuery]);

  const onFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await processImageFileToDataUrl(file);
      haptic();
      setDraftAvatar((prev) => ({ ...prev, mode: "image", imageUrl: dataUrl }));
      showToast("Photo ready");
    } catch {
      showToast("Could not read that image");
    }
  };

  const applyCustomUrl = () => {
    const trimmed = customUrl.trim();
    if (!trimmed) return;
    haptic();
    setDraftAvatar((prev) => ({ ...prev, mode: "image", imageUrl: trimmed }));
    setCustomUrl("");
    showToast("Image URL applied");
  };

  return (
    <div className="anim-fade-in absolute inset-0 z-[95] flex items-center justify-center bg-black/50 px-4 py-6">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={onFileSelected}
        className="hidden"
        aria-label="Upload avatar file"
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const finalName = value.trim() || name.trim() || "Player";
          onDone(finalName, draftAvatar);
        }}
        className="anim-sheet-in glass flex max-h-[90%] w-full max-w-[368px] flex-col rounded-[26px] p-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-1">
          <div className="text-[17px] font-bold text-ink">
            {firstRun ? "Welcome to Re:Port" : "Customize Profile"}
          </div>
          {!firstRun && (
            <button
              type="button"
              onClick={() => onDone(name, avatar)}
              className="press grid h-8 w-8 place-items-center rounded-full bg-black/[0.06] text-ink-soft"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Live Avatar Preview + Quick Upload Button */}
        <div className="mt-3 flex items-center gap-3.5 rounded-2xl bg-black/[0.04] p-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="press relative shrink-0 rounded-full"
            title="Tap to upload your own photo"
          >
            <InitialAvatar name={value || "RP"} size={68} configOverride={draftAvatar} />
            <span className="absolute -bottom-0.5 -right-0.5 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-[#1f7fd6] text-white shadow">
              <Camera size={13} strokeWidth={2.5} />
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <label className="block text-[10.5px] font-bold uppercase tracking-wider text-ink-soft">
              Display Name
            </label>
            <input
              autoFocus={firstRun}
              value={value}
              onChange={(e) => setValue(e.target.value.slice(0, 20))}
              placeholder="Your name"
              maxLength={20}
              className="mt-1 h-10 w-full rounded-xl bg-white/90 px-3 text-[14.5px] font-semibold text-ink shadow-inner outline-none focus:ring-2 focus:ring-lime-deep"
            />
            <div className="mt-2 flex gap-1.5">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="press flex h-7 items-center gap-1 rounded-full bg-white px-2.5 text-[11px] font-semibold text-ink shadow-sm"
              >
                <Upload size={11} /> Upload photo
              </button>
              {draftAvatar.mode === "image" && (
                <button
                  type="button"
                  onClick={() => setDraftAvatar((prev) => ({ ...prev, mode: "preset", imageUrl: "" }))}
                  className="press flex h-7 items-center gap-1 rounded-full bg-black/[0.07] px-2.5 text-[11px] font-semibold text-ink-soft"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Avatar Source Tabs */}
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-black/[0.06] p-1">
          {(
            [
              ["presets", "Icons"],
              ["games", "Game Art"],
              ["upload", "Custom Photo"],
            ] as [StudioTab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "press h-8 rounded-full text-[11.5px] font-semibold transition-colors",
                tab === id ? "glass-lime sheen text-white" : "text-ink-soft",
              )}
            >
              <span className="relative z-[2]">{label}</span>
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="v-scroll mt-3 min-h-[190px] flex-1 overflow-y-auto pr-0.5">
          {tab === "presets" && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                Choose Icon
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {AVATAR_PRESETS.map((p) => {
                  const selected = draftAvatar.mode === "preset" && draftAvatar.preset === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        haptic();
                        setDraftAvatar((prev) => ({ ...prev, mode: "preset", preset: p.id }));
                      }}
                      className={cn(
                        "press flex flex-col items-center gap-1 rounded-2xl p-2 transition-colors",
                        selected ? "bg-lime-main/20 ring-2 ring-lime-deep" : "bg-black/[0.03]",
                      )}
                    >
                      <span
                        className="icon-gloss grid h-11 w-11 place-items-center rounded-full text-white"
                        style={{ background: "linear-gradient(180deg, #c9ee6a, #5f9f22)" }}
                      >
                        <PresetGlyph preset={p.id} size={42} initials={value.trim().slice(0, 2).toUpperCase() || "RP"} />
                      </span>
                      <span className="text-[10.5px] font-semibold text-ink">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "games" && (
            <div>
              <label className="flex h-9 items-center gap-2 rounded-full bg-black/[0.06] px-3">
                <Search size={14} className="text-ink-soft" />
                <input
                  value={gameQuery}
                  onChange={(e) => setGameQuery(e.target.value)}
                  placeholder="Search 869 game covers…"
                  className="w-full bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink-soft/70"
                />
                {gameQuery && (
                  <button type="button" onClick={() => setGameQuery("")} className="text-ink-soft">
                    <X size={13} />
                  </button>
                )}
              </label>
              <div className="mt-2.5 grid grid-cols-4 gap-2">
                {gameChoices.map((g) => {
                  const active = draftAvatar.mode === "image" && draftAvatar.imageUrl === g.cover;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        haptic();
                        setDraftAvatar((prev) => ({ ...prev, mode: "image", imageUrl: g.cover }));
                      }}
                      className="press flex flex-col items-center gap-1 text-center"
                    >
                      <span
                        className={cn(
                          "icon-gloss relative block h-14 w-14 overflow-hidden rounded-full bg-black/20",
                          active && "ring-[3px] ring-lime-deep ring-offset-2 ring-offset-white",
                        )}
                      >
                        <img src={g.cover} alt={g.title} className="h-full w-full object-cover" loading="lazy" />
                      </span>
                      <span className="w-full truncate text-[10px] font-semibold text-ink">{g.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "upload" && (
            <div className="space-y-3 py-1">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="press flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-lime-deep/50 bg-lime-main/10 py-6 text-center"
              >
                <span className="icon-gloss grid h-12 w-12 place-items-center rounded-full bg-gradient-to-b from-[#c9ee6a] to-[#5f9f22] text-white">
                  <Upload size={20} />
                </span>
                <div className="text-[13.5px] font-bold text-ink">Choose photo from device</div>
                <div className="text-[11px] text-ink-soft">PNG, JPG, WebP or GIF · auto center-cropped</div>
              </button>

              <div className="rounded-2xl bg-black/[0.04] p-3">
                <div className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
                  Or paste an image URL
                </div>
                <div className="mt-1.5 flex gap-1.5">
                  <input
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://example.com/avatar.png"
                    className="h-9 flex-1 rounded-full bg-white px-3 text-[12px] text-ink outline-none"
                  />
                  <button
                    type="button"
                    onClick={applyCustomUrl}
                    disabled={!customUrl.trim()}
                    className="glass-lime sheen press h-9 rounded-full px-3.5 text-[12px] font-semibold text-white disabled:opacity-40"
                  >
                    Use
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Submit / Save */}
        <div className="mt-3 flex gap-2 border-t border-black/[0.06] pt-3">
          {!firstRun && (
            <button
              type="button"
              onClick={() => onDone(name, avatar)}
              className="press h-11 flex-1 rounded-full bg-black/[0.06] text-[13px] font-semibold text-ink-soft"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={firstRun && !value.trim()}
            className="glass-lime sheen press h-11 flex-[2] rounded-full text-[14px] font-semibold text-white disabled:opacity-50"
          >
            {firstRun ? "Start exploring" : "Save profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
