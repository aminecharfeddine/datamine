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
import { DeckOverview } from "./DeckOverview";

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
  const requeueCard = useProgress((s) => s.requeue);
  const [queue, setQueue] = useState<string[] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [choice, setChoice] = useState<number | null>(null);
  const [done, setDone] = useState(0);

  // La file est figée au début de la session ; une carte ratée revient lors d'une prochaine session.
  useEffect(() => {
    if (hydrated && queue === null) setQueue(dueCardIds(srs));
  }, [hydrated, queue, srs]);

  const currentId = queue?.[0];

  /** Remet une carte à réviser : elle est due tout de suite (synchronisé) et rejoint la session en cours. */
  const requeue = (id: string) => {
    requeueCard(id);
    setQueue((q) => (q && !q.includes(id) ? [...q, id] : q));
    setRevealed(false);
  };
  const card = currentId ? cardById(currentId) : undefined;

  const grade = (g: Grade) => {
    if (!currentId) return;
    review(currentId, g);
    // Une carte ratée revient dans 10 minutes, pas immédiatement dans la même session.
    setQueue((q) => q!.slice(1));
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
      } else if (card.kind === "mcq" && choice !== null) {
        const allowed = choice === card.answer ? GRADES.slice(1) : GRADES.slice(0, 1);
        const g = allowed.find((x) => x.key === e.key);
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
          <Link href={total === 0 ? "/parcours" : "/aujourdhui"} className="btn-3d mt-6 inline-block bg-accent px-5 py-2.5 text-sm text-white">
            {total === 0 ? "Voir le parcours" : "Retour"}
          </Link>
        </div>
        <DeckOverview queue={[]} onRequeue={requeue} defaultOpen={true} />
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
              <p className="mt-8 text-sm text-muted">Avais-tu la réponse en tête ? Le délai indique quand la carte reviendra.</p>
              <GradeButtons grades={GRADES} previews={previews} onGrade={grade} />
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
                {choice === card.answer ? (
                  <>
                    <p className="mt-6 text-sm text-muted">Bonne réponse. Était-ce facile ? Le délai indique quand la carte reviendra.</p>
                    <GradeButtons grades={GRADES.slice(1)} previews={previews} onGrade={grade} />
                  </>
                ) : (
                  <>
                    <p className="mt-6 text-sm text-muted">Pas grave : la carte revient bientôt pour ancrer la bonne réponse.</p>
                    <GradeButtons grades={GRADES.slice(0, 1)} previews={previews} onGrade={grade} />
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <DeckOverview queue={queue} onRequeue={requeue} defaultOpen={false} />
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

function GradeButtons({
  grades,
  previews,
  onGrade,
}: {
  grades: { g: Grade; label: string; key: string }[];
  previews: Record<Grade, Date> | null;
  onGrade: (g: Grade) => void;
}) {
  return (
    <div className={clsx("mt-2 grid gap-2", grades.length === 4 ? "grid-cols-2 sm:grid-cols-4" : grades.length === 3 ? "grid-cols-3" : "grid-cols-1 sm:max-w-xs")}>
      {grades.map(({ g, label, key }) => (
        <button
          key={g}
          onClick={() => onGrade(g)}
          className={clsx("px-3 py-2.5 text-sm", g === Rating.Good || grades.length === 1 ? "btn-3d bg-accent text-white" : "btn-ghost")}
        >
          <div className="font-semibold">{label}</div>
          <div className="num text-xs opacity-70">
            {previews ? `dans ${humanDelay(previews[g])}` : ""} · touche {key}
          </div>
        </button>
      ))}
    </div>
  );
}
