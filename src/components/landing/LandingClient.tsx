"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ALL_LESSONS } from "@/lib/curriculum";
import { dueCardIds, useProgress } from "@/lib/store";
import type { ItvQuestion } from "@/lib/interview/types";
import { useHydrated } from "@/components/ui/useHydrated";
import { QuestionView } from "@/components/interview/QuestionView";

/** Bandeau « Reprendre » pour les apprenants qui ont déjà commencé. */
export function ResumeBanner() {
  const hydrated = useHydrated();
  const s = useProgress();
  if (!hydrated || s.xp === 0) return null;
  const next = ALL_LESSONS.find((l) => l.available && !s.completedLessons[l.slug]);
  const due = dueCardIds(s.srs).length;
  return (
    <div className="border-b border-line bg-accent-soft">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <p className="text-[0.95rem]">
          Bon retour. {next ? <>Prochaine leçon : <b>{next.title}</b>.</> : "Toutes les leçons sont terminées."}
          {due > 0 && <> {due} carte{due > 1 ? "s" : ""} à réviser.</>}
        </p>
        <Link href="/aujourdhui" className="btn-3d ml-auto bg-accent px-4 py-2 text-sm text-white">
          Reprendre
        </Link>
      </div>
    </div>
  );
}

/** Une vraie question d'entretien, jouable depuis la page d'accueil. */
export function SampleQuestion({ q }: { q: ItvQuestion }) {
  const router = useRouter();
  return <QuestionView q={q} onDone={() => {}} onNext={() => router.push("/entretiens")} nextLabel="Toutes les questions" />;
}
