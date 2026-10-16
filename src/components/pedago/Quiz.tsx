"use client";
import { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";
import { useLesson } from "./LessonContext";
import { useProgress } from "@/lib/store";
import { Choice, choiceState } from "./Choice";

export type QuizQuestion = { q: string; options: string[]; answer: number; explain: string };

/** Vérification rapide : une question à la fois, feedback immédiat. */
export function Quiz({ id, title = "Vérifie tes acquis", questions }: { id: string; title?: string; questions: QuizQuestion[] }) {
  const { slug } = useLesson();
  const record = useProgress((s) => s.recordQuiz);
  const remember = useProgress((s) => s.rememberAnswer);
  const scoreKey = `${slug}:quizscore:${id}`;
  const best = useProgress((s) => s.answers[scoreKey]);
  const [idx, setIdx] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [restored, setRestored] = useState(false);

  // Quiz déjà terminé : on affiche directement le meilleur score, avec la possibilité de recommencer.
  useEffect(() => {
    if (!restored && best !== undefined) {
      setIdx(questions.length);
      setScore(best);
      setRestored(true);
    }
  }, [best, restored, questions.length]);
  const finished = idx >= questions.length;
  const q = questions[idx];

  return (
    <div className="card not-prose my-10 p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg text-white" style={{ background: "var(--mod)" }}>
          <ListChecks size={16} strokeWidth={2.6} />
        </span>
        <span className="text-sm font-bold" style={{ color: "var(--mod-deep)" }}>{title}</span>
        <div className="ml-auto flex gap-1.5" aria-label={`Question ${Math.min(idx + 1, questions.length)} sur ${questions.length}`}>
          {questions.map((_, i) => (
            <span
              key={i}
              className="h-2 w-6 rounded-full"
              style={{ background: i < idx || finished ? "var(--mod)" : i === idx ? "color-mix(in srgb, var(--mod) 40%, white)" : "var(--sunken)" }}
            />
          ))}
        </div>
      </div>
      {finished ? (
        <div className="animate-rise">
          <p className="font-display text-2xl font-bold">
            {score}/{questions.length}{" "}
            {best !== undefined && best > score && <span className="text-base font-semibold text-muted">(record : {best}/{questions.length}) </span>}
            <span className="text-muted">{score === questions.length ? "· parfait !" : "· tes erreurs reviendront en révision."}</span>
          </p>
          <button
            className="btn-ghost mt-4 px-4 py-2 text-sm"
            onClick={() => {
              setIdx(0);
              setChoice(null);
              setScore(0);
            }}
          >
            Recommencer le quiz
          </button>
        </div>
      ) : (
        <>
          <p className="mb-4 font-display text-xl font-bold leading-snug">{q.q}</p>
          <div className="grid gap-2.5">
            {q.options.map((o, i) => (
              <Choice
                key={i}
                disabled={choice !== null}
                state={choiceState(i, q.answer, choice)}
                onClick={() => {
                  setChoice(i);
                  const ok = i === q.answer;
                  if (ok) setScore((s) => s + 1);
                  record(`${slug}:quiz:${id}:${idx}`, ok);
                }}
              >
                {o}
              </Choice>
            ))}
          </div>
          {choice !== null && (
            <div className="animate-rise mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <p className="text-[0.95rem] text-muted">{q.explain}</p>
              <button
                onClick={() => {
                  if (idx + 1 >= questions.length) remember(scoreKey, score, "max");
                  setIdx((i) => i + 1);
                  setChoice(null);
                }}
                className="btn-3d shrink-0 px-5 py-2.5 text-sm text-white"
                style={{ background: "var(--mod)", ["--btn-shadow" as string]: "var(--mod-deep)" }}
              >
                {idx + 1 < questions.length ? "Question suivante" : "Voir mon score"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
