"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { scaleLinear, scaleLog } from "d3-scale";
import { line } from "d3-shape";
import {
  analogy, conv, EMB_GROUPS, EMB_WORDS, forward, groupOf, IMG, KERNELS, kernelResponses, lstmGradient, maxPool, neighbors, project2d, REG_EVERY,
  REG_EPOCHS, relu, rnnGradient, SCENE, SMALL_TRAIN, TARGET_TEST, targetTrain, trainEmbeddings, trainRegularized, TRANSFER_SIZES, transferRun,
  type RegConfig, type TransferMode,
} from "@/lib/dl";
import { CIRCLE_DOMAIN } from "@/lib/nn";
import { moonGrid } from "@/lib/ml";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { useHydrated } from "@/components/ui/useHydrated";
import { LabButton, LabFrame, Segmented, Slider } from "./controls";
import { DecisionMap } from "./Classify2D";

const fmt = (v: number, d = 2) => v.toFixed(d).replace(".", ",");
const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")} %`;

function Readout({ label, value, strong, sub }: { label: string; value: string; strong?: boolean; sub?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: strong ? "color-mix(in srgb, var(--mod) 10%, white)" : "var(--paper)" }}>
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="num mt-0.5 text-xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

// ============================================================ Régularisation

const REG_GRID = moonGrid(48, 48, CIRCLE_DOMAIN);
const regCache = new Map<string, ReturnType<typeof trainRegularized>>();
const getReg = (c: RegConfig) => {
  const k = `${c.dropout}:${c.wd}`;
  if (!regCache.has(k)) regCache.set(k, trainRegularized(c));
  return regCache.get(k)!;
};

/** 64 neurones, 60 points bruités : dropout, weight decay et early stopping contre le par cœur. */
export function RegLab({ id = "regularisation", challenge }: { id?: string; challenge?: string }) {
  const hydrated = useHydrated();
  const [dropout, setDropout] = useState<"0" | "0.3" | "0.5">("0");
  const [wd, setWd] = useState<"0" | "0.001" | "0.01">("0");
  const [early, setEarly] = useState<"non" | "oui">("non");
  const run = useMemo(() => (hydrated ? getReg({ dropout: Number(dropout) as RegConfig["dropout"], wd: Number(wd) as RegConfig["wd"] }) : null), [hydrated, dropout, wd]);
  const kept = run ? (early === "oui" ? run.best : run.valLoss.length - 1) : 0;
  const net = run ? run.snapshots[kept] : null;
  const predict = useMemo(() => (net ? REG_GRID.cells.map((c) => (forward(net, c.x, c.y) >= 0.5 ? 1 : 0) as 0 | 1) : []), [net]);
  const solved = challenge && run ? CHALLENGES[challenge].check({ valLoss: run.valLoss[kept] }) : false;

  const W = 440, H = 230, M = { l: 36, r: 10, t: 12, b: 30 };
  const x = scaleLinear().domain([0, REG_EPOCHS]).range([M.l, W - M.r]);
  const y = scaleLinear().domain([0, 1.2]).range([H - M.b, M.t]).clamp(true);
  const mk = (ls: number[]) => line<number>().x((_, i) => x((i + 1) * REG_EVERY)).y((v) => y(v))(ls) ?? "";

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-6 grid gap-x-8 gap-y-4 sm:grid-cols-3">
        <Segmented label="Dropout (couche cachée)" value={dropout} onChange={setDropout} options={[{ value: "0", label: "Aucun" }, { value: "0.3", label: "p = 0,3" }, { value: "0.5", label: "p = 0,5" }]} />
        <Segmented label="Weight decay" value={wd} onChange={setWd} options={[{ value: "0", label: "Aucun" }, { value: "0.001", label: "0,001" }, { value: "0.01", label: "0,01" }]} />
        <Segmented label="Early stopping" value={early} onChange={setEarly} options={[{ value: "non", label: "Non" }, { value: "oui", label: "Oui" }]} />
      </div>
      {run && net && (
        <div className="grid gap-8 lg:grid-cols-2 [&>*]:min-w-0">
          <div>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-display text-lg font-bold">Loss au fil des époques</h3>
              <span className="flex gap-3 text-xs text-muted">
                <span className="flex items-center gap-1"><span className="inline-block h-1 w-4 rounded bg-ink" /> entraînement</span>
                <span className="flex items-center gap-1"><span className="inline-block h-1 w-4 rounded bg-mod" /> validation</span>
              </span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Loss de validation du modèle retenu : ${fmt(run.valLoss[kept], 3)}`}>
              {[0, 0.4, 0.8, 1.2].map((v) => (
                <g key={v}>
                  <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
                  <text x={M.l - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)" className="num">{fmt(v, 1)}</text>
                </g>
              ))}
              <text x={(M.l + W - M.r) / 2} y={H - 6} fontSize={11} textAnchor="middle" fill="var(--muted)">époques</text>
              <path d={mk(run.trainLoss)} fill="none" stroke="var(--ink)" strokeWidth={2} />
              <path d={mk(run.valLoss)} fill="none" stroke="var(--mod)" strokeWidth={2.5} />
              <line x1={x((kept + 1) * REG_EVERY)} x2={x((kept + 1) * REG_EVERY)} y1={M.t} y2={H - M.b} stroke="var(--mod)" strokeDasharray="4 3" />
              <circle cx={x((kept + 1) * REG_EVERY)} cy={y(run.valLoss[kept])} r={5.5} fill="var(--mod)" stroke="var(--surface)" strokeWidth={2} />
            </svg>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Readout label="Loss de validation" value={fmt(run.valLoss[kept], 3)} strong />
              <Readout label="Précision de validation" value={pct(run.valAcc[kept])} />
              <Readout label="Modèle retenu" value={`époque ${(kept + 1) * REG_EVERY}`} />
            </div>
          </div>
          <DecisionMap predict={predict} cols={REG_GRID.cols} rows={REG_GRID.rows} points={SMALL_TRAIN} domain={CIRCLE_DOMAIN} title="Frontière du modèle retenu" />
        </div>
      )}
      {!run && <div className="h-80" />}
    </LabFrame>
  );
}

// ============================================================ Convolutions

const VALUES = [-1, 0, 1, 2];
function Grid({ M, title, size = 150, diverging = false }: { M: number[][]; title: string; size?: number; diverging?: boolean }) {
  const n = M.length, c = size / n;
  const mx = Math.max(1e-9, ...M.flat().map(Math.abs));
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full rounded-lg border border-line" style={{ maxWidth: size }} role="img" aria-label={title}>
        {M.flatMap((row, i) =>
          row.map((v, j) => {
            const t = v / mx;
            const fill = diverging
              ? t >= 0 ? `color-mix(in srgb, #d97706 ${Math.round(t * 100)}%, white)` : `color-mix(in srgb, #2a78d6 ${Math.round(-t * 100)}%, white)`
              : `color-mix(in srgb, var(--ink) ${Math.round(Math.max(0, t) * 100)}%, white)`;
            return <rect key={`${i}-${j}`} x={j * c} y={i * c} width={c + 0.3} height={c + 0.3} fill={fill} />;
          }),
        )}
      </svg>
      <span className="text-center text-xs font-semibold text-muted">{title}</span>
    </div>
  );
}

/** Un filtre 3 × 3 glisse sur l'image : carte d'activation, ReLU, puis max pooling. */
export function ConvLab({ id = "convolution", challenge }: { id?: string; challenge?: string }) {
  const [k, setK] = useState<number[][]>(KERNELS.verticaux);
  const [custom, setCustom] = useState(false);
  const out = relu(conv(SCENE, k));
  const pooled = maxPool(out);
  const r = kernelResponses(k);
  const solved = challenge ? CHALLENGES[challenge].check({ custom, ...r }) : false;
  const maxR = Math.max(r.vertical, r.horizontal, r.diagonal, 1);
  const cycle = (i: number, j: number) => {
    setK((m) => m.map((row, a) => row.map((v, b) => (a === i && b === j ? VALUES[(VALUES.indexOf(Math.round(v)) + 1) % VALUES.length] : Math.round(v * 100) / 100))));
    setCustom(true);
  };

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-muted">Filtres classiques :</span>
        {Object.entries({ identite: "Identité", flou: "Flou", verticaux: "Bords verticaux", horizontaux: "Bords horizontaux", nettete: "Netteté" }).map(([key, label]) => (
          <LabButton key={key} onClick={() => { setK(KERNELS[key]); setCustom(false); }}>{label}</LabButton>
        ))}
      </div>
      <div className="grid items-start gap-6 sm:grid-cols-[auto_1fr]">
        <div>
          <div className="mb-2 text-sm font-semibold text-muted">Ton filtre (clique pour changer : −1, 0, 1, 2)</div>
          <div className="grid w-fit grid-cols-3 gap-1.5">
            {k.map((row, i) =>
              row.map((v, j) => (
                <button
                  key={`${i}-${j}`}
                  onClick={() => cycle(i, j)}
                  className={clsx("num h-12 w-12 rounded-xl border-2 text-sm font-bold transition-colors", v > 0 ? "border-[#d97706] bg-[#fdf1e2]" : v < 0 ? "border-[#2a78d6] bg-[#e8f1fc]" : "border-line bg-surface")}
                >
                  {Number.isInteger(v) ? v : fmt(v, 2)}
                </button>
              )),
            )}
          </div>
        </div>
        <div className="min-w-0">
          <div className="mb-2 text-sm font-semibold text-muted">Réaction du filtre à chaque forme (somme des activations)</div>
          <ul className="space-y-1.5">
            {([["vertical", "Barre verticale"], ["horizontal", "Barre horizontale"], ["diagonal", "Diagonale"]] as const).map(([key, label]) => (
              <li key={key} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-2 text-sm">
                <span className="font-semibold">{label}</span>
                <span className="h-4 overflow-hidden rounded bg-sunken"><span className="block h-full rounded" style={{ width: `${(r[key] / maxR) * 100}%`, background: key === "diagonal" ? "var(--mod)" : "var(--neg)" }} /></span>
                <span className="num text-right text-xs">{Math.round(r[key])}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3">
        <Grid M={SCENE} title={`Image ${IMG} × ${IMG}`} />
        <Grid M={out} title="Carte d'activation (après ReLU)" />
        <Grid M={pooled} title="Max pooling 2 × 2 (10 × 10)" />
      </div>
    </LabFrame>
  );
}

// ============================================================ Transfer learning

const T_DOMAIN = { x: [-1.7, 2.0] as [number, number], y: [-1.45, 1.3] as [number, number] };
const T_GRID = moonGrid(56, 42, T_DOMAIN);
let transferAll: Record<TransferMode, number[]> | null = null;
const getTransferAll = () =>
  (transferAll ??= Object.fromEntries((["scratch", "frozen", "finetune"] as const).map((m) => [m, TRANSFER_SIZES.map((n) => transferRun(m, n).acc)])) as Record<TransferMode, number[]>);
const MODE_LABEL: Record<TransferMode, string> = { scratch: "Depuis zéro", frozen: "Pré-entraîné, couches gelées", finetune: "Pré-entraîné, fine-tuning complet" };
const MODE_COLOR: Record<TransferMode, string> = { scratch: "var(--neg)", frozen: "#2a78d6", finetune: "var(--mod)" };

/** Réutiliser un réseau entraîné sur une tâche voisine quand on a très peu d'exemples. */
export function TransferLab({ id = "transfer", challenge }: { id?: string; challenge?: string }) {
  const hydrated = useHydrated();
  const [n, setN] = useState(32);
  const [mode, setMode] = useState<TransferMode>("scratch");
  const run = useMemo(() => (hydrated ? transferRun(mode, n) : null), [hydrated, mode, n]);
  const all = hydrated ? getTransferAll() : null;
  const predict = useMemo(() => (run ? T_GRID.cells.map((c) => (forward(run.net, c.x, c.y) >= 0.5 ? 1 : 0) as 0 | 1) : []), [run]);
  const solved = challenge && run ? CHALLENGES[challenge].check({ mode, n, acc: run.acc }) : false;

  const W = 420, H = 220, M = { l: 40, r: 12, t: 12, b: 32 };
  const xs = scaleLog().domain([8, 128]).range([M.l, W - M.r]);
  const y = scaleLinear().domain([0.5, 1]).range([H - M.b, M.t]);

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <Segmented label="Exemples de la nouvelle tâche" value={String(n)} onChange={(v) => setN(Number(v))} options={TRANSFER_SIZES.map((s) => ({ value: String(s), label: String(s) }))} />
        <Segmented label="Point de départ" value={mode} onChange={setMode} options={(["scratch", "frozen", "finetune"] as const).map((m) => ({ value: m, label: MODE_LABEL[m] }))} />
      </div>
      {run && all && (
        <div className="grid gap-8 lg:grid-cols-2 [&>*]:min-w-0">
          <div>
            <DecisionMap predict={predict} cols={T_GRID.cols} rows={T_GRID.rows} points={targetTrain(n)} domain={T_DOMAIN} title={`${n} exemples d'entraînement`} />
            <p className="mt-2 text-xs text-muted">Tâche source : les cercles centrés (200 exemples). Tâche cible : les mêmes formes, décalées et étirées, avec très peu d'exemples. Test sur {TARGET_TEST.length} points.</p>
          </div>
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 font-display text-lg font-bold">Précision de test selon le nombre d'exemples</h3>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Précision des trois stratégies selon la taille du jeu d'entraînement">
                {[0.5, 0.6, 0.7, 0.8, 0.9, 1].map((v) => (
                  <g key={v}>
                    <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
                    <text x={M.l - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)" className="num">{Math.round(v * 100)}%</text>
                  </g>
                ))}
                {TRANSFER_SIZES.map((s) => (
                  <text key={s} x={xs(s)} y={H - M.b + 15} fontSize={10} textAnchor="middle" fill="var(--muted)" className="num">{s}</text>
                ))}
                <text x={(M.l + W - M.r) / 2} y={H - 3} fontSize={11} textAnchor="middle" fill="var(--muted)">exemples (échelle log)</text>
                {(["scratch", "frozen", "finetune"] as const).map((m) => (
                  <g key={m}>
                    <path d={line<number>().x((_, i) => xs(TRANSFER_SIZES[i])).y((v) => y(Math.max(0.5, v)))(all[m]) ?? ""} fill="none" stroke={MODE_COLOR[m]} strokeWidth={m === mode ? 3 : 1.6} />
                    {all[m].map((v, i) => <circle key={i} cx={xs(TRANSFER_SIZES[i])} cy={y(Math.max(0.5, v))} r={m === mode && TRANSFER_SIZES[i] === n ? 6 : 3} fill={MODE_COLOR[m]} />)}
                  </g>
                ))}
              </svg>
              <div className="flex flex-wrap gap-3 text-xs text-muted">
                {(["scratch", "frozen", "finetune"] as const).map((m) => (
                  <span key={m} className="flex items-center gap-1"><span className="inline-block h-1 w-4 rounded" style={{ background: MODE_COLOR[m] }} /> {MODE_LABEL[m]}</span>
                ))}
              </div>
            </div>
            <Readout label="Précision de test" value={pct(run.acc)} strong />
          </div>
        </div>
      )}
      {!run && <div className="h-80" />}
    </LabFrame>
  );
}

// ============================================================ Embeddings

const GROUP_COLOR: Record<string, string> = { animaux: "#d97706", fruits: "#db2777", pays: "#2a78d6", capitales: "#1baf7a" };
let embCache: { E: Record<string, number[]>; P: Record<string, [number, number]> } | null = null;
const getEmb = () => {
  if (!embCache) {
    const E = trainEmbeddings();
    embCache = { E, P: project2d(E) };
  }
  return embCache;
};

/** Embeddings appris par co-occurrence (PPMI + SVD) : la carte, les voisins, et l'arithmétique des mots. */
export function EmbeddingLab({ id = "embeddings", challenge }: { id?: string; challenge?: string }) {
  const hydrated = useHydrated();
  const [word, setWord] = useState("chat");
  const [a, setA] = useState("paris");
  const [b, setB] = useState("france");
  const [c, setC] = useState("italie");
  const emb = hydrated ? getEmb() : null;
  const res = emb ? analogy(emb.E, a, b, c) : [];
  const capI = (EMB_GROUPS.capitales as readonly string[]).indexOf(a);
  const cI = (EMB_GROUPS.pays as readonly string[]).indexOf(c);
  const expected = capI >= 0 && EMB_GROUPS.pays[capI] === b && cI >= 0 && cI !== capI ? EMB_GROUPS.capitales[cI] : null;
  const solved = challenge && emb ? CHALLENGES[challenge].check({ a, b, c, top: res[0]?.w ?? "", expected }) : false;

  const S = 340, pad = 50;
  const pts = emb ? Object.values(emb.P) : [];
  const xs = scaleLinear().domain([Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[0]))]).range([pad, S - pad - 30]);
  const ys = scaleLinear().domain([Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[1]))]).range([S - pad, pad]);
  // Les mots d'un même groupe sont presque confondus : on les dispose en petit cercle autour du centre de leur groupe.
  const layout = useMemo(() => {
    if (!emb) return {} as Record<string, [number, number]>;
    const out: Record<string, [number, number]> = {};
    const groups = Object.values(EMB_GROUPS);
    const centers = groups.map((words) => [
      words.reduce((s2, w) => s2 + xs(emb.P[w][0]), 0) / words.length,
      words.reduce((s2, w) => s2 + ys(emb.P[w][1]), 0) / words.length,
    ]);
    // Écarter les groupes trop proches (pays et capitales se chevauchent) pour que les étiquettes restent lisibles.
    for (let it = 0; it < 30; it++)
      for (let a = 0; a < centers.length; a++)
        for (let b = a + 1; b < centers.length; b++) {
          const dx = centers[b][0] - centers[a][0], dy = centers[b][1] - centers[a][1];
          const d = Math.hypot(dx, dy) || 1;
          if (d < 110) {
            const push = (110 - d) / 2;
            centers[a][0] -= (dx / d) * push; centers[a][1] -= (dy / d) * push;
            centers[b][0] += (dx / d) * push; centers[b][1] += (dy / d) * push;
          }
        }
    groups.forEach((words, g) => {
      const [cx, cy] = centers[g].map((v, k) => Math.min(Math.max(v, 55), S - (k === 0 ? 100 : 40)));
      words.forEach((w, i) => {
        const t = (2 * Math.PI * i) / words.length - Math.PI / 2;
        out[w] = [cx + 44 * Math.cos(t), cy + 26 * Math.sin(t)];
      });
    });
    return out;
  }, [emb]); // eslint-disable-line react-hooks/exhaustive-deps
  const Select = ({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) => (
    <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-xl border-2 border-line bg-surface px-2 py-1.5 text-sm font-semibold text-ink">
        {EMB_WORDS.map((w) => <option key={w} value={w}>{w}</option>)}
      </select>
    </label>
  );

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      {emb && (
        <div className="grid gap-8 lg:grid-cols-2 [&>*]:min-w-0">
          <div>
            <h3 className="mb-2 font-display text-lg font-bold">Carte des mots (projection 2D)</h3>
            <p className="mb-2 text-xs text-muted">Position de chaque groupe : projection des vecteurs. Dans un groupe, les mots sont écartés pour rester lisibles.</p>
            <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto w-full max-w-[380px] rounded-xl border border-line bg-paper" role="img" aria-label="Carte des embeddings : quatre groupes de mots">
              {EMB_WORDS.map((w) => {
                const [px, py] = layout[w];
                return (
                  <g key={w} onClick={() => setWord(w)} className="cursor-pointer">
                    <circle cx={px} cy={py} r={w === word ? 7 : 5} fill={GROUP_COLOR[groupOf(w)]} stroke="white" strokeWidth={1.5} />
                    <text x={px + 8} y={py + 4} fontSize={11} fontWeight={w === word ? 800 : 600} fill="var(--ink)">{w}</text>
                  </g>
                );
              })}
            </svg>
            <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs text-muted">
              {Object.entries(GROUP_COLOR).map(([g, col]) => <span key={g} className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: col }} /> {g}</span>)}
            </div>
          </div>
          <div className="space-y-5">
            <div>
              <h3 className="mb-2 font-display text-lg font-bold">Plus proches voisins de « {word} »</h3>
              <p className="mb-2 text-xs text-muted">Clique un mot sur la carte. Similarité cosinus dans l'espace complet (6 dimensions).</p>
              <ul className="space-y-1">
                {neighbors(emb.E, emb.E[word], [word], 4).map((nb) => (
                  <li key={nb.w} className="flex items-center justify-between rounded-lg bg-paper px-3 py-1.5 text-sm">
                    <span className="flex items-center gap-2 font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: GROUP_COLOR[groupOf(nb.w)] }} />{nb.w}</span>
                    <span className="num text-xs">{fmt(nb.s, 2)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 font-display text-lg font-bold">Analogie : A − B + C ≈ ?</h3>
              <div className="grid grid-cols-3 gap-2">
                <Select value={a} onChange={setA} label="A" />
                <Select value={b} onChange={setB} label="− B" />
                <Select value={c} onChange={setC} label="+ C" />
              </div>
              <ol className="mt-3 space-y-1">
                {res.map((r, i) => (
                  <li key={r.w} className={clsx("flex items-center justify-between rounded-lg px-3 py-1.5 text-sm", i === 0 ? "bg-[color-mix(in_srgb,var(--mod)_12%,white)] font-bold" : "bg-paper")}>
                    <span>{i + 1}. {r.w}{expected && r.w === expected ? " ✓" : ""}</span>
                    <span className="num text-xs">{fmt(r.s, 2)}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}
      {!emb && <div className="h-80" />}
    </LabFrame>
  );
}

// ============================================================ RNN et LSTM

/** Le gradient qui remonte le temps : multiplié à chaque pas par le même facteur (RNN) ou par la porte d'oubli (LSTM). */
export function RnnLab({ id = "rnn", challenge }: { id?: string; challenge?: string }) {
  const [model, setModel] = useState<"rnn" | "lstm">("rnn");
  const [w, setW] = useState(1);
  const [f, setF] = useState(0.9);
  const [T, setT] = useState(50);
  const g = (t: number) => (model === "rnn" ? rnnGradient(w, t) : lstmGradient(f, t));
  const gT = g(T);
  const solved = challenge ? CHALLENGES[challenge].check({ model, T, grad: gT }) : false;

  const W = 520, H = 240, M = { l: 52, r: 12, t: 12, b: 32 };
  const x = scaleLinear().domain([0, 200]).range([M.l, W - M.r]);
  const y = scaleLog().domain([1e-8, 1e8]).range([H - M.b, M.t]).clamp(true);
  const ts = Array.from({ length: T + 1 }, (_, t) => t);
  const d = line<number>().x((t) => x(t)).y((t) => y(Math.max(1e-8, Math.min(1e8, g(t)))))(ts) ?? "";

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-6 grid gap-x-8 gap-y-4 sm:grid-cols-3">
        <Segmented label="Cellule" value={model} onChange={setModel} options={[{ value: "rnn", label: "RNN simple" }, { value: "lstm", label: "LSTM" }]} />
        {model === "rnn" ? (
          <Slider label="Poids récurrent w" value={w} min={0.5} max={1.6} step={0.01} onChange={setW} display={fmt(w, 2)} />
        ) : (
          <Slider label="Porte d'oubli f" value={f} min={0.8} max={1} step={0.005} onChange={setF} display={fmt(f, 3)} />
        )}
        <Slider label="Pas de temps à remonter" value={T} min={10} max={200} step={10} onChange={setT} display={String(T)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] [&>*]:min-w-0">
        <div>
          <h3 className="mb-2 font-display text-lg font-bold">Taille du gradient après t pas (échelle log)</h3>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Gradient après ${T} pas : ${gT.toExponential(1)}`}>
            <rect x={M.l} width={W - M.l - M.r} y={y(10)} height={y(0.1) - y(10)} fill="color-mix(in srgb, var(--good-bg) 12%, white)" />
            {[1e-8, 1e-4, 1, 1e4, 1e8].map((v) => (
              <g key={v}>
                <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
                <text x={M.l - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)" className="num">{v === 1 ? "1" : `1e${Math.log10(v)}`}</text>
              </g>
            ))}
            {[0, 50, 100, 150, 200].map((t) => <text key={t} x={x(t)} y={H - M.b + 15} fontSize={10} textAnchor="middle" fill="var(--muted)" className="num">{t}</text>)}
            <text x={(M.l + W - M.r) / 2} y={H - 3} fontSize={11} textAnchor="middle" fill="var(--muted)">pas de temps remontés</text>
            <path d={d} fill="none" stroke="var(--mod)" strokeWidth={2.5} />
          </svg>
          <p className="mt-1 text-xs text-muted">Bande verte : gradient utilisable (entre 0,1 et 10).{model === "rnn" ? " Dérivée moyenne de tanh fixée à 0,8." : ""}</p>
        </div>
        <div className="space-y-2 self-center">
          <Readout label={`Gradient après ${T} pas`} value={gT < 1e-3 || gT > 1e3 ? gT.toExponential(1).replace(".", ",") : fmt(gT, 3)} strong sub={gT < 0.1 ? "évanoui : le début de la séquence n'apprend plus" : gT > 10 ? "explosé : l'entraînement devient instable" : "utilisable"} />
          <Readout label="Facteur par pas" value={fmt(model === "rnn" ? w * 0.8 : f, 3)} sub={model === "rnn" ? "w × dérivée de tanh" : "porte d'oubli (le chemin de la cellule)"} />
        </div>
      </div>
    </LabFrame>
  );
}
