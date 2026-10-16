"use client";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
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
  const next = ALL_LESSONS.slice(i + 1).find((l) => l.available);

  return (
    <div
      className="not-prose my-14 rounded-3xl p-6 text-center sm:p-8"
      style={{ background: "color-mix(in srgb, var(--mod) 9%, white)" }}
    >
      {hydrated && completed ? (
        <>
          <CircleCheck size={44} strokeWidth={2.2} className="mx-auto" style={{ color: "var(--mod)" }} />
          <p className="mt-3 font-display text-2xl font-bold">Leçon terminée</p>
          <p className="mx-auto mt-1 max-w-md text-muted">
            {nCards} cartes sont dans ton deck. Elles reviendront juste avant que tu ne les oublies.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/revisions" className="btn-ghost px-5 py-2.5 text-sm">
              Réviser maintenant
            </Link>
            {next && (
              <Link
                href={`/lecons/${next.slug}`}
                className="btn-3d px-5 py-2.5 text-sm text-white"
                style={{ background: "var(--mod)", ["--btn-shadow" as string]: "var(--mod-deep)" }}
              >
                Leçon suivante : {next.title}
              </Link>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="font-display text-2xl font-bold">Ancre ce que tu viens d'apprendre</p>
          <p className="mx-auto mt-2 max-w-md text-muted">
            Terminer la leçon ajoute {nCards} cartes à tes révisions : c'est là que la compréhension devient mémoire.
          </p>
          <button
            onClick={() => complete(slug, concepts)}
            className="btn-3d mt-6 px-6 py-3 text-white"
            style={{ background: "var(--mod)", ["--btn-shadow" as string]: "var(--mod-deep)" }}
          >
            Terminer la leçon · +50 XP
          </button>
        </>
      )}
    </div>
  );
}
