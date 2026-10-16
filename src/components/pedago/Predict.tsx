"use client";
import { useState } from "react";
import clsx from "clsx";
import { useLesson } from "./LessonContext";
import { useProgress } from "@/lib/store";

/**
 * « Prédis avant de voir » : l'apprenant s'engage sur une réponse,
 * puis la suite (children) se dévoile. La première réponse est celle qui compte.
 */
export function Predict({
  id,
  question,
  options,
  answer,
  children,
}: {
  id: string;
  question: string;
  options: string[];
  answer: number;
  children?: React.ReactNode;
}) {
  const { slug } = useLesson();
  const record = useProgress((s) => s.recordPrediction);
  const [choice, setChoice] = useState<number | null>(null);
  const done = choice !== null;
  const correct = choice === answer;

  return (
    <div className="not-prose my-8 rounded-xl border border-line bg-surface p-5 sm:p-6">
      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-accent">Prédis d'abord</div>
      <p className="mb-4 font-serif text-lg leading-snug">{question}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o, i) => (
          <button
            key={i}
            disabled={done}
            onClick={() => {
              setChoice(i);
              record(`${slug}:predict:${id}`, i === answer);
            }}
            className={clsx(
              "rounded-lg border px-4 py-3 text-left text-[0.95rem] transition-all",
              !done && "border-line hover:border-ink hover:bg-sunken",
              done && i === answer && "border-pos bg-pos-soft",
              done && i === choice && i !== answer && "border-fp bg-accent-soft",
              done && i !== answer && i !== choice && "border-line opacity-50",
            )}
          >
            {o}
          </button>
        ))}
      </div>
      {done && (
        <div className="animate-rise mt-5 border-t border-line pt-4">
          <p className={clsx("mb-2 text-sm font-semibold", correct ? "text-good" : "text-accent")}>
            {correct ? "Bien vu." : "Pas tout à fait — c'est justement là que ça devient intéressant."}
          </p>
          <div className="lesson-prose text-[0.98rem]">{children}</div>
        </div>
      )}
    </div>
  );
}
