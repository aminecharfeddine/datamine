"use client";

import { useMemo, useState } from "react";
import { scaleLinear, scaleLog } from "d3-scale";
import { line } from "d3-shape";
import { errorCurve, makeBvData } from "@/lib/sims";
import { CV_MAX_DEGREE, cvCurve, holdoutCurve, kfoldErrors, mean } from "@/lib/ml";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { LabFrame, Segmented, Slider } from "./controls";

const N = 40;
const KS = ["2", "5", "10", "40"] as const;
const fmt = (v: number) => v.toFixed(3).replace(".", ",");

/**
 * Validation croisée k-fold pour choisir le degré d'un polynôme, comparée à l'erreur réelle
 * (sur des données neuves) et à des découpages simples train / validation.
 */
export function CvLab({ id = "cv", degree: d0 = 10, k: k0 = 5, challenge }: { id?: string; degree?: number; k?: number; challenge?: string }) {
  const [degree, setDegree] = useState(d0);
  const [k, setK] = useState(k0);
  const [showHoldout, setShowHoldout] = useState(false);
  const { train, test } = useMemo(() => makeBvData(N, 0.3), []);
  const cv = useMemo(() => cvCurve(train, k), [train, k]);
  const truth = useMemo(() => errorCurve(train, test).slice(0, CV_MAX_DEGREE + 1).map((e) => e.test), [train, test]);
  const holdouts = useMemo(() => (showHoldout ? Array.from({ length: 10 }, (_, s) => holdoutCurve(train, 100 + s)) : []), [showHoldout, train]);
  const folds = useMemo(() => kfoldErrors(train, degree, k), [train, degree, k]);
  const solved = challenge ? CHALLENGES[challenge].check({ degree, k, cv }) : false;

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <Slider label="Degré du polynôme" value={degree} min={0} max={CV_MAX_DEGREE} step={1} onChange={setDegree} display={String(degree)} />
        <Segmented
          label="Nombre de plis k"
          value={String(k) as (typeof KS)[number]}
          options={KS.map((v) => ({ value: v, label: v === "40" ? "40 (leave-one-out)" : v }))}
          onChange={(v) => setK(Number(v))}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <h3 className="font-display text-lg font-bold">Comment les {N} exemples sont découpés</h3>
          <FoldDiagram k={k} />
          <h3 className="mt-6 font-display text-lg font-bold">Erreur de chaque pli, degré {degree}</h3>
          <FoldBars errors={folds} />
        </div>
        <div>
          <CurveChart cv={cv} truth={truth} holdouts={holdouts} degree={degree} />
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showHoldout} onChange={(e) => setShowHoldout(e.target.checked)} className="h-4 w-4 accent-[var(--mod)]" />
            Comparer à 10 découpages simples 70 / 30
          </label>
        </div>
      </div>
    </LabFrame>
  );
}

function FoldDiagram({ k }: { k: number }) {
  if (k > 10)
    return (
      <p className="mt-2 rounded-xl bg-paper p-3 text-sm text-muted">
        Leave-one-out : {N} entraînements, chacun en mettant de côté un seul exemple pour la validation.
      </p>
    );
  const W = 360, rowH = Math.min(22, 200 / k), H = k * rowH + 4, cell = W / N;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label={`${k} plis : à chaque tour, un pli sert de validation et les autres d'entraînement`}>
      {Array.from({ length: k }, (_, f) =>
        Array.from({ length: N }, (_, i) => {
          const isVal = Math.floor((i * k) / N) === f;
          return (
            <rect key={`${f}-${i}`} x={i * cell + 0.5} y={f * rowH + 2} width={cell - 1} height={rowH - 4} rx={1.5} fill={isVal ? "var(--mod)" : "var(--sunken)"} />
          );
        }),
      )}
    </svg>
  );
}

function FoldBars({ errors }: { errors: number[] }) {
  const W = 360, H = 110, M = 6;
  const max = Math.max(0.2, ...errors.map((e) => Math.min(e, 2)));
  const y = scaleLinear().domain([0, max]).range([H - M, M]).clamp(true);
  const bw = (W - 2 * M) / errors.length;
  const m = mean(errors);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label={`Erreur moyenne ${fmt(m)}`}>
        {errors.map((e, i) => (
          <rect key={i} x={M + i * bw + 1} y={y(e)} width={Math.max(1, bw - 2)} height={H - M - y(e)} rx={2} fill="var(--mod)" opacity={0.55} />
        ))}
        <line x1={M} x2={W - M} y1={y(m)} y2={y(m)} stroke="var(--ink)" strokeWidth={2} />
      </svg>
      <p className="text-sm text-muted">
        Trait noir : la moyenne, <span className="num font-bold text-ink">{fmt(m)}</span>. C'est l'estimation de validation croisée.
      </p>
    </div>
  );
}

function CurveChart({ cv, truth, holdouts, degree }: { cv: number[]; truth: number[]; holdouts: number[][]; degree: number }) {
  const W = 440, H = 300, M = { l: 44, r: 12, t: 14, b: 36 };
  const x = scaleLinear().domain([0, CV_MAX_DEGREE]).range([M.l, W - M.r]);
  const y = scaleLog().domain([0.05, 2]).range([H - M.b, M.t]).clamp(true);
  const mk = (vals: number[]) => line<number>().x((_, i) => x(i)).y((v) => y(Math.max(v, 0.05)))(vals) ?? "";
  const best = cv.indexOf(Math.min(...cv));
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-bold">Choisir le degré</h3>
        <div className="flex flex-wrap gap-3 text-xs text-muted">
          <span className="flex items-center gap-1"><span className="inline-block h-1 w-4 rounded bg-mod" /> validation croisée</span>
          <span className="flex items-center gap-1"><span className="inline-block w-4 border-t-2 border-dashed border-fp" /> erreur réelle</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Erreur de validation croisée par degré ; minimum au degré ${best}`}>
        {[0.1, 0.3, 1].map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={M.l - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)" className="num">{String(v).replace(".", ",")}</text>
          </g>
        ))}
        {[0, 2, 4, 6, 8, 10, 12].map((v) => (
          <text key={v} x={x(v)} y={H - M.b + 16} fontSize={10} textAnchor="middle" fill="var(--muted)" className="num">{v}</text>
        ))}
        <text x={(M.l + W - M.r) / 2} y={H - 4} fontSize={11} textAnchor="middle" fill="var(--muted)">degré</text>
        {holdouts.map((h, i) => (
          <path key={i} d={mk(h)} fill="none" stroke="var(--neg)" strokeWidth={1.2} opacity={0.8} />
        ))}
        <path d={mk(truth)} fill="none" stroke="var(--fp)" strokeWidth={2} strokeDasharray="6 4" />
        <path d={mk(cv)} fill="none" stroke="var(--mod)" strokeWidth={3} />
        <line x1={x(degree)} x2={x(degree)} y1={M.t} y2={H - M.b} stroke="var(--ink)" strokeDasharray="3 3" opacity={0.5} />
        <circle cx={x(degree)} cy={y(Math.max(cv[degree], 0.05))} r={6} fill="var(--mod)" stroke="var(--surface)" strokeWidth={2} />
      </svg>
      {holdouts.length > 0 && (
        <p className="text-xs text-muted">Lignes grises : 10 découpages simples. Chacun désigne parfois un autre « meilleur » degré ; la moyenne sur k plis est bien plus stable.</p>
      )}
    </div>
  );
}
