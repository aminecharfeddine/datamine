"use client";

import { useMemo, useState } from "react";
import { BOOST_LRS, BOOST_MAX, boostCurve, boostScores, buildForest, FOREST_MAX, forestCurve, forestVotes, predictNode, trainBoosting } from "@/lib/models";
import { moonGrid, MOON_TEST, MOON_TRAIN } from "@/lib/ml";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { LabFrame, Segmented, Slider } from "./controls";
import { AccCurve, AccReadouts, DecisionMap } from "./Classify2D";

const GRID = moonGrid();

// ------------------------------------------------------------------ Forêt aléatoire

let forestCache: ReturnType<typeof computeForest> | null = null;
function computeForest() {
  const forest = buildForest();
  return {
    forest,
    grid: forestVotes(forest, GRID.cells),
    train: forestCurve(forestVotes(forest, MOON_TRAIN), MOON_TRAIN),
    test: forestCurve(forestVotes(forest, MOON_TEST), MOON_TEST),
  };
}
const getForest = () => (forestCache ??= computeForest());
const COUNTS = Array.from({ length: FOREST_MAX }, (_, i) => i + 1);
type View = "forest" | "1" | "2" | "3";

/** Forêt aléatoire : des arbres profonds sur des échantillons bootstrap, qui votent. */
export function ForestLab({ id = "forest", trees: t0 = 1, challenge }: { id?: string; trees?: number; challenge?: string }) {
  const [n, setN] = useState(t0);
  const [view, setView] = useState<View>("forest");
  const { forest, grid, train, test } = getForest();

  const predict = useMemo(() => {
    if (view === "forest") return grid.map((v) => v[n - 1] as 0 | 1);
    const tree = forest[Number(view) - 1];
    return GRID.cells.map((c) => predictNode(tree, c.x, c.y) as 0 | 1);
  }, [view, n, grid, forest]);

  const solved = challenge ? CHALLENGES[challenge].check({ trees: n, testAcc: test[n - 1], singleAcc: test[0] }) : false;

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <Slider label="Nombre d'arbres qui votent" value={n} min={1} max={FOREST_MAX} step={1} onChange={(v) => { setN(v); setView("forest"); }} display={String(n)} />
        <Segmented
          label="Afficher"
          value={view}
          onChange={setView}
          options={[
            { value: "forest", label: "La forêt" },
            { value: "1", label: "Arbre 1" },
            { value: "2", label: "Arbre 2" },
            { value: "3", label: "Arbre 3" },
          ]}
        />
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <DecisionMap
          predict={predict}
          cols={GRID.cols}
          rows={GRID.rows}
          points={MOON_TRAIN}
          title={view === "forest" ? `Vote de ${n} arbre${n > 1 ? "s" : ""}` : `Arbre ${view} seul (son propre bootstrap)`}
        />
        <div className="space-y-5">
          <AccCurve xs={COUNTS} train={train} test={test} current={n} xLabel="nombre d'arbres" title="Précision selon la taille de la forêt" leftNote="un arbre" rightNote="" />
          <AccReadouts train={train[n - 1]} test={test[n - 1]} />
        </div>
      </div>
    </LabFrame>
  );
}

// ------------------------------------------------------------------ Gradient boosting

const boostCache = new Map<number, { grid: Float32Array[]; train: number[]; test: number[] }>();
function getBoost(lr: number) {
  if (!boostCache.has(lr)) {
    const b = trainBoosting(MOON_TRAIN, lr);
    boostCache.set(lr, {
      grid: boostScores(b, GRID.cells),
      train: boostCurve(boostScores(b, MOON_TRAIN), MOON_TRAIN),
      test: boostCurve(boostScores(b, MOON_TEST), MOON_TEST),
    });
  }
  return boostCache.get(lr)!;
}
let bestBoost: number | null = null;
const getBestBoost = () => (bestBoost ??= Math.max(...BOOST_LRS.flatMap((lr) => getBoost(lr).test)));
const ROUNDS = Array.from({ length: BOOST_MAX }, (_, i) => i + 1);
type Lr = "0.05" | "0.3" | "1";

/** Gradient boosting : chaque petit arbre corrige les erreurs de la somme des précédents. */
export function BoostLab({ id = "boost", rounds: r0 = 1, challenge }: { id?: string; rounds?: number; challenge?: string }) {
  const [m, setM] = useState(r0);
  const [lrS, setLr] = useState<Lr>("0.3");
  const lr = Number(lrS);
  const { grid, train, test } = getBoost(lr);
  const predict = useMemo(() => grid.map((s) => (s[m - 1] > 0 ? 1 : 0) as 0 | 1), [grid, m]);
  const solved = challenge ? CHALLENGES[challenge].check({ lr, rounds: m, trainAcc: train[m - 1], testAcc: test[m - 1], bestAcc: getBestBoost() }) : false;

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <Slider label="Itérations (arbres de profondeur 2)" value={m} min={1} max={BOOST_MAX} step={1} onChange={setM} display={String(m)} />
        <Segmented
          label="Taux d'apprentissage (learning rate)"
          value={lrS}
          onChange={setLr}
          options={[
            { value: "0.05", label: "0,05" },
            { value: "0.3", label: "0,3" },
            { value: "1", label: "1" },
          ]}
        />
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <DecisionMap predict={predict} cols={GRID.cols} rows={GRID.rows} points={MOON_TRAIN} title={`Après ${m} itération${m > 1 ? "s" : ""}`} />
        <div className="space-y-5">
          <AccCurve xs={ROUNDS} train={train} test={test} current={m} xLabel="itérations" title="Précision selon le nombre d'itérations" leftNote="underfitting" rightNote="overfitting" />
          <AccReadouts train={train[m - 1]} test={test[m - 1]} />
        </div>
      </div>
    </LabFrame>
  );
}
