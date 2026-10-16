"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { CHALLENGES } from "@/lib/challenges";
import { useProgress } from "@/lib/store";
import { useLesson } from "./LessonContext";

/** Bannière de défi commune à tous les labos : affiche l'objectif, valide et attribue l'XP. */
export function ChallengeBanner({ labId, challengeId, solved }: { labId: string; challengeId: string; solved: boolean }) {
  const ch = CHALLENGES[challengeId];
  const { slug } = useLesson();
  const key = `${slug}:challenge:${labId}:${challengeId}`;
  const already = useProgress((s) => !!s.awarded[key]);
  const record = useProgress((s) => s.recordChallenge);
  const [hint, setHint] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Valide après un court instant de stabilité pour éviter les validations « au passage » du curseur.
  useEffect(() => {
    if (!solved || already) return;
    const t = setTimeout(() => record(key), 450);
    return () => clearTimeout(t);
  }, [solved, already, key, record]);

  const done = mounted && (already || solved);

  return (
    <div
      className={clsx(
        "mb-6 rounded-xl border p-4 transition-colors",
        done ? "border-pos bg-pos-soft" : "border-dashed border-ink/40",
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Défi · {ch.title}</div>
        <div className={clsx("num text-xs font-semibold", done ? "text-good" : "text-muted")}>
          {done ? (solved ? "✓ réussi" : "✓ déjà réussi") : "+25 XP"}
        </div>
      </div>
      <p className="mt-1 font-serif text-lg leading-snug">{ch.goal}</p>
      {!done && (
        <button onClick={() => setHint((h) => !h)} className="mt-2 text-xs text-muted underline underline-offset-4 hover:text-ink">
          {hint ? ch.hint : "Un indice ?"}
        </button>
      )}
    </div>
  );
}
