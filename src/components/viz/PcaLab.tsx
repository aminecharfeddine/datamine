"use client";

import { useMemo, useState } from "react";
import { scaleLinear } from "d3-scale";
import { APPARTS, pca2, prepare, projection, SCREE, SUBJECTS } from "@/lib/pca";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { LabFrame, Segmented, Slider } from "./controls";

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d).replace(".", ",")} %`;

function Readout({ label, value, strong, sub }: { label: string; value: string; strong?: boolean; sub?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: strong ? "color-mix(in srgb, var(--mod) 10%, white)" : "var(--paper)" }}>
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="num mt-0.5 text-xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

/** Faire tourner un axe de projection, voir la variance conservée, et l'effet de la standardisation. Puis l'éboulis d'un jeu à 8 variables. */
export function PcaLab({ id = "acp", challenge }: { id?: string; challenge?: string }) {
  const [standardized, setStandardized] = useState(false);
  const [deg, setDeg] = useState(120);
  const [k, setK] = useState(2);
  const pts = useMemo(() => prepare(APPARTS, standardized), [standardized]);
  const best = useMemo(() => pca2(pts), [pts]);
  const proj = projection(pts, deg);
  const bestShare = best.l1 / best.total;
  const solved = challenge ? CHALLENGES[challenge].check({ standardized, share: proj.share, best: bestShare }) : false;

  // Graphique 2D : même échelle sur les deux axes, pour que les angles soient vrais.
  const S = 300;
  const ext = Math.max(...pts.flatMap((p) => [Math.abs(p[0]), Math.abs(p[1])])) * 1.08;
  const sc = scaleLinear().domain([-ext, ext]).range([8, S - 8]);
  const [ux, uy] = proj.u;

  const total = SCREE.reduce((a, b) => a + b, 0);
  const cum = SCREE.slice(0, k).reduce((a, b) => a + b, 0) / total;

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <p className="mb-4 text-sm text-muted">200 appartements décrits par leur surface (en m²) et leur nombre de pièces, centrés. Chaque point est projeté sur l'axe ; les segments gris montrent l'information perdue.</p>
      <div className="mb-5 grid gap-5 sm:grid-cols-2 [&>*]:min-w-0">
        <Segmented
          label="Préparation"
          value={standardized ? "std" : "raw"}
          onChange={(v) => setStandardized(v === "std")}
          options={[{ value: "raw", label: "Centrées seulement" }, { value: "std", label: "Centrées et réduites" }]}
        />
        <Slider label="Direction de l'axe" value={deg} min={0} max={179} step={1} onChange={setDeg} display={`${deg}°`} />
      </div>
      <div className="grid gap-6 md:grid-cols-[minmax(0,320px)_1fr] [&>*]:min-w-0">
        <svg viewBox={`0 0 ${S} ${S}`} className="w-full rounded-xl bg-paper" role="img" aria-label={`Variance conservée ${pct(proj.share)}`}>
          <line x1={sc(-ext)} x2={sc(ext)} y1={sc(0)} y2={sc(0)} stroke="var(--line)" />
          <line x1={sc(0)} x2={sc(0)} y1={sc(-ext)} y2={sc(ext)} stroke="var(--line)" />
          {pts.map((p, i) => {
            const t = proj.proj[i];
            return <line key={`s${i}`} x1={sc(p[0])} y1={sc(-p[1])} x2={sc(t * ux)} y2={sc(-t * uy)} stroke="var(--muted)" strokeWidth={0.6} opacity={0.5} />;
          })}
          {pts.map((p, i) => <circle key={i} cx={sc(p[0])} cy={sc(-p[1])} r={2.4} fill="var(--ink)" opacity={0.7} />)}
          <line x1={sc(-ext * ux)} y1={sc(ext * uy)} x2={sc(ext * ux)} y2={sc(-ext * uy)} stroke="var(--mod)" strokeWidth={2.5} />
          <text x={S - 10} y={sc(0) - 6} fontSize={10} textAnchor="end" fill="var(--muted)">surface</text>
          <text x={sc(0) + 6} y={16} fontSize={10} fill="var(--muted)">pièces</text>
        </svg>
        <div>
          <div className="grid grid-cols-2 gap-2">
            <Readout label="Variance conservée par l'axe" value={pct(proj.share)} strong={proj.share >= bestShare - 0.005} />
            <Readout label="Variance perdue" value={pct(1 - proj.share)} />
          </div>
          <p className="mt-3 text-sm text-muted">
            {standardized
              ? "Les deux variables ont maintenant le même poids : l'axe principal combine surface et nombre de pièces."
              : "Sans réduction, la surface (écart-type d'environ 30 m²) écrase le nombre de pièces (environ 1) : l'axe principal se confond presque avec l'axe de la surface."}
          </p>

          <div className="mt-6 border-t border-line pt-5">
            <div className="mb-2 text-sm font-bold">Éboulis : notes de 300 élèves dans 8 matières (standardisées)</div>
            <div className="flex h-28 items-end gap-1.5">
              {SCREE.map((l, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <span className="num text-[10px] text-muted">{Math.round((l / total) * 100)}</span>
                  <div className="w-full rounded-t" style={{ height: `${(l / SCREE[0]) * 80}px`, background: i < k ? "var(--mod)" : "var(--line)" }} />
                  <span className="num text-[10px] text-muted">CP{i + 1}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 max-w-xs">
              <Slider label="Composantes gardées" value={k} min={1} max={SUBJECTS.length} step={1} onChange={setK} display={`${k} · ${pct(cum, 0)} de la variance`} />
            </div>
          </div>
        </div>
      </div>
    </LabFrame>
  );
}
