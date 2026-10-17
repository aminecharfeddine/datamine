"use client";
import { useMemo, useSyncExternalStore } from "react";
import { useProgress, type Celebration } from "@/lib/store";
import { resolveSlot, unlockContext } from "@/lib/cosmetics";

// Célébrations : un court effet visuel après une réussite. Jamais pendant la lecture d'une leçon,
// seulement en réponse à une action. Désactivées si « réduire les animations » est demandé.

const PALETTE = ["#4f46e5", "#f43f5e", "#f59e0b", "#0d9488", "#7c3aed", "#0284c7", "#16a34a"];
const SYMBOLS = ["μ", "σ", "Σ", "∇", "λ", "θ", "∂", "∞", "π", "β"];

function subscribeReduced(cb: () => void) {
  const m = window.matchMedia("(prefers-reduced-motion: reduce)");
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
const reducedSnapshot = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Celebrations() {
  const celebrations = useProgress((s) => s.celebrations);
  const xp = useProgress((s) => s.xp);
  const badges = useProgress((s) => s.badges);
  const cosmetics = useProgress((s) => s.cosmetics);
  const reduced = useSyncExternalStore(subscribeReduced, reducedSnapshot, () => true);
  if (reduced || celebrations.length === 0) return null;
  const equipped = resolveSlot("effect", cosmetics, unlockContext(xp, badges)).id;
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {celebrations.map((c) => (
        <Effect key={c.id} c={c} effect={c.effect ?? equipped} />
      ))}
    </div>
  );
}

const rnd = (seed: number) => {
  let x = seed % 2147483647 || 1;
  return () => ((x = (x * 48271) % 2147483647) - 1) / 2147483646;
};

function Effect({ c, effect }: { c: Celebration; effect: string }) {
  const n = c.size === "big" ? 1 : 0.45;
  const parts = useMemo(() => {
    const r = rnd(c.id * 7919 + 13);
    return Array.from({ length: 60 }, () => ({ a: r(), b: r(), c: r(), d: r() }));
  }, [c.id]);

  if (effect === "e-none") return null;

  if (effect === "e-confetti") {
    return (
      <>
        {parts.slice(0, Math.round(56 * n)).map((p, i) => (
          <span
            key={i}
            className="absolute top-0 block"
            style={{
              left: `${p.a * 100}%`,
              width: 7 + p.b * 6,
              height: 11 + p.c * 8,
              borderRadius: 2,
              background: PALETTE[i % PALETTE.length],
              animation: `fall ${1.4 + p.d * 0.9}s cubic-bezier(.25,.6,.4,1) ${p.b * 0.25}s both`,
              ["--dx" as string]: `${(p.c - 0.5) * 160}px`,
              ["--rot" as string]: `${(p.d - 0.5) * 900}deg`,
            }}
          />
        ))}
      </>
    );
  }

  if (effect === "e-scatter") {
    // Un nuage de points qui apparaît, puis sa droite de régression se trace.
    const k = Math.round(40 * n);
    return (
      <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" width="360" height="260" viewBox="0 0 360 260">
        {parts.slice(0, k).map((p, i) => {
          const x = 20 + p.a * 320;
          const y = 230 - (x - 20) * 0.62 + (p.b - 0.5) * 70;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={5}
              fill={PALETTE[i % 3]}
              style={{ transformOrigin: `${x}px ${y}px`, animation: `dot-pop 1.6s ease-out ${(i / k) * 0.5}s both` }}
            />
          );
        })}
        <line x1={20} y1={230} x2={340} y2={32} stroke="#141627" strokeWidth={4} strokeLinecap="round" pathLength={1} strokeDasharray="1" style={{ animation: "draw-line 1.8s ease-out 0.35s both" }} />
      </svg>
    );
  }

  if (effect === "e-glyphs") {
    return (
      <>
        {parts.slice(0, Math.round(26 * n)).map((p, i) => (
          <span
            key={i}
            className="absolute bottom-0 font-bold"
            style={{
              left: `${10 + p.a * 80}%`,
              fontFamily: "Georgia, serif",
              fontSize: 22 + p.b * 26,
              color: PALETTE[i % PALETTE.length],
              animation: `rise-fade ${1.6 + p.c}s ease-out ${p.d * 0.4}s both`,
              ["--dx" as string]: `${(p.c - 0.5) * 120}px`,
            }}
          >
            {SYMBOLS[i % SYMBOLS.length]}
          </span>
        ))}
      </>
    );
  }

  // Étincelles (défaut) : une gerbe d'étoiles au centre de l'écran.
  return (
    <>
      {parts.slice(0, Math.round(22 * n)).map((p, i) => {
        const ang = p.a * 2 * Math.PI;
        const dist = 90 + p.b * (c.size === "big" ? 220 : 120);
        return (
          <svg
            key={i}
            className="absolute left-1/2 top-[45%]"
            width={14 + p.c * 12}
            height={14 + p.c * 12}
            viewBox="0 0 20 20"
            style={{
              animation: `burst ${0.9 + p.d * 0.6}s cubic-bezier(.2,.7,.3,1) both`,
              ["--dx" as string]: `${Math.cos(ang) * dist}px`,
              ["--dy" as string]: `${Math.sin(ang) * dist}px`,
              ["--rot" as string]: `${(p.d - 0.5) * 180}deg`,
            }}
          >
            <path d="M10 0 L12.5 7.5 L20 10 L12.5 12.5 L10 20 L7.5 12.5 L0 10 L7.5 7.5 Z" fill={i % 3 === 0 ? "#f59e0b" : "var(--accent)"} />
          </svg>
        );
      })}
    </>
  );
}
