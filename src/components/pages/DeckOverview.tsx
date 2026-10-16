"use client";
import { useState } from "react";
import clsx from "clsx";
import { ChevronDown, History, RotateCcw } from "lucide-react";
import { State } from "ts-fsrs";
import { useProgress, humanDelay, type StoredCard } from "@/lib/store";
import { cardById } from "@/lib/cards";
import { conceptTitle, moduleOfConcept } from "@/lib/curriculum";

const BUCKETS = [
  { id: "now", label: "À réviser maintenant" },
  { id: "today", label: "Plus tard aujourd'hui" },
  { id: "tomorrow", label: "Demain" },
  { id: "week", label: "Cette semaine" },
  { id: "later", label: "Plus tard" },
] as const;

function bucketOf(due: Date, now: Date): (typeof BUCKETS)[number]["id"] {
  if (due <= now) return "now";
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  if (due <= endOfDay) return "today";
  const endOfTomorrow = new Date(endOfDay.getTime() + 86_400_000);
  if (due <= endOfTomorrow) return "tomorrow";
  if (+due - +now <= 7 * 86_400_000) return "week";
  return "later";
}

const STATE_LABEL: Record<number, string> = {
  [State.New]: "Nouvelle",
  [State.Learning]: "En apprentissage",
  [State.Review]: "En révision",
  [State.Relearning]: "À réapprendre",
};

const GRADE: Record<number, { label: string; cls: string }> = {
  1: { label: "À revoir", cls: "bg-[#fef3f2] text-[#b42318]" },
  2: { label: "Difficile", cls: "bg-[#fffaeb] text-[#93370d]" },
  3: { label: "Correct", cls: "bg-accent-soft text-accent-deep" },
  4: { label: "Facile", cls: "bg-[#ecfdf3] text-good" },
};

/**
 * Vue de tout le deck : quand chaque carte reviendra, et un bouton pour la remettre à réviser tout de suite.
 * Plus l'historique des dernières révisions.
 */
export function DeckOverview({ queue, onRequeue, defaultOpen }: { queue: string[]; onRequeue: (id: string) => void; defaultOpen: boolean }) {
  const srs = useProgress((s) => s.srs);
  const log = useProgress((s) => s.reviewLog);
  const [open, setOpen] = useState(defaultOpen);
  const [showLog, setShowLog] = useState(false);
  const now = new Date();

  const entries = Object.entries(srs)
    .filter(([id]) => cardById(id))
    .map(([id, c]) => ({ id, c, due: new Date(c.due), card: cardById(id)! }))
    .sort((a, b) => +a.due - +b.due);
  if (entries.length === 0) return null;

  const groups = BUCKETS.map((b) => ({ ...b, items: entries.filter((e) => bucketOf(e.due, now) === b.id) })).filter((g) => g.items.length);

  return (
    <section className="mt-10">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 text-left">
        <span>
          <span className="block font-display text-2xl font-bold">Ton deck</span>
          <span className="text-sm text-muted">
            {entries.length} cartes · quand chacune reviendra, et la possibilité de la remettre à réviser
          </span>
        </span>
        <ChevronDown size={22} className="shrink-0 text-muted transition-transform" style={{ transform: open ? "rotate(180deg)" : undefined }} />
      </button>

      {open && (
        <div className="mt-5 space-y-6">
          {groups.map((g) => (
            <div key={g.id}>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-muted">
                {g.label} <span className="num rounded-full bg-sunken px-2 py-0.5 text-xs">{g.items.length}</span>
              </h3>
              <ul className="card divide-y divide-line overflow-hidden">
                {g.items.map(({ id, c, due, card }) => (
                  <DeckRow key={id} id={id} c={c} due={due} front={card.front} concept={card.concept} inQueue={queue.includes(id)} onRequeue={onRequeue} now={now} />
                ))}
              </ul>
            </div>
          ))}

          {log.length > 0 && (
            <div>
              <button onClick={() => setShowLog((v) => !v)} className="flex items-center gap-2 text-sm font-bold text-muted hover:text-ink">
                <History size={16} /> {showLog ? "Masquer" : "Voir"} l'historique des révisions ({log.length})
              </button>
              {showLog && (
                <ul className="card mt-2 divide-y divide-line overflow-hidden">
                  {[...log].reverse().slice(0, 40).map((e) => {
                    const card = cardById(e.c);
                    const t = new Date(e.t);
                    return (
                      <li key={`${e.t}|${e.c}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <span className="num w-28 shrink-0 text-xs text-muted">
                          {t.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} ·{" "}
                          {t.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{card?.front ?? e.c}</span>
                        <span className={clsx("shrink-0 rounded-full px-2 py-0.5 text-xs font-bold", GRADE[e.g]?.cls)}>{GRADE[e.g]?.label}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function DeckRow({
  id,
  c,
  due,
  front,
  concept,
  inQueue,
  onRequeue,
  now,
}: {
  id: string;
  c: StoredCard;
  due: Date;
  front: string;
  concept: string;
  inQueue: boolean;
  onRequeue: (id: string) => void;
  now: Date;
}) {
  const mod = moduleOfConcept(concept);
  const isDue = due <= now;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: mod?.color ?? "var(--muted)" }} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.95rem] font-medium">{front}</span>
        <span className="text-xs text-muted">
          {conceptTitle(concept)} · {STATE_LABEL[c.state] ?? ""}
          {c.reps > 0 ? ` · ${c.reps} révision${c.reps > 1 ? "s" : ""}` : ""}
        </span>
      </span>
      <span className="num shrink-0 text-xs font-semibold text-muted">{isDue ? "maintenant" : `dans ${humanDelay(due, now)}`}</span>
      {inQueue ? (
        <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent-deep">dans la session</span>
      ) : (
        <button
          onClick={() => onRequeue(id)}
          className="btn-ghost inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs"
          title="La carte revient tout de suite dans tes révisions"
        >
          <RotateCcw size={13} strokeWidth={2.6} /> Réviser maintenant
        </button>
      )}
    </li>
  );
}
