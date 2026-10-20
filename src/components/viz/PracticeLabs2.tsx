"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { RotateCcw } from "lucide-react";
import {
  backtest, bestOf, BASE_LOGIT, CLIENTS, CREDIT_FEATURES, HP_BEST, HP_DEPTH, HP_LR, hpScore, hpSearch, permutationImportance, SALES, shapValues, sigmoid, TS_DAYS, TS_TEST,
  type CreditFeature, type ForecastModel, type HpMethod,
} from "@/lib/practice2";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { LabButton, LabFrame, Segmented } from "./controls";

const fmt = (v: number, d = 2) => v.toFixed(d).replace(".", ",");
const pct = (v: number) => `${Math.round(v * 100)} %`;

function Readout({ label, value, strong, sub }: { label: string; value: string; strong?: boolean; sub?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: strong ? "color-mix(in srgb, var(--mod) 10%, white)" : "var(--paper)" }}>
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="num mt-0.5 text-xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

// ============================================================ 1. Séries temporelles

const MODEL_LABEL: Record<ForecastModel, string> = {
  naive: "Dernière valeur",
  saisonnier: "Saisonnière naïve",
  moyenne: "Moyenne 7 jours",
  regression: "Tendance + jour de la semaine",
};

/** Prévoir 1 à 4 semaines de ventes : baselines naïves contre une régression tendance + saisonnalité, en validation temporelle. */
export function ForecastLab({ id = "prevision", challenge }: { id?: string; challenge?: string }) {
  const [model, setModel] = useState<ForecastModel>("naive");
  const [horizon, setHorizon] = useState(28);
  const res = useMemo(() => backtest(model, horizon), [model, horizon]);
  const seasonal = useMemo(() => backtest("saisonnier", horizon), [horizon]);
  const all = useMemo(() => (Object.keys(MODEL_LABEL) as ForecastModel[]).map((m) => ({ m, mae: backtest(m, horizon).mae })), [horizon]);
  const solved = challenge ? CHALLENGES[challenge].check({ model, horizon, mae: res.mae, seasonalMae: seasonal.mae }) : false;

  const W = 640, H = 240, M = { l: 36, r: 10, t: 10, b: 26 };
  const start = TS_DAYS - TS_TEST - 42;
  const x = scaleLinear().domain([start, TS_DAYS - 1]).range([M.l, W - M.r]);
  const y = scaleLinear().domain([60, 190]).range([H - M.b, M.t]);
  const hist = SALES.slice(start).map((v, i) => [start + i, v] as [number, number]);
  const pred = res.pred.map((v, i) => [TS_DAYS - TS_TEST + i, v] as [number, number]);
  const mk = line<[number, number]>().x((d) => x(d[0])).y((d) => y(d[1]));
  const cut = TS_DAYS - TS_TEST - 0.5;

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-5 grid gap-5 sm:grid-cols-[1.6fr_1fr] [&>*]:min-w-0">
        <Segmented label="Modèle de prévision" value={model} onChange={setModel} options={(Object.keys(MODEL_LABEL) as ForecastModel[]).map((m) => ({ value: m, label: MODEL_LABEL[m] }))} />
        <Segmented label="Horizon" value={String(horizon)} onChange={(v) => setHorizon(Number(v))} options={[7, 14, 28].map((h) => ({ value: String(h), label: `${h} jours` }))} />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`MAE ${fmt(res.mae, 1)} ventes par jour`}>
        <rect x={x(cut)} y={M.t} width={x(TS_DAYS - 1) - x(cut)} height={H - M.b - M.t} fill="var(--mod)" opacity={0.06} />
        {[80, 120, 160].map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={M.l - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)" className="num">{v}</text>
          </g>
        ))}
        <line x1={x(cut)} x2={x(cut)} y1={M.t} y2={H - M.b} stroke="var(--muted)" strokeDasharray="4 3" />
        <text x={x(cut) - 6} y={H - 8} fontSize={11} textAnchor="end" fill="var(--muted)">historique (entraînement)</text>
        <text x={x(cut) + 6} y={H - 8} fontSize={11} fill="var(--muted)">4 semaines de test</text>
        <path d={mk(hist) ?? ""} fill="none" stroke="var(--ink)" strokeWidth={1.6} />
        <path d={mk(pred) ?? ""} fill="none" stroke="var(--mod)" strokeWidth={2.6} />
      </svg>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {all.map(({ m, mae }) => (
          <Readout key={m} label={MODEL_LABEL[m]} value={fmt(mae, 1)} strong={m === model} sub={m === "saisonnier" ? "baseline" : undefined} />
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">MAE sur l'horizon choisi, en ventes par jour. La prévision est faite une seule fois, à la fin de l'historique, sans regarder les jours de test.</p>
    </LabFrame>
  );
}

// ============================================================ 2. Interprétabilité

/** Valeurs SHAP d'un modèle de crédit pour chaque client, et importance globale par permutation. */
export function ShapLab({ id = "shap", challenge }: { id?: string; challenge?: string }) {
  const [cid, setCid] = useState(CLIENTS[0].id);
  const [withCopy, setWithCopy] = useState(false);
  const client = CLIENTS.find((c) => c.id === cid)!;
  const s = shapValues(client);
  const entries = CREDIT_FEATURES.map((f) => ({ ...f, phi: s.phi[f.id] })).sort((a, b) => Math.abs(b.phi) - Math.abs(a.phi));
  const worst = CREDIT_FEATURES.map((f) => f.id).reduce((a, b) => (s.phi[b] < s.phi[a] ? b : a)) as CreditFeature;
  const imp = useMemo(() => permutationImportance(withCopy), [withCopy]);
  const impMax = Math.max(...imp.map((i) => i.importance), 1e-6);
  const solved = challenge ? CHALLENGES[challenge].check({ clientId: cid, accepted: s.proba >= 0.5, worstFeature: worst }) : false;
  const maxPhi = Math.max(...CLIENTS.flatMap((c) => Object.values(shapValues(c).phi).map(Math.abs)));

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <Segmented label="Demande de crédit" value={String(cid)} onChange={(v) => setCid(Number(v))} options={CLIENTS.map((c) => ({ value: String(c.id), label: c.nom }))} />
      <div className="mt-5 grid gap-6 lg:grid-cols-[1.2fr_1fr] [&>*]:min-w-0">
        <div>
          <div className="mb-2 text-sm font-semibold text-muted">Pourquoi cette décision ? (contributions SHAP, en log-odds)</div>
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {CREDIT_FEATURES.map((f) => (
              <span key={f.id}>
                {f.label} : <b className="num">{fmt(client[f.id], f.id === "revenu" ? 1 : 0)}{f.unit ? ` ${f.unit}` : ""}</b>
              </span>
            ))}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg bg-paper px-3 py-1.5 text-sm">
              <span>Valeur de base (client moyen)</span>
              <span className="num font-semibold">{pct(sigmoid(BASE_LOGIT))}</span>
            </div>
            {entries.map((e) => (
              <div key={e.id} className="grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-2 text-sm sm:grid-cols-[11rem_1fr_3.5rem]">
                <span className="truncate">{e.label}</span>
                <span className="relative h-5 rounded bg-sunken">
                  <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
                  <span
                    className="absolute inset-y-0.5 rounded"
                    style={{
                      background: e.phi >= 0 ? "var(--pos)" : "var(--fp)",
                      left: e.phi >= 0 ? "50%" : `${50 - (Math.abs(e.phi) / maxPhi) * 50}%`,
                      width: `${(Math.abs(e.phi) / maxPhi) * 50}%`,
                    }}
                  />
                </span>
                <span className="num text-right">{e.phi >= 0 ? "+" : "−"}{fmt(Math.abs(e.phi), 2)}</span>
              </div>
            ))}
            <div className={clsx("flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold", s.proba >= 0.5 ? "bg-[#ecfdf3] text-[#05603a]" : "bg-[#fff4ed] text-[#9c2a10]")}>
              <span>Probabilité d'accord</span>
              <span className="num">{pct(s.proba)} · {s.proba >= 0.5 ? "accordé" : "refusé"}</span>
            </div>
          </div>
        </div>
        <div>
          <div className="mb-2 text-sm font-semibold text-muted">Importance globale (permutation, hausse de log loss)</div>
          <div className="space-y-1.5">
            {imp.map((i) => (
              <div key={i.id} className="text-sm">
                <div className="flex justify-between gap-2">
                  <span className="truncate">{i.label}</span>
                  <span className="num">{fmt(Math.max(0, i.importance), 3)}</span>
                </div>
                <div className="h-2 rounded-full bg-sunken">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(0, i.importance / impMax) * 100}%`, background: i.id === "copie" || (withCopy && i.id === "revenu") ? "var(--xp)" : "var(--mod)" }} />
                </div>
              </div>
            ))}
          </div>
          <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm">
            <input type="checkbox" checked={withCopy} onChange={(e) => setWithCopy(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span>Ajouter une variable très corrélée au revenu (le revenu déclaré), puis réentraîner</span>
          </label>
        </div>
      </div>
    </LabFrame>
  );
}

// ============================================================ 3. Optimisation d'hyperparamètres

const HP_LABEL: Record<HpMethod, string> = { grille: "Grille", aleatoire: "Aléatoire", bayesienne: "Bayésienne" };

/** Grille, recherche aléatoire ou optimisation bayésienne, à budget égal, sur un paysage où un seul hyperparamètre compte vraiment. */
export function HpoLab({ id = "hpo", challenge }: { id?: string; challenge?: string }) {
  const [method, setMethod] = useState<HpMethod>("grille");
  const [budget, setBudget] = useState(9);
  const [seed, setSeed] = useState(1);
  const pts = useMemo(() => hpSearch(method, budget, seed), [method, budget, seed]);
  const best = bestOf(pts);
  const gap = HP_BEST - best.score;
  const solved = challenge ? CHALLENGES[challenge].check({ budget, gap }) : false;

  const W = 420, H = 300, M = { l: 44, r: 10, t: 10, b: 38 };
  const x = scaleLinear().domain(HP_LR).range([M.l, W - M.r]);
  const y = scaleLinear().domain(HP_DEPTH).range([H - M.b, M.t]);
  const cells = useMemo(() => {
    const out: { lx: number; d: number; v: number }[] = [];
    for (let i = 0; i < 25; i++) for (let j = 0; j < 11; j++) {
      const lx = HP_LR[0] + ((i + 0.5) * (HP_LR[1] - HP_LR[0])) / 25;
      out.push({ lx, d: HP_DEPTH[0] + j, v: hpScore(lx, HP_DEPTH[0] + j) });
    }
    return out;
  }, []);
  const cw = (x(HP_LR[1]) - x(HP_LR[0])) / 25;
  const ch = (y(HP_DEPTH[0]) - y(HP_DEPTH[1])) / 10;

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-5 grid gap-5 sm:grid-cols-2 [&>*]:min-w-0">
        <Segmented label="Méthode" value={method} onChange={setMethod} options={(["grille", "aleatoire", "bayesienne"] as HpMethod[]).map((m) => ({ value: m, label: HP_LABEL[m] }))} />
        <Segmented label="Budget (entraînements)" value={String(budget)} onChange={(v) => setBudget(Number(v))} options={[4, 9, 16].map((b) => ({ value: String(b), label: String(b) }))} />
      </div>
      <div className="grid gap-6 md:grid-cols-[minmax(0,440px)_1fr] [&>*]:min-w-0">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Meilleur score trouvé ${fmt(best.score, 3)}`}>
          {cells.map((c, i) => (
            <rect key={i} x={x(c.lx) - cw / 2} y={y(c.d) - ch / 2} width={cw + 0.5} height={ch + 0.5} fill="var(--mod)" opacity={Math.max(0.04, (c.v - 0.74) / 0.16) ** 1.5 * 0.7} />
          ))}
          {[-3, -2, -1].map((v) => (
            <text key={v} x={x(v)} y={H - M.b + 15} fontSize={10} textAnchor="middle" fill="var(--muted)" className="num">{`1e${v}`}</text>
          ))}
          {[2, 6, 10].map((v) => (
            <text key={v} x={M.l - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)" className="num">{v}</text>
          ))}
          <text x={(M.l + W - M.r) / 2} y={H - 4} fontSize={11} textAnchor="middle" fill="var(--muted)">learning rate (échelle log)</text>
          <text x={12} y={(M.t + H - M.b) / 2} fontSize={11} textAnchor="middle" fill="var(--muted)" transform={`rotate(-90 12 ${(M.t + H - M.b) / 2})`}>profondeur</text>
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={x(p.logLr)} cy={y(p.depth)} r={p === best ? 7 : 5} fill={p === best ? "var(--xp)" : "var(--ink)"} stroke="var(--surface)" strokeWidth={1.5} />
              {method === "bayesienne" && <text x={x(p.logLr) + 7} y={y(p.depth) - 6} fontSize={9} fill="var(--ink)" className="num">{i + 1}</text>}
            </g>
          ))}
        </svg>
        <div>
          <div className="grid grid-cols-2 gap-2">
            <Readout label="Meilleur score trouvé" value={fmt(best.score, 4)} strong />
            <Readout label="Écart à l'optimum" value={fmt(gap, 4)} sub={gap < 0.005 ? "sous 0,005" : "objectif : sous 0,005"} />
            <Readout label="Learning rate retenu" value={(10 ** best.logLr).toFixed(4).replace(".", ",")} />
            <Readout label="Profondeur retenue" value={String(best.depth)} />
          </div>
          {method !== "grille" && (
            <div className="mt-3">
              <LabButton onClick={() => setSeed((s) => s + 1)}>
                <span className="flex items-center gap-1.5"><RotateCcw size={15} /> Nouveau tirage</span>
              </LabButton>
            </div>
          )}
          <p className="mt-3 text-sm text-muted">
            La zone foncée est la meilleure. Le score dépend surtout du learning rate ; la profondeur compte peu. Le score réel est inconnu : chaque point coûte un entraînement complet.
          </p>
        </div>
      </div>
    </LabFrame>
  );
}
