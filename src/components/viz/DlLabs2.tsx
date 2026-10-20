"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { scaleLinear } from "d3-scale";
import { DIFF_STEPS, DIFF_TARGET, GT, iou, matchDetections, nms, noisy, PREDS, sample, sampleQuality, SPIRAL, type P2 } from "@/lib/dl3";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { useHydrated } from "@/components/ui/useHydrated";
import { LabFrame, Segmented, Slider } from "./controls";

const fmt = (v: number, d = 2) => v.toFixed(d).replace(".", ",");

function Readout({ label, value, strong, sub }: { label: string; value: string; strong?: boolean; sub?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: strong ? "color-mix(in srgb, var(--mod) 10%, white)" : "var(--paper)" }}>
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="num mt-0.5 text-xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

// ============================================================ 1. Diffusion

function Cloud({ pts, color, title, faint }: { pts: P2[]; color: string; title: string; faint?: P2[] }) {
  const S = 220;
  const s = scaleLinear().domain([-2.2, 2.2]).range([6, S - 6]);
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${S} ${S}`} className="w-full rounded-xl bg-paper" role="img" aria-label={title}>
        {faint?.map((p, i) => <circle key={`f${i}`} cx={s(p[0])} cy={s(-p[1])} r={1.6} fill="var(--muted)" opacity={0.35} />)}
        {pts.map((p, i) => <circle key={i} cx={s(p[0])} cy={s(-p[1])} r={2.2} fill={color} opacity={0.8} />)}
      </svg>
      <figcaption className="mt-1 text-center text-xs font-semibold text-muted">{title}</figcaption>
    </figure>
  );
}

/** Un modèle de diffusion 2D : bruiter les données, puis les reconstruire en N étapes de débruitage. */
export function DiffusionLab({ id = "diffusion", challenge }: { id?: string; challenge?: string }) {
  const hydrated = useHydrated();
  const [t, setT] = useState(0.5);
  const [steps, setSteps] = useState(1);
  const forward = useMemo(() => noisy(t), [t]);
  const gen = useMemo(() => (hydrated ? sample(steps) : []), [hydrated, steps]);
  const q = useMemo(() => (hydrated ? sampleQuality(gen) : { dist: 1, coverage: 0 }), [hydrated, gen]);
  const minSteps = useMemo(() => (hydrated ? DIFF_STEPS.find((k) => sampleQuality(sample(k)).dist < DIFF_TARGET) ?? 0 : 0), [hydrated]);
  const solved = challenge && hydrated ? CHALLENGES[challenge].check({ steps, dist: q.dist, minSteps }) : false;

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="grid gap-6 md:grid-cols-2 [&>*]:min-w-0">
        <div>
          <div className="mb-2 text-sm font-bold">1. Processus direct : on ajoute du bruit</div>
          <Slider label="Niveau de bruit t" value={t} min={0} max={1} step={0.05} onChange={setT} display={t === 0 ? "données" : t === 1 ? "bruit pur" : fmt(t, 2)} />
          <div className="mx-auto mt-3 max-w-[260px]">
            <Cloud pts={forward} color="var(--ink)" title={`x_t avec t = ${fmt(t, 2)}`} />
          </div>
        </div>
        <div>
          <div className="mb-2 text-sm font-bold">2. Génération : on part du bruit et on débruite</div>
          <Segmented label="Nombre d'étapes de débruitage" value={String(steps)} onChange={(v) => setSteps(Number(v))} options={DIFF_STEPS.map((k) => ({ value: String(k), label: String(k) }))} />
          <div className="mx-auto mt-3 max-w-[260px]">{hydrated && <Cloud pts={gen} color="var(--mod)" faint={SPIRAL} title={`200 échantillons générés en ${steps} étape${steps > 1 ? "s" : ""}`} />}</div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:max-w-md">
        <Readout label="Distance moyenne aux données" value={hydrated ? fmt(q.dist, 3) : "…"} strong={q.dist < DIFF_TARGET} sub={q.dist < DIFF_TARGET ? "sous 0,03" : "objectif : sous 0,03"} />
        <Readout label="Couverture de la spirale" value={hydrated ? `${Math.round(q.coverage * 100)} %` : "…"} />
      </div>
      <p className="mt-3 text-sm text-muted">
        Ici, le débruiteur est calculé exactement à partir des 160 points (en gris) ; un vrai modèle apprend à prédire le bruit avec un réseau. Chaque étape coûte un appel au réseau.
      </p>
    </LabFrame>
  );
}

// ============================================================ 2. Détection

/** Seuil de confiance et non-maximum suppression : passer des sorties brutes d'un détecteur à une boîte par objet. */
export function DetectionLab({ id = "detection", challenge }: { id?: string; challenge?: string }) {
  const [conf, setConf] = useState(0.25);
  const [thr, setThr] = useState(0.9);
  const kept = nms(PREDS, conf, thr);
  const m = matchDetections(kept);
  const keptIds = new Set(kept.map((k) => k.id));
  const solved = challenge ? CHALLENGES[challenge].check({ tp: m.tp, fp: m.fp, fn: m.fn }) : false;
  const precision = kept.length ? m.tp / kept.length : 0;
  const recall = m.tp / GT.length;

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-5 grid gap-5 sm:grid-cols-2">
        <Slider label="Seuil de confiance" value={conf} min={0.05} max={0.95} step={0.01} onChange={setConf} display={fmt(conf, 2)} />
        <Slider label="Seuil d'IoU du NMS" value={thr} min={0.1} max={0.95} step={0.05} onChange={setThr} display={fmt(thr, 2)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
        <svg viewBox="0 0 500 280" className="w-full rounded-xl bg-paper" role="img" aria-label={`${m.tp} vrais positifs, ${m.fp} faux positifs, ${m.fn} objets manqués`}>
          {GT.map((g, i) => (
            <g key={i}>
              <rect x={g.x1} y={g.y1} width={g.x2 - g.x1} height={g.y2 - g.y1} fill="none" stroke="var(--muted)" strokeWidth={2} strokeDasharray="6 4" />
              <text x={g.x1 + 4} y={g.y2 - 6} fontSize={11} fill="var(--muted)">{g.label}</text>
            </g>
          ))}
          {PREDS.map((p) => {
            const on = keptIds.has(p.id);
            const st = m.status[p.id];
            const col = !on ? "var(--muted)" : st === "tp" ? "#12b76a" : "#f04438";
            return (
              <g key={p.id} opacity={on ? 1 : 0.22}>
                <rect x={p.x1} y={p.y1} width={p.x2 - p.x1} height={p.y2 - p.y1} fill="none" stroke={col} strokeWidth={on ? 2.5 : 1.5} />
                <rect x={p.x1} y={p.y1 - 14} width={34} height={14} fill={col} />
                <text x={p.x1 + 3} y={p.y1 - 3} fontSize={10} fill="white" className="num">{fmt(p.score, 2)}</text>
              </g>
            );
          })}
        </svg>
        <div>
          <div className="grid grid-cols-3 gap-2">
            <Readout label="Détectés" value={`${m.tp} / ${GT.length}`} strong={m.tp === GT.length} />
            <Readout label="Faux positifs" value={String(m.fp)} />
            <Readout label="Manqués" value={String(m.fn)} />
          </div>
          <p className="num mt-3 text-sm text-muted">
            Precision {Math.round(precision * 100)} % · recall {Math.round(recall * 100)} % (IoU ≥ 0,5 avec la vérité)
          </p>
          <div className="mt-3 text-sm">
            <div className="mb-1 font-semibold text-muted">IoU entre les deux boîtes les plus sûres de chaque personne</div>
            <p className="num">{fmt(iou(PREDS[0], PREDS[2]), 2)} : deux objets différents qui se chevauchent</p>
            <p className="num">{fmt(iou(PREDS[0], PREDS[1]), 2)} : deux détections du même objet</p>
          </div>
          <p className={clsx("mt-3 text-sm", "text-muted")}>Pointillés : vérité terrain. Vert : bonne détection. Rouge : fausse détection ou doublon. Pâle : boîte éliminée.</p>
        </div>
      </div>
    </LabFrame>
  );
}
