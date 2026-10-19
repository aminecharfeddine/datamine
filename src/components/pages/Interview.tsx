"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Briefcase, Check, Clock, MessagesSquare, RotateCcw, Target, TriangleAlert, X } from "lucide-react";
import {
  answerKey, filterQuestions, KINDS, LEVELS, okKey, PASS, pickSimulation, QUESTIONS, questionById, sessionReport, shuffle, SUGGESTED_SECONDS, TOPICS,
  topicProgress, XP_QUESTION, XP_SIMULATION, type Filters, type ItvKind, type ItvLevel, type SessionResult,
} from "@/lib/interview";
import { dayKey } from "@/lib/gamification";
import { useProgress } from "@/lib/store";
import { useHydrated } from "@/components/ui/useHydrated";
import { QuestionView } from "@/components/interview/QuestionView";

type Session = { mode: "simulation" | "practice"; ids: string[]; index: number; results: SessionResult[]; startedAt: number; finished: boolean };

const pct = (v: number) => `${Math.round(v * 100)}\u202f%`;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function Interview() {
  const hydrated = useHydrated();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [session?.index, session?.finished, session === null]);

  if (!hydrated) return <div className="mx-auto max-w-4xl px-4 pt-10" />;
  if (session && !session.finished) return <Runner session={session} setSession={setSession} />;
  if (session && session.finished) return <Report session={session} onClose={() => setSession(null)} onRetry={(ids) => setSession(newSession("practice", ids))} />;
  return <Hub start={(mode, ids) => setSession(newSession(mode, ids))} />;
}

const newSession = (mode: Session["mode"], ids: string[]): Session => ({ mode, ids, index: 0, results: [], startedAt: Date.now(), finished: false });

// ============================================================ Accueil

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={clsx("rounded-xl border-2 px-3 py-1.5 text-sm font-semibold transition-colors", active ? "border-accent bg-accent text-white" : "border-line bg-surface hover:border-accent")}
    >
      {children}
    </button>
  );
}

const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

function Hub({ start }: { start: (mode: Session["mode"], ids: string[]) => void }) {
  const answers = useProgress((s) => s.answers);
  const explored = useProgress((s) => s.explored);
  const [f, setF] = useState<Filters>({ topics: [], kinds: [], levels: [], trapsOnly: false, scope: "all" });
  const matching = useMemo(() => filterQuestions(f, answers), [f, answers]);
  const progress = topicProgress(answers);
  const ok = Object.values(progress).reduce((a, p) => a + p.ok, 0);
  const retry = Object.values(progress).reduce((a, p) => a + p.retry, 0);
  const sims = Object.keys(explored).filter((k) => k.startsWith("itv-sim:")).length;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-10">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-white">
          <Briefcase size={24} strokeWidth={2.3} />
        </span>
        <span className="text-sm font-bold text-muted">Module spécial</span>
      </div>
      <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Entretiens</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        {QUESTIONS.length} questions types d'entretien data et IA : théorie à expliquer à l'oral, choix de modèle, études de cas, code à déboguer,
        calculs au tableau, et les pièges classiques des recruteurs.
      </p>

      <div className="mt-6 grid grid-cols-3 gap-3 sm:max-w-xl">
        <Stat label="Réussies" value={`${ok} / ${QUESTIONS.length}`} />
        <Stat label="À retravailler" value={String(retry)} />
        <Stat label="Entretiens blancs réussis" value={String(sims)} />
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-[1fr_1.25fr] [&>*]:min-w-0">
        <section className="card flex flex-col p-6">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-white">
            <MessagesSquare size={22} strokeWidth={2.4} />
          </span>
          <h2 className="mt-4 font-display text-2xl font-bold">Entretien blanc</h2>
          <p className="mt-2 text-muted">
            10 questions tirées au sort comme dans un vrai entretien technique : 4 QCM, 2 réponses orales, 2 bugs, 2 calculs, sur des thèmes variés et de
            difficulté croissante. Chronomètre et bilan par thème à la fin.
          </p>
          <ul className="mt-4 space-y-1.5 text-sm">
            <li className="flex items-center gap-2"><Clock size={15} className="text-muted" /> Environ 20 minutes</li>
            <li className="flex items-center gap-2"><Target size={15} className="text-muted" /> Priorité aux questions jamais vues ou ratées</li>
            <li className="flex items-center gap-2"><Check size={15} className="text-muted" /> Réussi à partir de 70 %, +{XP_SIMULATION} XP</li>
          </ul>
          <div className="mt-auto pt-6">
            <button onClick={() => start("simulation", pickSimulation(Date.now(), answers).map((q) => q.id))} className="btn-3d bg-accent w-full px-5 py-3 text-white">
              Commencer l'entretien blanc
            </button>
          </div>
        </section>

        <section className="card p-6">
          <h2 className="font-display text-2xl font-bold">Entraînement ciblé</h2>
          <p className="mt-1 text-sm text-muted">Choisis tes thèmes et formats. Sans filtre, toutes les questions sont proposées dans un ordre aléatoire.</p>

          <div className="mt-5 space-y-4">
            <FilterGroup label="Thèmes">
              {TOPICS.map((t) => (
                <Chip key={t.id} active={f.topics.includes(t.id)} onClick={() => setF({ ...f, topics: toggle(f.topics, t.id) })}>
                  {t.short}
                </Chip>
              ))}
            </FilterGroup>
            <FilterGroup label="Formats">
              {KINDS.map((k) => (
                <Chip key={k.id} active={f.kinds.includes(k.id)} onClick={() => setF({ ...f, kinds: toggle(f.kinds, k.id as ItvKind) })}>
                  {k.title}
                </Chip>
              ))}
            </FilterGroup>
            <FilterGroup label="Niveau">
              {([1, 2, 3] as ItvLevel[]).map((l) => (
                <Chip key={l} active={f.levels.includes(l)} onClick={() => setF({ ...f, levels: toggle(f.levels, l) })}>
                  {LEVELS[l]}
                </Chip>
              ))}
              <Chip active={f.trapsOnly} onClick={() => setF({ ...f, trapsOnly: !f.trapsOnly })}>
                <span className="flex items-center gap-1"><TriangleAlert size={14} /> Pièges</span>
              </Chip>
            </FilterGroup>
            <FilterGroup label="Questions">
              {([["all", "Toutes"], ["new", "Jamais vues"], ["retry", "À retravailler"]] as const).map(([v, label]) => (
                <Chip key={v} active={f.scope === v} onClick={() => setF({ ...f, scope: v })}>
                  {label}
                </Chip>
              ))}
            </FilterGroup>
          </div>

          <button
            onClick={() => start("practice", shuffle(matching, Math.random).map((q) => q.id))}
            disabled={!matching.length}
            className="btn-3d bg-accent mt-6 w-full px-5 py-3 text-white"
          >
            {matching.length ? `S'entraîner sur ${matching.length} question${matching.length > 1 ? "s" : ""}` : "Aucune question avec ces filtres"}
          </button>
        </section>
      </div>

      <h2 className="mt-12 font-display text-2xl font-bold">Par thème</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TOPICS.map((t) => {
          const p = progress[t.id];
          return (
            <button
              key={t.id}
              onClick={() => start("practice", shuffle(QUESTIONS.filter((q) => q.topic === t.id), Math.random).map((q) => q.id))}
              className="card group p-4 text-left transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-lg font-bold">{t.title}</span>
                <span className="num text-sm font-semibold text-muted">{p.ok} / {p.total}</span>
              </div>
              <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-sunken">
                <span className="h-full bg-[#12b76a]" style={{ width: `${(p.ok / p.total) * 100}%` }} />
                <span className="h-full bg-[#fdb022]" style={{ width: `${(p.retry / p.total) * 100}%` }} />
              </div>
              <div className="mt-2 text-xs text-muted">{p.retry ? `${p.retry} à retravailler` : p.ok === p.total ? "Thème maîtrisé" : "Clique pour t'entraîner"}</div>
            </button>
          );
        })}
      </div>

      <section className="mt-12 rounded-3xl bg-paper p-6">
        <h2 className="font-display text-xl font-bold">Répondre comme en entretien</h2>
        <ul className="mt-3 grid gap-3 text-[0.95rem] sm:grid-cols-2">
          <li><b>Clarifie d'abord.</b> Reformule la question, demande l'objectif métier, les contraintes (volume, latence, interprétabilité) et ce qui est mesuré.</li>
          <li><b>Structure.</b> Définition, intuition, exemple concret, limites. Pour une étude de cas : données, baseline, modèle, évaluation, déploiement, suivi.</li>
          <li><b>Parle des compromis.</b> Il y a rarement une seule bonne réponse : dis ce que tu choisis, pourquoi, et ce que tu sacrifies.</li>
          <li><b>Pense à voix haute.</b> Sur un calcul ou un bug, explique ta démarche ; un raisonnement juste avec une petite erreur vaut mieux qu'un chiffre sorti de nulle part.</li>
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border-2 border-line bg-surface p-3">
      <div className="num text-xl font-bold">{value}</div>
      <div className="text-xs font-semibold text-muted">{label}</div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-sm font-semibold text-muted">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

// ============================================================ Session

function Runner({ session, setSession }: { session: Session; setSession: (s: Session | null) => void }) {
  const rememberAnswer = useProgress((s) => s.rememberAnswer);
  const explore = useProgress((s) => s.explore);
  const award = useProgress((s) => s.award);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const q = questionById(session.ids[session.index])!;
  const isSim = session.mode === "simulation";
  const total = session.ids.length;
  const elapsed = (now - session.startedAt) / 1000;
  const budget = isSim ? session.ids.reduce((a, id) => a + SUGGESTED_SECONDS[questionById(id)!.kind], 0) : 0;
  const last = session.index === total - 1;

  const done = (score: number) => {
    rememberAnswer(answerKey(q.id), Math.round(score * 100), "last");
    if (score >= PASS) {
      explore(okKey(q.id));
      award(answerKey(q.id), XP_QUESTION, "Question d'entretien réussie");
    }
    setSession({ ...session, results: [...session.results, { id: q.id, score }] });
  };

  const finish = (results: SessionResult[]) => {
    if (isSim && results.length === total && sessionReport(results).score >= PASS) {
      explore(`itv-sim:${Date.now()}`);
      award(`itv-sim:${dayKey()}`, XP_SIMULATION, "Entretien blanc réussi");
    }
    setSession({ ...session, results, finished: true });
  };

  const next = () => (last ? finish(session.results) : setSession({ ...session, index: session.index + 1 }));

  return (
    <div className="mx-auto max-w-3xl px-4 pt-8">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="font-display text-lg font-bold">{isSim ? "Entretien blanc" : "Entraînement"}</span>
        <span className="num text-sm font-semibold text-muted">
          Question {session.index + 1} / {total}
        </span>
        {isSim && (
          <span className={clsx("num flex items-center gap-1 rounded-lg px-2 py-0.5 text-sm font-semibold", elapsed > budget ? "bg-[#fff4ed] text-[#b93815]" : "bg-sunken text-muted")}>
            <Clock size={14} /> {clock(elapsed)} / {clock(budget)}
          </span>
        )}
        <button
          onClick={() => (session.results.length ? finish(session.results) : setSession(null))}
          className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold text-muted hover:bg-sunken hover:text-ink"
        >
          <X size={16} /> {session.results.length ? "Terminer" : "Quitter"}
        </button>
      </div>
      {total > 20 ? (
        <div className="mb-6 h-2 overflow-hidden rounded-full bg-sunken">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(session.index / total) * 100}%` }} />
        </div>
      ) : (
      <div className="mb-6 flex h-2 gap-1">
        {session.ids.map((id, i) => {
          const r = session.results[i];
          return (
            <span
              key={id}
              className={clsx("h-full flex-1 rounded-full", r ? (r.score >= PASS ? "bg-[#12b76a]" : "bg-[#f97066]") : i === session.index ? "bg-accent" : "bg-sunken")}
            />
          );
        })}
      </div>
      )}
      <QuestionView key={q.id} q={q} onDone={done} onNext={next} nextLabel={last ? "Voir le bilan" : "Question suivante"} />
    </div>
  );
}

// ============================================================ Bilan

function Report({ session, onClose, onRetry }: { session: Session; onClose: () => void; onRetry: (ids: string[]) => void }) {
  const r = sessionReport(session.results);
  const isSim = session.mode === "simulation";
  const passed = r.score >= PASS;
  const minutes = Math.max(1, Math.round((Date.now() - session.startedAt) / 60000));

  return (
    <div className="mx-auto max-w-3xl px-4 pt-10">
      <div className="card p-6 sm:p-8">
        <div className="text-sm font-bold text-muted">{isSim ? "Bilan de l'entretien blanc" : "Bilan de l'entraînement"}</div>
        <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1">
          <span className="num font-display text-6xl font-extrabold">{pct(r.score)}</span>
          <span className="pb-2 text-muted">
            {r.passed} / {session.results.length} questions réussies, {minutes} min
          </span>
        </div>
        <p className={clsx("mt-3 text-lg font-semibold", passed ? "text-[#05603a]" : "text-[#b93815]")}>
          {passed
            ? isSim
              ? "Entretien réussi. Continue à varier les thèmes pour que ce soit vrai sur n'importe quelle question."
              : "Bon niveau sur cette série."
            : "Pas encore. Les questions ratées sont marquées « à retravailler » et reviendront en priorité."}
        </p>

        {r.topics.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 text-sm font-bold">Par thème</div>
            <div className="space-y-2">
              {r.topics.map((t) => (
                <div key={t.topic} className="flex items-center gap-3 text-sm">
                  <span className="w-40 shrink-0 font-semibold">{TOPICS.find((x) => x.id === t.topic)!.title}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-sunken">
                    <span className={clsx("block h-full rounded-full", t.score >= PASS ? "bg-[#12b76a]" : "bg-[#f97066]")} style={{ width: `${Math.max(4, t.score * 100)}%` }} />
                  </span>
                  <span className="num w-12 text-right">{pct(t.score)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {r.toReview.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 text-sm font-bold">À retravailler</div>
            <ul className="space-y-1.5">
              {r.toReview.map((q) => (
                <li key={q.id} className="rounded-xl bg-paper px-3 py-2 text-sm">
                  <span className="font-semibold">{q.q}</span>
                  {q.lesson && (
                    <Link href={`/lecons/${q.lesson}`} className="ml-2 whitespace-nowrap font-semibold text-accent hover:underline">
                      Revoir la leçon
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          {r.toReview.length > 0 && (
            <button onClick={() => onRetry(r.toReview.map((q) => q.id))} className="btn-3d bg-accent flex items-center gap-2 px-5 py-2.5 text-white">
              <RotateCcw size={16} /> Refaire les questions ratées
            </button>
          )}
          <button onClick={onClose} className="btn-ghost px-5 py-2.5">
            Retour aux entretiens
          </button>
        </div>
      </div>
    </div>
  );
}

