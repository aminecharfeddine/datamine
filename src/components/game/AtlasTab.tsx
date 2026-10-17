"use client";
import Link from "next/link";
import clsx from "clsx";
import { Lock, Star } from "lucide-react";
import { useProgress, humanDelay } from "@/lib/store";
import { MODULES, ALL_LESSONS, type Module } from "@/lib/curriculum";
import { conceptLevel, MASTERY_LABELS, type MasteryLevel } from "@/lib/mastery";
import { CARDS } from "@/lib/cards";
import { ModuleIcon } from "@/components/ui/ModuleIcon";

const NEXT_STEP: Record<MasteryLevel, string> = {
  0: "Ouvre la leçon pour le découvrir.",
  1: "Termine la leçon pour l'ajouter à tes révisions.",
  2: "Révise ses cartes : il passera « Maîtrisé ».",
  3: "Continue de réviser : au-delà de 3 semaines de mémoire, il sera consolidé.",
  4: "Gravé en mémoire.",
};

/**
 * L'Atlas : chaque concept est une carte à collectionner. Son apparence suit ta mémoire réelle
 * (mesurée par la répétition espacée), pas le temps passé.
 */
export function AtlasTab() {
  const s = useProgress();
  const modules = MODULES.filter((m) => m.lessons.some((l) => l.available));
  const covered = modules.flatMap((m) => coveredConcepts(m));
  const levels = Object.fromEntries(covered.map((c) => [c, conceptLevel(s, c)]));
  const mastered = covered.filter((c) => levels[c] >= 3).length;
  const consolidated = covered.filter((c) => levels[c] >= 4).length;

  return (
    <div>
      <p className="max-w-2xl text-muted">
        Chaque concept est une carte. Elle prend des couleurs quand tu le pratiques, se dore quand tu le maîtrises, et devient
        holographique quand ta mémoire tient plus de trois semaines.
      </p>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>
          <span className="num font-display text-2xl font-bold">{mastered}</span>
          <span className="text-muted"> / {covered.length} maîtrisés</span>
        </span>
        <span>
          <span className="num font-display text-2xl font-bold">{consolidated}</span>
          <span className="text-muted"> consolidés</span>
        </span>
      </div>

      <div className="mt-8 space-y-10">
        {modules.map((m) => (
          <section key={m.id}>
            <h3 className="flex items-center gap-2 font-display text-xl font-bold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ background: m.color }}>
                <ModuleIcon id={m.id} size={16} />
              </span>
              {m.title}
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {m.concepts.map((c) => {
                const isCovered = coveredConcepts(m).includes(c.id);
                return isCovered ? (
                  <ConceptCard key={c.id} m={m} concept={c.id} title={c.title} level={levels[c.id]} />
                ) : (
                  <div key={c.id} className="flex min-h-40 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line p-4 text-center text-muted">
                    <Lock size={18} />
                    <span className="mt-2 text-sm font-semibold">{c.title}</span>
                    <span className="text-xs">Leçon à venir</span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function coveredConcepts(m: Module) {
  return [...new Set(m.lessons.filter((l) => l.available).flatMap((l) => l.concepts))];
}

function ConceptCard({ m, concept, title, level }: { m: Module; concept: string; title: string; level: MasteryLevel }) {
  const srs = useProgress((s) => s.srs);
  const lesson = ALL_LESSONS.find((l) => l.available && l.concepts.includes(concept));
  const dues = CARDS.filter((c) => c.concept === concept)
    .map((c) => srs[c.id]?.due)
    .filter(Boolean)
    .map((d) => new Date(d!));
  const nextDue = dues.length ? new Date(Math.min(...dues.map(Number))) : null;
  const solid = level >= 3;

  return (
    <Link
      href={lesson ? `/lecons/${lesson.slug}` : "/parcours"}
      className={clsx(
        "group relative flex min-h-40 flex-col rounded-2xl p-4 transition-transform hover:-translate-y-0.5",
        level === 0 && "border-2 border-dashed border-line bg-paper",
        level === 4 && "atlas-holo",
      )}
      style={
        level === 0
          ? undefined
          : level === 1
            ? { background: "white", border: `2px solid ${m.color}55` }
            : level === 2
              ? { background: `${m.color}14`, border: `2px solid ${m.color}66` }
              : {
                  background: `linear-gradient(150deg, ${m.color}, ${m.deep})`,
                  border: level === 3 ? "2px solid #facc15" : "2px solid transparent",
                  color: "white",
                }
      }
      title={NEXT_STEP[level]}
    >
      <div className="flex items-start justify-between">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={solid ? { background: "rgb(255 255 255 / 0.2)" } : { background: level ? `${m.color}22` : "var(--sunken)", color: level ? m.deep : "var(--muted)" }}
        >
          <ModuleIcon id={m.id} size={17} />
        </span>
        {level >= 3 && <Star size={18} fill="#facc15" color="#facc15" aria-label={MASTERY_LABELS[level]} />}
      </div>
      <span className={clsx("mt-3 font-display text-[1.02rem] font-bold leading-tight", level === 0 && "text-muted")}>{title}</span>
      <span className={clsx("mt-auto pt-3 text-xs font-bold", solid ? "text-white/90" : "text-muted")}>{MASTERY_LABELS[level]}</span>
      <div className="mt-1.5 flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="h-1.5 flex-1 rounded-full"
            style={{ background: i <= level ? (solid ? "white" : m.color) : solid ? "rgb(255 255 255 / 0.3)" : "var(--sunken)" }}
          />
        ))}
      </div>
      {nextDue && level >= 2 && (
        <span className={clsx("mt-1.5 text-[11px]", solid ? "text-white/80" : "text-muted")}>
          {nextDue <= new Date() ? "À réviser maintenant" : `Révision dans ${humanDelay(nextDue)}`}
        </span>
      )}
    </Link>
  );
}
