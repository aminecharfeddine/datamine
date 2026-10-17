"use client";

import { useMemo, useState } from "react";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { assignAll, BLOB_DOMAIN, BLOBS, elbowCurve, inertia as inertiaOf, initCentroids, KMEANS_MAX_K, lloyd, nearest, recenter, type InitMode, type XY } from "@/lib/models";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { LabButton, LabFrame, Segmented, Slider } from "./controls";

// Huit teintes distinctes (et toujours accompagnées d'un numéro de groupe dans la légende).
const COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#8b5cf6", "#db2777", "#d9a300", "#0e9fb3", "#64748b"];
const fmt = (v: number, d = 1) => v.toFixed(d).replace(".", ",");

let elbowCache: number[] | null = null;
const getElbow = () => (elbowCache ??= elbowCurve());

const COLS = 54, ROWS = 47;
const CELLS = Array.from({ length: COLS * ROWS }, (_, idx) => {
  const i = idx % COLS, j = Math.floor(idx / COLS);
  const { x, y } = BLOB_DOMAIN;
  return { x: x[0] + ((i + 0.5) / COLS) * (x[1] - x[0]), y: y[1] - ((j + 0.5) / ROWS) * (y[1] - y[0]) };
});

type State = { k: number; mode: InitMode; seed: number; centroids: XY[]; labels: number[] | null; iter: number; converged: boolean };
const start = (k: number, mode: InitMode, seed: number): State => ({ k, mode, seed, centroids: initCentroids(BLOBS, k, seed, mode), labels: null, iter: 0, converged: false });

/** k-means pas à pas : assigner chaque point au centre le plus proche, puis déplacer chaque centre au milieu de ses points. */
export function KMeansLab({ id = "kmeans", k: k0 = 3, mode: m0 = "random", seed: s0 = 2, challenge }: { id?: string; k?: number; mode?: InitMode; seed?: number; challenge?: string }) {
  const [st, setSt] = useState<State>(() => start(k0, m0, s0));
  const elbow = getElbow();
  const best = elbow[3];
  const inertia = st.labels ? inertiaOf(BLOBS, st.labels, st.centroids) : null;
  const solved = challenge ? CHALLENGES[challenge].check({ k: st.k, mode: st.mode, converged: st.converged, inertia: inertia ?? Infinity, best }) : false;
  const nextIsAssign = !st.labels || st.labels.length === 0 || st.iter % 2 === 0;

  const step = () =>
    setSt((s) => {
      if (s.converged) return s;
      if (!s.labels || s.iter % 2 === 0) {
        const labels = assignAll(BLOBS, s.centroids);
        const same = !!s.labels && labels.every((l, i) => l === s.labels![i]);
        return { ...s, labels, iter: s.iter + 1, converged: same && s.iter > 0 };
      }
      return { ...s, centroids: recenter(BLOBS, s.labels, s.centroids), iter: s.iter + 1 };
    });
  const converge = () =>
    setSt((s) => {
      const r = lloyd(BLOBS, s.centroids);
      return { ...s, centroids: r.centroids, labels: r.labels, iter: s.iter + 2, converged: true };
    });

  const regions = useMemo(() => CELLS.map((c) => nearest(c, st.centroids)), [st.centroids]);

  const W = 480, H = Math.round((W * (BLOB_DOMAIN.y[1] - BLOB_DOMAIN.y[0])) / (BLOB_DOMAIN.x[1] - BLOB_DOMAIN.x[0]));
  const x = scaleLinear().domain(BLOB_DOMAIN.x).range([0, W]);
  const y = scaleLinear().domain(BLOB_DOMAIN.y).range([H, 0]);
  const cw = W / COLS, ch = H / ROWS;

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <Slider label="Nombre de groupes k" value={st.k} min={1} max={KMEANS_MAX_K} step={1} onChange={(k) => setSt((s) => start(k, s.mode, s.seed))} display={String(st.k)} />
        <Segmented
          label="Initialisation"
          value={st.mode}
          onChange={(mode) => setSt((s) => start(s.k, mode, s.seed))}
          options={[
            { value: "random", label: "Aléatoire" },
            { value: "pp", label: "k-means++" },
          ]}
        />
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <LabButton primary onClick={step} disabled={st.converged}>
          {nextIsAssign ? "Étape : assigner les points" : "Étape : déplacer les centres"}
        </LabButton>
        <LabButton onClick={converge} disabled={st.converged}>
          Jusqu'à convergence
        </LabButton>
        <LabButton onClick={() => setSt((s) => start(s.k, s.mode, s.seed + 1))}>Nouvelle initialisation</LabButton>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="font-display text-lg font-bold">{BLOBS.length} points sans étiquette</h4>
            <span className="text-xs font-semibold text-muted">
              {st.converged ? "Convergé" : st.iter === 0 ? "Centres placés" : `Étape ${st.iter}`}
            </span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-hidden rounded-xl border border-line" role="img" aria-label={`k-means avec ${st.k} centres, ${st.converged ? "convergé" : `étape ${st.iter}`}.`}>
            {regions.map((c, idx) => (
              <rect key={idx} x={(idx % COLS) * cw} y={Math.floor(idx / COLS) * ch} width={cw + 0.5} height={ch + 0.5} fill={COLORS[c]} opacity={0.1} />
            ))}
            {BLOBS.map((p, i) => (
              <circle key={i} cx={x(p.x)} cy={y(p.y)} r={3.6} fill={st.labels ? COLORS[st.labels[i]] : "var(--neg)"} stroke="white" strokeWidth={1} />
            ))}
            {st.centroids.map((c, j) => (
              <g key={j} style={{ transform: `translate(${x(c.x)}px, ${y(c.y)}px)`, transition: "transform 450ms cubic-bezier(.2,.8,.2,1)" }}>
                <circle r={11} fill={COLORS[j]} stroke="white" strokeWidth={3} />
                <text y={4} textAnchor="middle" fontSize={11} fontWeight={800} fill="white">{j + 1}</text>
              </g>
            ))}
          </svg>
          <p className="mt-2 text-sm text-muted">
            {st.converged
              ? "Plus aucun point ne change de groupe : l'algorithme s'arrête."
              : nextIsAssign
                ? "Prochaine étape : chaque point rejoint le centre le plus proche."
                : "Prochaine étape : chaque centre se déplace au milieu de ses points."}
          </p>
        </div>
        <div className="space-y-4">
          <Elbow elbow={elbow} k={st.k} current={st.converged ? inertia : null} />
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl p-3" style={{ background: "color-mix(in srgb, var(--mod) 10%, white)" }}>
              <div className="text-xs font-semibold text-muted">Inertie actuelle</div>
              <div className="num mt-0.5 text-xl font-bold">{inertia === null ? "–" : fmt(inertia)}</div>
            </div>
            <div className="rounded-xl border border-line bg-paper p-3">
              <div className="text-xs font-semibold text-muted">Meilleure (k = {st.k})</div>
              <div className="num mt-0.5 text-xl font-bold">{fmt(elbow[st.k - 1])}</div>
            </div>
          </div>
        </div>
      </div>
    </LabFrame>
  );
}

/** Courbe du coude : meilleure inertie selon k, et la solution actuelle si elle a convergé. */
function Elbow({ elbow, k, current }: { elbow: number[]; k: number; current: number | null }) {
  const W = 420, H = 240, M = { l: 48, r: 12, t: 14, b: 36 };
  const ks = elbow.map((_, i) => i + 1);
  const x = scaleLinear().domain([1, ks.length]).range([M.l, W - M.r]);
  const y = scaleLinear().domain([0, elbow[0] * 1.05]).range([H - M.b, M.t]);
  const d = line<number>().x((_, i) => x(i + 1)).y((v) => y(v))(elbow) ?? "";
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-display text-lg font-bold">Inertie selon k</h4>
        <span className="text-xs text-muted">somme des distances² au centre</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Courbe du coude : l'inertie baisse fortement jusqu'à k = 4, puis lentement.">
        {y.ticks(4).map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={M.l - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)" className="num">{v}</text>
          </g>
        ))}
        {ks.map((v) => (
          <text key={v} x={x(v)} y={H - M.b + 16} fontSize={10} textAnchor="middle" fill="var(--muted)" className="num">{v}</text>
        ))}
        <text x={(M.l + W - M.r) / 2} y={H - 4} fontSize={11} textAnchor="middle" fill="var(--muted)">k (nombre de groupes)</text>
        <line x1={x(k)} x2={x(k)} y1={M.t} y2={H - M.b} stroke="var(--mod)" strokeDasharray="4 3" />
        <path d={d} fill="none" stroke="var(--ink)" strokeWidth={2} />
        {elbow.map((v, i) => (
          <circle key={i} cx={x(i + 1)} cy={y(v)} r={3.5} fill="var(--ink)" />
        ))}
        {current !== null && <circle cx={x(k)} cy={y(Math.min(current, elbow[0] * 1.05))} r={7} fill="var(--mod)" stroke="var(--surface)" strokeWidth={2} />}
      </svg>
    </div>
  );
}
