"use client";

import { useMemo, useState } from "react";
import { accuracy, buildTree, countLeaves, moonGrid, MOON_TEST, MOON_TRAIN, treeClassifier, treeDepth, TREE_MAX_DEPTH, type TreeNode } from "@/lib/ml";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { LabFrame, Slider } from "./controls";
import { AccCurve, AccReadouts, DecisionMap } from "./Classify2D";

const GRID = moonGrid();
const DEPTHS = Array.from({ length: TREE_MAX_DEPTH }, (_, i) => i + 1);

// Les arbres de chaque profondeur sont déterministes : on les calcule une fois.
let cache: { trees: TreeNode[]; train: number[]; test: number[] } | null = null;
function allTrees() {
  if (!cache) {
    const trees = DEPTHS.map((d) => buildTree(MOON_TRAIN, d));
    cache = {
      trees,
      train: trees.map((t) => accuracy(treeClassifier(t), MOON_TRAIN)),
      test: trees.map((t) => accuracy(treeClassifier(t), MOON_TEST)),
    };
  }
  return cache;
}

/** Arbre de décision (CART, Gini) : chaque niveau coupe le plan en rectangles plus fins. */
export function TreeLab({ id = "tree", depth: d0 = 1, challenge }: { id?: string; depth?: number; challenge?: string }) {
  const [depth, setDepth] = useState(d0);
  const { trees, train, test } = allTrees();
  const tree = trees[depth - 1];
  const predict = useMemo(() => {
    const f = treeClassifier(tree);
    return GRID.cells.map((c) => f(c.x, c.y));
  }, [tree]);
  const bestAcc = Math.max(...test);
  const trainAcc = train[depth - 1];
  const testAcc = test[depth - 1];
  const solved = challenge ? CHALLENGES[challenge].check({ depth, trainAcc, testAcc, bestAcc }) : false;
  const leaves = countLeaves(tree);

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-6 max-w-md">
        <Slider label="Profondeur maximale de l'arbre" value={depth} min={1} max={TREE_MAX_DEPTH} step={1} onChange={setDepth} display={String(depth)} />
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <DecisionMap predict={predict} cols={GRID.cols} rows={GRID.rows} points={MOON_TRAIN} title={`Régions de décision, profondeur ${depth}`} />
          <p className="mt-2 text-sm text-muted">
            <span className="num font-bold text-ink">{leaves}</span> feuilles (rectangles) · profondeur réelle{" "}
            <span className="num font-bold text-ink">{treeDepth(tree)}</span>
            {tree.leaf ? "" : ` · première question : « ${tree.feat} ≤ ${tree.thr.toFixed(2).replace(".", ",")} ? »`}
          </p>
        </div>
        <div className="space-y-5">
          <AccCurve xs={DEPTHS} train={train} test={test} current={depth} xLabel="profondeur maximale" title="Précision selon la profondeur" leftNote="underfitting" rightNote="overfitting" />
          <AccReadouts train={trainAcc} test={testAcc} />
        </div>
      </div>
    </LabFrame>
  );
}
