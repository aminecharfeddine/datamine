"use client";

import { useMemo, useState } from "react";
import { scaleLinear, scaleLog } from "d3-scale";
import { line } from "d3-shape";
import { errorCurve, makeBvData, makePoints, MAX_DEGREE, mse, polyFit, trueFn } from "@/lib/sims";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { LabFrame, Slider } from "./controls";

const fmt = (v: number, d = 3) => v.toFixed(d).replace(".", ",");
const XS = Array.from({ length: 161 }, (_, i) => -1 + i / 80);

type Control = "degree" | "n" | "noise";

/**
 * Régression polynomiale : on ajuste des polynômes de degré croissant à des données bruitées,
 * et on compare l'erreur sur les données d'entraînement à l'erreur sur des données jamais vues.
 */
export function PolyFitLab({
  id = "poly",
  degree: d0 = 1,
  n: n0 = 20,
  noise: s0 = 0.3,
  controls = ["degree"],
  panels = ["fit", "errors"],
  ensemble = false,
  challenge,
}: {
  id?: string;
  degree?: number;
  n?: number;
  noise?: number;
  controls?: Control[];
  panels?: ("fit" | "errors")[];
  ensemble?: boolean;
  challenge?: string;
}) {
  const [degree, setDegree] = useState(d0);
  const [n, setN] = useState(n0);
  const [noise, setNoise] = useState(s0);
  const [showMany, setShowMany] = useState(false);

  const { train, test } = useMemo(() => makeBvData(n, noise), [n, noise]);
  const curve = useMemo(() => errorCurve(train, test), [train, test]);
  const f = useMemo(() => polyFit(train, degree), [train, degree]);
  const trainMse = mse(f, train);
  const testMse = mse(f, test);

  // 20 jeux d'entraînement différents, même degré : visualise la variance du modèle.
  const many = useMemo(() => {
    if (!showMany) return [];
    return Array.from({ length: 20 }, (_, k) => polyFit(makePoints(n, noise, 100 + k), degree));
  }, [showMany, n, noise, degree]);

  const solved = challenge ? CHALLENGES[challenge].check({ degree, n, noise, train, test, trainMse, testMse }) : false;

  return (
    <LabFrame>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}

      <div className="mb-6 grid gap-x-8 gap-y-4 sm:grid-cols-3">
        {controls.includes("degree") && (
          <Slider label="Degré du polynôme (complexité)" value={degree} min={0} max={MAX_DEGREE} step={1} onChange={setDegree} display={String(degree)} />
        )}
        {controls.includes("n") && (
          <Slider label="Points d'entraînement" value={n} min={10} max={200} step={10} onChange={setN} display={String(n)} />
        )}
        {controls.includes("noise") && (
          <Slider label="Bruit dans les données" value={noise} min={0.05} max={0.6} step={0.05} onChange={setNoise} display={fmt(noise, 2)} />
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {panels.includes("fit") && (
          <FitChart
            train={train}
            f={f}
            many={many}
            footer={
              ensemble ? (
                <label className="mt-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={showMany} onChange={(e) => setShowMany(e.target.checked)} className="h-4 w-4 accent-[var(--mod)]" />
                  Montrer 20 modèles entraînés sur 20 jeux de données différents
                </label>
              ) : null
            }
          />
        )}
        {panels.includes("errors") && <ErrorChart curve={curve} degree={degree} />}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 sm:max-w-md">
        <div className="rounded-lg border border-line bg-paper p-3">
          <div className="text-xs text-muted">Erreur d'entraînement (MSE)</div>
          <div className="num mt-0.5 text-xl font-semibold">{fmt(trainMse)}</div>
        </div>
        <div className="rounded-lg p-3" style={{ background: "color-mix(in srgb, var(--mod) 10%, white)" }}>
          <div className="text-xs text-muted">Erreur de test (MSE)</div>
          <div className="num mt-0.5 text-xl font-semibold">{fmt(testMse)}</div>
        </div>
      </div>
    </LabFrame>
  );
}

function FitChart({
  train,
  f,
  many,
  footer,
}: {
  train: { x: number; y: number }[];
  f: (x: number) => number;
  many: ((x: number) => number)[];
  footer: React.ReactNode;
}) {
  const W = 400, H = 300, M = 14;
  const x = scaleLinear().domain([-1, 1]).range([M, W - M]);
  const y = scaleLinear().domain([-2.2, 2.2]).range([H - M, M]);
  const clip = (v: number) => Math.max(-2.6, Math.min(2.6, v));
  const path = (g: (x: number) => number) => line<number>().x((v) => x(v)).y((v) => y(clip(g(v))))(XS) ?? "";
  const avg = many.length ? (v: number) => many.reduce((s, g) => s + g(v), 0) / many.length : null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-display text-lg">Le modèle et les données</h4>
        <div className="flex gap-3 text-xs text-muted">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-ink" /> entraînement</span>
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-accent" /> modèle</span>
          <span className="flex items-center gap-1"><span className="inline-block w-4 border-t-2 border-dashed border-muted" /> vraie fonction</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-hidden rounded-lg border border-line bg-paper" role="img" aria-label="Points d'entraînement et courbe ajustée">
        <defs>
          <clipPath id="fitclip">
            <rect x={0} y={0} width={W} height={H} />
          </clipPath>
        </defs>
        <g clipPath="url(#fitclip)">
          <line x1={M} x2={W - M} y1={y(0)} y2={y(0)} stroke="var(--line)" />
          <path d={path(trueFn)} fill="none" stroke="var(--muted)" strokeWidth={2} strokeDasharray="6 5" />
          {many.map((g, i) => (
            <path key={i} d={path(g)} fill="none" stroke="var(--accent)" strokeWidth={1.2} opacity={0.28} />
          ))}
          {avg ? (
            <path d={path(avg)} fill="none" stroke="var(--accent)" strokeWidth={3} />
          ) : (
            <path d={path(f)} fill="none" stroke="var(--accent)" strokeWidth={2.5} />
          )}
          {!many.length &&
            train.map((p, i) => <circle key={i} cx={x(p.x)} cy={y(p.y)} r={3.5} fill="var(--ink)" stroke="var(--paper)" strokeWidth={1.5} />)}
        </g>
      </svg>
      {many.length > 0 && <p className="mt-1 text-xs text-muted">Trait épais : la moyenne des 20 modèles. Son écart à la vraie fonction, c'est le biais ; la dispersion des traits fins, c'est la variance.</p>}
      {footer}
    </div>
  );
}

function ErrorChart({ curve, degree }: { curve: { degree: number; train: number; test: number }[]; degree: number }) {
  const W = 400, H = 300, M = { l: 44, r: 12, t: 12, b: 36 };
  const x = scaleLinear().domain([0, MAX_DEGREE]).range([M.l, W - M.r]);
  const y = scaleLog().domain([0.003, 3]).range([H - M.b, M.t]).clamp(true);
  const mk = (k: "train" | "test") => line<(typeof curve)[number]>().x((d) => x(d.degree)).y((d) => y(Math.max(d[k], 0.003)))(curve) ?? "";
  const best = curve.reduce((a, b) => (b.test < a.test ? b : a));
  const cur = curve[degree];

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-display text-lg">Erreur selon la complexité</h4>
        <div className="flex gap-3 text-xs text-muted">
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-ink" /> entraînement</span>
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-accent" /> test</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Erreurs d'entraînement et de test en fonction du degré. Meilleur degré en test : ${best.degree}.`}>
        {[0.01, 0.1, 1].map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={M.l - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)" className="num">{String(v).replace(".", ",")}</text>
          </g>
        ))}
        {[0, 3, 6, 9, 12, 15].map((v) => (
          <text key={v} x={x(v)} y={H - M.b + 16} fontSize={10} textAnchor="middle" fill="var(--muted)" className="num">{v}</text>
        ))}
        <text x={(M.l + W - M.r) / 2} y={H - 4} fontSize={11} textAnchor="middle" fill="var(--muted)">degré (complexité) →</text>
        <text transform={`translate(11, ${(M.t + H - M.b) / 2}) rotate(-90)`} fontSize={11} textAnchor="middle" fill="var(--muted)">MSE (échelle log)</text>

        <text x={x(1.2)} y={M.t + 12} fontSize={10} fill="var(--muted)">underfitting</text>
        <text x={x(14.8)} y={M.t + 12} fontSize={10} textAnchor="end" fill="var(--muted)">overfitting</text>

        <path d={mk("train")} fill="none" stroke="var(--ink)" strokeWidth={2} />
        <path d={mk("test")} fill="none" stroke="var(--accent)" strokeWidth={2} />
        <line x1={x(degree)} x2={x(degree)} y1={M.t} y2={H - M.b} stroke="var(--ink)" strokeDasharray="3 3" opacity={0.5} />
        <circle cx={x(degree)} cy={y(Math.max(cur.train, 0.003))} r={5} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2} />
        <circle cx={x(degree)} cy={y(Math.max(cur.test, 0.003))} r={6} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
      </svg>
    </div>
  );
}
