"use client";
import { useState } from "react";
import clsx from "clsx";
import { Check, Lock, Play, Trophy } from "lucide-react";
import { useProgress } from "@/lib/store";
import { COSMETICS, SLOTS, isUnlocked, rankTitle, resolveSlot, unlockLabel, unlockShort, type Cosmetic, type Slot } from "@/lib/cosmetics";
import { Avatar, Frame } from "./Avatar";
import { useMe } from "./useMe";

const EFFECT_ICON: Record<string, string> = { "e-sparkles": "✦", "e-none": "–", "e-confetti": "❖", "e-scatter": "⋰", "e-glyphs": "∑" };

/**
 * Le Vestiaire : un miroir à gauche, les cosmétiques à droite.
 * Survoler un élément l'essaie sur le miroir ; cliquer l'équipe (s'il est débloqué).
 */
export function VestiaireTab() {
  const me = useMe();
  const cosmetics = useProgress((s) => s.cosmetics);
  const equip = useProgress((s) => s.equip);
  const celebrate = useProgress((s) => s.celebrate);
  const [slot, setSlot] = useState<Slot>("glyph");
  const [hover, setHover] = useState<Cosmetic | null>(null);
  const [pinned, setPinned] = useState<Cosmetic | null>(null);
  const preview = hover ?? pinned;

  const current = (s: Slot) => resolveSlot(s, cosmetics, me.ctx);
  const shown = (s: Slot) => (preview?.slot === s ? preview : current(s));
  const theme = shown("theme").colors ?? ["#4f46e5", "#3730a3"];
  const title = preview?.slot === "title" ? preview.name : me.title;
  const items = COSMETICS.filter((c) => c.slot === slot);
  const autoTitle = !cosmetics.title;
  const previewLocked = preview && !isUnlocked(preview, me.ctx);

  const choose = (c: Cosmetic) => {
    if (isUnlocked(c, me.ctx)) {
      equip(c.slot, c.id);
      setPinned(null);
      if (c.slot === "effect" && c.id !== "e-none") celebrate("big", c.id);
    } else setPinned(pinned?.id === c.id ? null : c);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(280px,340px)_1fr] lg:items-start">
      {/* ------------------------------------------------------------ Miroir */}
      <div className="min-w-0 lg:sticky lg:top-24">
        <div
          className="relative overflow-hidden rounded-[28px] px-6 pb-6 pt-8 text-center text-white"
          style={{ background: `radial-gradient(120% 90% at 50% 0%, ${theme[0]}, ${theme[1]})` }}
        >
          <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.12]" aria-hidden>
            <defs>
              <pattern id="vest-grid" width="22" height="22" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.6" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#vest-grid)" />
          </svg>
          <div className="relative mx-auto w-fit rounded-full bg-white/10 p-2 ring-1 ring-white/20">
            <Avatar size={176} letter={me.letter} glyph={shown("glyph").glyph} frame={shown("frame").id} color="white" textColor={theme[1]} frameColor="white" />
          </div>
          <div className="relative mt-4 font-display text-2xl font-extrabold">{me.name}</div>
          <div className="relative mx-auto mt-2 w-fit rounded-full bg-white px-4 py-1 font-display text-sm font-bold" style={{ color: theme[1] }}>
            {title}
          </div>
          <div className="relative mt-4 min-h-6 text-sm text-white/85">
            {preview ? (
              previewLocked ? (
                <span className="inline-flex items-center gap-1.5 font-semibold">
                  <Lock size={14} /> Aperçu · {unlockLabel(preview)}
                </span>
              ) : (
                <span className="font-semibold">Aperçu · clique pour équiper</span>
              )
            ) : (
              <span>
                Niveau {me.level.level} · {COSMETICS.filter((c) => isUnlocked(c, me.ctx)).length} / {COSMETICS.length} débloqués
              </span>
            )}
          </div>
          {shown("effect").id !== "e-none" && (
            <button
              onClick={() => celebrate("big", shown("effect").id)}
              className="relative mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold ring-1 ring-white/25 hover:bg-white/25"
            >
              <Play size={12} fill="currentColor" /> Jouer « {shown("effect").name} »
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------ Penderie */}
      <div className="min-w-0">
        <div className="flex gap-1 overflow-x-auto rounded-2xl bg-sunken p-1" role="tablist" aria-label="Catégories">
          {SLOTS.map((s) => {
            const all = COSMETICS.filter((c) => c.slot === s.id);
            const got = all.filter((c) => isUnlocked(c, me.ctx)).length;
            return (
              <button
                key={s.id}
                role="tab"
                aria-selected={slot === s.id}
                onClick={() => {
                  setSlot(s.id);
                  setPinned(null);
                }}
                className={clsx(
                  "flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-bold transition-colors",
                  slot === s.id ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
                )}
              >
                {s.title}
                <span className="num ml-1.5 text-xs font-semibold text-muted">
                  {got}/{all.length}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-muted">{SLOTS.find((s) => s.id === slot)!.description}</p>

        <ul className={clsx("mt-4 grid gap-3", slot === "title" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5")}>
          {slot === "title" && (
            <Tile
              selected={autoTitle}
              unlocked
              label="Rang automatique"
              sub={rankTitle(me.level.level).name}
              onClick={() => equip("title", "")}
              onHover={() => setHover(null)}
            >
              <span className="rounded-full bg-sunken px-3 py-1 font-display text-sm font-bold">Auto</span>
            </Tile>
          )}
          {items.map((c) => {
            const unlocked = isUnlocked(c, me.ctx);
            const selected = slot === "title" ? cosmetics.title === c.id : current(slot).id === c.id;
            return (
              <Tile
                key={c.id}
                selected={selected}
                pinned={pinned?.id === c.id}
                unlocked={unlocked}
                label={slot === "title" ? undefined : c.name}
                sub={unlocked ? undefined : unlockShort(c)}
                subIcon={!unlocked && "badge" in c.unlock}
                onClick={() => choose(c)}
                onHover={(on) => setHover(on ? c : null)}
              >
                <CosmeticPreview c={c} color={theme[0]} letter={me.letter} />
              </Tile>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Tile({
  selected,
  pinned,
  unlocked,
  label,
  sub,
  subIcon,
  onClick,
  onHover,
  children,
}: {
  selected: boolean;
  pinned?: boolean;
  unlocked: boolean;
  label?: string;
  sub?: string;
  subIcon?: boolean;
  onClick: () => void;
  onHover: (on: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        onFocus={() => onHover(true)}
        onBlur={() => onHover(false)}
        aria-pressed={selected}
        className={clsx(
          "group relative flex aspect-square w-full flex-col items-center justify-center rounded-2xl p-2 text-center transition-all",
          unlocked ? "bg-surface shadow-sm ring-1 ring-line hover:-translate-y-0.5 hover:shadow-md" : "border-2 border-dashed border-line bg-paper",
          selected && "ring-[3px] ring-accent",
          pinned && "ring-2 ring-muted",
        )}
      >
        {selected && (
          <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white">
            <Check size={13} strokeWidth={3} />
          </span>
        )}
        {!unlocked && (
          <span className="absolute right-2 top-2 text-muted">
            <Lock size={14} />
          </span>
        )}
        <span className={clsx("flex flex-1 items-center justify-center", !unlocked && "opacity-35 grayscale")}>{children}</span>
        {label && <span className={clsx("text-[0.8rem] font-semibold leading-tight", !unlocked && "text-muted")}>{label}</span>}
        {sub && (
          <span className="mt-0.5 inline-flex max-w-full items-center gap-1 text-[10.5px] font-medium leading-tight text-muted">
            {subIcon && <Trophy size={10} className="shrink-0" />}
            <span className="truncate">{sub}</span>
          </span>
        )}
      </button>
    </li>
  );
}

export function CosmeticPreview({ c, color, letter }: { c: Cosmetic; color: string; letter: string }) {
  switch (c.slot) {
    case "glyph":
      return <Avatar size={64} letter={letter} glyph={c.glyph} color={color} />;
    case "frame":
      return (
        <svg width={68} height={68} viewBox="0 0 100 100" aria-hidden>
          <circle cx={50} cy={50} r={34} fill={color} opacity={0.2} />
          <Frame id={c.id} color={color} />
        </svg>
      );
    case "theme":
      return (
        <span className="relative block h-14 w-14 rounded-full" style={{ background: `conic-gradient(${c.colors![0]} 0 62%, ${c.colors![1]} 62% 100%)` }} aria-hidden>
          <span className="absolute inset-[30%] rounded-full bg-white/90" />
        </span>
      );
    case "effect":
      return (
        <span className="font-display text-4xl" style={{ color }}>
          {EFFECT_ICON[c.id] ?? "✦"}
        </span>
      );
    default:
      return <span className="px-1 font-display text-[0.95rem] font-bold leading-tight">{c.name}</span>;
  }
}
