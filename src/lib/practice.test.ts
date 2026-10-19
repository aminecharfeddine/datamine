// @vitest-environment node
import { describe, expect, it } from "vitest";
import initSqlJs from "sql.js";
import { CHALLENGES } from "./challenges";
import { broadcast, CHURN, featureFit, monthAccuracy, pipelineCv, psi, monthData, runPandas, shopSql, SHOP, simulateYear, trainOnMonth } from "./practice";
import { sameResult, SQL_EXERCISES, type SqlResult } from "./sqlExercises";

const C = (id: string, s: unknown) => CHALLENGES[id].check(s);

describe("boutique et mini-pandas", () => {
  it("des clients sans commande existent (utile pour LEFT JOIN)", () => {
    expect(SHOP.clients.some((c) => !SHOP.commandes.some((o) => o.client_id === c.id))).toBe(true);
  });
  it("groupby mean trié", () => {
    const r = runPandas({ categorie: "Tech", minMontant: 0, group: "ville", agg: "mean", sortDesc: true, head: 10 });
    const v = r.rows.map((x) => x.montant as number);
    expect([...v].sort((a, b) => b - a)).toEqual(v);
    expect(C("pandas-mean", { categorie: "Tech", minMontant: 0, group: "ville", agg: "mean", sortDesc: true })).toBe(true);
    expect(C("pandas-mean", { categorie: "Tech", minMontant: 0, group: "ville", agg: "sum", sortDesc: true })).toBe(false);
  });
  it("broadcasting : règles NumPy", () => {
    expect(broadcast([4, 3], [3])).toEqual([4, 3]);
    expect(broadcast([4, 3], [4, 1])).toEqual([4, 3]);
    expect(broadcast([4, 3], [4])).toBeNull();
    expect(broadcast([4, 1], [1, 3])).toEqual([4, 3]);
  });
});

describe("pipeline", () => {
  it("le kNN a besoin de standardisation ; le bon pipeline atteint le défi sans supprimer de lignes", () => {
    const raw = pipelineCv({ impute: "mean", scale: "none", ville: "onehot", model: "knn" }).acc;
    const scaled = pipelineCv({ impute: "mean", scale: "standard", ville: "onehot", model: "knn" }).acc;
    expect(scaled).toBeGreaterThan(raw + 0.1);
    const best = pipelineCv({ impute: "median", scale: "standard", ville: "onehot", model: "logreg" });
    expect(C("pipe-best", { impute: "median", scale: "standard", ville: "onehot", model: "logreg", acc: best.acc })).toBe(true);
    const ord = pipelineCv({ impute: "median", scale: "standard", ville: "ordinal", model: "logreg" }).acc;
    expect(best.acc).toBeGreaterThan(ord + 0.04); // one-hot > ordinal pour une variable non ordonnée
    expect(pipelineCv({ impute: "drop", scale: "none", ville: "drop", model: "knn" }).n).toBeLessThan(CHURN.length);
  });
});

describe("feature engineering", () => {
  it("jour de la semaine et température² sont nécessaires ; le découpage aléatoire est optimiste", () => {
    const base = featureFit({ dow: false, temp2: false, inter: false, split: "temporel" });
    const full = featureFit({ dow: true, temp2: true, inter: true, split: "temporel" });
    expect(full.valR2).toBeGreaterThan(0.95);
    expect(C("feat-r2", { split: "temporel", valR2: full.valR2 })).toBe(true);
    expect(C("feat-r2", { split: "temporel", valR2: base.valR2 })).toBe(false);
    expect(featureFit({ dow: false, temp2: false, inter: false, split: "aleatoire" }).valR2).toBeGreaterThan(base.valR2);
  });
});

describe("dérive", () => {
  it("la précision baisse sans réentraînement, le PSI monte", () => {
    const year = simulateYear([]);
    expect(year[0].acc).toBeGreaterThan(0.8);
    expect(year[12].acc).toBeLessThan(0.6);
    expect(year[3].psi).toBeGreaterThan(0.2);
    expect(psi(monthData(0).map((p) => p.x), monthData(0, 600, 99).map((p) => p.x))).toBeLessThan(0.1);
    expect(monthAccuracy(trainOnMonth(5).thr, 5)).toBeGreaterThan(0.8);
  });
  it("défi drift-keep : faisable avec 4 réentraînements, impossible sans", () => {
    const minAcc = (r: number[]) => Math.min(...simulateYear(r).map((m) => m.acc));
    expect(C("drift-keep", { retrains: 0, minAcc: minAcc([]) })).toBe(false);
    let ok = false;
    for (let a = 1; a <= 12 && !ok; a++)
      for (let b = a + 1; b <= 12 && !ok; b++)
        for (let c = b + 1; c <= 12 && !ok; c++) for (let d = c + 1; d <= 12 && !ok; d++) if (minAcc([a, b, c, d]) >= 0.7) ok = true;
    expect(ok).toBe(true);
    expect(C("drift-keep", { retrains: 4, minAcc: minAcc([2, 5, 8, 11]) })).toBe(true);
  });
});

describe("exercices SQL", async () => {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.run(shopSql());
  const run = (q: string): SqlResult | null => {
    const r = db.exec(q);
    return r.length ? { columns: r[0].columns, values: r[0].values as SqlResult["values"] } : { columns: [], values: [] };
  };
  for (const [id, ex] of Object.entries(SQL_EXERCISES)) {
    it(`${id} : la solution renvoie des lignes, la requête de départ ne suffit pas`, () => {
      const want = run(ex.solution)!;
      expect(want.values.length).toBeGreaterThan(0);
      expect(sameResult(run(ex.solution), want, ex.ordered)).toBe(true);
      expect(sameResult(run(ex.starter), want, ex.ordered)).toBe(false);
    });
  }
  it("HAVING élimine au moins une catégorie, le LEFT JOIN garde des clients à 0 commande", () => {
    expect(run(SQL_EXERCISES["sql-group"].solution)!.values.length).toBeLessThan(4);
    expect(run(SQL_EXERCISES["sql-join"].solution)!.values.some((r) => r[1] === 0)).toBe(true);
  });
});
