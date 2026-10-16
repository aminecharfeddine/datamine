"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Rating, type Grade } from "ts-fsrs";
import { useProgress, dueCardIds, previewDue, humanDelay } from "@/lib/store";
import { cardById } from "@/lib/cards";
import { conceptTitle } from "@/lib/curriculum";
import { useHydrated } from "@/components/ui/useHydrated";
import { Choice, choiceState } from "@/components/pedago/Choice";

const GRADES: { g: Grade; label: string; key: string }[] = [
  { g: Rating.Again, label: "À revoir", key: "1" },
  { g: Rating.Hard, label: "Difficile", key: "2" },
  { g: Rating.Good, label: "Correct", key: "3" },
  { g: Rating.Easy, label: "Facile", key: "4" },
];

export function Review() {
  const hydrated = useHydrated();
  const srs = useProgress((s) => s.srs);
  const review = useProgress((s) => s.review);
  const [queue, setQueue] = useState<string[] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [choice, setChoice] = useState<number | null>(null);
  const [done, setDone] = useState(0);

  // La file est figée au début de la session ; les cartes « À revoir » reviennent en fin de file.
  useEffect(() => {
    if (hydrated && queue === null) setQueue(dueCardIds(srs));
  }, [hydrated, queue, srs]);

  const currentId = queue?.[0];
  const card = currentId ? cardById(currentId) : undefined;

  const grade = (g: Grade) => {
    if (!currentId) return;
    review(currentId, g);
    setQueue((q) => {
      const rest = q!.slice(1);
      return g === Rating.Again ? [...rest, currentId] : rest;
    });
    setDone((d) => d + 1);
    setRevealed(false);
    setChoice(null);
  };

  // Raccourcis clavier : espace pour révéler, 1-4 pour noter
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!card) return;
      if (card.kind === "flash" && !revealed && e.key === " ") {
        e.preventDefault();
        setRevealed(true);
      } else if (card.kind === "flash" && revealed) {
        const g = GRADES.find((x) => x.key === e.key);
        if (g) grade(g.g);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!hydrated || queue === null) return <Shell><p className="text-muted">Chargement…</p></Shell>;

  if (!card) {
    const total = Object.keys(srs).length;
    return (
      <Shell>
        <div className="card p-8 text-center">
          <p className="font-display text-2xl">{done > 0 ? `Session terminée · ${done} révisions` : "Rien à réviser"}</p>
          <p className="mx-auto mt-2 max-w-md text-muted">
            {total === 0
              ? "Ton deck est vide. Termine une leçon pour y ajouter ses cartes."
              : "Tes cartes reviendront au moment où tu serais sur le point de les oublier."}
          </p>
          <Link href={total === 0 ? "/parcours" : "/"} className="btn-3d mt-6 inline-block bg-accent px-5 py-2.5 text-sm text-white">
            {total === 0 ? "Voir le parcours" : "Retour"}
          </Link>
        </div>
      </Shell>
    );
  }

  const stored = srs[card.id];
  const previews = stored ? previewDue(stored) : null;

  return (
    <Shell>
      <div className="mb-4 flex items-center justify-between text-sm text-muted">
        <span>{conceptTitle(card.concept)}</span>
        <span className="num">{queue.length} restante{queue.length > 1 ? "s" : ""}</span>
      </div>

      <div key={card.id + done} className="card animate-rise p-6 sm:p-8">
        <p className="font-display text-2xl font-bold leading-snug">{card.front}</p>

        {card.kind === "flash" ? (
          !revealed ? (
            <button onClick={() => setRevealed(true)} className="btn-3d mt-8 w-full bg-accent py-3.5 text-white">
              Afficher la réponse <span className="ml-2 font-medium text-white/70">espace</span>
            </button>
          ) : (
            <>
              <p className="animate-rise mt-6 border-t border-line pt-6 text-lg leading-relaxed">{card.back}</p>
              <p className="mt-8 text-xs text-muted">Avais-tu la réponse en tête ?</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {GRADES.map(({ g, label, key }) => (
                  <button
                    key={g}
                    onClick={() => grade(g)}
                    className={clsx("px-3 py-2.5 text-sm", g === Rating.Good ? "btn-3d bg-accent text-white" : "btn-ghost")}
                  >
                    <div className="font-semibold">{label}</div>
                    <div className="num text-xs opacity-60">
                      {previews ? humanDelay(previews[g]) : ""} · {key}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )
        ) : (
          <>
            <div className="mt-6 grid gap-2">
              {card.options.map((o, i) => (
                <Choice key={i} disabled={choice !== null} state={choiceState(i, card.answer, choice)} onClick={() => setChoice(i)}>
                  {o}
                </Choice>
              ))}
            </div>
            {choice !== null && (
              <div className="animate-rise mt-6 border-t border-line pt-5">
                <p className="text-muted">{card.explain}</p>
                <button
                  onClick={() => grade(choice === card.answer ? Rating.Good : Rating.Again)}
                  className="btn-3d mt-5 bg-accent px-5 py-2.5 text-sm text-white"
                >
                  {choice === card.answer ? "Continuer" : "Compris, je la reverrai"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-12">
      <h1 className="mb-8 font-display text-4xl font-extrabold tracking-tight">Révisions</h1>
      {children}
    </div>
  );
}
