"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react";
import {
  CAL_ECE_TARGET, calibration, CONST_GRID, CONST_MAX, CONST_MIN, CONST_STEP, constMetrics, DELAIS, MC_BEST_MACRO, MC_CLASSES, MC_WEIGHTS, mcConfusion, mean, median,
  RANK_DOCS, RANK_K, RANK_QUERY, RANK_START, rankMetrics, type CalModel,
} from "@/lib/evalmetrics";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { LabButton, LabFrame, Segmented, Slider } from "./controls";

const fmt = (v: number, d = 2) => v.toFixed(d).replace(".", ",");
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

// ============================================================ 1. Régression : la meilleure constante

const OUTLIER = Math.max(...DELAIS);

/** Prédire une seule valeur pour toutes les livraisons : quelle constante minimise la MAE ? la RMSE ? */
export function ConstantPredLab({ id = "constante", challenge }: { id?: string; challenge?: string }) {
  const [c, setC] = useState(35);
  const [withOutlier, setWithOutlier] = useState(true);
  const [hits, setHits] = useState({ maeHit: false, rmseHit: false });
  const data = useMemo(() => (withOutlier ? DELAIS : DELAIS.filter((d) => d !== OUTLIER)), [withOutlier]);
  const curve = useMemo(() => CONST_GRID.map((v) => ({ c: v, ...constMetrics(v, data) })), [data]);
  const bestMae = Math.min(...curve.map((p) => p.mae));
  const bestRmse = Math.min(...curve.map((p) => p.rmse));
  const m = constMetrics(c, data);
  const mu = mean(data);
  const med = median(data);
  const solved = challenge ? CHALLENGES[challenge].check(hits) : false;

  const update = (v: number, d = data) => {
    setC(v);
    const mm = constMetrics(v, d);
    const bm = Math.min(...CONST_GRID.map((g) => constMetrics(g, d).mae));
    const br = Math.min(...CONST_GRID.map((g) => constMetrics(g, d).rmse));
    setHits((h) => ({ maeHit: h.maeHit || mm.mae <= bm + 1e-9, rmseHit: h.rmseHit || mm.rmse <= br + 1e-9 }));
  };

  // Bande des données
  const SW = 560, SH = 120, SM = { l: 14, r: 14 };
  const xs = scaleLinear().domain([0, 120]).range([SM.l, SW - SM.r]);
  const stack = new Map<number, number>();
  const dots = data.map((d) => {
    const k = stack.get(d) ?? 0;
    stack.set(d, k + 1);
    return { d, k };
  });

  // Courbes
  const W = 560, H = 230, M = { l: 40, r: 14, t: 12, b: 30 };
  const x = scaleLinear().domain([CONST_MIN, CONST_MAX]).range([M.l, W - M.r]);
  const yMax = Math.max(...curve.map((p) => p.rmse));
  const y = scaleLinear().domain([0, yMax]).range([H - M.b, M.t]).nice();
  const mk = (key: "mae" | "rmse") => line<(typeof curve)[number]>().x((p) => x(p.c)).y((p) => y(p[key]))(curve) ?? "";

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-5 grid gap-5 sm:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
        <Slider label="Prédiction constante (minutes)" value={c} min={CONST_MIN} max={CONST_MAX} step={CONST_STEP} onChange={(v) => update(v)} display={`${fmt(c, 1)} min`} />
        <Segmented
          label={`Livraison de ${OUTLIER} min (incident)`}
          value={withOutlier ? "in" : "out"}
          onChange={(v) => {
            const w = v === "in";
            setWithOutlier(w);
            update(c, w ? DELAIS : DELAIS.filter((d) => d !== OUTLIER));
          }}
          options={[{ value: "in", label: "Gardée" }, { value: "out", label: "Retirée" }]}
        />
      </div>

      <div className="mb-1 text-sm font-semibold text-muted">Délais réels de {data.length} livraisons</div>
      <svg viewBox={`0 0 ${SW} ${SH}`} className="mb-4 w-full" role="img" aria-label={`Moyenne ${fmt(mu, 1)} minutes, médiane ${fmt(med, 1)} minutes`}>
        <line x1={SM.l} x2={SW - SM.r} y1={SH - 28} y2={SH - 28} stroke="var(--line)" />
        {[0, 20, 40, 60, 80, 100, 120].map((v) => (
          <text key={v} x={xs(v)} y={SH - 12} fontSize={10} textAnchor="middle" fill="var(--muted)" className="num">{v}</text>
        ))}
        {dots.map(({ d, k }, i) => (
          <circle key={i} cx={xs(d)} cy={SH - 36 - k * 9} r={4} fill={d === OUTLIER ? "var(--fp)" : "var(--ink)"} opacity={0.75} />
        ))}
        <line x1={xs(med)} x2={xs(med)} y1={14} y2={SH - 28} stroke="var(--fn)" strokeWidth={2} strokeDasharray="4 3" />
        <text x={xs(med) - 4} y={11} fontSize={10.5} textAnchor="end" fill="var(--fn)" fontWeight={700}>médiane {fmt(med, 0)}</text>
        <line x1={xs(mu)} x2={xs(mu)} y1={14} y2={SH - 28} stroke="var(--pos)" strokeWidth={2} strokeDasharray="4 3" />
        <text x={xs(mu) + 4} y={11} fontSize={10.5} fill="var(--pos)" fontWeight={700}>moyenne {fmt(mu, 1)}</text>
        <line x1={xs(c)} x2={xs(c)} y1={22} y2={SH - 28} stroke="var(--mod)" strokeWidth={3} />
      </svg>

      <div className="space-y-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`MAE ${fmt(m.mae, 1)}, RMSE ${fmt(m.rmse, 1)}`}>
          {y.ticks(5).map((v) => (
            <g key={v}>
              <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
              <text x={M.l - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)" className="num">{v}</text>
            </g>
          ))}
          {[10, 20, 30, 40, 50, 60].map((v) => (
            <text key={v} x={x(v)} y={H - M.b + 15} fontSize={10} textAnchor="middle" fill="var(--muted)" className="num">{v}</text>
          ))}
          <text x={(M.l + W - M.r) / 2} y={H - 2} fontSize={11} textAnchor="middle" fill="var(--muted)">prédiction constante (min)</text>
          <path d={mk("mae")} fill="none" stroke="var(--fn)" strokeWidth={2.5} />
          <path d={mk("rmse")} fill="none" stroke="var(--pos)" strokeWidth={2.5} />
          <text x={W - M.r} y={y(curve[curve.length - 1].mae) + 16} fontSize={11} textAnchor="end" fill="var(--fn)" fontWeight={700}>MAE</text>
          <text x={W - M.r} y={y(curve[curve.length - 1].rmse) - 8} fontSize={11} textAnchor="end" fill="var(--pos)" fontWeight={700}>RMSE</text>
          <line x1={x(c)} x2={x(c)} y1={M.t} y2={H - M.b} stroke="var(--mod)" strokeDasharray="4 3" />
          <circle cx={x(c)} cy={y(m.mae)} r={5.5} fill="var(--fn)" stroke="var(--surface)" strokeWidth={2} />
          <circle cx={x(c)} cy={y(m.rmse)} r={5.5} fill="var(--pos)" stroke="var(--surface)" strokeWidth={2} />
        </svg>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Readout label="MAE" value={`${fmt(m.mae, 2)} min`} strong={m.mae <= bestMae + 1e-9} sub={m.mae <= bestMae + 1e-9 ? "minimum atteint" : undefined} />
          <Readout label="RMSE" value={`${fmt(m.rmse, 2)} min`} strong={m.rmse <= bestRmse + 1e-9} sub={m.rmse <= bestRmse + 1e-9 ? "minimum atteint" : undefined} />
          <Readout label="R²" value={fmt(m.r2, 3)} sub="0 pour la moyenne" />
          <Readout label="MAPE" value={pct(m.mape, 0)} />
        </div>
      </div>
    </LabFrame>
  );
}

// ============================================================ 2. Multiclasse

/** Classifieur de tickets à 4 classes déséquilibrées : un poids sur la classe rare change tout le tableau. */
export function MulticlassLab({ id = "multiclasse", challenge }: { id?: string; challenge?: string }) {
  const [wi, setWi] = useState(0);
  const w = MC_WEIGHTS[wi];
  const r = useMemo(() => mcConfusion(w), [w]);
  const solved = challenge ? CHALLENGES[challenge].check({ macroF1: r.macroF1, best: MC_BEST_MACRO }) : false;
  const short = ["Fact.", "Livr.", "Tech.", "Fraude"];

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-5 max-w-md">
        <Slider label="Poids de la classe Fraude" value={wi} min={0} max={MC_WEIGHTS.length - 1} step={1} onChange={setWi} display={`× ${fmt(w, w % 1 ? 1 : 0)}`} />
      </div>
      <div className="space-y-6">
        <div>
          <div className="mb-2 text-sm font-semibold text-muted">Confusion matrix (lignes : vraie classe, colonnes : prédite)</div>
          <div className="overflow-x-auto">
            <table className="num w-full max-w-xl border-separate text-center text-sm" style={{ borderSpacing: 3 }}>
              <thead>
                <tr>
                  <th />
                  {short.map((c) => <th key={c} className="pb-1 text-xs font-semibold text-muted">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {r.matrix.map((row, i) => {
                  const tot = row.reduce((a, b) => a + b, 0);
                  return (
                    <tr key={i}>
                      <th className="pr-1 text-right text-xs font-semibold text-muted">{short[i]}</th>
                      {row.map((v, j) => {
                        const share = v / tot;
                        const col = i === j ? "var(--pos)" : "var(--fp)";
                        return (
                          <td
                            key={j}
                            className="rounded-lg py-2 font-bold"
                            style={{ background: `color-mix(in srgb, ${col} ${Math.round(share * 85)}%, white)`, color: share > 0.5 ? "white" : "var(--ink)" }}
                          >
                            {v}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Readout label="Accuracy (= micro-F1)" value={pct(r.accuracy)} />
            <Readout label="Weighted-F1" value={pct(r.weightedF1)} />
            <Readout label="Macro-F1" value={pct(r.macroF1)} strong />
            <Readout label="Macro-recall" value={pct(r.macroRecall)} />
          </div>
        </div>
        <div>
          <div className="mb-2 text-sm font-semibold text-muted">Rapport par classe</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="py-1.5 pr-3 font-semibold">Classe</th>
                  <th className="font-semibold">Precision</th>
                  <th className="font-semibold">Recall</th>
                  <th className="font-semibold">F1</th>
                  <th className="text-right font-semibold">Support</th>
                </tr>
              </thead>
              <tbody className="num whitespace-nowrap">
                {r.perClass.map((s, i) => (
                  <tr key={i} className={clsx("border-t border-line", i === 3 && "font-bold")}>
                    <td className="py-2 font-sans">{MC_CLASSES[i]}</td>
                    <td>{pct(s.precision, 0)}</td>
                    <td>{pct(s.recall, 0)}</td>
                    <td>{pct(s.f1, 0)}</td>
                    <td className="text-right">{s.support}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-sm text-muted">
            Le poids multiplie le score de la classe Fraude avant l'argmax (équivalent à un <code className="code-raw font-mono text-xs">class_weight</code> ou à un seuil abaissé pour cette classe).
          </p>
        </div>
      </div>
    </LabFrame>
  );
}

// ============================================================ 3. Calibration

const CAL_LABEL: Record<CalModel, string> = { boosting: "Boosting (surconfiant)", regularise: "Réseau très régularisé (sous-confiant)" };

/** Courbe de calibration et temperature scaling : le classement (AUC) ne bouge pas, les probabilités oui. */
export function CalibrationLab({ id = "calibration", challenge }: { id?: string; challenge?: string }) {
  const [model, setModel] = useState<CalModel>("boosting");
  const [temps, setTemps] = useState<Record<CalModel, number>>({ boosting: 1, regularise: 1 });
  const T = temps[model];
  const res = useMemo(() => calibration(model, T), [model, T]);
  const eceB = useMemo(() => calibration("boosting", temps.boosting).ece, [temps.boosting]);
  const eceR = useMemo(() => calibration("regularise", temps.regularise).ece, [temps.regularise]);
  const solved = challenge ? CHALLENGES[challenge].check({ eceBoosting: eceB, eceRegularise: eceR, target: CAL_ECE_TARGET }) : false;

  const S = 300, M = { l: 40, r: 12, t: 12, b: 36 };
  const x = scaleLinear().domain([0, 1]).range([M.l, S - M.r]);
  const y = scaleLinear().domain([0, 1]).range([S - M.b, M.t]);
  const bins = res.bins.filter((b) => b.count > 0);
  const maxCount = Math.max(...res.bins.map((b) => b.count));
  const path = line<(typeof bins)[number]>().x((b) => x(b.meanPred)).y((b) => y(b.freq))(bins) ?? "";

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-5 grid gap-5 sm:grid-cols-2 [&>*]:min-w-0">
        <Segmented label="Modèle" value={model} onChange={setModel} options={(["boosting", "regularise"] as const).map((m) => ({ value: m, label: CAL_LABEL[m] }))} />
        <Slider label="Température T (p = σ(z / T))" value={T} min={0.3} max={3} step={0.05} onChange={(v) => setTemps((t) => ({ ...t, [model]: v }))} display={fmt(T, 2)} />
      </div>
      <div className="grid gap-6 md:grid-cols-[minmax(0,320px)_1fr] [&>*]:min-w-0">
        <svg viewBox={`0 0 ${S} ${S}`} className="w-full" role="img" aria-label={`Courbe de calibration, ECE ${fmt(res.ece, 3)}`}>
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((v) => (
            <g key={v}>
              <line x1={x(0)} x2={x(1)} y1={y(v)} y2={y(v)} stroke="var(--line)" />
              <text x={M.l - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)" className="num">{fmt(v, 1)}</text>
              <text x={x(v)} y={S - M.b + 15} fontSize={10} textAnchor="middle" fill="var(--muted)" className="num">{fmt(v, 1)}</text>
            </g>
          ))}
          <text x={(M.l + S - M.r) / 2} y={S - 4} fontSize={11} textAnchor="middle" fill="var(--muted)">probabilité prédite (moyenne de la tranche)</text>
          <text x={12} y={(M.t + S - M.b) / 2} fontSize={11} textAnchor="middle" fill="var(--muted)" transform={`rotate(-90 12 ${(M.t + S - M.b) / 2})`}>fréquence observée</text>
          <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="var(--muted)" strokeDasharray="5 4" />
          {res.bins.map((b, i) => (
            <rect key={i} x={x(b.lo) + 1} width={x(b.hi) - x(b.lo) - 2} y={S - M.b - (b.count / maxCount) * 40} height={(b.count / maxCount) * 40} fill="var(--mod)" opacity={0.15} />
          ))}
          <path d={path} fill="none" stroke="var(--mod)" strokeWidth={2.5} />
          {bins.map((b, i) => (
            <circle key={i} cx={x(b.meanPred)} cy={y(b.freq)} r={4.5} fill="var(--mod)" stroke="var(--surface)" strokeWidth={1.5} />
          ))}
        </svg>
        <div>
          <div className="grid grid-cols-2 gap-2">
            <Readout label="ECE (erreur de calibration)" value={fmt(res.ece, 3)} strong={res.ece < CAL_ECE_TARGET} sub={res.ece < CAL_ECE_TARGET ? "sous 0,02" : "objectif : sous 0,02"} />
            <Readout label="Log loss" value={fmt(res.logloss, 3)} />
            <Readout label="Brier score" value={fmt(res.brier, 3)} />
            <Readout label="AUC ROC" value={fmt(res.auc, 3)} sub="ne bouge jamais" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            {(["boosting", "regularise"] as const).map((m) => {
              const e = m === "boosting" ? eceB : eceR;
              return (
                <div key={m} className={clsx("rounded-xl border-2 px-3 py-2", e < CAL_ECE_TARGET ? "border-[var(--pos)]" : "border-line")}>
                  <div className="text-xs font-semibold text-muted">{m === "boosting" ? "Boosting" : "Réseau régularisé"}</div>
                  <div className="num font-bold">T = {fmt(temps[m], 2)}</div>
                  <div className="num text-xs">ECE {fmt(e, 3)}</div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-sm text-muted">
            Points sous la diagonale : le modèle annonce plus qu'il n'observe (surconfiance). Au-dessus : il est trop prudent. Les barres pâles montrent combien d'exemples tombent dans chaque tranche.
          </p>
        </div>
      </div>
    </LabFrame>
  );
}

// ============================================================ 4. Ranking

const GRADE_LABEL = ["hors sujet", "vaguement lié", "utile", "répond exactement"];
const GRADE_COLOR = ["var(--neg)", "var(--fn)", "var(--pos)", "#067647"];

/** Réordonner des résultats de recherche et voir P@k, MRR et NDCG réagir (ou pas). */
export function RankingLab({ id = "ranking", challenge }: { id?: string; challenge?: string }) {
  const [order, setOrder] = useState(RANK_START);
  const m = rankMetrics(order);
  const solved = challenge ? CHALLENGES[challenge].check({ ndcg: m.ndcg }) : false;
  const byId = new Map(RANK_DOCS.map((d) => [d.id, d]));
  const move = (i: number, d: -1 | 1) =>
    setOrder((o) => {
      const j = i + d;
      if (j < 0 || j >= o.length) return o;
      const n = [...o];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <p className="mb-4 rounded-2xl bg-paper px-4 py-3 text-[0.95rem]"><b>Requête :</b> « {RANK_QUERY} »</p>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] [&>*]:min-w-0">
        <ol className="space-y-1.5">
          {order.map((docId, i) => {
            const d = byId.get(docId)!;
            const contrib = i < RANK_K ? (2 ** d.grade - 1) / Math.log2(i + 2) : null;
            return (
              <li key={docId}>
                {i === RANK_K && <div className="my-2 border-t-2 border-dashed border-line pt-1 text-xs font-semibold text-muted">hors du top {RANK_K}</div>}
                <div className={clsx("flex items-center gap-2 rounded-xl border-2 px-2 py-1.5", i < RANK_K ? "border-line bg-surface" : "border-transparent bg-paper opacity-70")}>
                  <span className="num w-5 shrink-0 text-center text-sm font-bold text-muted">{i + 1}</span>
                  <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: GRADE_COLOR[d.grade] }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold leading-snug">{d.title}</div>
                    <div className="text-xs text-muted">
                      pertinence {d.grade} · {GRADE_LABEL[d.grade]}
                      {contrib !== null && <span className="num"> · gain {fmt(contrib, 2)}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col">
                    <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Monter « ${d.title} »`} className="rounded p-0.5 text-muted hover:bg-paper hover:text-ink disabled:opacity-30">
                      <ArrowUp size={16} />
                    </button>
                    <button onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label={`Descendre « ${d.title} »`} className="rounded p-0.5 text-muted hover:bg-paper hover:text-ink disabled:opacity-30">
                      <ArrowDown size={16} />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <div>
          <div className="grid grid-cols-2 gap-2">
            <Readout label={`Precision@${RANK_K}`} value={pct(m.precision, 0)} sub="pertinence ≥ 2" />
            <Readout label={`Recall@${RANK_K}`} value={pct(m.recall, 0)} />
            <Readout label="MRR" value={fmt(m.mrr, 3)} sub="1 / rang du 1er pertinent" />
            <Readout label={`NDCG@${RANK_K}`} value={fmt(m.ndcg, 3)} strong />
          </div>
          <p className="num mt-3 text-sm text-muted">DCG = {fmt(m.dcg, 2)} · DCG idéal = {fmt(m.idcg, 2)}</p>
          <div className="mt-3">
            <LabButton onClick={() => setOrder(RANK_START)}>
              <span className="flex items-center gap-1.5"><RotateCcw size={15} /> Ordre du moteur</span>
            </LabButton>
          </div>
        </div>
      </div>
    </LabFrame>
  );
}
