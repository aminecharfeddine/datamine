"use client";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { Check, Lightbulb, PencilLine, X } from "lucide-react";
import { useLesson } from "./LessonContext";
import { useProgress } from "@/lib/store";

/** Lit « 0,8 », « 0.8 », « 80 % » ou « 1/3 » comme un nombre. */
export function parseAnswer(raw: string, percent = false): number | null {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const frac = t.match(/^(-?\d+(?:\.\d+)?)\/(\d+(?:\.\d+)?)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const isPct = t.endsWith("%");
  const v = Number(isPct ? t.slice(0, -1) : t);
  if (!Number.isFinite(v)) return null;
  // En mode pourcentage, « 15 » et « 15 % » valent tous deux 0,15 ; une valeur ≤ 1 est lue comme une proportion.
  if (isPct || (percent && Math.abs(v) > 1)) return v / 100;
  return v;
}

export const isClose = (v: number, answer: number, tolerance: number) => Math.abs(v - answer) <= tolerance + 1e-12;

/**
 * Exercice de calcul : on tape un résultat, la correction détaillée (children) s'affiche
 * après une bonne réponse ou sur demande. La première réussite rapporte de l'XP.
 */
export function Exercise({
  id,
  question,
  answer,
  tolerance,
  percent = false,
  unit,
  hint,
  children,
}: {
  id: string;
  question: string;
  answer: number;
  tolerance?: number;
  percent?: boolean;
  unit?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const { slug } = useLesson();
  const record = useProgress((s) => s.recordExercise);
  const remember = useProgress((s) => s.rememberAnswer);
  const explore = useProgress((s) => s.explore);
  const key = `${slug}:exercise:${id}`;
  const saved = useProgress((s) => s.answers[key]);
  const [value, setValue] = useState("");
  const [state, setState] = useState<"idle" | "right" | "wrong" | "shown">("idle");
  const [tries, setTries] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const tol = tolerance ?? Math.max(Math.abs(answer) * 0.01, 0.005);

  // Exercice déjà réussi : on réaffiche la bonne réponse et la correction.
  useEffect(() => {
    if (saved !== undefined && state === "idle" && value === "") {
      setValue(String(percent && Math.abs(saved) <= 1 ? `${+(saved * 100).toFixed(2)} %` : +saved.toFixed(4)).replace(".", ","));
      setState("right");
    }
  }, [saved, state, value, percent]);
  const done = state === "right" || state === "shown";

  const check = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseAnswer(value, percent);
    if (v === null) return;
    if (isClose(v, answer, tol)) {
      setState("right");
      remember(key, v, "last");
      if (tries === 0) explore(`ex-first:${key}`);
      if (tries >= 2) explore(`ex-persist:${key}`);
      record(key);
    } else {
      setState("wrong");
      setTries((t) => t + 1);
    }
  };

  return (
    <div className="card not-prose my-10 overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: "var(--mod-deep)" }}>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg text-white" style={{ background: "var(--mod)" }}>
            <PencilLine size={16} strokeWidth={2.6} />
          </span>
          À toi de calculer
          {state !== "shown" && <span className="ml-auto rounded-full bg-xp/15 px-2.5 py-0.5 text-xs text-[#93370d]">+15 XP</span>}
        </div>
        <p className="font-display text-xl font-bold leading-snug">{question}</p>

        <form onSubmit={check} className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (state === "wrong") setState("idle");
              }}
              disabled={done}
              inputMode="decimal"
              aria-label="Ta réponse"
              placeholder={percent ? "ex. 15 %" : "ta réponse"}
              className={clsx(
                "num w-44 rounded-xl border-2 bg-surface px-4 py-2.5 text-lg font-bold outline-none transition-colors focus:border-mod",
                state === "right" && "border-good-bg bg-[#ecfdf3]",
                state === "wrong" && "border-fp",
                (state === "idle" || state === "shown") && "border-line",
              )}
            />
          </div>
          {unit && <span className="font-semibold text-muted">{unit}</span>}
          {!done && (
            <button type="submit" className="btn-3d px-5 py-2.5 text-sm text-white" style={{ background: "var(--mod)", ["--btn-shadow" as string]: "var(--mod-deep)" }}>
              Vérifier
            </button>
          )}
          {state === "right" && (
            <span className="flex items-center gap-1 font-bold text-good">
              <Check size={20} strokeWidth={3} /> Exact
            </span>
          )}
          {state === "wrong" && (
            <span className="flex items-center gap-1 font-bold text-[#b42318]">
              <X size={20} strokeWidth={3} /> Pas encore
            </span>
          )}
        </form>

        {!done && (
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            {hint &&
              (showHint ? (
                <p className="flex gap-1.5 text-muted">
                  <Lightbulb size={16} className="mt-0.5 shrink-0 text-xp" /> {hint}
                </p>
              ) : (
                <button onClick={() => setShowHint(true)} className="font-semibold text-mod-deep underline underline-offset-4">
                  Un indice
                </button>
              ))}
            {tries >= 2 && (
              <button onClick={() => setState("shown")} className="text-muted underline underline-offset-4 hover:text-ink">
                Voir la correction
              </button>
            )}
          </div>
        )}
      </div>
      {done && (
        <div className="animate-rise border-t-2 border-line bg-paper/70 px-5 py-5 sm:px-6">
          <div className="mb-1 text-sm font-bold text-muted">Correction</div>
          <div className="lesson-prose text-[0.98rem]">{children}</div>
        </div>
      )}
    </div>
  );
}
