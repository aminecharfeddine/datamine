"use client";

import { useState } from "react";
import { bayes, roundCounts } from "@/lib/sims";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { LabFrame, Slider } from "./controls";

const N = 2000;
const COLS = 50;
const ROWS = N / COLS;
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d).replace(".", ",")} %`;

type Control = "prevalence" | "sensitivity" | "specificity";

/**
 * Population de 2 000 personnes testées. Chaque point prend la couleur de son issue :
 * on voit littéralement d'où viennent les tests positifs.
 */
export function BayesLab({
  id = "bayes",
  prevalence: p0 = 0.01,
  sensitivity: se0 = 0.9,
  specificity: sp0 = 0.95,
  controls = ["prevalence", "sensitivity", "specificity"],
  challenge,
}: {
  id?: string;
  prevalence?: number;
  sensitivity?: number;
  specificity?: number;
  controls?: Control[];
  challenge?: string;
}) {
  const [prevalence, setPrev] = useState(p0);
  const [sensitivity, setSe] = useState(se0);
  const [specificity, setSp] = useState(sp0);
  const params = { prevalence, sensitivity, specificity };
  const r = bayes(params, N);
  const [tp, fn, fp, tn] = roundCounts([r.tp, r.fn, r.fp, r.tn], N);
  const solved = challenge ? CHALLENGES[challenge].check(params) : false;

  // Ordre de remplissage colonne par colonne : malades détectés, malades ratés, fausses alertes, sains.
  const colors = [
    ...Array(tp).fill("var(--pos)"),
    ...Array(fn).fill("var(--fn)"),
    ...Array(fp).fill("var(--fp)"),
    ...Array(tn).fill("var(--neg)"),
  ];

  const W = 600, cell = W / COLS, H = ROWS * cell;

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}

      <div className="mb-6 grid gap-x-8 gap-y-4 sm:grid-cols-3">
        {controls.includes("prevalence") && (
          <Slider label="Prévalence (malades)" value={prevalence} min={0.001} max={0.3} step={0.001} onChange={setPrev} display={pct(prevalence)} />
        )}
        {controls.includes("sensitivity") && (
          <Slider label="Sensitivity du test" value={sensitivity} min={0.5} max={0.999} step={0.001} onChange={setSe} display={pct(sensitivity)} />
        )}
        {controls.includes("specificity") && (
          <Slider label="Specificity du test" value={specificity} min={0.9} max={0.999} step={0.001} onChange={setSp} display={pct(specificity)} />
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
        <div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Population de ${N} personnes : ${tp} vrais positifs, ${fn} faux négatifs, ${fp} faux positifs, ${tn} vrais négatifs`}>
            {colors.map((c, i) => {
              const col = Math.floor(i / ROWS);
              const row = i % ROWS;
              return <rect key={i} x={col * cell + 1} y={row * cell + 1} width={cell - 2} height={cell - 2} rx={2} fill={c} />;
            })}
          </svg>
          <p className="mt-2 text-xs text-muted">Chaque carré = une personne testée. {N.toLocaleString("fr-FR")} au total.</p>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Count color="var(--pos)" label="Malades détectés" sub="TP" v={tp} />
            <Count color="var(--fn)" label="Malades ratés" sub="FN" v={fn} />
            <Count color="var(--fp)" label="Sains alarmés" sub="FP" v={fp} />
            <Count color="var(--neg)" label="Sains rassurés" sub="TN" v={tn} />
          </div>
          <div className="rounded-2xl p-4" style={{ background: "color-mix(in srgb, var(--mod) 10%, white)" }}>
            <div className="text-sm text-muted">Mon test est positif. Probabilité d'être malade :</div>
            <div className="num mt-1 font-display text-4xl font-bold" style={{ color: "var(--mod-deep)" }}>{pct(r.ppv)}</div>
            <div className="num mt-1 text-xs text-muted">
              = TP / (TP + FP) = {tp} / {tp + fp}
            </div>
          </div>
        </div>
      </div>
    </LabFrame>
  );
}

function Count({ color, label, sub, v }: { color: string; label: string; sub: string; v: number }) {
  return (
    <div className="rounded-lg border border-line bg-paper p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: color }} />
        {label} <span className="ml-auto font-semibold text-ink">{sub}</span>
      </div>
      <div className="num mt-1 text-2xl font-semibold">{v}</div>
    </div>
  );
}
