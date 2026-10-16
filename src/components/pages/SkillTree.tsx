"use client";
import Link from "next/link";
import clsx from "clsx";
import { MODULES, type Module } from "@/lib/curriculum";
import { useProgress, conceptLevel } from "@/lib/store";
import { useHydrated } from "@/components/ui/useHydrated";
import { MasteryPips } from "./Today";

// Profondeur dans le graphe de prérequis → rangée de l'arbre.
function depth(m: Module, seen = new Map<string, number>()): number {
  if (seen.has(m.id)) return seen.get(m.id)!;
  const d = m.prereqs.length === 0 ? 0 : 1 + Math.max(...m.prereqs.map((p) => depth(MODULES.find((x) => x.id === p)!, seen)));
  seen.set(m.id, d);
  return d;
}

export function SkillTree() {
  const hydrated = useHydrated();
  const s = useProgress();
  const rows: Module[][] = [];
  for (const m of MODULES) (rows[depth(m)] ??= []).push(m);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-12">
      <h1 className="font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Parcours</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        Huit modules, des bases mathématiques aux agents. Chaque concept passe par quatre niveaux : découvert, pratiqué,
        maîtrisé, puis consolidé quand ta mémoire tient sur la durée.
      </p>

      <div className="relative mt-12">
        <div className="absolute bottom-6 left-1/2 top-6 hidden w-px -translate-x-1/2 bg-line sm:block" />
        <div className="space-y-6">
          {rows.map((row, i) => (
            <div key={i} className={clsx("relative grid gap-6", row.length > 1 && "sm:grid-cols-2")}>
              {row.map((m) => (
                <ModuleCard key={m.id} m={m} levels={m.concepts.map((c) => (hydrated ? conceptLevel(s, c.id) : 0))} done={s.completedLessons} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ModuleCard({ m, levels, done }: { m: Module; levels: number[]; done: Record<string, string> }) {
  const available = m.lessons.some((l) => l.available);
  const mastery = levels.reduce((a, b) => a + b, 0) / (levels.length * 4);
  return (
    <section
      className={clsx(
        "relative mx-auto w-full max-w-xl rounded-2xl border bg-surface p-5",
        available ? "border-ink/70" : "border-line",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="num text-xs text-muted">Module {m.index}</div>
          <h2 className="font-serif text-2xl font-semibold leading-tight">{m.title}</h2>
          <p className="mt-1 text-sm text-muted">{m.tagline}</p>
        </div>
        <Ring value={mastery} dim={!available} />
      </div>

      <ul className="mt-4 grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {m.concepts.map((c, i) => (
          <li key={c.id} className="text-sm">
            <span className={clsx(levels[i] === 0 && !available && "text-muted")}>{c.title}</span>
            {available && <MasteryPips level={levels[i]} />}
          </li>
        ))}
      </ul>

      {available ? (
        <div className="mt-5 space-y-2 border-t border-line pt-4">
          {m.lessons.map((l) => (
            <Link key={l.slug} href={`/lecons/${l.slug}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-sunken">
              <span className="text-sm font-medium">
                <span className={clsx("mr-2", done[l.slug] ? "text-good" : "text-muted")}>{done[l.slug] ? "✓" : "○"}</span>
                {l.title}
              </span>
              <span className="num text-xs text-muted">{l.minutes} min</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted">Bientôt</div>
      )}
    </section>
  );
}

function Ring({ value, dim }: { value: number; dim: boolean }) {
  const r = 18, c = 2 * Math.PI * r;
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className={clsx("shrink-0", dim && "opacity-40")} aria-label={`Maîtrise ${Math.round(value * 100)} %`}>
      <circle cx="24" cy="24" r={r} fill="none" stroke="var(--sunken)" strokeWidth="4" />
      <circle
        cx="24" cy="24" r={r} fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round"
        strokeDasharray={`${c * value} ${c}`} transform="rotate(-90 24 24)"
      />
      <text x="24" y="28" textAnchor="middle" fontSize="11" fill="var(--ink)" className="num">
        {Math.round(value * 100)}
      </text>
    </svg>
  );
}
