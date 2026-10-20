"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Braces } from "lucide-react";
import { useLesson } from "@/components/pedago/LessonContext";
import { Choice, choiceState } from "@/components/pedago/Choice";
import { useProgress } from "@/lib/store";
import { Highlighted } from "./Code";

/**
 * « Complète le code » : un extrait avec un trou (___), quatre propositions.
 * Une fois répondu, le trou est rempli avec la bonne ligne et l'explication s'affiche.
 */
export function CodeChoice({
  id,
  question,
  code,
  options,
  answer,
  children,
}: {
  id: string;
  question: string;
  code: string;
  options: string[];
  answer: number;
  children?: React.ReactNode;
}) {
  const { slug } = useLesson();
  const record = useProgress((s) => s.recordQuiz);
  const remember = useProgress((s) => s.rememberAnswer);
  const key = `${slug}:code:${id}`;
  const saved = useProgress((s) => s.answers[key]);
  const [choice, setChoice] = useState<number | null>(null);
  useEffect(() => {
    if (saved !== undefined && choice === null) setChoice(saved);
  }, [saved, choice]);
  const done = choice !== null;
  const correct = choice === answer;
  const [before, after = ""] = code.split("___");

  return (
    <div className="card not-prose my-10 overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: "var(--mod-deep)" }}>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg text-white" style={{ background: "var(--mod)" }}>
            <Braces size={16} strokeWidth={2.6} />
          </span>
          Complète le code
          {!done && <span className="ml-auto rounded-full bg-xp/15 px-2.5 py-0.5 text-xs text-[#93370d]">+5 XP</span>}
        </div>
        <p className="mb-4 font-display text-xl font-bold leading-snug">{question}</p>
        <pre className="mb-5 overflow-x-auto rounded-2xl bg-[#171a2e] px-4 py-3.5" tabIndex={0}>
          <Highlighted code={before} inline />
          {done ? (
            <span className={clsx("rounded px-1", correct ? "bg-[#12b76a]/25" : "bg-[#eb6834]/25")}>
              <Highlighted code={options[answer]} inline />
            </span>
          ) : (
            <span className="rounded border border-dashed border-[#fde68a] px-6 text-[#fde68a]">?</span>
          )}
          <Highlighted code={after} inline />
        </pre>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {options.map((o, i) => (
            <Choice
              key={i}
              disabled={done}
              state={choiceState(i, answer, choice)}
              onClick={() => {
                setChoice(i);
                remember(key, i, "first");
                record(key, i === answer);
              }}
            >
              <span className="font-mono text-[0.85rem]">{o}</span>
            </Choice>
          ))}
        </div>
      </div>
      {done && (
        <div className={clsx("animate-rise border-t-2 px-5 py-5 sm:px-6", correct ? "border-good-bg/30 bg-[#f6fef9]" : "border-fp/30 bg-[#fffaf5]")}>
          <p className={clsx("mb-2 font-display text-lg font-bold", correct ? "text-good" : "text-[#9c2a10]")}>{correct ? "Exact." : "Pas cette ligne."}</p>
          <div className="lesson-prose text-[0.98rem]">{children}</div>
        </div>
      )}
    </div>
  );
}
