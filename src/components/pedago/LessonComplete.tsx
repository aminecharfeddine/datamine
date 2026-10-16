"use client";
import Link from "next/link";
import { useLesson } from "./LessonContext";
import { useProgress } from "@/lib/store";
import { cardsForConcepts } from "@/lib/cards";
import { useHydrated } from "@/components/ui/useHydrated";
import { ALL_LESSONS } from "@/lib/curriculum";

/** Fin de leçon : ancre les concepts dans le deck de révision. */
export function LessonComplete() {
  const { slug, concepts } = useLesson();
  const hydrated = useHydrated();
  const completed = useProgress((s) => !!s.completedLessons[slug]);
  const complete = useProgress((s) => s.completeLesson);
  const nCards = cardsForConcepts(concepts).length;
  const i = ALL_LESSONS.findIndex((l) => l.slug === slug);
  const next = ALL_LESSONS[i + 1];

  return (
    <div className="my-12 rounded-xl border border-ink/80 bg-surface p-6 text-center">
      {hydrated && completed ? (
        <>
          <p className="font-serif text-xl">Leçon terminée ✓</p>
          <p className="mt-1 text-muted">
            {nCards} cartes sont dans ton deck. Elles reviendront juste avant que tu les oublies.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/revisions" className="rounded-lg border border-line px-4 py-2 text-sm hover:border-ink">
              Réviser maintenant
            </Link>
            {next?.available && (
              <Link href={`/lecons/${next.slug}`} className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper">
                Leçon suivante →
              </Link>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="font-serif text-xl">Ancre ce que tu viens d'apprendre</p>
          <p className="mx-auto mt-1 max-w-md text-muted">
            Terminer la leçon ajoute {nCards} cartes à ta répétition espacée : c'est là que la compréhension devient
            mémoire.
          </p>
          <button
            onClick={() => complete(slug, concepts)}
            className="mt-5 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-paper transition-transform hover:-translate-y-0.5"
          >
            Terminer la leçon · +50 XP
          </button>
        </>
      )}
    </div>
  );
}
