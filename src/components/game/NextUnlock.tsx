"use client";
import { Gift, ChevronRight } from "lucide-react";
import { useProgress } from "@/lib/store";
import { levelInfo, xpForLevel } from "@/lib/gamification";
import { nextLevelUnlock, describeUnlock, resolveSlot, SLOTS, type Cosmetic } from "@/lib/cosmetics";
import { useHydrated } from "@/components/ui/useHydrated";
import { Avatar } from "./Avatar";
import { CosmeticPreview } from "./VestiaireTab";
import { useMe } from "./useMe";

/** « a », « a et b », « a, b et c ». */
export const frenchList = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} et ${xs.at(-1)}`);

function useNext() {
  const hydrated = useHydrated();
  const xp = useProgress((s) => s.xp);
  if (!hydrated) return null;
  const { level } = levelInfo(xp);
  const next = nextLevelUnlock(level);
  if (!next) return null;
  const from = xpForLevel(level);
  const to = xpForLevel(next.level);
  return { ...next, missing: to - xp, progress: (xp - from) / (to - from) };
}

/** Version courte, pour la page Aujourd'hui. */
export function NextUnlock() {
  const next = useNext();
  if (!next) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-accent-soft px-4 py-3">
      <Gift size={20} strokeWidth={2.4} className="shrink-0 text-accent" />
      <p className="text-sm">
        <span className="font-bold">Au niveau {next.level}, tu débloqueras</span> {frenchList(next.items.map(describeUnlock))}.{" "}
        <span className="text-muted">Encore {next.missing} XP.</span>
      </p>
    </div>
  );
}

/**
 * Version riche, pour le profil : à gauche, ton avatar tel qu'il pourra être ;
 * à droite, chaque récompense avec son aperçu.
 */
export function NextLevelCard({ onOpen }: { onOpen?: () => void }) {
  const next = useNext();
  const me = useMe();
  const equipped = useProgress((s) => s.cosmetics);
  if (!next) return null;
  const pick = (slot: Cosmetic["slot"]) => next.items.find((c) => c.slot === slot);
  const theme = pick("theme")?.colors ?? resolveSlot("theme", equipped, me.ctx).colors ?? ["#4f46e5", "#3730a3"];

  return (
    <section className="card overflow-hidden">
      <div className="grid sm:grid-cols-[220px_1fr]">
        <div
          className="relative flex flex-col items-center justify-center gap-3 px-6 py-7 text-center text-white"
          style={{ background: `radial-gradient(120% 100% at 50% 0%, ${theme[0]}, ${theme[1]})` }}
        >
          <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.12]" aria-hidden>
            <defs>
              <pattern id="next-dots" width="18" height="18" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1.4" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#next-dots)" />
          </svg>
          <div className="relative rounded-full bg-white/10 p-1.5 ring-1 ring-white/25">
            <Avatar
              size={96}
              letter={me.letter}
              glyph={pick("glyph")?.glyph ?? me.glyph}
              frame={pick("frame")?.id ?? me.frame}
              color="white"
              textColor={theme[1]}
              frameColor="white"
            />
          </div>
          <span className="relative rounded-full bg-white px-3 py-0.5 font-display text-sm font-bold text-ink">
            {pick("title")?.name ?? me.title}
          </span>
          <span className="relative text-xs font-semibold text-white/80">Toi, au niveau {next.level}</span>
        </div>

        <div className="flex min-w-0 flex-col p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="font-display text-xl font-bold">Au niveau {next.level}, tu débloqueras</h2>
            <span className="text-sm font-semibold text-muted">Encore {next.missing} XP</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunken">
            <div className="h-full rounded-full bg-xp" style={{ width: `${Math.max(3, next.progress * 100)}%` }} />
          </div>

          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {next.items.map((c) => (
              <li key={c.id} className="flex min-w-0 items-center gap-3 rounded-2xl bg-paper p-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden [&>*]:max-h-14 [&>*]:max-w-14">
                  {c.slot === "title" ? (
                    <span className="font-display text-2xl font-extrabold text-accent">Aa</span>
                  ) : (
                    <CosmeticPreview c={c} color="var(--accent)" letter={me.letter} />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-muted">{SLOTS.find((s) => s.id === c.slot)!.title}</span>
                  <span className="block truncate font-display font-bold leading-tight">{c.name}</span>
                </span>
              </li>
            ))}
          </ul>

          {onOpen && (
            <button onClick={onOpen} className="mt-auto inline-flex items-center gap-1 self-start pt-5 text-sm font-semibold text-accent hover:underline">
              Voir tout le Vestiaire <ChevronRight size={15} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
