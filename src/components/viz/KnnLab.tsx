"use client";

import { useMemo, useState } from "react";
import { KNN_KS, knnAccuracyCurve, moonGrid, MOON_TEST, MOON_TRAIN, neighborLabels, voteK } from "@/lib/ml";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { LabFrame, Slider } from "./controls";
import { AccCurve, AccReadouts, DecisionMap } from "./Classify2D";

const GRID = moonGrid();
const Y_SCALE = 20;

/** k plus proches voisins sur des demi-lunes : k règle la douceur de la frontière. */
export function KnnLab({ id = "knn", k: k0 = 1, allowScale = false, challenge }: { id?: string; k?: number; allowScale?: boolean; challenge?: string }) {
  const [k, setK] = useState(k0);
  const [scaled, setScaled] = useState(false);
  const yScale = scaled ? Y_SCALE : 1;

  // Voisins pré-triés une fois par échelle : changer k ne coûte ensuite qu'un vote.
  const gridNeigh = useMemo(() => neighborLabels(MOON_TRAIN, GRID.cells, yScale), [yScale]);
  const trainNeigh = useMemo(() => neighborLabels(MOON_TRAIN, MOON_TRAIN, yScale), [yScale]);
  const testNeigh = useMemo(() => neighborLabels(MOON_TRAIN, MOON_TEST, yScale), [yScale]);
  const trainCurve = useMemo(() => knnAccuracyCurve(trainNeigh, MOON_TRAIN), [trainNeigh]);
  const testCurve = useMemo(() => knnAccuracyCurve(testNeigh, MOON_TEST), [testNeigh]);
  const bestAcc = useMemo(() => Math.max(...knnAccuracyCurve(neighborLabels(MOON_TRAIN, MOON_TEST, 1), MOON_TEST)), []);
  const predict = useMemo(() => gridNeigh.map((l) => voteK(l, k)), [gridNeigh, k]);

  const ki = KNN_KS.indexOf(k);
  const trainAcc = trainCurve[ki];
  const testAcc = testCurve[ki];
  const solved = challenge ? CHALLENGES[challenge].check({ k, scaled, testAcc, bestAcc }) : false;

  return (
    <LabFrame>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <Slider label="Nombre de voisins k" value={k} min={1} max={149} step={2} onChange={setK} display={String(k)} />
        {allowScale && (
          <label className="flex items-center gap-3 self-end rounded-xl border-2 border-line bg-surface px-4 py-2.5 text-sm font-semibold">
            <input type="checkbox" checked={scaled} onChange={(e) => setScaled(e.target.checked)} className="h-4 w-4 accent-[var(--mod)]" />
            y mesuré en centimètres (valeurs × {Y_SCALE}, sans standardiser)
          </label>
        )}
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <DecisionMap predict={predict} cols={GRID.cols} rows={GRID.rows} points={MOON_TRAIN} title={`Régions de décision, k = ${k}`} />
        <div className="space-y-5">
          <AccCurve xs={KNN_KS} train={trainCurve} test={testCurve} current={k} xLabel="k (nombre de voisins)" title="Précision selon k" leftNote="overfitting" rightNote="underfitting" />
          <AccReadouts train={trainAcc} test={testAcc} />
        </div>
      </div>
    </LabFrame>
  );
}
