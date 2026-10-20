"use client";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, Briefcase, Check, Lock, Play } from "lucide-react";
import { MODULES, modStyle, type Module } from "@/lib/curriculum";
import { useProgress, conceptLevel } from "@/lib/store";
import { useHydrated } from "@/components/ui/useHydrated";
import { ModuleIcon } from "@/components/ui/ModuleIcon";
import { MasteryPips } from "./Today";

export function SkillTree() {
  const hydrated = useHydrated();
  const s = useProgress();

  return (
    <div className="mx-auto max-w-4xl px-4 pt-10">
      <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Parcours</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        Neuf modules, des bases mathématiques jusqu'aux agents, puis un module spécial pour préparer tes entretiens. Chaque concept passe par quatre niveaux : découvert,
        pratiqué, maîtrisé, puis consolidé quand ta mémoire tient sur la durée.
      </p>

      <ol className="relative mt-10 space-y-5">
        {/* Le fil du parcours */}
        <span className="absolute bottom-8 left-[27px] top-8 w-1 rounded-full bg-line" aria-hidden />
        {MODULES.map((m) => (
          <ModuleRow
            key={m.id}
            m={m}
            levels={m.concepts.map((c) => (hydrated ? conceptLevel(s, c.id) : 0))}
            done={hydrated ? s.completedLessons : {}}
          />
        ))}
      </ol>

      <Link href="/entretiens" className="card group mt-8 flex items-center gap-4 p-5 transition-transform hover:-translate-y-0.5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-ink text-white">
          <Briefcase size={26} strokeWidth={2.3} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold text-muted">Module spécial</span>
          <span className="block font-display text-xl font-bold">Préparer les entretiens</span>
          <span className="block text-sm text-muted">Questions de théorie, études de cas, bugs à trouver, calculs et pièges, en entraînement libre ou en entretien blanc chronométré.</span>
        </span>
        <ArrowRight className="shrink-0 text-muted transition-transform group-hover:translate-x-1" />
      </Link>
    </div>
  );
}

function ModuleRow({ m, levels, done }: { m: Module; levels: number[]; done: Record<string, string> }) {
  const available = m.lessons.some((l) => l.available);
  const mastery = levels.reduce((a, b) => a + b, 0) / (levels.length * 4);
  const allDone = available && m.lessons.every((l) => done[l.slug]);

  return (
    <li id={m.id} className="relative flex scroll-mt-24 gap-4" style={modStyle(m)}>
      <span
        className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
        style={{ background: available ? m.color : "var(--neg)", boxShadow: available ? `0 4px 0 0 ${m.deep}` : undefined }}
      >
        {available ? <ModuleIcon id={m.id} size={26} /> : <Lock size={22} strokeWidth={2.6} />}
        {allDone && (
          <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-good-bg ring-2 ring-paper">
            <Check size={14} strokeWidth={3.5} />
          </span>
        )}
      </span>

      <section className={clsx("card flex-1 overflow-hidden", !available && "opacity-70")}>
        <div className="flex items-start justify-between gap-4 p-5">
          <div>
            <div className="text-sm font-semibold" style={{ color: available ? m.deep : "var(--muted)" }}>
              Module {m.index}
            </div>
            <h2 className="font-display text-2xl font-bold leading-tight">{m.title}</h2>
            <p className="mt-1 text-muted">{m.tagline}</p>
          </div>
          {available && (
            <div className="text-right">
              <div className="num font-display text-2xl font-bold" style={{ color: m.deep }}>
                {Math.round(mastery * 100)}%
              </div>
              <div className="text-xs text-muted">maîtrise</div>
            </div>
          )}
        </div>

        {available && (
          <div className="border-t border-line bg-paper/60 px-3 py-2">
            {m.lessons.map((l) => (
              <Link
                key={l.slug}
                href={`/lecons/${l.slug}`}
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-surface"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={done[l.slug] ? { background: m.deep, color: "white" } : { background: `${m.color}1a`, color: m.deep }}
                >
                  {done[l.slug] ? <Check size={16} strokeWidth={3} /> : <Play size={14} strokeWidth={3} fill="currentColor" />}
                </span>
                <span className="flex-1 font-semibold">{l.title}</span>
                <span className="num text-xs text-muted">{l.minutes} min</span>
              </Link>
            ))}
          </div>
        )}

        <ul className="grid gap-x-6 gap-y-2 px-5 py-4 sm:grid-cols-2">
          {m.concepts.map((c, i) => (
            <li key={c.id} className="text-sm">
              <span className={clsx("font-medium", !available && "text-muted")}>{c.title}</span>
              {available && <MasteryPips level={levels[i]} color={m.color} />}
            </li>
          ))}
        </ul>
        {!available && <div className="border-t border-line px-5 py-3 text-sm font-semibold text-muted">Bientôt disponible</div>}
      </section>
    </li>
  );
}
