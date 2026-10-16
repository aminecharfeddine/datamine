"use client";

import { useMemo, useState } from "react";
import { scaleLinear } from "d3-scale";
import { leakageCv, mean, noiseDataset } from "@/lib/ml";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { LabButton, LabFrame, Segmented } from "./controls";

const N = 60, P = 2000, M = 20;
const pct = (v: number) => `${Math.round(v * 100)} %`;

/**
 * Fuite de données : 60 exemples, 2 000 variables de pur bruit, étiquettes au hasard.
 * Sélectionner les variables avant la validation croisée donne une précision spectaculaire… et fausse.
 */
export function LeakLab({ id = "leak", challenge }: { id?: string; challenge?: string }) {
  const [seed, setSeed] = useState(2);
  const [mode, setMode] = useState<"avant" | "pendant">("avant");
  const [folds, setFolds] = useState<number[] | null>(null);
  const [leakyAcc, setLeakyAcc] = useState<number | null>(null);
  const [cleanAcc, setCleanAcc] = useState<number | null>(null);
  const data = useMemo(() => noiseDataset(N, P, seed), [seed]);
  const solved = challenge ? CHALLENGES[challenge].check({ leakyAcc, cleanAcc }) : false;

  const run = () => {
    const f = leakageCv(data, M, mode === "avant");
    setFolds(f);
    if (mode === "avant") setLeakyAcc(mean(f));
    else setCleanAcc(mean(f));
  };

  const W = 360, H = 150, PAD = 8;
  const y = scaleLinear().domain([0, 1]).range([H - PAD, PAD]);

  return (
    <LabFrame>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <p className="mb-5 rounded-xl bg-paper p-3 text-sm text-muted">
        {N} patients, {P.toLocaleString("fr-FR")} variables de <strong className="text-ink">pur bruit aléatoire</strong>, et une étiquette malade / sain tirée à pile ou face. Aucun modèle ne peut faire mieux que <strong className="text-ink">50 %</strong> sur de nouvelles données. Pipeline : garder les {M} variables les plus corrélées à l'étiquette, puis classer par plus proche centroïde, évalué en validation croisée à 5 plis.
      </p>

      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <Segmented
            label="Où fais-tu la sélection des variables ?"
            value={mode}
            options={[
              { value: "avant", label: "Sur tout le dataset, avant la CV" },
              { value: "pendant", label: "Dans chaque pli, sur le train seulement" },
            ]}
            onChange={(v) => {
              setMode(v);
              setFolds(null);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <LabButton primary onClick={run}>
              Lancer la validation croisée
            </LabButton>
            <LabButton
              onClick={() => {
                setSeed((s) => s + 1);
                setFolds(null);
                setLeakyAcc(null);
                setCleanAcc(null);
              }}
            >
              Nouveau jeu de données
            </LabButton>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl p-3" style={{ background: "#fff4ed" }}>
              <div className="text-xs font-semibold text-muted">Sélection avant la CV</div>
              <div className="num mt-0.5 text-2xl font-bold">{leakyAcc === null ? "–" : pct(leakyAcc)}</div>
            </div>
            <div className="rounded-xl p-3" style={{ background: "color-mix(in srgb, var(--mod) 10%, white)" }}>
              <div className="text-xs font-semibold text-muted">Sélection dans chaque pli</div>
              <div className="num mt-0.5 text-2xl font-bold">{cleanAcc === null ? "–" : pct(cleanAcc)}</div>
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-display text-lg font-bold">Précision de chaque pli</h4>
          {folds ? (
            <>
              <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label={`Précision moyenne ${pct(mean(folds))}`}>
                <line x1={0} x2={W} y1={y(0.5)} y2={y(0.5)} stroke="var(--ink)" strokeDasharray="5 4" />
                <text x={W - 4} y={y(0.5) - 5} fontSize={11} textAnchor="end" fill="var(--ink)" fontWeight={700}>hasard (50 %)</text>
                {folds.map((a, i) => {
                  const bw = (W - 2 * PAD) / folds.length;
                  return (
                    <g key={i}>
                      <rect x={PAD + i * bw + 6} y={y(a)} width={bw - 12} height={y(0) - y(a)} rx={4} fill={mode === "avant" ? "var(--fp)" : "var(--mod)"} />
                      <text x={PAD + i * bw + bw / 2} y={y(a) - 5} fontSize={11} textAnchor="middle" fill="var(--ink)" className="num">{pct(a)}</text>
                    </g>
                  );
                })}
              </svg>
              <p className="text-sm font-semibold" style={{ color: mode === "avant" ? "#9c2a10" : "var(--mod-deep)" }}>
                Moyenne : {pct(mean(folds))}
                {mode === "avant" ? ". Trop beau pour être vrai." : ". La vérité : du hasard."}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">Lance la validation croisée pour voir les résultats.</p>
          )}
        </div>
      </div>
    </LabFrame>
  );
}
