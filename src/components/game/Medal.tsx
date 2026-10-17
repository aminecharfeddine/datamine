import clsx from "clsx";
import { Brain, Crosshair, Flame, KeyRound, Telescope, type LucideIcon } from "lucide-react";
import type { Family, Tier } from "@/lib/achievements";

export const FAMILY_ICON: Record<Family, LucideIcon> = {
  regularite: Flame,
  maitrise: Brain,
  rigueur: Crosshair,
  curiosite: Telescope,
  secret: KeyRound,
};

export const FAMILY_COLOR: Record<Family, string> = {
  regularite: "#f97316",
  maitrise: "#4f46e5",
  rigueur: "#e11d48",
  curiosite: "#0d9488",
  secret: "#7c3aed",
};

const TIER: Record<Tier, { from: string; to: string; label: string }> = {
  bronze: { from: "#e0a26b", to: "#9a5b2b", label: "Bronze" },
  argent: { from: "#e2e8f0", to: "#7c8aa0", label: "Argent" },
  or: { from: "#fde047", to: "#c2850c", label: "Or" },
  platine: { from: "#a5f3fc", to: "#818cf8", label: "Platine" },
};

export const tierLabel = (t?: Tier) => (t ? TIER[t].label : undefined);

/** Médaille d'un succès : métal du palier, icône de la famille. Grisée tant qu'elle n'est pas obtenue. */
export function Medal({ family, tier, earned, size = 52 }: { family: Family; tier?: Tier; earned: boolean; size?: number }) {
  const Icon = FAMILY_ICON[family];
  const metal = tier ? TIER[tier] : { from: FAMILY_COLOR[family], to: FAMILY_COLOR[family] };
  return (
    <span
      className={clsx("relative inline-flex shrink-0 items-center justify-center rounded-full", !earned && "opacity-60")}
      style={{
        width: size,
        height: size,
        background: earned ? `linear-gradient(145deg, ${metal.from}, ${metal.to})` : "var(--sunken)",
        boxShadow: earned ? `inset 0 -3px 0 rgb(0 0 0 / 0.15), 0 0 0 3px white, 0 0 0 4px ${metal.to}55` : "inset 0 0 0 2px var(--line)",
      }}
    >
      <Icon size={size * 0.44} strokeWidth={2.4} color={earned ? "white" : "var(--muted)"} aria-hidden />
    </span>
  );
}
