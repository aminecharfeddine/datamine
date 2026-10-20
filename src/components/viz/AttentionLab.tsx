"use client";

import { useMemo, useState } from "react";
import { scaleLinear } from "d3-scale";
import { ATTN_KEYS, ATTN_SOURCE, ATTN_TOKENS, attentionMatrix, meanEntropy, steeredWeights } from "@/lib/llm";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { LabFrame, Segmented, Slider } from "./controls";

const fmt = (v: number, d = 2) => v.toFixed(d).replace(".", ",");
const TARGET = 1; // « chat »

/** La query de « il » s'oriente dans un plan de clés 2D ; le softmax des produits scalaires donne l'attention. */
export function AttentionLab({ id = "attention", challenge }: { id?: string; challenge?: string }) {
  const [angle, setAngle] = useState(-90);
  const [norm, setNorm] = useState(1);
  const w = steeredWeights(angle, norm);
  const solved = challenge ? CHALLENGES[challenge].check({ weight: w[TARGET] }) : false;

  const S = 320, R = 1.25;
  const sc = scaleLinear().domain([-R, R]).range([0, S]);
  const qx = Math.cos((angle * Math.PI) / 180), qy = Math.sin((angle * Math.PI) / 180);
  const qLen = Math.min(1.15, 0.25 + norm / 8);

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <Slider label="Direction de la query de « il »" value={angle} min={-180} max={180} step={5} onChange={setAngle} display={`${angle}°`} />
        <Slider label="Norme de la query (netteté)" value={norm} min={0.5} max={8} step={0.5} onChange={setNorm} display={fmt(norm, 1)} />
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 font-display text-lg font-bold">Clés des tokens et query de « il »</h3>
          <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto w-full max-w-[360px] rounded-xl border border-line bg-paper" role="img" aria-label={`Query orientée à ${angle} degrés ; « chat » reçoit ${Math.round(w[TARGET] * 100)} % de l'attention.`}>
            <defs>
              <marker id="att-k" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--neg)" /></marker>
              <marker id="att-q" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--mod)" /></marker>
            </defs>
            <line x1={sc(-R)} x2={sc(R)} y1={sc(0)} y2={sc(0)} stroke="var(--line)" />
            <line y1={sc(-R)} y2={sc(R)} x1={sc(0)} x2={sc(0)} stroke="var(--line)" />
            {ATTN_KEYS.map(([kx, ky], i) =>
              i === ATTN_SOURCE ? null : (
                <g key={i}>
                  <line x1={sc(0)} y1={sc(0)} x2={sc(kx)} y2={sc(-ky)} stroke="var(--neg)" strokeWidth={1.5 + w[i] * 5} strokeOpacity={0.4 + w[i] * 0.6} markerEnd="url(#att-k)" />
                  <text x={sc(kx * 1.13)} y={sc(-ky * 1.13) + 4} fontSize={12} fontWeight={700} textAnchor="middle" fill={i === TARGET ? "var(--mod-deep)" : "var(--ink)"}>
                    {ATTN_TOKENS[i]}
                  </text>
                </g>
              ),
            )}
            <line x1={sc(0)} y1={sc(0)} x2={sc(qx * qLen)} y2={sc(-qy * qLen)} stroke="var(--mod)" strokeWidth={4} markerEnd="url(#att-q)" />
            <text x={sc(qx * qLen * 0.55) + 8} y={sc(-qy * qLen * 0.55) - 6} fontSize={11} fontWeight={800} fill="var(--mod-deep)">q(il)</text>
          </svg>
        </div>
        <div>
          <h3 className="mb-2 font-display text-lg font-bold">Attention de « il » : softmax(q·k / √d)</h3>
          <ul className="space-y-2">
            {ATTN_TOKENS.map((t, i) => (
              <li key={i} className="grid grid-cols-[4.5rem_1fr_3.2rem] items-center gap-2 text-sm">
                <span className={i === TARGET ? "font-bold text-mod-deep" : i === ATTN_SOURCE ? "font-semibold text-muted" : "font-semibold"}>{t}</span>
                <span className="h-5 overflow-hidden rounded-md bg-sunken">
                  <span className="block h-full rounded-md transition-[width] duration-200" style={{ width: `${w[i] * 100}%`, background: i === TARGET ? "var(--mod)" : "var(--neg)" }} />
                </span>
                <span className="num text-right text-xs">{Math.round(w[i] * 100)} %</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted">
            La sortie de « il » sera la moyenne des <b>values</b> de chaque token, pondérée par ces pourcentages : ce que « il » récupère vient
            surtout des tokens qui ont la plus grande barre.
          </p>
        </div>
      </div>
    </LabFrame>
  );
}

const DS = ["4", "16", "64", "256"] as const;

/** Matrice d'attention complète : effet de la division par √d et du masque causal. */
export function AttentionMatrixLab({ id = "attention-matrix" }: { id?: string }) {
  const [d, setD] = useState<(typeof DS)[number]>("64");
  const [scaled, setScaled] = useState<"oui" | "non">("oui");
  const [causal, setCausal] = useState<"oui" | "non">("non");
  const A = useMemo(() => attentionMatrix(ATTN_TOKENS.length, Number(d), scaled === "oui", causal === "oui"), [d, scaled, causal]);
  const ent = meanEntropy(A);
  const n = ATTN_TOKENS.length;
  const C = 46, L = 74, T = 64;

  return (
    <LabFrame labKey={id}>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Segmented label="Dimension d des vecteurs" value={d} onChange={setD} options={DS.map((v) => ({ value: v, label: v }))} />
        <Segmented label="Diviser les scores par √d" value={scaled} onChange={setScaled} options={[{ value: "oui", label: "Oui" }, { value: "non", label: "Non" }]} />
        <Segmented label="Masque causal" value={causal} onChange={setCausal} options={[{ value: "non", label: "Non" }, { value: "oui", label: "Oui" }]} />
      </div>
      <div className="grid gap-8 lg:grid-cols-[auto_1fr] lg:items-center">
        <div className="overflow-x-auto" tabIndex={0}>
          <svg viewBox={`0 0 ${L + n * C + 4} ${T + n * C + 4}`} className="w-full min-w-[300px] max-w-[440px]" role="img" aria-label={`Matrice d'attention ${n} par ${n}, entropie moyenne ${Math.round(ent * 100)} %.`}>
            {ATTN_TOKENS.map((t, j) => (
              <text key={`c${j}`} x={L + j * C + C / 2} y={T - 10} fontSize={11} fontWeight={700} textAnchor="end" transform={`rotate(-40 ${L + j * C + C / 2} ${T - 10})`} fill="var(--muted)">{t}</text>
            ))}
            {ATTN_TOKENS.map((t, i) => (
              <text key={`r${i}`} x={L - 8} y={T + i * C + C / 2 + 4} fontSize={11} fontWeight={700} textAnchor="end" fill="var(--ink)">{t}</text>
            ))}
            {A.map((row, i) =>
              row.map((p, j) => (
                <g key={`${i}-${j}`}>
                  <rect x={L + j * C + 1} y={T + i * C + 1} width={C - 2} height={C - 2} rx={6} fill={causal === "oui" && j > i ? "var(--paper)" : `color-mix(in srgb, var(--mod) ${Math.round(p * 100)}%, white)`} stroke="var(--line)" />
                  {!(causal === "oui" && j > i) && (
                    <text x={L + j * C + C / 2} y={T + i * C + C / 2 + 4} fontSize={10.5} textAnchor="middle" fill={p > 0.55 ? "white" : "var(--ink)"} className="num">{Math.round(p * 100)}</text>
                  )}
                </g>
              )),
            )}
          </svg>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl p-3" style={{ background: "color-mix(in srgb, var(--mod) 10%, white)" }}>
            <div className="text-xs font-semibold text-muted">Attention diffuse ou tranchée ? (entropie moyenne)</div>
            <div className="num mt-0.5 text-xl font-bold">{Math.round(ent * 100)} %</div>
            <div className="mt-1 text-xs text-muted">100 % = chaque token regarde tout le monde également ; 0 % = un seul token à la fois.</div>
          </div>
          <p className="text-sm text-muted">
            Ligne = le token qui regarde (query), colonne = le token regardé (key), valeurs en %. Chaque ligne somme à 100. Q et K sont ici
            aléatoires, comme dans un modèle pas encore entraîné.
          </p>
        </div>
      </div>
    </LabFrame>
  );
}
