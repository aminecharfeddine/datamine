"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Lightbulb, Trophy } from "lucide-react";
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
  const explore = useProgress((s) => s.explore);
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
        "mb-6 flex gap-4 rounded-2xl p-4 transition-colors sm:p-5",
        done ? "bg-[#ecfdf3]" : "bg-[#fffaeb]",
      )}
    >
      <span
        className={clsx(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white transition-colors",
          done ? "bg-good-bg" : "bg-xp",
        )}
      >
        <Trophy size={22} strokeWidth={2.4} />
      </span>
      <div className="flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className={clsx("text-sm font-bold", done ? "text-good" : "text-[#93370d]")}>Défi : {ch.title}</div>
          <div className={clsx("rounded-full px-2.5 py-0.5 text-xs font-bold", done ? "bg-good-bg text-white" : "bg-xp/20 text-[#93370d]")}>
            {done ? (solved ? "Réussi !" : "Déjà réussi") : "+25 XP"}
          </div>
        </div>
        <p className="mt-1 font-display text-lg font-bold leading-snug">{ch.goal}</p>
        {!done &&
          (hint ? (
            <p className="mt-2 flex gap-1.5 text-sm text-[#93370d]">
              <Lightbulb size={16} className="mt-0.5 shrink-0" /> {ch.hint}
            </p>
          ) : (
            <button
              onClick={() => {
                setHint(true);
                explore(`hint:${key}`); // un défi réussi après l'indice ne compte pas pour « Sans filet »
              }} className="mt-2 text-sm font-semibold text-[#b54708] underline underline-offset-4">
              Afficher un indice
            </button>
          ))}
      </div>
    </div>
  );
}
