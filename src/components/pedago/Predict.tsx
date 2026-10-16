"use client";
import { useState } from "react";
import clsx from "clsx";
import { Eye } from "lucide-react";
import { useLesson } from "./LessonContext";
import { useProgress } from "@/lib/store";
import { Choice, choiceState } from "./Choice";

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
    <div className="card not-prose my-10 overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: "var(--mod-deep)" }}>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg text-white" style={{ background: "var(--mod)" }}>
            <Eye size={16} strokeWidth={2.6} />
          </span>
          Prédis d'abord
        </div>
        <p className="mb-5 font-display text-xl font-bold leading-snug">{question}</p>
        <div className={clsx("grid gap-2.5", options.length > 2 && options.every((o) => o.length < 40) && "sm:grid-cols-2")}>
          {options.map((o, i) => (
            <Choice
              key={i}
              disabled={done}
              state={choiceState(i, answer, choice)}
              onClick={() => {
                setChoice(i);
                record(`${slug}:predict:${id}`, i === answer);
              }}
            >
              {o}
            </Choice>
          ))}
        </div>
      </div>
      {done && (
        <div className={clsx("animate-rise border-t-2 px-5 py-5 sm:px-6", correct ? "border-good-bg/30 bg-[#f6fef9]" : "border-fp/30 bg-[#fffaf5]")}>
          <p className={clsx("mb-2 font-display text-lg font-bold", correct ? "text-good" : "text-[#9c2a10]")}>
            {correct ? "Bien vu !" : "Pas tout à fait, et c'est justement ce qui rend la suite intéressante."}
          </p>
          <div className="lesson-prose text-[0.98rem]">{children}</div>
        </div>
      )}
    </div>
  );
}
