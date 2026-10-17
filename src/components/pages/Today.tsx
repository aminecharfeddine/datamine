"use client";
import Link from "next/link";
import clsx from "clsx";
import { Flame, Lock, Repeat } from "lucide-react";
import { useProgress, dueCardIds, conceptLevel } from "@/lib/store";
import { ALL_LESSONS, MODULES, modStyle, moduleById, type Module } from "@/lib/curriculum";
import { dayKey, displayedStreak } from "@/lib/gamification";
import { useHydrated } from "@/components/ui/useHydrated";
import { ModuleIcon } from "@/components/ui/ModuleIcon";
import { WeeklyGoal } from "@/components/game/WeeklyGoal";
import { NextUnlock } from "@/components/game/NextUnlock";
import { useMe } from "@/components/game/useMe";

export function Today() {
  const hydrated = useHydrated();
  const s = useProgress();
  const me = useMe();
  const due = hydrated ? dueCardIds(s.srs).length : 0;
  const next = hydrated ? ALL_LESSONS.find((l) => l.available && !s.completedLessons[l.slug]) : ALL_LESSONS[0];
  const nextMod = next ? moduleById(next.moduleId) : undefined;
  const streak = hydrated ? displayedStreak(s.streak, dayKey()) : 0;
  const isNew = hydrated && s.xp === 0;


  const mastery = (m: Module) => {
    if (!hydrated) return 0;
    const lv: number[] = m.concepts.map((c) => conceptLevel(s, c.id));
    return lv.reduce((a, b) => a + b, 0) / (lv.length * 4);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10">
      <section>
        <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          {isNew ? "La data science, en manipulant." : `On continue, ${me.name} ?`}
        </h1>
        {!isNew && hydrated && (
          <p className="mt-2 flex items-center gap-2 font-semibold text-accent">
            {me.title} · niveau {me.level.level}
            {streak > 0 && (
              <span className="flex items-center gap-1 text-flame">
                · <Flame size={16} fill="currentColor" /> {streak} j
              </span>
            )}
          </p>
        )}
        <p className="mt-3 max-w-2xl text-lg text-muted">
          {isNew
            ? "Statistiques, machine learning, deep learning, LLM. Tu prédis, tu manipules, tu relèves des défis, puis tes révisions reviennent juste avant que tu oublies."
            : "Une leçon ou quelques révisions : quinze minutes suffisent pour garder ta série."}
        </p>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        {next && nextMod ? (
          <Link
            href={`/lecons/${next.slug}`}
            style={{ ...modStyle(nextMod), background: nextMod.color }}
            className="group relative overflow-hidden rounded-3xl p-6 text-white sm:p-8"
          >
            <ModuleIcon id={nextMod.id} size={180} className="pointer-events-none absolute -bottom-8 -right-6 opacity-15" />
            <div className="flex items-center gap-2 text-sm font-semibold text-white/80">
              <ModuleIcon id={nextMod.id} size={16} />
              {isNew ? "Commence ici" : "Ta prochaine leçon"} · Module {nextMod.index}, {nextMod.title}
            </div>
            <h2 className="mt-3 max-w-lg font-display text-3xl font-bold leading-tight sm:text-4xl">{next.title}</h2>
            <p className="mt-2 max-w-md text-white/85">{next.summary}</p>
            <span
              className="btn-3d mt-6 inline-flex items-center gap-2 bg-white px-5 py-3 text-ink"
              style={{ ["--btn-shadow" as string]: "rgb(0 0 0 / 0.25)" }}
            >
              Commencer · {next.minutes} min
            </span>
          </Link>
        ) : (
          <div className="card p-8">
            <h2 className="font-display text-2xl font-bold">Tu as terminé toutes les leçons disponibles</h2>
            <p className="mt-2 text-muted">De nouveaux modules arrivent. En attendant, tes révisions consolident ce que tu as appris.</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <Link href={due > 0 ? "/revisions" : "/parcours"} className="card flex items-center gap-4 p-5 transition-colors hover:border-muted">
            <span className={clsx("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", due > 0 ? "bg-flame text-white" : "bg-sunken text-muted")}>
              <Repeat size={22} strokeWidth={2.6} />
            </span>
            <span>
              <span className="block font-display text-2xl font-bold">
                {due} carte{due > 1 ? "s" : ""} à réviser
              </span>
              <span className="text-sm text-muted">
                {due > 0 ? "Elles sont sur le point de s'effacer." : isNew ? "Termine une leçon pour remplir ton deck." : "Rien pour l'instant. Reviens demain."}
              </span>
            </span>
          </Link>

          <WeeklyGoal compact />
        </div>
      </section>

      <div className="mt-4">
        <NextUnlock />
      </div>

      <section className="mt-14">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-bold">Les modules</h2>
          <Link href="/parcours" className="text-sm font-semibold text-accent hover:underline">
            Voir le parcours détaillé
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {MODULES.map((m) => {
            const available = m.lessons.some((l) => l.available);
            const v = mastery(m);
            const first = m.lessons.find((l) => l.available);
            const Tile = (
              <div
                className={clsx("relative h-full rounded-2xl border-2 p-4 transition-transform", available ? "hover:-translate-y-0.5" : "opacity-60")}
                style={{ borderColor: available ? `${m.color}33` : "var(--line)", background: available ? `${m.color}0d` : "var(--surface)" }}
              >
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
                  style={{ background: available ? m.color : "var(--neg)" }}
                >
                  {available ? <ModuleIcon id={m.id} /> : <Lock size={18} strokeWidth={2.6} />}
                </span>
                <div className="mt-3 text-xs font-semibold text-muted">Module {m.index}</div>
                <div className="font-display text-lg font-bold leading-tight">{m.title}</div>
                {available ? (
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(4, v * 100)}%`, background: m.color }} />
                  </div>
                ) : (
                  <div className="mt-3 text-xs font-semibold text-muted">Bientôt</div>
                )}
              </div>
            );
            return available && first ? (
              <Link key={m.id} href={`/parcours#${m.id}`}>
                {Tile}
              </Link>
            ) : (
              <div key={m.id}>{Tile}</div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function MasteryPips({ level, color }: { level: number; color?: string }) {
  const labels = ["Non vu", "Découvert", "Pratiqué", "Maîtrisé", "Consolidé"];
  return (
    <div className="mt-2 flex items-center gap-1" title={labels[level]}>
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="h-2 flex-1 rounded-full"
          style={{ background: i <= level ? (color ?? "var(--mod)") : "var(--sunken)" }}
        />
      ))}
      <span className="ml-2 w-16 text-[11px] font-medium text-muted">{labels[level]}</span>
    </div>
  );
}
