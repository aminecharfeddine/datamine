"use client";
import { Gift } from "lucide-react";
import { useProgress } from "@/lib/store";
import { levelInfo, xpForLevel } from "@/lib/gamification";
import { nextLevelUnlock, describeUnlock } from "@/lib/cosmetics";
import { useHydrated } from "@/components/ui/useHydrated";

/** Ce que le prochain palier de niveau débloque, et ce qu'il reste à gagner. */
export function NextUnlock() {
  const hydrated = useHydrated();
  const xp = useProgress((s) => s.xp);
  if (!hydrated) return null;
  const { level } = levelInfo(xp);
  const next = nextLevelUnlock(level);
  if (!next) return null;
  const missing = xpForLevel(next.level) - xp;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-accent-soft px-4 py-3">
      <Gift size={20} strokeWidth={2.4} className="shrink-0 text-accent" />
      <p className="text-sm">
        <span className="font-bold">Niveau {next.level}</span>{" "}
        <span className="text-muted">dans {missing} XP :</span> {next.items.map(describeUnlock).join(", ")}.
      </p>
    </div>
  );
}
