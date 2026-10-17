"use client";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ListOrdered, RotateCcw, Undo2 } from "lucide-react";
import { useLesson } from "@/components/pedago/LessonContext";
import { useProgress } from "@/lib/store";
import { Highlighted } from "./Code";

/** Mélange déterministe (même ordre à chaque visite). */
function shuffle<T>(xs: T[], seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const j = Math.abs(h) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  // Jamais déjà dans le bon ordre.
  return out.every((x, i) => x === xs[i]) ? [...out.slice(1), out[0]] : out;
}

/**
 * Problème de Parsons : remettre les lignes d'un programme dans l'ordre.
 * `lines` est la solution ; l'indentation fait partie de la réponse.
 */
export function Parsons({ id, prompt, lines, children }: { id: string; prompt: string; lines: string[]; children?: React.ReactNode }) {
  const { slug } = useLesson();
  const record = useProgress((s) => s.recordExercise);
  const remember = useProgress((s) => s.rememberAnswer);
  const explore = useProgress((s) => s.explore);
  const key = `${slug}:parsons:${id}`;
  const saved = useProgress((s) => s.answers[key]);
  const pool0 = useMemo(() => shuffle(lines.map((_, i) => i), `${slug}:${id}`), [lines, slug, id]);
  const [placed, setPlaced] = useState<number[]>([]);
  const [state, setState] = useState<"idle" | "right" | "wrong">("idle");
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (saved !== undefined && state === "idle" && placed.length === 0) {
      setPlaced(lines.map((_, i) => i));
      setState("right");
    }
  }, [saved, state, placed.length, lines]);

  const pool = pool0.filter((i) => !placed.includes(i));
  const done = state === "right";
  // Deux lignes identiques sont interchangeables : on compare le texte.
  const okAt = (pos: number) => lines[placed[pos]] === lines[pos];

  const check = () => {
    if (placed.every((_, p) => okAt(p))) {
      setState("right");
      remember(key, 1, "first");
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
            <ListOrdered size={16} strokeWidth={2.6} />
          </span>
          Remets le code dans l'ordre
          {!done && <span className="ml-auto rounded-full bg-xp/15 px-2.5 py-0.5 text-xs text-[#93370d]">+15 XP</span>}
        </div>
        <p className="mb-4 font-display text-xl font-bold leading-snug">{prompt}</p>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="min-w-0">
            <div className="mb-2 text-xs font-semibold text-muted">Lignes disponibles · touche une ligne pour l'ajouter</div>
            <ul className="min-h-16 space-y-1.5 rounded-2xl bg-sunken p-2">
              {pool.map((i) => (
                <li key={i}>
                  <button
                    onClick={() => {
                      setPlaced((p) => [...p, i]);
                      setState("idle");
                    }}
                    className="w-full overflow-x-auto rounded-xl bg-[#171a2e] px-3 py-2 text-left transition-transform hover:-translate-y-0.5"
                  >
                    <Highlighted code={lines[i].trimStart()} />
                  </button>
                </li>
              ))}
              {!pool.length && <li className="px-2 py-3 text-sm text-muted">Toutes les lignes sont placées.</li>}
            </ul>
          </div>
          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted">
              <span>Ton programme</span>
              {!done && placed.length > 0 && (
                <span className="flex gap-3">
                  <button onClick={() => { setPlaced((p) => p.slice(0, -1)); setState("idle"); }} className="flex items-center gap-1 hover:text-ink">
                    <Undo2 size={13} /> Retirer la dernière
                  </button>
                  <button onClick={() => { setPlaced([]); setState("idle"); }} className="flex items-center gap-1 hover:text-ink">
                    <RotateCcw size={13} /> Tout retirer
                  </button>
                </span>
              )}
            </div>
            <ol className="min-h-16 overflow-x-auto rounded-2xl bg-[#171a2e] p-2">
              {placed.map((i, pos) => (
                <li
                  key={pos}
                  className={clsx(
                    "flex items-baseline gap-3 rounded-lg px-2 py-1",
                    state === "wrong" && (okAt(pos) ? "bg-[#12b76a]/15" : "bg-[#eb6834]/25"),
                    done && "bg-[#12b76a]/10",
                  )}
                >
                  <span className="num w-4 shrink-0 text-right text-[11px] text-[#6b7092]">{pos + 1}</span>
                  <Highlighted code={lines[i]} />
                </li>
              ))}
              {!placed.length && <li className="px-2 py-3 text-sm text-[#9196b8]">Commence par la première ligne du programme.</li>}
            </ol>
          </div>
        </div>

        {!done && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={check}
              disabled={placed.length < lines.length}
              className="btn-3d px-5 py-2.5 text-sm text-white disabled:opacity-40"
              style={{ background: "var(--mod)", ["--btn-shadow" as string]: "var(--mod-deep)" }}
            >
              Vérifier
            </button>
            {state === "wrong" && <span className="text-sm font-semibold text-[#9c2a10]">Les lignes en orange ne sont pas à leur place.</span>}
            {tries >= 2 && (
              <button onClick={() => { setPlaced(lines.map((_, i) => i)); setState("right"); }} className="text-sm text-muted underline underline-offset-4 hover:text-ink">
                Voir la solution
              </button>
            )}
          </div>
        )}
      </div>
      {done && children && (
        <div className="animate-rise border-t-2 border-line bg-paper/70 px-5 py-5 sm:px-6">
          <div className="mb-1 text-sm font-bold text-muted">Explication</div>
          <div className="lesson-prose text-[0.98rem]">{children}</div>
        </div>
      )}
    </div>
  );
}
