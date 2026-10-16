"use client";

import { useMemo, useState } from "react";
import { scaleLinear, scaleLog } from "d3-scale";
import { line } from "d3-shape";
import { makeBvData, mse, polyFit, ridgeCurve, RIDGE_DEGREE, trueFn } from "@/lib/sims";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { LabFrame, Slider } from "./controls";

const XS = Array.from({ length: 161 }, (_, i) => -1 + i / 80);
const fmt = (v: number, d = 3) => v.toFixed(d).replace(".", ",");
const lambdaLabel = (l: number) => {
  const v = 10 ** l;
  return v >= 1 ? v.toFixed(v >= 10 ? 0 : 1).replace(".", ",") : v >= 0.001 ? v.toFixed(3).replace(".", ",") : `10^${l}`;
};

/**
 * Ridge (L2) sur un polynôme de degré 15 : λ pénalise la taille des coefficients.
 * On voit la courbe se lisser, les coefficients fondre et l'erreur de test passer par un minimum.
 */
export function RidgeLab({ id = "ridge", logLambda: l0 = -6, challenge }: { id?: string; logLambda?: number; challenge?: string }) {
  const [logLambda, setLogLambda] = useState(l0);
  const { train, test } = useMemo(() => makeBvData(20, 0.3), []);
  const curve = useMemo(() => ridgeCurve(train, test), [train, test]);
  const f = useMemo(() => polyFit(train, RIDGE_DEGREE, 10 ** logLambda), [train, logLambda]);
  const trainMse = mse(f, train);
  const testMse = mse(f, test);
  const solved = challenge ? CHALLENGES[challenge].check({ logLambda, train, test, trainMse, testMse }) : false;

  return (
    <LabFrame>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}

      <div className="mb-6 max-w-md">
        <Slider
          label="Force de régularisation λ (échelle log)"
          value={logLambda}
          min={-6}
          max={2}
          step={0.25}
          onChange={setLogLambda}
          display={`λ = ${lambdaLabel(logLambda)}`}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <FitChart f={f} train={train} />
        <LambdaChart curve={curve} logLambda={logLambda} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <CoefBars coef={f.coef} />
        <div className="grid grid-cols-2 content-start gap-2">
          <div className="rounded-xl border border-line bg-paper p-3">
            <div className="text-xs font-semibold text-muted">Erreur d'entraînement</div>
            <div className="num mt-0.5 text-xl font-bold">{fmt(trainMse)}</div>
          </div>
          <div className="rounded-xl p-3" style={{ background: "color-mix(in srgb, var(--mod) 10%, white)" }}>
            <div className="text-xs font-semibold text-muted">Erreur de test</div>
            <div className="num mt-0.5 text-xl font-bold">{fmt(testMse)}</div>
          </div>
        </div>
      </div>
    </LabFrame>
  );
}

function FitChart({ f, train }: { f: (x: number) => number; train: { x: number; y: number }[] }) {
  const W = 400, H = 280, M = 14;
  const x = scaleLinear().domain([-1, 1]).range([M, W - M]);
  const y = scaleLinear().domain([-2.2, 2.2]).range([H - M, M]);
  const clip = (v: number) => Math.max(-2.6, Math.min(2.6, v));
  const path = (g: (x: number) => number) => line<number>().x((v) => x(v)).y((v) => y(clip(g(v))))(XS) ?? "";
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-display text-lg font-bold">Polynôme de degré {RIDGE_DEGREE}</h4>
        <div className="flex gap-3 text-xs text-muted">
          <span className="flex items-center gap-1"><span className="inline-block h-1 w-4 rounded bg-mod" /> modèle</span>
          <span className="flex items-center gap-1"><span className="inline-block w-4 border-t-2 border-dashed border-muted" /> vraie fonction</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-hidden rounded-xl border border-line bg-paper" role="img" aria-label="Données d'entraînement et polynôme régularisé">
        <line x1={M} x2={W - M} y1={y(0)} y2={y(0)} stroke="var(--line)" />
        <path d={path(trueFn)} fill="none" stroke="var(--muted)" strokeWidth={2} strokeDasharray="6 5" />
        <path d={path(f)} fill="none" stroke="var(--mod)" strokeWidth={3} />
        {train.map((p, i) => (
          <circle key={i} cx={x(p.x)} cy={y(p.y)} r={4} fill="var(--ink)" stroke="var(--paper)" strokeWidth={1.5} />
        ))}
      </svg>
    </div>
  );
}

function LambdaChart({ curve, logLambda }: { curve: { logLambda: number; train: number; test: number }[]; logLambda: number }) {
  const W = 400, H = 280, M = { l: 44, r: 12, t: 14, b: 36 };
  const x = scaleLinear().domain([-6, 2]).range([M.l, W - M.r]);
  const y = scaleLog().domain([0.01, 2]).range([H - M.b, M.t]).clamp(true);
  const mk = (k: "train" | "test") => line<(typeof curve)[number]>().x((d) => x(d.logLambda)).y((d) => y(Math.max(d[k], 0.01)))(curve) ?? "";
  const cur = curve.reduce((a, b) => (Math.abs(b.logLambda - logLambda) < Math.abs(a.logLambda - logLambda) ? b : a));
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-display text-lg font-bold">Erreur selon λ</h4>
        <div className="flex gap-3 text-xs text-muted">
          <span className="flex items-center gap-1"><span className="inline-block h-1 w-4 rounded bg-ink" /> entraînement</span>
          <span className="flex items-center gap-1"><span className="inline-block h-1 w-4 rounded bg-fp" /> test</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Erreurs d'entraînement et de test en fonction de λ">
        {[0.01, 0.1, 1].map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={M.l - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)" className="num">{String(v).replace(".", ",")}</text>
          </g>
        ))}
        {[-6, -4, -2, 0, 2].map((v) => (
          <text key={v} x={x(v)} y={H - M.b + 16} fontSize={10} textAnchor="middle" fill="var(--muted)" className="num">
            {v === 0 ? "1" : `10^${v}`}
          </text>
        ))}
        <text x={x(-5.8)} y={M.t + 10} fontSize={10} fill="var(--muted)">overfitting</text>
        <text x={x(1.9)} y={M.t + 10} fontSize={10} textAnchor="end" fill="var(--muted)">underfitting</text>
        <path d={mk("train")} fill="none" stroke="var(--ink)" strokeWidth={2} />
        <path d={mk("test")} fill="none" stroke="var(--fp)" strokeWidth={2.5} />
        <line x1={x(logLambda)} x2={x(logLambda)} y1={M.t} y2={H - M.b} stroke="var(--mod)" strokeWidth={2} strokeDasharray="4 3" />
        <circle cx={x(logLambda)} cy={y(Math.max(cur.test, 0.01))} r={6} fill="var(--fp)" stroke="var(--surface)" strokeWidth={2} />
        <circle cx={x(logLambda)} cy={y(Math.max(cur.train, 0.01))} r={5} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2} />
        <text x={(M.l + W - M.r) / 2} y={H - 4} fontSize={11} textAnchor="middle" fill="var(--muted)">λ, de « libre » à « très contraint »</text>
      </svg>
    </div>
  );
}

function CoefBars({ coef }: { coef: number[] }) {
  const W = 400, H = 120, M = 6;
  // Échelle log signée et fixe : les coefficients non régularisés peuvent valoir des milliers.
  const slog = (c: number) => Math.sign(c) * Math.log10(1 + Math.abs(c));
  const bw = (W - 2 * M) / coef.length;
  const y = scaleLinear().domain([-4, 4]).range([H - M, M]).clamp(true);
  const norm = Math.sqrt(coef.reduce((s, c) => s + c * c, 0));
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h4 className="font-display text-lg font-bold">Les 16 coefficients</h4>
        <span className="num text-sm font-semibold text-muted">‖w‖ = {fmt(norm, 2)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl border border-line bg-paper" role="img" aria-label={`Coefficients du modèle, norme ${fmt(norm, 2)}`}>
        <line x1={M} x2={W - M} y1={y(0)} y2={y(0)} stroke="var(--line)" />
        {coef.map((c, i) => {
          const top = Math.min(y(0), y(slog(c)));
          const h = Math.abs(y(slog(c)) - y(0));
          return <rect key={i} x={M + i * bw + 2} y={top} width={bw - 4} height={Math.max(1, h)} rx={2} fill="var(--mod)" />;
        })}
      </svg>
      <p className="mt-1 text-xs text-muted">Échelle logarithmique fixe. Sans régularisation, les coefficients s'envolent pour suivre le bruit ; λ les ramène vers zéro.</p>
    </div>
  );
}
