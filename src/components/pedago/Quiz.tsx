"use client";
import { useState } from "react";
import clsx from "clsx";
import { useLesson } from "./LessonContext";
import { useProgress } from "@/lib/store";

export type QuizQuestion = { q: string; options: string[]; answer: number; explain: string };

/** Vérification rapide : une question à la fois, feedback immédiat. */
export function Quiz({ id, title = "Vérifie", questions }: { id: string; title?: string; questions: QuizQuestion[] }) {
  const { slug } = useLesson();
  const record = useProgress((s) => s.recordQuiz);
  const [idx, setIdx] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const finished = idx >= questions.length;
  const q = questions[idx];

  return (
    <div className="not-prose my-8 rounded-xl border border-line bg-surface p-5 sm:p-6">
      <div className="mb-3 flex items-baseline justify-between">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{title}</div>
        <div className="num text-xs text-muted">
          {Math.min(idx + 1, questions.length)}/{questions.length}
        </div>
      </div>
      {finished ? (
        <div className="animate-rise">
          <p className="font-serif text-lg">
            {score}/{questions.length} — {score === questions.length ? "parfait." : "les erreurs reviendront en révision."}
          </p>
          <button
            className="mt-3 text-sm text-muted underline underline-offset-4 hover:text-ink"
            onClick={() => {
              setIdx(0);
              setChoice(null);
              setScore(0);
            }}
          >
            Recommencer
          </button>
        </div>
      ) : (
        <>
          <p className="mb-4 font-serif text-lg leading-snug">{q.q}</p>
          <div className="grid gap-2">
            {q.options.map((o, i) => (
              <button
                key={i}
                disabled={choice !== null}
                onClick={() => {
                  setChoice(i);
                  const ok = i === q.answer;
                  if (ok) setScore((s) => s + 1);
                  record(`${slug}:quiz:${id}:${idx}`, ok);
                }}
                className={clsx(
                  "rounded-lg border px-4 py-2.5 text-left text-[0.95rem] transition-all",
                  choice === null && "border-line hover:border-ink hover:bg-sunken",
                  choice !== null && i === q.answer && "border-pos bg-pos-soft",
                  choice !== null && i === choice && i !== q.answer && "border-fp bg-accent-soft",
                  choice !== null && i !== q.answer && i !== choice && "border-line opacity-50",
                )}
              >
                {o}
              </button>
            ))}
          </div>
          {choice !== null && (
            <div className="animate-rise mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-start sm:justify-between">
              <p className="text-[0.95rem] text-muted">{q.explain}</p>
              <button
                onClick={() => {
                  setIdx((i) => i + 1);
                  setChoice(null);
                }}
                className="shrink-0 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper"
              >
                {idx + 1 < questions.length ? "Suivante" : "Résultat"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
