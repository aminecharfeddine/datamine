"use client";
import clsx from "clsx";
import { Check, Lock, Play } from "lucide-react";
import { useProgress } from "@/lib/store";
import { COSMETICS, SLOTS, isUnlocked, resolveSlot, unlockLabel, type Cosmetic, type Slot } from "@/lib/cosmetics";
import { Avatar, Frame } from "./Avatar";
import { useMe } from "./useMe";

/** L'Atelier : équiper les cosmétiques débloqués, voir comment débloquer les autres. */
export function AtelierTab() {
  const me = useMe();
  const cosmetics = useProgress((s) => s.cosmetics);
  const equip = useProgress((s) => s.equip);
  const celebrate = useProgress((s) => s.celebrate);
  const unlockedCount = COSMETICS.filter((c) => isUnlocked(c, me.ctx)).length;

  return (
    <div>
      <div className="card flex flex-wrap items-center gap-5 p-5">
        <Avatar size={104} letter={me.letter} glyph={me.glyph} frame={me.frame} color={me.color} />
        <div>
          <div className="font-display text-2xl font-bold">{me.name}</div>
          <div className="font-semibold text-accent">{me.title}</div>
          <p className="mt-1 text-sm text-muted">
            {unlockedCount} / {COSMETICS.length} éléments débloqués. Les niveaux et les succès en débloquent d'autres.
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-10">
        {SLOTS.map((slot) => {
          const items = COSMETICS.filter((c) => c.slot === slot.id);
          const current = resolveSlot(slot.id, cosmetics, me.ctx);
          const autoTitle = slot.id === "title" && !cosmetics.title;
          return (
            <section key={slot.id}>
              <h3 className="font-display text-xl font-bold">{slot.title}</h3>
              <p className="text-sm text-muted">{slot.description}</p>
              <div className={clsx("mt-4 grid gap-2.5", slot.id === "title" ? "sm:grid-cols-3" : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6")}>
                {slot.id === "title" && (
                  <Option selected={autoTitle} unlocked onClick={() => equip("title", "")} sub="Suit ton niveau automatiquement">
                    <span className="font-display text-[1.05rem] font-bold">Rang automatique</span>
                  </Option>
                )}
                {items.map((c) => {
                    const unlocked = isUnlocked(c, me.ctx);
                    const selected = !autoTitle && current.id === c.id && (slot.id !== "title" || cosmetics.title === c.id);
                    return (
                      <Option
                        key={c.id}
                        selected={selected}
                        unlocked={unlocked}
                        onClick={() => unlocked && equip(slot.id, c.id)}
                        label={slot.id === "title" ? undefined : c.name}
                        sub={unlocked ? c.hint : unlockLabel(c)}
                        extra={
                          slot.id === "effect" && unlocked && c.id !== "e-none" ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                celebrate("big", c.id);
                              }}
                              className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                            >
                              <Play size={11} fill="currentColor" /> Essayer
                            </button>
                          ) : undefined
                        }
                      >
                        <Preview c={c} slot={slot.id} color={me.color} letter={me.letter} />
                      </Option>
                    );
                  })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Option({
  selected,
  unlocked,
  onClick,
  label,
  sub,
  extra,
  children,
}: {
  selected: boolean;
  unlocked: boolean;
  onClick: () => void;
  label?: string;
  sub?: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={unlocked ? 0 : -1}
      aria-pressed={selected}
      aria-disabled={!unlocked}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onClick())}
      className={clsx(
        "relative flex flex-col items-center rounded-2xl border-2 p-3 text-center transition-colors",
        unlocked ? "cursor-pointer bg-surface hover:border-accent/50" : "cursor-not-allowed border-dashed bg-paper",
        selected ? "border-accent" : "border-line",
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
      <div className={clsx("flex min-h-12 items-center justify-center", !unlocked && "opacity-40 grayscale")}>{children}</div>
      {label && <span className={clsx("mt-1.5 text-sm font-semibold leading-tight", !unlocked && "text-muted")}>{label}</span>}
      {sub && <span className="mt-0.5 text-[11px] leading-snug text-muted">{sub}</span>}
      {extra}
    </div>
  );
}

function Preview({ c, slot, color, letter }: { c: Cosmetic; slot: Slot; color: string; letter: string }) {
  if (slot === "glyph") return <Avatar size={52} letter={letter} glyph={c.glyph} color={color} />;
  if (slot === "frame")
    return (
      <svg width={52} height={52} viewBox="0 0 100 100" aria-hidden>
        <circle cx={50} cy={50} r={34} fill={color} opacity={0.25} />
        <Frame id={c.id} color={color} />
      </svg>
    );
  if (slot === "theme")
    return (
      <span className="flex h-10 w-16 overflow-hidden rounded-xl" aria-hidden>
        <span className="flex-1" style={{ background: c.colors?.[0] }} />
        <span className="w-4" style={{ background: c.colors?.[1] }} />
      </span>
    );
  if (slot === "effect") {
    const icon = { "e-sparkles": "✦", "e-none": "·", "e-confetti": "▮", "e-scatter": "⋰", "e-glyphs": "∑" }[c.id] ?? "✦";
    return <span className="font-display text-3xl text-accent">{icon}</span>;
  }
  return <span className="font-display text-[1.05rem] font-bold">{c.name}</span>;
}
