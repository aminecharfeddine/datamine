"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import {
  broadcast, CATEGORIES, featureFit, MONTHS, pandasCode, pipelineCode, pipelineCv, runPandas, SALES, simulateYear,
  type Agg, type FeatSet, type GroupKey, type PipeConfig,
} from "@/lib/practice";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { Highlighted } from "@/components/code/Code";
import { useHydrated } from "@/components/ui/useHydrated";
import { LabFrame, Segmented, Slider } from "./controls";

const fmt = (v: number, d = 2) => v.toFixed(d).replace(".", ",");
const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")} %`;

function CodePanel({ code }: { code: string }) {
  return (
    <pre className="min-w-0 overflow-x-auto rounded-2xl bg-[#171a2e] px-4 py-3" tabIndex={0}>
      <Highlighted code={code} />
    </pre>
  );
}

function Readout({ label, value, strong, sub }: { label: string; value: string; strong?: boolean; sub?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: strong ? "color-mix(in srgb, var(--mod) 10%, white)" : "var(--paper)" }}>
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="num mt-0.5 text-xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

// ============================================================ pandas

/** Construit une requête pandas avec des boutons : le code et le résultat se mettent à jour ensemble. */
export function PandasLab({ id = "pandas", challenge }: { id?: string; challenge?: string }) {
  const [categorie, setCat] = useState("toutes");
  const [minMontant, setMin] = useState(0);
  const [group, setGroup] = useState<GroupKey>("none");
  const [agg, setAgg] = useState<Agg>("sum");
  const [sort, setSort] = useState<"non" | "desc">("non");
  const q = { categorie, minMontant, group, agg, sortDesc: sort === "desc", head: 10 };
  const res = useMemo(() => runPandas(q), [categorie, minMontant, group, agg, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const solved = challenge ? CHALLENGES[challenge].check(q) : false;

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <Segmented label="Filtre : catégorie" value={categorie} onChange={setCat} options={["toutes", ...CATEGORIES].map((c) => ({ value: c, label: c === "toutes" ? "Toutes" : c }))} />
        <Slider label="Filtre : montant supérieur à" value={minMontant} min={0} max={150} step={10} onChange={setMin} display={`${minMontant} €`} />
        <Segmented label="groupby" value={group} onChange={setGroup} options={[{ value: "none", label: "Aucun" }, { value: "ville", label: "ville" }, { value: "categorie", label: "categorie" }, { value: "mois", label: "mois" }]} />
        {group !== "none" ? (
          <Segmented label="Agrégation du montant" value={agg} onChange={setAgg} options={(["sum", "mean", "count", "max"] as const).map((a) => ({ value: a, label: a }))} />
        ) : (
          <div />
        )}
        <Segmented label="Tri" value={sort} onChange={setSort} options={[{ value: "non", label: "Aucun" }, { value: "desc", label: "Montant décroissant" }]} />
      </div>
      <div className="space-y-4">
        <CodePanel code={pandasCode(q)} />
        <div className="max-h-96 overflow-auto rounded-2xl border border-line" tabIndex={0}>
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs text-muted">
              <tr>{res.columns.map((c) => <th key={c} className="px-3 py-2 font-semibold">{c}</th>)}</tr>
            </thead>
            <tbody>
              {res.rows.map((r, i) => (
                <tr key={i} className="border-t border-line">
                  {res.columns.map((c) => (
                    <td key={c} className={clsx("whitespace-nowrap px-3 py-1.5", typeof r[c] === "number" && "num text-right")}>
                      {typeof r[c] === "number" && c === "montant" ? fmt(r[c] as number) : String(r[c])}
                    </td>
                  ))}
                </tr>
              ))}
              {!res.rows.length && (
                <tr><td className="px-3 py-3 text-muted" colSpan={res.columns.length}>DataFrame vide</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </LabFrame>
  );
}

// ============================================================ Broadcasting

const A_SHAPES = ["4,3", "4,1", "3"];
const B_SHAPES = ["3", "4", "4,1", "1,3", "4,3"];
const parse = (s: string) => s.split(",").map(Number);
const label = (s: string) => `(${s}${s.includes(",") ? "" : ","})`;

function Cells({ shape, color, title }: { shape: number[]; color: string; title: string }) {
  const [r, c] = shape.length === 1 ? [1, shape[0]] : shape;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${c}, 22px)` }}>
        {Array.from({ length: r * c }, (_, i) => <span key={i} className="h-[22px] w-[22px] rounded" style={{ background: color }} />)}
      </div>
      <span className="num text-xs font-semibold text-muted">{title}</span>
    </div>
  );
}

/** Les règles de broadcasting de NumPy : les formes s'alignent par la droite, une dimension 1 s'étire. */
export function BroadcastLab({ id = "broadcast", challenge }: { id?: string; challenge?: string }) {
  const [a, setA] = useState("4,3");
  const [b, setB] = useState("3");
  const out = broadcast(parse(a), parse(b));
  const solved = challenge ? CHALLENGES[challenge].check({ a, b, ok: !!out }) : false;
  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Segmented label="Forme de X" value={a} onChange={setA} options={A_SHAPES.map((s) => ({ value: s, label: label(s) }))} />
        <Segmented label="Forme de B" value={b} onChange={setB} options={B_SHAPES.map((s) => ({ value: s, label: label(s) }))} />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-6 rounded-2xl bg-paper p-5">
        <Cells shape={parse(a)} color="color-mix(in srgb, var(--fn) 55%, white)" title={`X ${label(a)}`} />
        <span className="font-display text-2xl font-bold text-muted">−</span>
        <Cells shape={parse(b)} color="color-mix(in srgb, var(--fp) 55%, white)" title={`B ${label(b)}`} />
        <span className="font-display text-2xl font-bold text-muted">=</span>
        {out ? (
          <Cells shape={out} color="color-mix(in srgb, var(--mod) 55%, white)" title={`résultat ${label(out.join(","))}`} />
        ) : (
          <div className="max-w-xs rounded-xl bg-[#fff4ed] px-4 py-3 font-mono text-xs text-[#9c2a10]">
            ValueError: operands could not be broadcast together with shapes {label(a)} {label(b)}
          </div>
        )}
      </div>
      <p className="mt-3 text-sm text-muted">
        On aligne les formes par la droite : deux dimensions sont compatibles si elles sont égales ou si l'une vaut 1 (elle est alors « étirée »).
        Une dimension absente compte comme 1.
      </p>
    </LabFrame>
  );
}

// ============================================================ Pipeline scikit-learn

/** Assemble un pipeline (imputation, échelle, encodage, modèle) et mesure-le en validation croisée, préprocessing compris. */
export function PipelineLab({ id = "pipeline", challenge }: { id?: string; challenge?: string }) {
  const hydrated = useHydrated();
  const [cfg, setCfg] = useState<PipeConfig>({ impute: "drop", scale: "none", ville: "drop", model: "knn" });
  const set = <K extends keyof PipeConfig>(k: K) => (v: PipeConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));
  const res = useMemo(() => (hydrated ? pipelineCv(cfg) : null), [cfg, hydrated]);
  const solved = challenge && res ? CHALLENGES[challenge].check({ ...cfg, acc: res.acc }) : false;
  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <Segmented label="Valeurs manquantes (âge, revenu)" value={cfg.impute} onChange={set("impute")} options={[{ value: "drop", label: "Supprimer les lignes" }, { value: "mean", label: "Moyenne" }, { value: "median", label: "Médiane" }]} />
        <Segmented label="Échelle des variables numériques" value={cfg.scale} onChange={set("scale")} options={[{ value: "none", label: "Brutes" }, { value: "standard", label: "StandardScaler" }]} />
        <Segmented label="Variable « ville » (5 valeurs)" value={cfg.ville} onChange={set("ville")} options={[{ value: "drop", label: "Ignorée" }, { value: "ordinal", label: "OrdinalEncoder" }, { value: "onehot", label: "OneHotEncoder" }]} />
        <Segmented label="Modèle" value={cfg.model} onChange={set("model")} options={[{ value: "knn", label: "k-NN (k = 15)" }, { value: "logreg", label: "Régression logistique" }]} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
        <CodePanel code={pipelineCode(cfg)} />
        <div className="space-y-2 self-start">
          <Readout label="Précision, validation croisée 5 plis" value={res ? pct(res.acc) : "…"} strong />
          <Readout
            label="Clients utilisés"
            value={res ? `${res.n} / 400` : "…"}
            sub={res && res.dropped ? `${res.dropped} clients supprimés : le modèle ne saura rien prédire pour eux en production.` : "Tous les clients sont gardés."}
          />
          <p className="text-xs text-muted">41 % des clients résilient : prédire « reste » pour tout le monde donne déjà 59 %. Les étapes de préparation sont réapprises dans chaque pli.</p>
        </div>
      </div>
    </LabFrame>
  );
}

// ============================================================ Feature engineering

type YN = "oui" | "non";

/** Régression linéaire sur deux ans de ventes : ajouter les bonnes variables, et valider dans le bon ordre. */
export function FeatureLab({ id = "features", challenge }: { id?: string; challenge?: string }) {
  const hydrated = useHydrated();
  const [dow, setDow] = useState<YN>("non");
  const [temp2, setTemp2] = useState<YN>("non");
  const [inter, setInter] = useState<YN>("non");
  const [split, setSplit] = useState<FeatSet["split"]>("temporel");
  const f: FeatSet = { dow: dow === "oui", temp2: temp2 === "oui", inter: inter === "oui", split };
  const fit = useMemo(() => (hydrated ? featureFit(f) : null), [hydrated, dow, temp2, inter, split]); // eslint-disable-line react-hooks/exhaustive-deps
  const solved = challenge && fit ? CHALLENGES[challenge].check({ split, valR2: fit.valR2 }) : false;

  const W = 560, H = 220, M = { l: 40, r: 10, t: 12, b: 28 };
  const days = SALES.slice(-84);
  const x = scaleLinear().domain([days[0].t, days.at(-1)!.t]).range([M.l, W - M.r]);
  const y = scaleLinear().domain([Math.min(...days.map((d) => d.ventes)) - 10, Math.max(...days.map((d) => d.ventes)) + 10]).range([H - M.b, M.t]);
  const real = line<(typeof days)[number]>().x((d) => x(d.t)).y((d) => y(d.ventes))(days) ?? "";
  const pred = fit ? line<(typeof days)[number]>().x((d) => x(d.t)).y((d) => y(fit.predict(d)))(days) ?? "" : "";

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <Segmented label="Jour de la semaine (one-hot)" value={dow} onChange={setDow} options={[{ value: "non", label: "Non" }, { value: "oui", label: "Oui" }]} />
        <Segmented label="Écart de température au carré" value={temp2} onChange={setTemp2} options={[{ value: "non", label: "Non" }, { value: "oui", label: "Oui" }]} />
        <Segmented label="Interaction promo × week-end" value={inter} onChange={setInter} options={[{ value: "non", label: "Non" }, { value: "oui", label: "Oui" }]} />
        <Segmented label="Découpage train / validation" value={split} onChange={setSplit} options={[{ value: "temporel", label: "Temporel (80 % puis 20 %)" }, { value: "aleatoire", label: "Aléatoire" }]} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] [&>*]:min-w-0">
        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-lg font-bold">Les 12 dernières semaines</h3>
            <span className="flex gap-3 text-xs text-muted">
              <span className="flex items-center gap-1"><span className="inline-block h-1 w-4 rounded bg-neg" /> ventes réelles</span>
              <span className="flex items-center gap-1"><span className="inline-block h-1 w-4 rounded bg-mod" /> prédiction</span>
            </span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Ventes réelles et prédites, R² de validation ${fit ? fmt(fit.valR2) : ""}`}>
            {y.ticks(4).map((v) => (
              <g key={v}>
                <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
                <text x={M.l - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)" className="num">{v}</text>
              </g>
            ))}
            <text x={(M.l + W - M.r) / 2} y={H - 6} fontSize={11} textAnchor="middle" fill="var(--muted)">jours</text>
            <path d={real} fill="none" stroke="var(--neg)" strokeWidth={2} />
            <path d={pred} fill="none" stroke="var(--mod)" strokeWidth={2.5} />
          </svg>
        </div>
        <div className="space-y-2 self-center">
          <Readout label="R² de validation" value={fit ? fmt(fit.valR2, 3) : "…"} strong />
          <Readout label="R² d'entraînement" value={fit ? fmt(fit.trainR2, 3) : "…"} />
          <Readout label="Variables du modèle" value={fit ? String(fit.nFeatures) : "…"} sub="constante, jour n°, température, promo, puis tes ajouts" />
        </div>
      </div>
    </LabFrame>
  );
}

// ============================================================ Dérive en production

const VERSION_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#8b5cf6", "#db2777", "#d9a300", "#0e9fb3", "#64748b", "#2a78d6", "#eb6834", "#1baf7a", "#8b5cf6", "#db2777"];

/** Un modèle en production pendant un an : la précision mensuelle, le PSI, et les réentraînements que tu planifies. */
export function DriftLab({ id = "drift", challenge }: { id?: string; challenge?: string }) {
  const hydrated = useHydrated();
  const [retrain, setRetrain] = useState<number[]>([]);
  const year = useMemo(() => (hydrated ? simulateYear(retrain) : null), [retrain, hydrated]);
  const minAcc = year ? Math.min(...year.map((m) => m.acc)) : 0;
  const solved = challenge && year ? CHALLENGES[challenge].check({ retrains: retrain.length, minAcc }) : false;
  const toggle = (m: number) => setRetrain((r) => (r.includes(m) ? r.filter((x) => x !== m) : [...r, m].sort((a, b) => a - b)));

  const W = 620, H = 230, M = { l: 40, r: 10, t: 14, b: 30 };
  const bw = (W - M.l - M.r) / (MONTHS + 1);
  const y = scaleLinear().domain([0.4, 0.9]).range([H - M.b, M.t]);
  const versions = year ? [...new Set(year.map((m) => m.version))] : [];

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-2 text-sm font-semibold text-muted">Réentraîner au début du mois (sur les données du mois précédent) :</div>
      <div className="mb-6 flex flex-wrap gap-1.5">
        {Array.from({ length: MONTHS }, (_, i) => i + 1).map((m) => (
          <button
            key={m}
            onClick={() => toggle(m)}
            aria-pressed={retrain.includes(m)}
            className={clsx("num rounded-xl border-2 px-3 py-1.5 text-sm font-semibold transition-colors", retrain.includes(m) ? "border-mod bg-mod text-white" : "border-line bg-surface hover:border-mod")}
          >
            M{m}
          </button>
        ))}
        {retrain.length > 0 && (
          <button onClick={() => setRetrain([])} className="px-2 text-sm text-muted underline underline-offset-4 hover:text-ink">
            Tout effacer
          </button>
        )}
      </div>
      {year && (
        <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr] [&>*]:min-w-0">
          <div>
            <h3 className="mb-2 font-display text-lg font-bold">Précision mensuelle du modèle en service</h3>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Précision minimale sur l'année : ${pct(minAcc)}`}>
              {[0.5, 0.6, 0.7, 0.8, 0.9].map((v) => (
                <g key={v}>
                  <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke={v === 0.7 ? "var(--fp)" : "var(--line)"} strokeDasharray={v === 0.7 ? "5 4" : undefined} />
                  <text x={M.l - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)" className="num">{Math.round(v * 100)}%</text>
                </g>
              ))}
              {year.map((m) => (
                <g key={m.t}>
                  <rect x={M.l + m.t * bw + 3} y={y(Math.max(0.4, m.acc))} width={bw - 6} height={y(0.4) - y(Math.max(0.4, m.acc))} rx={4} fill={VERSION_COLORS[versions.indexOf(m.version)]} opacity={m.acc < 0.7 ? 0.45 : 0.9} />
                  <text x={M.l + m.t * bw + bw / 2} y={H - M.b + 14} fontSize={10} textAnchor="middle" fill="var(--muted)" className="num">M{m.t}</text>
                  <text x={M.l + m.t * bw + bw / 2} y={H - 3} fontSize={9} textAnchor="middle" fill={m.psi > 0.2 ? "var(--fp)" : "var(--muted)"} className="num">{fmt(m.psi, 1)}</text>
                </g>
              ))}
            </svg>
            <p className="mt-1 text-xs text-muted">Couleur = version du modèle. Ligne du bas : PSI entre les données d'entraînement de la version en service et celles du mois (orange au-delà de 0,2).</p>
          </div>
          <div className="space-y-2 self-center">
            <Readout label="Précision minimale sur l'année" value={pct(minAcc)} strong />
            <Readout label="Réentraînements" value={String(retrain.length)} sub={retrain.length ? retrain.map((m) => `M${m}`).join(", ") : "aucun : le modèle du mois 0 tourne toute l'année"} />
          </div>
        </div>
      )}
    </LabFrame>
  );
}
