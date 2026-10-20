"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import {
  avgLogLik, BEST_POISSON_LL, CALLS, CALLS_MAX, GROUP_SIZE, pmfOf, RATES, sampleMean, sampleVar, simpson, type DistModel,
} from "@/lib/stats2";
import {
  clusterQuality, dbscan, fitLine, kmeans, LOSS_POINTS, lossValue, MOONS, OUTLIERS, SVM_C, SVM_GAMMA, SVM_TEST, SVM_TRAIN, trainSvm, type Kernel, type LossKind,
} from "@/lib/ml2";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { useHydrated } from "@/components/ui/useHydrated";
import { LabFrame, Segmented, Slider } from "./controls";

const fmt = (v: number, d = 2) => v.toFixed(d).replace(".", ",");
const pct = (v: number, d = 0) => `${(v * 100).toFixed(d).replace(".", ",")}\u202f%`;

function Readout({ label, value, strong, sub }: { label: string; value: string; strong?: boolean; sub?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: strong ? "color-mix(in srgb, var(--mod) 10%, white)" : "var(--paper)" }}>
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="num mt-0.5 text-xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

// ============================================================ 1. Lois et maximum de vraisemblance

/** Ajuster une loi à des comptages d'appels : la log-vraisemblance dit quelle loi et quel paramètre « expliquent » le mieux les données. */
export function MleLab({ id = "vraisemblance", challenge }: { id?: string; challenge?: string }) {
  const [law, setLaw] = useState<"poisson" | "normale">("normale");
  const [lambda, setLambda] = useState(2);
  const [mu, setMu] = useState(3);
  const [sigma, setSigma] = useState(1);
  const model: DistModel = law === "poisson" ? { law, lambda } : { law, mu, sigma };
  const ll = avgLogLik(model);
  const counts = useMemo(() => Array.from({ length: CALLS_MAX + 1 }, (_, k) => CALLS.filter((c) => c === k).length / CALLS.length), []);
  const solved = challenge ? CHALLENGES[challenge].check({ law, avgLL: ll, best: BEST_POISSON_LL }) : false;

  const W = 560, H = 220, M = { l: 34, r: 10, t: 10, b: 28 };
  const x = scaleLinear().domain([-0.5, CALLS_MAX + 0.5]).range([M.l, W - M.r]);
  const y = scaleLinear().domain([0, 0.3]).range([H - M.b, M.t]);
  const bw = x(1) - x(0);

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <p className="mb-4 text-sm text-muted">Nombre d'appels reçus par un service client, sur 200 heures. Barres : fréquences observées ; points : probabilités prédites par la loi choisie.</p>
      <div className="mb-5 grid gap-5 sm:grid-cols-2 [&>*]:min-w-0">
        <Segmented label="Loi" value={law} onChange={setLaw} options={[{ value: "normale", label: "Normale" }, { value: "poisson", label: "Poisson" }]} />
        {law === "poisson" ? (
          <Slider label="λ (nombre moyen d'appels)" value={lambda} min={1} max={8} step={0.1} onChange={setLambda} display={fmt(lambda, 1)} />
        ) : (
          <div className="grid gap-4">
            <Slider label="μ (moyenne)" value={mu} min={1} max={6} step={0.1} onChange={setMu} display={fmt(mu, 1)} />
            <Slider label="σ (écart-type)" value={sigma} min={0.5} max={3} step={0.05} onChange={setSigma} display={fmt(sigma, 2)} />
          </div>
        )}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] [&>*]:min-w-0">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Log-vraisemblance moyenne ${fmt(ll, 3)}`}>
          {[0, 0.1, 0.2, 0.3].map((v) => (
            <g key={v}>
              <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
              <text x={M.l - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)" className="num">{fmt(v, 1)}</text>
            </g>
          ))}
          {counts.map((f, k) => (
            <g key={k}>
              <rect x={x(k) - bw * 0.38} y={y(f)} width={bw * 0.76} height={y(0) - y(f)} rx={3} fill="var(--neg)" />
              <text x={x(k)} y={H - 10} fontSize={10} textAnchor="middle" fill="var(--muted)" className="num">{k}</text>
            </g>
          ))}
          <path d={line<number>().x((_, k) => x(k)).y((_, k) => y(Math.min(0.3, pmfOf(model, k))))(counts) ?? ""} fill="none" stroke="var(--mod)" strokeWidth={2} />
          {counts.map((_, k) => <circle key={`m${k}`} cx={x(k)} cy={y(Math.min(0.3, pmfOf(model, k)))} r={4.5} fill="var(--mod)" stroke="var(--surface)" strokeWidth={1.5} />)}
        </svg>
        <div className="grid grid-cols-2 content-start gap-2">
          <Readout label="Log-vraisemblance moyenne" value={fmt(ll, 3)} strong sub="plus haut = mieux" />
          <Readout label="Écart au meilleur ajustement" value={fmt(Math.max(0, BEST_POISSON_LL - ll), 3)} sub="objectif : moins de 0,003" />
          <Readout label="Moyenne des données" value={fmt(sampleMean(CALLS), 2)} />
          <Readout label="Variance des données" value={fmt(sampleVar(CALLS), 2)} />
        </div>
      </div>
    </LabFrame>
  );
}

// ============================================================ 2. Paradoxe de Simpson

/** Deux traitements, deux groupes de gravité : la répartition des patients suffit à inverser la conclusion globale. */
export function SimpsonLab({ id = "simpson", challenge }: { id?: string; challenge?: string }) {
  const [grave, setGrave] = useState(0.5);
  const [split, setSplit] = useState(false);
  const r = simpson(grave, 1 - grave);
  const solved = challenge ? CHALLENGES[challenge].check({ reversed: r.reversed, split }) : false;

  const Bar = ({ label, a, b }: { label: string; a: number; b: number }) => (
    <div>
      <div className="mb-1.5 text-sm font-semibold">{label}</div>
      {([["A (nouveau)", a, "var(--mod)"], ["B (habituel)", b, "var(--muted)"]] as const).map(([n, v, c]) => (
        <div key={n} className="mb-1 grid grid-cols-[6.5rem_1fr_3rem] items-center gap-2 text-sm">
          <span>{n}</span>
          <span className="h-4 rounded bg-sunken">
            <span className="block h-full rounded" style={{ width: `${v * 100}%`, background: c }} />
          </span>
          <span className="num text-right font-semibold">{pct(v)}</span>
        </div>
      ))}
    </div>
  );

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <p className="mb-4 text-sm text-muted">
        {GROUP_SIZE} patients légers et {GROUP_SIZE} patients graves. Dans chaque groupe, A guérit mieux que B. Mais ce ne sont pas les mêmes patients qui reçoivent A et B.
      </p>
      <div className="mb-5 grid gap-5 sm:grid-cols-2 [&>*]:min-w-0">
        <Slider label="Part des patients graves qui reçoivent A" value={grave} min={0.1} max={0.9} step={0.05} onChange={setGrave} display={pct(grave)} />
        <Segmented label="Affichage" value={split ? "split" : "global"} onChange={(v) => setSplit(v === "split")} options={[{ value: "global", label: "Résultat global" }, { value: "split", label: "Par gravité" }]} />
      </div>
      <p className="mb-4 text-sm">
        A est donné à <b className="num">{Math.round(r.nA.grave)}</b> patients graves et <b className="num">{Math.round(r.nA.leger)}</b> légers ; B à <b className="num">{Math.round(r.nB.grave)}</b> graves et <b className="num">{Math.round(r.nB.leger)}</b> légers.
      </p>
      <div className="grid gap-6 md:grid-cols-2 [&>*]:min-w-0">
        {split ? (
          <>
            <Bar label="Patients légers" a={RATES.A.leger} b={RATES.B.leger} />
            <Bar label="Patients graves" a={RATES.A.grave} b={RATES.B.grave} />
          </>
        ) : (
          <>
            <Bar label="Taux de guérison global" a={r.globalA} b={r.globalB} />
            <div className={clsx("self-start rounded-xl px-4 py-3 text-sm", r.reversed ? "bg-[#fff4ed] text-[#7a2610]" : "bg-paper")}>
              {r.reversed ? "Au global, B paraît meilleur. " : "Au global, A paraît meilleur. "}
              À population égale (standardisé sur la gravité) : A {pct(r.adjA)}, B {pct(r.adjB)}.
            </div>
          </>
        )}
      </div>
    </LabFrame>
  );
}

// ============================================================ 3. Fonctions de perte

const LOSS_LABEL: Record<LossKind, string> = { mse: "MSE (carré)", mae: "MAE (valeur absolue)", huber: "Huber (δ = 1)" };

/** Ajuster une droite avec différentes pertes, avec ou sans quelques mesures aberrantes. */
export function LossLab({ id = "pertes", challenge }: { id?: string; challenge?: string }) {
  const [kind, setKind] = useState<LossKind>("mse");
  const [outliers, setOutliers] = useState(false);
  const pts = outliers ? [...LOSS_POINTS, ...OUTLIERS] : LOSS_POINTS;
  const fit = fitLine(pts, kind);
  const clean = fitLine(LOSS_POINTS, "mse");
  const solved = challenge ? CHALLENGES[challenge].check({ outliers, slope: fit.slope, cleanSlope: clean.slope }) : false;

  const W = 360, H = 260, M = { l: 30, r: 10, t: 10, b: 26 };
  const x = scaleLinear().domain([0, 10.5]).range([M.l, W - M.r]);
  const y = scaleLinear().domain([0, 17]).range([H - M.b, M.t]);
  const Wc = 300, Hc = 200;
  const rx = scaleLinear().domain([-4, 4]).range([30, Wc - 10]);
  const ry = scaleLinear().domain([0, 8]).range([Hc - 26, 10]);
  const curve = (k: LossKind) => line<number>().x((r) => rx(r)).y((r) => ry(Math.min(8, lossValue(k, r))))(Array.from({ length: 81 }, (_, i) => -4 + i * 0.1)) ?? "";

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-5 grid gap-5 sm:grid-cols-[1.6fr_1fr] [&>*]:min-w-0">
        <Segmented label="Perte minimisée" value={kind} onChange={setKind} options={(Object.keys(LOSS_LABEL) as LossKind[]).map((k) => ({ value: k, label: LOSS_LABEL[k] }))} />
        <Segmented label="Mesures aberrantes" value={outliers ? "on" : "off"} onChange={(v) => setOutliers(v === "on")} options={[{ value: "off", label: "Absentes" }, { value: "on", label: "4 ajoutées" }]} />
      </div>
      <div className="grid gap-6 md:grid-cols-[1.2fr_1fr] [&>*]:min-w-0">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Pente estimée ${fmt(fit.slope, 3)}`}>
          {[0, 5, 10, 15].map((v) => (
            <g key={v}>
              <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
              <text x={M.l - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)" className="num">{v}</text>
            </g>
          ))}
          <line x1={x(0)} x2={x(10.5)} y1={y(clean.intercept)} y2={y(clean.intercept + clean.slope * 10.5)} stroke="var(--muted)" strokeDasharray="5 4" />
          {LOSS_POINTS.map((p, i) => <circle key={i} cx={x(p.x)} cy={y(p.y)} r={3.5} fill="var(--ink)" opacity={0.75} />)}
          {outliers && OUTLIERS.map((p, i) => <circle key={`o${i}`} cx={x(p.x)} cy={y(p.y)} r={5} fill="var(--fp)" />)}
          <line x1={x(0)} x2={x(10.5)} y1={y(fit.intercept)} y2={y(fit.intercept + fit.slope * 10.5)} stroke="var(--mod)" strokeWidth={3} />
        </svg>
        <div>
          <div className="grid grid-cols-2 gap-2">
            <Readout label="Pente estimée" value={fmt(fit.slope, 3)} strong />
            <Readout label="Pente sur données propres" value={fmt(clean.slope, 3)} sub="ligne pointillée" />
          </div>
          <svg viewBox={`0 0 ${Wc} ${Hc}`} className="mt-4 w-full" role="img" aria-label="Forme des trois pertes selon le résidu">
            <line x1={rx(0)} x2={rx(0)} y1={10} y2={Hc - 26} stroke="var(--line)" />
            <line x1={30} x2={Wc - 10} y1={ry(0)} y2={ry(0)} stroke="var(--line)" />
            {(["mse", "mae", "huber"] as LossKind[]).map((k) => (
              <path key={k} d={curve(k)} fill="none" stroke={k === kind ? "var(--mod)" : "var(--neg)"} strokeWidth={k === kind ? 3 : 1.5} />
            ))}
            <text x={(30 + Wc - 10) / 2} y={Hc - 6} fontSize={11} textAnchor="middle" fill="var(--muted)">résidu</text>
            <text x={Wc - 12} y={22} fontSize={11} textAnchor="end" fill="var(--muted)">perte</text>
          </svg>
        </div>
      </div>
    </LabFrame>
  );
}

// ============================================================ 4. SVM

/** SVM sur deux cercles concentriques : noyau, C et gamma, frontière, marge et vecteurs de support. */
export function SvmLab({ id = "svm", challenge }: { id?: string; challenge?: string }) {
  const hydrated = useHydrated();
  const [kernel, setKernel] = useState<Kernel>("lineaire");
  const [ci, setCi] = useState(1);
  const [gi, setGi] = useState(3);
  const C = SVM_C[ci];
  const gamma = SVM_GAMMA[gi];
  const model = useMemo(() => (hydrated ? trainSvm(SVM_TRAIN, kernel, C, gamma) : null), [hydrated, kernel, C, gamma]);
  const solved = challenge && model ? CHALLENGES[challenge].check({ testAcc: model.testAcc, supportVectors: model.supportVectors.length }) : false;

  const S = 300, N = 44;
  const sc = scaleLinear().domain([-2.6, 2.6]).range([0, S]);
  const cells = useMemo(() => {
    if (!model) return [];
    const out: { i: number; j: number; v: number }[] = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) out.push({ i, j, v: model.decision({ x: -2.6 + ((i + 0.5) * 5.2) / N, y: 2.6 - ((j + 0.5) * 5.2) / N }) });
    return out;
  }, [model]);
  const cs = S / N;
  const sv = new Set(model?.supportVectors.map((d) => `${d.x}|${d.y}`));

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-5 grid gap-5 sm:grid-cols-3 [&>*]:min-w-0">
        <Segmented label="Noyau" value={kernel} onChange={setKernel} options={[{ value: "lineaire", label: "Linéaire" }, { value: "rbf", label: "RBF" }]} />
        <Slider label="C (pénalité des erreurs)" value={ci} min={0} max={SVM_C.length - 1} step={1} onChange={setCi} display={String(C)} />
        {kernel === "rbf" && <Slider label="γ (portée du noyau)" value={gi} min={0} max={SVM_GAMMA.length - 1} step={1} onChange={setGi} display={String(gamma)} />}
      </div>
      <div className="grid gap-6 md:grid-cols-[minmax(0,320px)_1fr] [&>*]:min-w-0">
        <svg viewBox={`0 0 ${S} ${S}`} className="w-full rounded-xl bg-paper" role="img" aria-label={model ? `Précision de test ${pct(model.testAcc)}` : "Entraînement"}>
          {cells.map((c) => (
            <rect
              key={`${c.i}-${c.j}`}
              x={c.i * cs}
              y={c.j * cs}
              width={cs + 0.4}
              height={cs + 0.4}
              fill={c.v >= 0 ? "var(--mod)" : "var(--fp)"}
              opacity={Math.abs(c.v) < 1 ? 0.28 : 0.12}
            />
          ))}
          {SVM_TRAIN.map((p, i) => (
            <circle
              key={i}
              cx={sc(p.x)}
              cy={sc(-p.y)}
              r={sv.has(`${p.x}|${p.y}`) ? 5.5 : 3.5}
              fill={p.c === 1 ? "var(--mod)" : "var(--fp)"}
              stroke={sv.has(`${p.x}|${p.y}`) ? "var(--ink)" : "var(--surface)"}
              strokeWidth={sv.has(`${p.x}|${p.y}`) ? 2 : 1}
            />
          ))}
        </svg>
        <div>
          <div className="grid grid-cols-2 gap-2">
            <Readout label="Précision (entraînement)" value={model ? pct(model.trainAcc) : "…"} />
            <Readout label="Précision (test, 200 points)" value={model ? pct(model.testAcc) : "…"} strong />
            <Readout label="Vecteurs de support" value={model ? String(model.supportVectors.length) : "…"} sub={`sur ${SVM_TRAIN.length} points`} />
          </div>
          <p className="mt-3 text-sm text-muted">
            Zones foncées : la marge (|score| &lt; 1). Points cerclés : les vecteurs de support, les seuls exemples dont dépend la frontière. Le jeu de test ({SVM_TEST.length} points) n'est pas affiché.
          </p>
        </div>
      </div>
    </LabFrame>
  );
}

// ============================================================ 5. Clustering par densité

const PALETTE = ["#4f46e5", "#0f766e", "#b45309", "#be185d", "#0277b5", "#15803d", "#7c3aed"];

/** k-means contre DBSCAN sur deux lunes avec du bruit. */
export function DbscanLab({ id = "dbscan", challenge }: { id?: string; challenge?: string }) {
  const [algo, setAlgo] = useState<"kmeans" | "dbscan">("kmeans");
  const [eps, setEps] = useState(0.1);
  const [minPts, setMinPts] = useState(5);
  const labels = useMemo(() => (algo === "kmeans" ? kmeans(MOONS, 2) : dbscan(MOONS, eps, minPts)), [algo, eps, minPts]);
  const q = clusterQuality(labels);
  const solved = challenge ? CHALLENGES[challenge].check({ algo, ari: q.ari, noiseFound: q.noiseFound }) : false;

  const W = 420, H = 260;
  const x = scaleLinear().domain([-1.5, 2.6]).range([10, W - 10]);
  const y = scaleLinear().domain([-0.95, 1.3]).range([H - 10, 10]);

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-5 grid gap-5 sm:grid-cols-3 [&>*]:min-w-0">
        <Segmented label="Algorithme" value={algo} onChange={setAlgo} options={[{ value: "kmeans", label: "k-means (k = 2)" }, { value: "dbscan", label: "DBSCAN" }]} />
        {algo === "dbscan" && (
          <>
            <Slider label="ε (rayon de voisinage)" value={eps} min={0.05} max={0.4} step={0.05} onChange={setEps} display={fmt(eps, 2)} />
            <Slider label="minPts (voisins minimum)" value={minPts} min={2} max={10} step={1} onChange={setMinPts} display={String(minPts)} />
          </>
        )}
      </div>
      <div className="grid gap-6 md:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-paper" role="img" aria-label={`${q.clusters} groupes, indice de Rand ajusté ${fmt(q.ari, 2)}`}>
          {MOONS.map((p, i) => {
            const l = labels[i];
            return l < 0 ? (
              <g key={i}>
                <line x1={x(p.x) - 3.5} x2={x(p.x) + 3.5} y1={y(p.y) - 3.5} y2={y(p.y) + 3.5} stroke="var(--muted)" strokeWidth={1.6} />
                <line x1={x(p.x) - 3.5} x2={x(p.x) + 3.5} y1={y(p.y) + 3.5} y2={y(p.y) - 3.5} stroke="var(--muted)" strokeWidth={1.6} />
              </g>
            ) : (
              <circle key={i} cx={x(p.x)} cy={y(p.y)} r={3.4} fill={PALETTE[l % PALETTE.length]} opacity={0.85} />
            );
          })}
        </svg>
        <div>
          <div className="grid grid-cols-2 gap-2">
            <Readout label="Groupes trouvés" value={String(q.clusters)} />
            <Readout label="Indice de Rand ajusté" value={fmt(q.ari, 2)} strong sub="1 = les deux lunes exactes" />
            <Readout label="Bruit détecté" value={`${Math.round(q.noiseFound * q.noiseCount)} / ${q.noiseCount}`} sub="points isolés marqués ×" />
          </div>
          <p className="mt-3 text-sm text-muted">Les croix sont les points que DBSCAN classe comme bruit : ils n'ont pas assez de voisins à moins de ε.</p>
        </div>
      </div>
    </LabFrame>
  );
}
