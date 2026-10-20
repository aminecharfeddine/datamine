"use client";

import { useState } from "react";
import clsx from "clsx";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { BUGS, CIRCLE_TEST, CIRCLE_TRAIN, LOOP, trainLoop, type Bug, type Run } from "@/lib/nn";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { Choice } from "@/components/pedago/Choice";
import { Highlighted } from "@/components/code/Code";
import { LabFrame, Segmented } from "./controls";
import { useHydrated } from "@/components/ui/useHydrated";

const cache = new Map<string, Run>();
const getRun = (bug: Bug, seed = 3) => {
  const k = `${bug}:${seed}`;
  if (!cache.has(k)) cache.set(k, trainLoop(CIRCLE_TRAIN, CIRCLE_TEST, bug, LOOP.epochs, seed));
  return cache.get(k)!;
};
const MYSTERY: Bug = "shuffle";
const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")} %`;

const LOOP_CODE = (bug: Bug) => [
  { t: `loader = DataLoader(train_ds, batch_size=${LOOP.batch}, shuffle=${bug === "shuffle" ? "False" : "True"})`, bad: bug === "shuffle" },
  { t: `optimizer = torch.optim.SGD(model.parameters(), lr=${bug === "lr" ? "10.0" : "0.5"})`, bad: bug === "lr" },
  { t: "for epoch in range(40):", bad: false },
  { t: "    model.train()", bad: false },
  { t: "    for X, y in loader:", bad: false },
  { t: bug === "scale" ? "        X = X_raw  # pas de normalisation" : "        X = (X_raw - mu) / sigma", bad: bug === "scale" },
  { t: bug === "zero-grad" ? "        # optimizer.zero_grad()  ← oublié" : "        optimizer.zero_grad()", bad: bug === "zero-grad" },
  { t: "        loss = loss_fn(model(X), y)", bad: false },
  { t: "        loss.backward()", bad: false },
  { t: "        optimizer.step()", bad: false },
];

/** Une vraie boucle d'entraînement (réseau 2 → 16 → 1) et cinq variantes, dont quatre buguées. */
export function TrainLoopLab(props: { id?: string; challenge?: string }) {
  // Calculs flottants (exp, tanh) : le serveur et le navigateur peuvent différer au dernier chiffre. On calcule côté client seulement.
  const hydrated = useHydrated();
  if (!hydrated) return <LabFrame labKey={props.id ?? "loop"}><div className="h-[520px]" /></LabFrame>;
  return <TrainLoopInner {...props} />;
}

function TrainLoopInner({ id = "loop", challenge }: { id?: string; challenge?: string }) {
  const [bug, setBug] = useState<Bug>("zero-grad");
  const [guess, setGuess] = useState<Bug | null>(null);
  const clean = getRun("none");
  const run = getRun(bug);
  const mystery = getRun(MYSTERY, 11);
  const guessed = guess === MYSTERY;
  const solved = challenge ? CHALLENGES[challenge].check({ guessed }) : false;

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-5">
        <Segmented label="Version de la boucle" value={bug} onChange={setBug} options={BUGS.map((b) => ({ value: b.id, label: b.label }))} />
      </div>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] [&>*]:min-w-0">
        <div>
          <StepCurve run={run} reference={bug === "none" ? undefined : clean} title="Loss après chaque mini-batch" />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-line bg-paper p-3">
              <div className="text-xs font-semibold text-muted">Loss finale</div>
              <div className="num mt-0.5 text-xl font-bold">{run.loss.at(-1)!.toFixed(3).replace(".", ",")}</div>
            </div>
            <div className="rounded-xl p-3" style={{ background: "color-mix(in srgb, var(--mod) 10%, white)" }}>
              <div className="text-xs font-semibold text-muted">Précision de validation</div>
              <div className="num mt-0.5 text-xl font-bold">{pct(run.valAcc.at(-1)!)}</div>
            </div>
          </div>
        </div>
        <pre className="min-w-0 self-start overflow-x-auto rounded-2xl bg-[#171a2e] p-3" tabIndex={0}>
          {LOOP_CODE(bug).map((c, i) => (
            <div key={i} className={clsx("rounded px-1.5", c.bad && "bg-[#eb6834]/30")}>
              <Highlighted code={c.t} />
            </div>
          ))}
        </pre>
      </div>

      <div className="mt-8 border-t-2 border-dashed border-line pt-6">
        <h3 className="font-display text-lg font-bold">Courbe mystère</h3>
        <p className="mb-3 text-sm text-muted">Un collègue t'envoie cette courbe (autre initialisation, même réseau). Quel est son bug ?</p>
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <StepCurve run={mystery} reference={clean} title="Sa loss" />
          <div className="grid gap-2 self-center">
            {BUGS.filter((b) => b.id !== "none").map((b) => (
              <Choice
                key={b.id}
                disabled={guessed}
                state={guess === b.id ? (b.id === MYSTERY ? "correct" : "wrong") : guessed ? "dim" : "idle"}
                onClick={() => setGuess(b.id)}
              >
                {b.label}
              </Choice>
            ))}
            {guessed && (
              <p className="text-sm text-muted">
                Les dents de scie viennent des mini-batches triés : le modèle voit 5 batches d'une seule classe, puis 5 de l'autre, et
                oscille de l'une à l'autre à chaque époque.
              </p>
            )}
          </div>
        </div>
      </div>
    </LabFrame>
  );
}

function StepCurve({ run, reference, title }: { run: Run; reference?: Run; title: string }) {
  const W = 440, H = 220, M = { l: 34, r: 10, t: 12, b: 30 };
  const n = run.loss.length;
  const x = scaleLinear().domain([0, n]).range([M.l, W - M.r]);
  const y = scaleLinear().domain([0, 3]).range([H - M.b, M.t]).clamp(true);
  const mk = (ls: number[]) => line<number>().x((_, i) => x(i + 1)).y((v) => y(v))(ls) ?? "";
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-bold">{title}</h3>
        {reference && (
          <span className="flex items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1"><span className="inline-block h-1 w-4 rounded bg-neg" /> boucle correcte</span>
            <span className="flex items-center gap-1"><span className="inline-block h-1 w-4 rounded bg-mod" /> cette version</span>
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${title}, dernière valeur ${run.loss.at(-1)!.toFixed(2)}`}>
        {[0, 1, 2, 3].map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={M.l - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)" className="num">{v}</text>
          </g>
        ))}
        {[0, 10, 20, 30, 40].map((e) => (
          <text key={e} x={x(e * run.stepsPerEpoch)} y={H - M.b + 15} fontSize={10} textAnchor="middle" fill="var(--muted)" className="num">{e}</text>
        ))}
        <text x={(M.l + W - M.r) / 2} y={H - 3} fontSize={11} textAnchor="middle" fill="var(--muted)">époques</text>
        {reference && <path d={mk(reference.loss)} fill="none" stroke="var(--neg)" strokeWidth={2} />}
        <path d={mk(run.loss)} fill="none" stroke="var(--mod)" strokeWidth={2} />
      </svg>
    </div>
  );
}
