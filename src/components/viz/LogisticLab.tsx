"use client";

import { useMemo, useState } from "react";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { accuracy1, fitPolyLogistic, fitStudy, logit1, logLoss, polyLogitProba, STUDY, type LogRegModel } from "@/lib/models";
import { accuracy, moonGrid, MOON_TEST, MOON_TRAIN } from "@/lib/ml";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { LabFrame, Segmented, Slider } from "./controls";
import { AccReadouts, DecisionMap } from "./Classify2D";

const fmt = (v: number, d = 2) => v.toFixed(d).replace(".", ",");
const BEST = fitStudy(STUDY);
const BEST_LOSS = logLoss(logit1(BEST.w, BEST.x0), STUDY);
const XS = Array.from({ length: 201 }, (_, i) => i / 20);
// Léger décalage vertical déterministe pour que les points de même abscisse ne se cachent pas.
const JITTER = STUDY.map((_, i) => (((i * 37) % 11) - 5) * 0.006);

/**
 * Régression logistique à une variable : la pente et le point de bascule d'une sigmoïde,
 * et le coût (log-loss) de chaque point mal anticipé.
 */
export function SigmoidLab({ id = "sigmoid", w: w0 = 0.4, x0: x00 = 3, challenge }: { id?: string; w?: number; x0?: number; challenge?: string }) {
  const [w, setW] = useState(w0);
  const [x0, setX0] = useState(x00);
  const f = logit1(w, x0);
  const loss = logLoss(f, STUDY);
  const acc = accuracy1(f, STUDY);
  const costs = STUDY.map((p) => -Math.log(Math.max(1e-9, p.y ? f(p.x) : 1 - f(p.x))));
  const worst = costs.indexOf(Math.max(...costs));
  const solved = challenge ? CHALLENGES[challenge].check({ w, x0, loss, bestLoss: BEST_LOSS }) : false;

  const W = 520, H = 300, M = { l: 44, r: 16, t: 16, b: 40 };
  const x = scaleLinear().domain([0, 10]).range([M.l, W - M.r]);
  const y = scaleLinear().domain([-0.08, 1.08]).range([H - M.b, M.t]);
  const path = line<number>().x((v) => x(v)).y((v) => y(f(v)))(XS) ?? "";

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <Slider label="Pente w (netteté de la transition)" value={w} min={0} max={4} step={0.05} onChange={setW} display={fmt(w)} />
        <Slider label="Point de bascule (p = 0,5)" value={x0} min={0} max={10} step={0.1} onChange={setX0} display={`${fmt(x0, 1)} h`} />
      </div>
      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-lg font-bold">Probabilité de réussite selon les heures de révision</h3>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Sigmoïde de pente ${fmt(w)} et de point de bascule ${fmt(x0, 1)} heures, sur ${STUDY.length} étudiants.`}>
            {[0, 0.5, 1].map((v) => (
              <g key={v}>
                <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray={v === 0.5 ? "4 4" : undefined} />
                <text x={M.l - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)" className="num">{fmt(v, 1)}</text>
              </g>
            ))}
            {[0, 2, 4, 6, 8, 10].map((v) => (
              <text key={v} x={x(v)} y={H - M.b + 16} fontSize={10} textAnchor="middle" fill="var(--muted)" className="num">{v} h</text>
            ))}
            <text x={(M.l + W - M.r) / 2} y={H - 4} fontSize={11} textAnchor="middle" fill="var(--muted)">heures de révision</text>
            <text x={M.l + 4} y={y(1) - 5} fontSize={10} fill="var(--muted)">réussi</text>
            <text x={M.l + 4} y={y(0) + 14} fontSize={10} fill="var(--muted)">échoué</text>
            {/* Écart entre l'issue réelle et la probabilité annoncée : plus il est épais, plus la log-loss punit. */}
            {STUDY.map((p, i) => (
              <line key={`e${i}`} x1={x(p.x)} x2={x(p.x)} y1={y(p.y + JITTER[i])} y2={y(f(p.x))} stroke="var(--fp)" strokeOpacity={0.5} strokeWidth={Math.min(6, 0.6 + costs[i] * 1.6)} />
            ))}
            <line x1={x(x0)} x2={x(x0)} y1={M.t} y2={H - M.b} stroke="var(--mod)" strokeDasharray="4 3" />
            <path d={path} fill="none" stroke="var(--mod)" strokeWidth={3} />
            {STUDY.map((p, i) => (
              <circle key={i} cx={x(p.x)} cy={y(p.y + JITTER[i])} r={i === worst ? 6.5 : 4.5} fill={p.y ? "var(--pos)" : "var(--neg)"} stroke={i === worst ? "var(--fp)" : "white"} strokeWidth={i === worst ? 2.5 : 1.4} />
            ))}
          </svg>
          <p className="mt-1 text-xs text-muted">Traits orange : l'écart entre ce qui s'est passé et la probabilité annoncée. Point cerclé : le plus coûteux.</p>
        </div>
        <div className="space-y-3 self-center">
          <Readout label="Log-loss (à minimiser)" value={fmt(loss, 3)} strong />
          <Readout label="Précision au seuil 0,5" value={`${fmt(acc * 100, 0)} %`} />
          <Readout
            label="Point le plus coûteux"
            value={`${fmt(STUDY[worst].x, 1)} h, ${STUDY[worst].y ? "réussi" : "échoué"}`}
            sub={`probabilité donnée à ce qui s'est réellement passé : ${fmt(STUDY[worst].y ? f(STUDY[worst].x) : 1 - f(STUDY[worst].x), 2)} · coût ${fmt(costs[worst], 2)}`}
          />
          {solved && <p className="text-sm text-muted">Minimum : log-loss {fmt(BEST_LOSS, 3)} avec w ≈ {fmt(BEST.w)} et une bascule à {fmt(BEST.x0, 1)} h.</p>}
        </div>
      </div>
    </LabFrame>
  );
}

function Readout({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className="rounded-xl p-3" style={{ background: strong ? "color-mix(in srgb, var(--mod) 10%, white)" : "var(--paper)" }}>
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="num mt-0.5 text-xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ Frontière 2D

const GRID = moonGrid();
const DEGREES = ["1", "2", "3", "5"] as const;
type Deg = (typeof DEGREES)[number];
const cache = new Map<number, { model: LogRegModel; predict: (0 | 1)[]; train: number; test: number }>();
function model(d: number) {
  if (!cache.has(d)) {
    const m = fitPolyLogistic(MOON_TRAIN, d);
    const p = polyLogitProba(m);
    const cls = (x: number, y: number): 0 | 1 => (p(x, y) >= 0.5 ? 1 : 0);
    cache.set(d, { model: m, predict: GRID.cells.map((c) => cls(c.x, c.y)), train: accuracy(cls, MOON_TRAIN), test: accuracy(cls, MOON_TEST) });
  }
  return cache.get(d)!;
}

/** Régression logistique sur les demi-lunes, avec des variables polynomiales de degré croissant. */
export function LogRegLab({ id = "logreg", challenge }: { id?: string; challenge?: string }) {
  const [deg, setDeg] = useState<Deg>("1");
  const d = Number(deg);
  const cur = useMemo(() => model(d), [d]);
  const linearAcc = model(1).test;
  const solved = challenge ? CHALLENGES[challenge].check({ degree: d, testAcc: cur.test, linearAcc }) : false;
  const nFeat = cur.model.terms.length;

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-6">
        <Segmented
          label="Variables données au modèle"
          value={deg}
          onChange={setDeg}
          options={[
            { value: "1", label: "x, y" },
            { value: "2", label: "+ carrés (degré 2)" },
            { value: "3", label: "+ cubes (degré 3)" },
            { value: "5", label: "jusqu'au degré 5" },
          ]}
        />
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <DecisionMap predict={cur.predict} cols={GRID.cols} rows={GRID.rows} points={MOON_TRAIN} title={d === 1 ? "Frontière : une droite" : `Frontière avec ${nFeat} variables`} />
        <div className="space-y-4 self-center">
          <AccReadouts train={cur.train} test={cur.test} />
          <div className="rounded-xl bg-paper p-4 text-sm">
            <div className="text-xs font-semibold text-muted">Variables d'entrée ({nFeat})</div>
            <p className="num mt-1 leading-relaxed">
              {cur.model.terms.map(([i, j]) => term(i, j)).join(", ")}
            </p>
            <p className="mt-2 text-muted">
              Le modèle reste une régression logistique : une combinaison linéaire de ces variables passée dans la sigmoïde.
            </p>
          </div>
        </div>
      </div>
    </LabFrame>
  );
}

const SUP = ["", "", "²", "³", "⁴", "⁵"];
const term = (i: number, j: number) => [i ? `x${SUP[i]}` : "", j ? `y${SUP[j]}` : ""].filter(Boolean).join("");
