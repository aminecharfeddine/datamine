"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import {
  alignment, averagePrecision, BEST_GOLD, bestMf, CATEGORIES, CONTAMINATIONS, detect, EVAL_TICKETS, FILM_GENRE, FILMS, IMB, IMB_DATA, IMB_THRESHOLDS,
  imbalance, imbProbas, KL_STEPS, MF_K, MF_LAMBDA, N_ANOMALIES, N_ITEMS, promptEval, promptText, RATINGS, recoModel, recommend, recoScores, TRANSACTIONS,
  type AnomalyMethod, type ImbStrategy, type PromptConfig, type RecoMethod, type RmSize,
} from "@/lib/models3";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { useHydrated } from "@/components/ui/useHydrated";
import { LabFrame, Segmented, Slider } from "./controls";

const fmt = (v: number, d = 2) => v.toFixed(d).replace(".", ",");
const pct = (v: number, d = 0) => `${(v * 100).toFixed(d).replace(".", ",")} %`;

function Readout({ label, value, strong, sub }: { label: string; value: string; strong?: boolean; sub?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: strong ? "color-mix(in srgb, var(--mod) 10%, white)" : "var(--paper)" }}>
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="num mt-0.5 text-xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

function Pending() {
  return <div className="flex h-48 items-center justify-center text-sm text-muted">Calcul en cours…</div>;
}

// ============================================================ 1. Recommandation

const SHOWN_USERS = 10;

/** Matrice utilisateurs × films : prédire les notes cachées par popularité, par voisins ou par factorisation. */
export function RecoLab({ id = "reco", challenge }: { id?: string; challenge?: string }) {
  const hydrated = useHydrated();
  const [method, setMethod] = useState<RecoMethod>("pop");
  const [ki, setKi] = useState(4);
  const [li, setLi] = useState(0);
  const [user, setUser] = useState(0);
  const k = MF_K[ki];
  const lambda = MF_LAMBDA[li];

  const r = useMemo(() => (hydrated ? recoScores(method, k, lambda) : null), [hydrated, method, k, lambda]);
  const best = useMemo(() => (hydrated ? bestMf() : null), [hydrated]);
  const model = useMemo(() => (hydrated ? recoModel(method, k, lambda) : null), [hydrated, method, k, lambda]);
  const recos = useMemo(() => (hydrated ? recommend(method, user, k, lambda) : []), [hydrated, method, user, k, lambda]);
  const solved = challenge && r && best ? CHALLENGES[challenge].check({ method, valid: r.valid, best: best.valid }) : false;

  const cells = useMemo(() => {
    const m = new Map<string, { r: number; kind: "train" | "valid" }>();
    RATINGS.train.forEach((x) => x.u < SHOWN_USERS && m.set(`${x.u}:${x.i}`, { r: x.r, kind: "train" }));
    RATINGS.valid.forEach((x) => x.u < SHOWN_USERS && m.set(`${x.u}:${x.i}`, { r: x.r, kind: "valid" }));
    return m;
  }, []);

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <p className="mb-4 text-sm text-muted">
        60 utilisateurs, 16 films, notes de 1 à 5. Chacun n'a noté qu'une partie des films ; une partie des notes est cachée pour mesurer la qualité des prédictions.
      </p>
      <div className="mb-5 grid gap-5 sm:grid-cols-3 [&>*]:min-w-0">
        <Segmented label="Méthode" value={method} onChange={setMethod} options={[{ value: "pop", label: "Popularité" }, { value: "knn", label: "Voisins" }, { value: "mf", label: "Factorisation" }]} />
        {method === "mf" && <Slider label="Facteurs latents (k)" value={ki} min={0} max={MF_K.length - 1} step={1} onChange={setKi} display={String(k)} />}
        {method === "mf" && <Slider label="Régularisation (λ)" value={li} min={0} max={MF_LAMBDA.length - 1} step={1} onChange={setLi} display={fmt(lambda, lambda < 0.1 ? 2 : 1)} />}
      </div>
      {!hydrated || !r || !model ? (
        <Pending />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 [&>*]:min-w-0">
          <div className="sm:col-span-2">
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Matrice des notes des dix premiers utilisateurs">
              <div className="num grid w-max gap-[3px] text-xs" style={{ gridTemplateColumns: `30px repeat(${FILMS.length}, 24px)` }}>
                <div />
                {FILMS.map((f, i) => (
                  <div key={f} className="text-center font-semibold text-muted" title={f}>{i + 1}</div>
                ))}
                {Array.from({ length: SHOWN_USERS }, (_, u) => [
                  <div key={`u${u}`} className={clsx("flex items-center justify-end pr-1 font-semibold", u === user ? "text-ink" : "text-muted")}>U{u + 1}</div>,
                  ...FILMS.map((_, i) => {
                    const c = cells.get(`${u}:${i}`);
                    const base = "flex h-6 w-6 items-center justify-center rounded font-bold";
                    if (c?.kind === "train")
                      return (
                        <div key={i} className={clsx(base, "text-white")} style={{ background: `color-mix(in srgb, var(--mod) ${20 + c.r * 16}%, #94a3b8)` }}>
                          {c.r}
                        </div>
                      );
                    if (c?.kind === "valid") {
                      const p = model(u, i);
                      const err = Math.abs(p - c.r);
                      return (
                        <div key={i} title={`Note cachée ${c.r}, prédite ${fmt(p, 1)}`} className={clsx(base, "border-2 border-dashed")} style={{ borderColor: err < 0.5 ? "#15803d" : err < 1 ? "#b45309" : "#e11d48" }}>
                          {Math.round(p)}
                        </div>
                      );
                    }
                    return <div key={i} className="h-6 w-6 rounded bg-paper" />;
                  }),
                ])}
              </div>
            </div>
            <p className="mt-2 text-xs text-muted">
              Cases pleines : notes connues. Cases en pointillés : notes cachées, avec la note prédite ; bordure verte si l'erreur est sous 0,5, orange sous 1, rose au-delà.
            </p>
          </div>
          <div className="grid grid-cols-2 content-start gap-2">
            <Readout label="Erreur sur les notes connues" value={fmt(r.train)} sub="RMSE d'entraînement" />
            <Readout label="Erreur sur les notes cachées" value={fmt(r.valid)} strong sub="RMSE de validation" />
          </div>
          <div>
            <div>
              <Slider label="Recommandations pour" value={user} min={0} max={SHOWN_USERS - 1} step={1} onChange={setUser} display={`U${user + 1}`} />
              <ol className="mt-2 space-y-1.5 text-sm">
                {recos.map((x, n) => (
                  <li key={x.i} className="flex items-baseline justify-between gap-2 rounded-lg bg-paper px-3 py-1.5">
                    <span>
                      <b>{n + 1}.</b> {FILMS[x.i]} <span className="text-xs text-muted">({FILM_GENRE[x.i]}, film {x.i + 1})</span>
                    </span>
                    <span className="num font-bold">{fmt(x.score, 1)}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-muted">{N_ITEMS} films : 1 à 6 plutôt action ou science-fiction, 7 à 12 plutôt romance et comédie, 13 à 16 mixtes.</p>
    </LabFrame>
  );
}

// ============================================================ 2. Anomalies

const METHOD_LABEL: Record<AnomalyMethod, string> = { zscore: "z-score", knn: "Distance aux voisins", iforest: "Isolation Forest", lof: "LOF" };

/** Transactions en deux dimensions : quelles méthodes repèrent les anomalies globales et locales ? */
export function AnomalyLab({ id = "anomalies", challenge }: { id?: string; challenge?: string }) {
  const hydrated = useHydrated();
  const [method, setMethod] = useState<AnomalyMethod>("zscore");
  const [ci, setCi] = useState(2);
  const share = CONTAMINATIONS[ci];
  const r = useMemo(() => (hydrated ? detect(method, share) : null), [hydrated, method, share]);
  const solved = challenge && r ? CHALLENGES[challenge].check({ precision: r.precision, recall: r.recall }) : false;

  const W = 480, H = 380, M = 16;
  const x = scaleLinear().domain([-2.5, 13.5]).range([M, W - M]);
  const y = scaleLinear().domain([-2, 12]).range([H - M, M]);

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <p className="mb-4 text-sm text-muted">
        600 transactions décrites par deux variables (montant et fréquence, standardisés) : un grand groupe de clients ordinaires, un petit groupe très homogène, et {N_ANOMALIES} fraudes (croix).
      </p>
      <div className="mb-5 grid gap-5 sm:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
        <Segmented label="Méthode" value={method} onChange={setMethod} options={(Object.keys(METHOD_LABEL) as AnomalyMethod[]).map((m) => ({ value: m, label: METHOD_LABEL[m] }))} />
        <Slider label="Part des transactions signalées" value={ci} min={0} max={CONTAMINATIONS.length - 1} step={1} onChange={setCi} display={pct(share)} />
      </div>
      <div className="grid gap-6 md:grid-cols-[1.5fr_1fr] [&>*]:min-w-0">
        {!r ? (
          <Pending />
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl bg-paper" role="img" aria-label={`${r.k} transactions signalées, dont ${r.tp} fraudes`}>
            {TRANSACTIONS.map((p, i) => {
              const f = r.flagged.has(i);
              if (p.anomaly)
                return (
                  <g key={i} stroke={f ? "#e11d48" : "var(--ink)"} strokeWidth={2.2}>
                    <line x1={x(p.x) - 4} y1={y(p.y) - 4} x2={x(p.x) + 4} y2={y(p.y) + 4} />
                    <line x1={x(p.x) - 4} y1={y(p.y) + 4} x2={x(p.x) + 4} y2={y(p.y) - 4} />
                    {f && <circle cx={x(p.x)} cy={y(p.y)} r={8} fill="none" />}
                  </g>
                );
              return f ? (
                <circle key={i} cx={x(p.x)} cy={y(p.y)} r={5} fill="#e11d48" stroke="var(--surface)" />
              ) : (
                <circle key={i} cx={x(p.x)} cy={y(p.y)} r={2.6} fill="var(--mod)" opacity={0.45} />
              );
            })}
          </svg>
        )}
        <div className="grid grid-cols-2 content-start gap-2">
          <Readout label="Transactions signalées" value={r ? String(r.k) : "…"} />
          <Readout label="Fraudes trouvées" value={r ? `${r.tp} / ${N_ANOMALIES}` : "…"} />
          <Readout label="Recall" value={r ? pct(r.recall) : "…"} strong />
          <Readout label="Precision" value={r ? pct(r.precision) : "…"} strong />
          <p className="col-span-2 text-xs text-muted">En rose : transactions signalées. Une croix entourée est une fraude repérée ; une croix noire, une fraude manquée.</p>
        </div>
      </div>
    </LabFrame>
  );
}

// ============================================================ 3. Données déséquilibrées

const STRATEGY_LABEL: Record<ImbStrategy, string> = { none: "Aucune", weights: "class_weight", under: "Sous-échantillonnage", smote: "SMOTE" };
const BINS = 20;

/** Fraude à 1 % : rééquilibrer les classes ou déplacer le seuil ? */
export function ImbalanceLab({ id = "desequilibre", challenge }: { id?: string; challenge?: string }) {
  const hydrated = useHydrated();
  const [strategy, setStrategy] = useState<ImbStrategy>("none");
  const [ti, setTi] = useState(49);
  const t = IMB_THRESHOLDS[ti];
  const r = useMemo(() => (hydrated ? imbalance(strategy, t) : null), [hydrated, strategy, t]);
  const ap = useMemo(() => (hydrated ? averagePrecision(strategy) : null), [hydrated, strategy]);
  const hist = useMemo(() => {
    if (!hydrated) return null;
    const p = imbProbas(strategy);
    const h = Array.from({ length: BINS }, () => ({ neg: 0, pos: 0 }));
    p.forEach((v, i) => {
      const b = Math.min(BINS - 1, Math.floor(v * BINS));
      if (IMB_DATA[i].y) h[b].pos++;
      else h[b].neg++;
    });
    return h;
  }, [hydrated, strategy]);
  const solved = challenge && r ? CHALLENGES[challenge].check({ recall: r.recall, precision: r.precision, calibrationGap: r.calibrationGap }) : false;

  const W = 480, H = 200, M = { l: 10, r: 10, t: 10, b: 26 };
  const x = scaleLinear().domain([0, 1]).range([M.l, W - M.r]);
  const hy = scaleLinear().domain([0, Math.log1p(IMB.n)]).range([0, (H - M.t - M.b) / 2]);
  const mid = M.t + (H - M.t - M.b) / 2;
  const bw = (W - M.l - M.r) / BINS;

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <p className="mb-4 text-sm text-muted">
        20 000 transactions, dont 1 % de fraudes. Le même modèle est entraîné avec ou sans rééquilibrage des classes ; on décide « fraude » au-dessus du seuil.
      </p>
      <div className="mb-5 grid gap-5 sm:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
        <Segmented label="Rééquilibrage à l'entraînement" value={strategy} onChange={setStrategy} options={(Object.keys(STRATEGY_LABEL) as ImbStrategy[]).map((s) => ({ value: s, label: STRATEGY_LABEL[s] }))} />
        <Slider label="Seuil de décision" value={ti} min={0} max={IMB_THRESHOLDS.length - 1} step={1} onChange={setTi} display={fmt(t, 2)} />
      </div>
      {!r || !hist || ap === null ? (
        <Pending />
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Distribution des probabilités prédites pour les fraudes et les transactions normales">
            {hist.map((b, i) => (
              <g key={i}>
                <rect x={M.l + i * bw + 1} y={mid - hy(Math.log1p(b.neg))} width={bw - 2} height={hy(Math.log1p(b.neg))} fill="var(--muted)" opacity={0.45} />
                <rect x={M.l + i * bw + 1} y={mid} width={bw - 2} height={hy(Math.log1p(b.pos))} fill="var(--mod)" />
              </g>
            ))}
            <line x1={M.l} x2={W - M.r} y1={mid} y2={mid} stroke="var(--line)" />
            <line x1={x(t)} x2={x(t)} y1={M.t} y2={H - M.b} stroke="var(--ink)" strokeWidth={2} strokeDasharray="5 3" />
            <text x={W - M.r} y={M.t + 10} fontSize={11} textAnchor="end" fill="var(--muted)">transactions normales</text>
            <text x={W - M.r} y={H - M.b - 4} fontSize={11} textAnchor="end" fill="var(--mod-deep)">fraudes</text>
            {[0, 0.5, 1].map((v) => (
              <text key={v} x={x(v)} y={H - 6} fontSize={10} textAnchor={v === 0 ? "start" : v === 1 ? "end" : "middle"} fill="var(--muted)" className="num">{fmt(v, 1)}</text>
            ))}
          </svg>
          <p className="mb-4 text-xs text-muted">Probabilité de fraude prédite (axe horizontal) ; hauteur des barres en échelle logarithmique. Pointillés : le seuil.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Readout label="Accuracy" value={pct(r.accuracy, 1)} />
            <Readout label="Recall" value={pct(r.recall)} strong sub={`${r.tp} fraudes repérées`} />
            <Readout label="Precision" value={pct(r.precision)} strong sub={`${r.fp} fausses alertes`} />
            <Readout label="PR-AUC (average precision)" value={fmt(ap)} sub="qualité du classement" />
            <Readout label="Probabilité moyenne prédite" value={pct(r.meanProba, 2)} strong sub={`taux réel : ${pct(r.realRate, 2)}`} />
          </div>
        </>
      )}
    </LabFrame>
  );
}

// ============================================================ 4. Prompt engineering

/** Classer des tickets avec un LLM : ce que chaque élément du prompt change (simulation). */
export function PromptLab({ id = "prompt", challenge }: { id?: string; challenge?: string }) {
  const [c, setC] = useState<PromptConfig>({ instructions: "vague", examples: "0", format: "free", reasoning: false });
  const set = <K extends keyof PromptConfig>(k: K) => (v: PromptConfig[K]) => setC((o) => ({ ...o, [k]: v }));
  const r = promptEval(c);
  const solved = challenge ? CHALLENGES[challenge].check({ usable: r.usable, tokens: r.tokens }) : false;
  const maxN = Math.max(...r.predicted.map((p) => p.n), 30);

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <p className="mb-4 text-sm text-muted">
        Un LLM classe des tickets de support en quatre catégories ; on l'évalue sur {EVAL_TICKETS} tickets étiquetés, 15 par catégorie. Les résultats sont simulés, avec des ordres de grandeur réalistes.
      </p>
      <div className="mb-5 grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
        <Segmented label="Instructions" value={c.instructions} onChange={set("instructions")} options={[{ value: "vague", label: "Vagues" }, { value: "precise", label: "Précises" }]} />
        <Segmented
          label="Exemples (few-shot)"
          value={c.examples}
          onChange={set("examples")}
          options={[{ value: "0", label: "Aucun" }, { value: "3-biased", label: "3, même classe" }, { value: "3", label: "3 variés" }, { value: "8", label: "8 variés" }]}
        />
        <Segmented label="Format de sortie" value={c.format} onChange={set("format")} options={[{ value: "free", label: "Texte libre" }, { value: "json", label: "JSON imposé" }]} />
        <Segmented label="Raisonnement" value={c.reasoning ? "on" : "off"} onChange={(v) => set("reasoning")(v === "on")} options={[{ value: "off", label: "Réponse directe" }, { value: "on", label: "Pas à pas" }]} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] [&>*]:min-w-0">
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-paper p-4 font-mono text-xs leading-relaxed" tabIndex={0} aria-label="Prompt construit">
          {promptText(c)}
        </pre>
        <div>
          <div className="grid grid-cols-2 gap-2">
            <Readout label="Bonne catégorie" value={pct(r.accuracy)} />
            <Readout label="Réponses lisibles" value={pct(r.parse)} sub="par le programme" />
            <Readout label="Réponses exploitables" value={pct(r.usable)} strong sub="correctes et lisibles" />
            <Readout label="Tokens par requête" value={String(r.tokens)} strong sub={`${r.inputTokens} en entrée, ${r.outputTokens} en sortie`} />
          </div>
          <div className="mt-4 text-sm font-semibold text-muted">Catégories prédites (trait : vraie répartition)</div>
          <div className="mt-2 space-y-1.5">
            {r.predicted.map((p) => (
              <div key={p.cat} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0">{p.cat}</span>
                <div className="relative h-4 flex-1 rounded bg-paper">
                  <div className="h-4 rounded" style={{ width: `${(p.n / maxN) * 100}%`, background: "var(--mod)" }} />
                  <div className="absolute top-[-2px] h-5 w-0.5 bg-ink" style={{ left: `${(p.truth / maxN) * 100}%` }} />
                </div>
                <span className="num w-6 text-right font-bold">{p.n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">Catégories : {CATEGORIES.join(", ")}.</p>
    </LabFrame>
  );
}

// ============================================================ 5. Alignement

const REGIME_TEXT = {
  base: "Modèle de départ (après le fine-tuning supervisé) : souvent correct, parfois à côté de la demande.",
  aligned: "Réponses claires, qui suivent la consigne et refusent ce qu'il faut refuser.",
  hacking: "Réponses très longues, flatteuses, chargées de listes et d'avertissements : le reward model les note très bien, les humains beaucoup moins.",
};

/** Sur-optimisation d'un reward model : le score du proxy monte toujours, la qualité réelle finit par baisser. */
export function AlignmentLab({ id = "alignement", challenge }: { id?: string; challenge?: string }) {
  const [rm, setRm] = useState<RmSize>("small");
  const [ki, setKi] = useState(2);
  const kl = KL_STEPS[ki];
  const a = alignment(kl, rm);
  const solved = challenge ? CHALLENGES[challenge].check({ gold: a.gold, best: BEST_GOLD }) : false;

  const W = 520, H = 250, M = { l: 40, r: 14, t: 14, b: 36 };
  const ds = Array.from({ length: 51 }, (_, i) => i * 0.2);
  const x = scaleLinear().domain([0, 10]).range([M.l, W - M.r]);
  const y = scaleLinear().domain([-2.5, 11]).range([H - M.b, M.t]);
  const curve = (f: (d: number) => number) => line<number>().x((d) => x(d)).y((d) => y(f(d)))(ds) ?? "";

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <p className="mb-4 text-sm text-muted">
        On optimise un LLM par renforcement contre un reward model appris sur des préférences humaines. Plus on s'éloigne du modèle de référence (KL), plus le score du reward model monte. Et la qualité jugée par des humains ?
      </p>
      <div className="mb-5 grid gap-5 sm:grid-cols-2 [&>*]:min-w-0">
        <Segmented label="Reward model" value={rm} onChange={setRm} options={[{ value: "small", label: "Petit" }, { value: "large", label: "Grand" }]} />
        <Slider label="Distance au modèle de référence (KL)" value={ki} min={0} max={KL_STEPS.length - 1} step={1} onChange={setKi} display={`${kl} nats`} />
      </div>
      <div className="grid gap-6 md:grid-cols-[1.5fr_1fr] [&>*]:min-w-0">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Score du reward model ${fmt(a.proxy, 1)}, qualité humaine ${fmt(a.gold, 1)}`}>
          <line x1={M.l} x2={W - M.r} y1={y(0)} y2={y(0)} stroke="var(--line)" />
          {[0, 5, 10].map((v) => (
            <text key={v} x={M.l - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)" className="num">{v}</text>
          ))}
          {KL_STEPS.map((k) => (
            <text key={k} x={x(Math.sqrt(k))} y={H - M.b + 14} fontSize={9} textAnchor="middle" fill="var(--muted)" className="num">{k}</text>
          ))}
          <text x={(M.l + W - M.r) / 2} y={H - 4} fontSize={11} textAnchor="middle" fill="var(--muted)">KL (échelle en racine carrée)</text>
          <path d={curve((d) => alignment(d * d, rm).proxy)} fill="none" stroke="var(--muted)" strokeWidth={2} strokeDasharray="6 4" />
          <path d={curve((d) => alignment(d * d, rm).gold)} fill="none" stroke="var(--mod)" strokeWidth={3} />
          <text x={x(9.8)} y={y(alignment(96, rm).proxy) - 8} fontSize={11} textAnchor="end" fill="var(--muted)">score du reward model</text>
          <text x={x(0.4)} y={y(4.3)} fontSize={11} fill="var(--mod-deep)" fontWeight={700}>qualité humaine</text>
          <circle cx={x(a.d)} cy={y(a.proxy)} r={5} fill="var(--muted)" />
          <circle cx={x(a.d)} cy={y(a.gold)} r={7} fill="var(--mod)" stroke="var(--surface)" strokeWidth={2} />
        </svg>
        <div>
          <div className="grid grid-cols-2 gap-2">
            <Readout label="Score du reward model" value={fmt(a.proxy, 1)} />
            <Readout label="Qualité jugée par des humains" value={fmt(a.gold, 1)} strong />
            <Readout label="Longueur moyenne" value={`${a.length} mots`} />
          </div>
          <p className={clsx("mt-3 rounded-xl p-3 text-sm", a.regime === "hacking" ? "bg-black/5" : "bg-paper")}>{REGIME_TEXT[a.regime]}</p>
        </div>
      </div>
    </LabFrame>
  );
}
