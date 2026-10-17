import { Brain, Crosshair, Flame, KeyRound, Lock, Telescope, type LucideIcon } from "lucide-react";
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
  bronze: { from: "#e8ad78", to: "#9a5b2b", label: "Bronze" },
  argent: { from: "#cfd6e1", to: "#5f6c80", label: "Argent" },
  or: { from: "#fde047", to: "#c2850c", label: "Or" },
  platine: { from: "#a5f3fc", to: "#818cf8", label: "Platine" },
};

export const tierLabel = (t?: Tier) => (t ? TIER[t].label : undefined);
export const tierColor = (family: Family, t?: Tier) => (t ? TIER[t].to : FAMILY_COLOR[family]);

/**
 * Médaille d'un succès : métal du palier, icône de la famille.
 * Non obtenue : grisée, avec un anneau de progression autour (ou un cadenas pour un secret).
 */
export function Medal({
  family,
  tier,
  earned,
  size = 56,
  progress,
  secret,
}: {
  family: Family;
  tier?: Tier;
  earned: boolean;
  size?: number;
  progress?: number;
  secret?: boolean;
}) {
  const Icon = secret && !earned ? Lock : FAMILY_ICON[family];
  const metal = tier ? TIER[tier] : { from: FAMILY_COLOR[family], to: FAMILY_COLOR[family] };
  const ring = 5;
  const r = 50 - ring / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress ?? 0));
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="absolute inset-0" aria-hidden>
        <defs>
          <linearGradient id={`m-${family}-${tier ?? "x"}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={metal.from} />
            <stop offset="1" stopColor={metal.to} />
          </linearGradient>
        </defs>
        {earned ? (
          <>
            <circle cx={50} cy={50} r={48} fill={`url(#m-${family}-${tier ?? "x"})`} />
            <circle cx={50} cy={50} r={40} fill="none" stroke="white" strokeOpacity={0.45} strokeWidth={2} />
          </>
        ) : (
          <>
            <circle cx={50} cy={50} r={44} fill="var(--sunken)" />
            <circle cx={50} cy={50} r={r} fill="none" stroke="var(--line)" strokeWidth={ring} />
            {p > 0 && (
              <circle
                cx={50}
                cy={50}
                r={r}
                fill="none"
                stroke={metal.to}
                strokeWidth={ring}
                strokeLinecap="round"
                strokeDasharray={`${c * p} ${c}`}
                transform="rotate(-90 50 50)"
              />
            )}
          </>
        )}
      </svg>
      <span className="relative flex h-full w-full items-center justify-center">
        <Icon size={size * 0.4} strokeWidth={2.4} color={earned ? "white" : "#9aa0b8"} aria-hidden />
      </span>
    </span>
  );
}
