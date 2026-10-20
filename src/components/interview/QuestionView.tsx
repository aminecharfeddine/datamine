"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, BookOpen, Check, Eye, TriangleAlert, X } from "lucide-react";
import { Highlighted } from "@/components/code/Code";
import { checkCalc, shuffle, KINDS, LEVELS, PASS, TOPICS, type BugQ, type CalcQ, type ItvQuestion, type OralQ, type QcmQ } from "@/lib/interview";

const fmtNum = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 4 });

/** Une question d'entretien, quel que soit son format. Appelle onDone(score entre 0 et 1) une fois la réponse évaluée. */
export function QuestionView({ q, onDone, onNext, nextLabel }: { q: ItvQuestion; onDone: (score: number) => void; onNext: () => void; nextLabel: string }) {
  const [score, setScore] = useState<number | null>(null);
  const finish = (s: number) => {
    if (score !== null) return;
    setScore(s);
    onDone(s);
  };
  const topic = TOPICS.find((t) => t.id === q.topic)!;
  const kind = KINDS.find((k) => k.id === q.kind)!;

  return (
    <article className="card p-5 sm:p-7">
      <div className="mb-4 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-accent">{topic.title}</span>
        <span className="rounded-full bg-sunken px-2.5 py-1 text-muted">{kind.title}</span>
        <span className="rounded-full bg-sunken px-2.5 py-1 text-muted">{LEVELS[q.level]}</span>
        {q.trap && score !== null && (
          <span className="flex items-center gap-1 rounded-full bg-[#fff4ed] px-2.5 py-1 text-[#b93815]">
            <TriangleAlert size={12} strokeWidth={2.6} /> Question piège
          </span>
        )}
      </div>
      <h2 className="font-display text-xl font-bold leading-snug sm:text-[1.35rem]">{q.q}</h2>

      <div className="mt-5">
        {q.kind === "qcm" && <Qcm q={q} done={score !== null} onAnswer={finish} />}
        {q.kind === "calcul" && <Calc q={q} done={score !== null} onAnswer={finish} />}
        {q.kind === "bug" && <Bug q={q} done={score !== null} onAnswer={finish} />}
        {q.kind === "oral" && <Oral q={q} done={score !== null} onAnswer={finish} />}
      </div>

      {score !== null && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          {q.lesson ? (
            <Link href={`/lecons/${q.lesson}`} target="_blank" className="flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
              <BookOpen size={16} /> Revoir la leçon
            </Link>
          ) : (
            <span />
          )}
          <button onClick={onNext} className="btn-3d bg-accent flex items-center gap-2 px-5 py-2.5 text-white" autoFocus>
            {nextLabel} <ArrowRight size={17} strokeWidth={2.6} />
          </button>
        </div>
      )}
    </article>
  );
}

function Verdict({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div className={clsx("mt-4 rounded-2xl px-4 py-3 text-[0.95rem] leading-relaxed", ok ? "bg-[#ecfdf3] text-[#05603a]" : "bg-[#fff4ed] text-[#7a2610]")}>
      <div className="mb-1 flex items-center gap-1.5 font-bold">
        {ok ? <Check size={17} strokeWidth={3} /> : <X size={17} strokeWidth={3} />}
        {ok ? "Bonne réponse" : "Pas tout à fait"}
      </div>
      {children}
    </div>
  );
}

// ------------------------------------------------------------ QCM

function Qcm({ q, done, onAnswer }: { q: QcmQ; done: boolean; onAnswer: (s: number) => void }) {
  // Ordre mélangé après le montage : identique entre rendu serveur et client, puis aléatoire.
  const [order, setOrder] = useState(() => q.options.map((_, i) => i));
  useEffect(() => setOrder(shuffle(q.options.map((_, i) => i), Math.random)), [q]);
  const [picked, setPicked] = useState<number | null>(null);
  const pick = (i: number) => {
    if (done) return;
    setPicked(i);
    onAnswer(i === q.answer ? 1 : 0);
  };
  return (
    <div>
      <div className="space-y-2">
        {order.map((i, k) => {
          const state = picked === null ? "idle" : i === q.answer ? "right" : i === picked ? "wrong" : "dim";
          return (
            <button
              key={i}
              onClick={() => pick(i)}
              disabled={done}
              className={clsx(
                "flex w-full items-start gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[0.95rem] transition-colors",
                state === "idle" && "border-line bg-surface hover:border-accent",
                state === "right" && "border-[#12b76a] bg-[#ecfdf3]",
                state === "wrong" && "border-[#f97066] bg-[#fef3f2]",
                state === "dim" && "border-line bg-surface opacity-60",
              )}
            >
              <span className="num mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-sunken text-xs font-bold">{String.fromCharCode(65 + k)}</span>
              <span>{q.options[i]}</span>
            </button>
          );
        })}
      </div>
      {picked !== null && <Verdict ok={picked === q.answer}>{q.explain}</Verdict>}
    </div>
  );
}

// ------------------------------------------------------------ Calcul

function Calc({ q, done, onAnswer }: { q: CalcQ; done: boolean; onAnswer: (s: number) => void }) {
  const [raw, setRaw] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  const submit = () => {
    if (done || !raw.trim()) return;
    const good = checkCalc(raw, q.answer, q.tolerance);
    setOk(good);
    onAnswer(good ? 1 : 0);
  };
  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          disabled={done}
          inputMode="decimal"
          placeholder="Ta réponse"
          aria-label="Ta réponse"
          className="num w-44 rounded-xl border-2 border-line bg-surface px-3 py-2 text-lg font-bold outline-none focus:border-accent"
          autoFocus
        />
        {q.unit && <span className="font-semibold text-muted">{q.unit}</span>}
        {!done && (
          <button type="submit" disabled={!raw.trim()} className="btn-3d bg-accent px-4 py-2 text-white">
            Valider
          </button>
        )}
      </form>
      {ok !== null && (
        <Verdict ok={ok}>
          <p className="mb-1 font-semibold">
            Réponse attendue : <span className="num">{fmtNum(q.answer)}</span>
            {q.unit ? ` ${q.unit}` : ""}
          </p>
          {q.explain}
        </Verdict>
      )}
    </div>
  );
}

// ------------------------------------------------------------ Bug

function Bug({ q, done, onAnswer }: { q: BugQ; done: boolean; onAnswer: (s: number) => void }) {
  const lines = q.code.split("\n");
  const [picked, setPicked] = useState<number | null>(null);
  const pick = (n: number) => {
    if (done || !lines[n - 1].trim()) return;
    setPicked(n);
    onAnswer(n === q.line ? 1 : 0);
  };
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-muted">Clique sur la ligne fautive.</p>
      <div className="overflow-x-auto rounded-2xl bg-[#171a2e] py-3" tabIndex={0}>
        {lines.map((l, i) => {
          const n = i + 1;
          const isBug = picked !== null && n === q.line;
          const isWrong = picked === n && n !== q.line;
          return (
            <button
              key={i}
              onClick={() => pick(n)}
              disabled={done || !l.trim()}
              className={clsx(
                "flex w-full min-w-max items-center gap-3 border-l-4 pr-4 text-left",
                isBug ? "border-[#12b76a] bg-[#12b76a]/20" : isWrong ? "border-[#f97066] bg-[#f97066]/20" : "border-transparent",
                !done && l.trim() && "hover:bg-white/10",
              )}
            >
              <span className="num w-8 shrink-0 select-none text-right text-xs text-[#6b7094]">{n}</span>
              <Highlighted code={l || " "} lang={q.lang} />
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <Verdict ok={picked === q.line}>
          {picked !== q.line && <p className="mb-1 font-semibold">Le problème est à la ligne {q.line}.</p>}
          <p>{q.explain}</p>
          <p className="mt-2">
            <b>Correction :</b> {q.fix}
          </p>
        </Verdict>
      )}
    </div>
  );
}

// ------------------------------------------------------------ Oral

function Oral({ q, done, onAnswer }: { q: OralQ; done: boolean; onAnswer: (s: number) => void }) {
  const [draft, setDraft] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [checked, setChecked] = useState<boolean[]>(q.points.map(() => false));
  const n = checked.filter(Boolean).length;
  const score = n / q.points.length;

  return (
    <div>
      <label htmlFor={`oral-${q.id}`} className="mb-1.5 block text-sm font-semibold text-muted">
        Ta réponse : prends une à deux minutes, comme à l'oral (facultatif d'écrire, mais structure-la)
      </label>
      <textarea
        id={`oral-${q.id}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={revealed}
        rows={5}
        placeholder="Définition, intuition, exemple, limites…"
        className="w-full rounded-2xl border-2 border-line bg-surface px-4 py-3 text-[0.95rem] leading-relaxed outline-none focus:border-accent disabled:opacity-80"
      />
      {!revealed ? (
        <button onClick={() => setRevealed(true)} className="btn-3d bg-accent mt-3 flex items-center gap-2 px-4 py-2 text-white">
          <Eye size={17} /> Voir les points attendus
        </button>
      ) : (
        <div className="mt-5">
          <div className="mb-2 text-sm font-bold">Coche les points que tu as vraiment couverts</div>
          <ul className="space-y-1.5">
            {q.points.map((p, i) => (
              <li key={i}>
                <label className={clsx("flex cursor-pointer items-start gap-3 rounded-xl border-2 px-3 py-2.5 text-[0.95rem]", checked[i] ? "border-[#12b76a] bg-[#ecfdf3]" : "border-line bg-surface", done && "cursor-default")}>
                  <input
                    type="checkbox"
                    checked={checked[i]}
                    disabled={done}
                    onChange={() => setChecked((c) => c.map((x, j) => (j === i ? !x : x)))}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#12b76a]"
                  />
                  <span>{p}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-2xl bg-paper px-4 py-3 text-[0.95rem] leading-relaxed">
            <div className="mb-1 text-sm font-bold">Réponse type</div>
            {q.answer}
          </div>
          {!done ? (
            <button onClick={() => onAnswer(score)} className="btn-3d bg-accent mt-4 px-4 py-2 text-white">
              Valider : {n} / {q.points.length} points
            </button>
          ) : (
            <p className={clsx("mt-4 font-semibold", score >= PASS ? "text-[#05603a]" : "text-[#b93815]")}>
              {score >= PASS ? "Réponse solide." : "À retravailler : relis la réponse type et reformule-la à voix haute."} {n} / {q.points.length} points couverts.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
