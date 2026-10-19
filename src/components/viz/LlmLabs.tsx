"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Dices } from "lucide-react";
import {
  CANDIDATES, countParams, drawSamples, expandQuery, ffDim, inferenceBudget, lowRank, LORA_N, makeDelta, PRESETS, RAG_QUESTIONS,
  ragEval, retrieve, containsAnswer, SAMPLING_PROMPT, samplingDist, tokenCount, type Arch, type Granularity, type InfConfig,
} from "@/lib/llm2";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { useHydrated } from "@/components/ui/useHydrated";
import { LabButton, LabFrame, Segmented, Slider } from "./controls";

const fmt = (v: number, d = 2) => v.toFixed(d).replace(".", ",");
const gb = (bytes: number) => (bytes < 1e9 ? `${Math.round(bytes / 1e6)} Mo` : `${fmt(bytes / 1e9, 1)} Go`);
const big = (n: number) => (n >= 1e9 ? `${fmt(n / 1e9, 2)} G` : n >= 1e6 ? `${fmt(n / 1e6, 1)} M` : `${fmt(n / 1e3, 1)} k`);

function Readout({ label, value, strong, sub }: { label: string; value: string; strong?: boolean; sub?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: strong ? "color-mix(in srgb, var(--mod) 10%, white)" : "var(--paper)" }}>
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="num mt-0.5 text-xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

// ============================================================ Taille d'un Transformer

const PARTS = [
  { key: "embeddings", label: "Embeddings (+ positions)", color: "#2a78d6" },
  { key: "attention", label: "Attention", color: "#d97706" },
  { key: "mlp", label: "MLP", color: "#db2777" },
  { key: "head", label: "Tête de sortie", color: "#1baf7a" },
  { key: "norms", label: "Normalisations", color: "#a8adc4" },
] as const;

/** Schéma d'un bloc décodeur : chaque sous-couche est entourée d'une connexion résiduelle. */
function BlockDiagram({ L, gpt }: { L: number; gpt: boolean }) {
  const norm = gpt ? "LayerNorm" : "RMSNorm";
  const Box = ({ y, label, color }: { y: number; label: string; color: string }) => (
    <g>
      <rect x={60} y={y} width={150} height={30} rx={9} fill={`color-mix(in srgb, ${color} 18%, white)`} stroke={color} strokeWidth={1.5} />
      <text x={135} y={y + 19.5} textAnchor="middle" fontSize={11.5} fontWeight={700} fill="var(--ink)">{label}</text>
    </g>
  );
  const Plus = ({ y }: { y: number }) => (
    <g>
      <circle cx={135} cy={y} r={9} fill="var(--surface)" stroke="var(--muted)" strokeWidth={1.5} />
      <text x={135} y={y + 4} textAnchor="middle" fontSize={13} fontWeight={800} fill="var(--muted)">+</text>
    </g>
  );
  return (
    <svg viewBox="0 0 270 430" className="mx-auto w-full max-w-[260px]" role="img" aria-label={`Bloc décodeur répété ${L} fois`}>
      <defs>
        <marker id="tf-a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="var(--muted)" /></marker>
      </defs>
      <Box y={392} label="Tokens → embeddings" color="#2a78d6" />
      <line x1={135} y1={392} x2={135} y2={366} stroke="var(--muted)" strokeWidth={1.5} markerEnd="url(#tf-a)" />
      <rect x={30} y={70} width={210} height={290} rx={16} fill="none" stroke="var(--line)" strokeWidth={2} strokeDasharray="6 4" />
      <text x={232} y={88} textAnchor="end" fontSize={11} fontWeight={800} fill="var(--mod-deep)" className="num">× {L}</text>
      <Box y={318} label={norm} color="#a8adc4" />
      <Box y={268} label="Self-attention causale" color="#d97706" />
      <Plus y={240} />
      <Box y={186} label={norm} color="#a8adc4" />
      <Box y={136} label={gpt ? "MLP (GELU)" : "MLP (SwiGLU)"} color="#db2777" />
      <Plus y={108} />
      {/* flux principal */}
      <line x1={135} y1={318} x2={135} y2={300} stroke="var(--muted)" strokeWidth={1.5} />
      <line x1={135} y1={268} x2={135} y2={251} stroke="var(--muted)" strokeWidth={1.5} />
      <line x1={135} y1={231} x2={135} y2={218} stroke="var(--muted)" strokeWidth={1.5} />
      <line x1={135} y1={186} x2={135} y2={168} stroke="var(--muted)" strokeWidth={1.5} />
      <line x1={135} y1={136} x2={135} y2={119} stroke="var(--muted)" strokeWidth={1.5} />
      {/* connexions résiduelles */}
      <path d="M135,360 L135,352 M135,356 L48,356 L48,240 L124,240" fill="none" stroke="var(--mod)" strokeWidth={2} />
      <path d="M135,228 L135,224 M135,226 L48,226 L48,108 L124,108" fill="none" stroke="var(--mod)" strokeWidth={2} />
      <text x={42} y={300} fontSize={10} fill="var(--mod-deep)" fontWeight={700} transform="rotate(-90 42 300)" textAnchor="middle">résidu</text>
      <text x={42} y={170} fontSize={10} fill="var(--mod-deep)" fontWeight={700} transform="rotate(-90 42 170)" textAnchor="middle">résidu</text>
      <line x1={135} y1={99} x2={135} y2={60} stroke="var(--muted)" strokeWidth={1.5} markerEnd="url(#tf-a)" />
      <Box y={26} label={`${norm} → logits (vocab)`} color="#1baf7a" />
    </svg>
  );
}

/** Calculateur d'architecture : chaque réglage change le nombre de paramètres, poste par poste. */
export function TransformerSizeLab({ id = "taille", challenge }: { id?: string; challenge?: string }) {
  const [a, setA] = useState<Arch>({ d: 512, L: 6, V: 32000, ctx: 4096, ffn: "swiglu83", pos: "rope", tied: false, gqa: 1 });
  const [usedPreset, setUsedPreset] = useState(false);
  const set = <K extends keyof Arch>(k: K) => (v: Arch[K]) => setA((x) => ({ ...x, [k]: v }));
  const p = countParams(a);
  const solved = challenge ? CHALLENGES[challenge].check({ total: p.total, usedPreset }) : false;

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-muted">Préréglages :</span>
        {Object.entries(PRESETS).map(([name, arch]) => (
          <LabButton key={name} onClick={() => { setA(arch); setUsedPreset(true); }}>{name}</LabButton>
        ))}
        {usedPreset && (
          <button onClick={() => { setA({ d: 512, L: 6, V: 32000, ctx: 4096, ffn: "swiglu83", pos: "rope", tied: false, gqa: 1 }); setUsedPreset(false); }} className="text-sm text-muted underline underline-offset-4 hover:text-ink">
            Repartir de zéro
          </button>
        )}
      </div>
      <div className="mb-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <Slider label="Dimension du modèle d" value={a.d} min={256} max={8192} step={128} onChange={set("d")} display={String(a.d)} />
        <Slider label="Nombre de blocs L" value={a.L} min={1} max={96} step={1} onChange={set("L")} display={String(a.L)} />
        <Segmented label="Vocabulaire" value={String(a.V)} onChange={(v) => set("V")(Number(v))} options={["32000", "50257", "128256"].map((v) => ({ value: v, label: Number(v).toLocaleString("fr-FR") }))} />
        <Segmented label="Contexte maximal" value={String(a.ctx)} onChange={(v) => set("ctx")(Number(v))} options={["1024", "4096", "8192"].map((v) => ({ value: v, label: Number(v).toLocaleString("fr-FR") }))} />
        <Segmented label="MLP" value={a.ffn} onChange={set("ffn")} options={[{ value: "gelu4", label: "GELU, 4d (GPT-2)" }, { value: "swiglu83", label: "SwiGLU, 8d/3" }, { value: "swiglu35", label: "SwiGLU, 3,5d" }]} />
        <Segmented label="Positions" value={a.pos} onChange={set("pos")} options={[{ value: "learned", label: "Apprises" }, { value: "rope", label: "RoPE (sans paramètre)" }]} />
        <Segmented label="Embeddings d'entrée et de sortie" value={a.tied ? "oui" : "non"} onChange={(v) => set("tied")(v === "oui")} options={[{ value: "oui", label: "Partagés" }, { value: "non", label: "Séparés" }]} />
        <Segmented label="Têtes key/value" value={String(a.gqa)} onChange={(v) => set("gqa")(Number(v) as 1 | 8)} options={[{ value: "1", label: "Une par tête (MHA)" }, { value: "8", label: "Partagées par 8 (GQA)" }]} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr] [&>*]:min-w-0">
        <BlockDiagram L={a.L} gpt={a.ffn === "gelu4"} />
        <div className="space-y-4 self-center">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Readout label="Paramètres" value={big(p.total)} strong />
            <Readout label="Mémoire des poids (bf16)" value={gb(p.total * 2)} sub={`${gb(p.total * 0.5)} en int4`} />
            <Readout label="Calcul par token généré" value={`≈ ${big(2 * p.total)}FLOP`} sub="≈ 2 × paramètres" />
          </div>
          <div>
            <div className="mb-1.5 flex h-6 overflow-hidden rounded-lg">
              {PARTS.map((part) => {
                const v = p[part.key];
                return v > 0 ? <span key={part.key} title={`${part.label} : ${big(v)}`} style={{ width: `${(v / p.total) * 100}%`, background: part.color }} /> : null;
              })}
            </div>
            <ul className="grid gap-y-1 text-sm">
              {PARTS.map((part) => (
                <li key={part.key} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: part.color }} /> {part.label}</span>
                  <span className="num text-xs text-muted">{big(p[part.key])} · {Math.round((p[part.key] / p.total) * 100)} %</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-muted">MLP : largeur cachée {ffDim(a).toLocaleString("fr-FR")}. Têtes de 128 dimensions pour le calcul des key/value partagées.</p>
        </div>
      </div>
    </LabFrame>
  );
}

// ============================================================ LoRA

const DELTA = makeDelta();
let lrCache: ReturnType<typeof lowRank> | null = null;
const getLr = () => (lrCache ??= lowRank(DELTA));

function Heat({ M, title, scale }: { M: number[][]; title: string; scale: number }) {
  const n = M.length, c = 5;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox={`0 0 ${n * c} ${n * c}`} className="w-full max-w-[170px] rounded-lg border border-line" role="img" aria-label={title}>
        {M.flatMap((row, i) =>
          row.map((v, j) => {
            const t = Math.max(-1, Math.min(1, v / scale));
            return <rect key={`${i}-${j}`} x={j * c} y={i * c} width={c + 0.2} height={c + 0.2} fill={t >= 0 ? `color-mix(in srgb, #d97706 ${Math.round(t * 100)}%, white)` : `color-mix(in srgb, #2a78d6 ${Math.round(-t * 100)}%, white)`} />;
          }),
        )}
      </svg>
      <span className="text-center text-xs font-semibold text-muted">{title}</span>
    </div>
  );
}

/** ΔW (32 × 32) approchée par une matrice de rang r : B·A, avec B de taille 32 × r et A de taille r × 32. */
export function LoraLab({ id = "lora", challenge }: { id?: string; challenge?: string }) {
  const hydrated = useHydrated();
  const [r, setR] = useState(1);
  const lr = hydrated ? getLr() : null;
  const approx = useMemo(() => (lr ? lr.approx(r) : null), [lr, r]);
  const err = lr ? lr.error(r) : 1;
  const minR = lr ? [...Array(LORA_N + 1).keys()].find((k) => lr.error(k) < 0.05)! : -1;
  const solved = challenge && lr ? CHALLENGES[challenge].check({ r, err, minR }) : false;
  const scale = Math.max(...DELTA.flat().map(Math.abs));
  const resid = approx ? DELTA.map((row, i) => row.map((v, j) => v - approx[i][j])) : null;

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-6 max-w-md">
        <Slider label="Rang r de la mise à jour" value={r} min={0} max={12} step={1} onChange={setR} display={String(r)} />
      </div>
      {lr && approx && resid && (
        <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
          <div>
            <div className="grid grid-cols-3 gap-3">
              <Heat M={DELTA} title="ΔW apprise (complète)" scale={scale} />
              <Heat M={approx} title={`B · A, rang ${r}`} scale={scale} />
              <Heat M={resid} title="Ce qui manque" scale={scale} />
            </div>
            <h4 className="mb-2 mt-6 font-display text-lg font-bold">Valeurs singulières de ΔW</h4>
            <div className="flex h-28 items-end gap-1">
              {lr.sigma.slice(0, 12).map((s, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div className="w-full rounded-t" style={{ height: `${(s / lr.sigma[0]) * 100}px`, background: i < r ? "var(--mod)" : "var(--neg)" }} />
                  <span className="num text-[10px] text-muted">{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2 self-center">
            <Readout label="Erreur relative de reconstruction" value={`${fmt(err * 100, 1)} %`} strong />
            <Readout label="Paramètres entraînés ici" value={`${r * 2 * LORA_N} au lieu de ${LORA_N * LORA_N}`} sub="r × (32 + 32) contre 32 × 32" />
            <Readout label="Pour une matrice 4 096 × 4 096" value={`${(r * 2 * 4096).toLocaleString("fr-FR")}`} sub={`au lieu de 16 777 216, soit ${fmt((r * 2 * 4096 * 100) / 16777216, 2)} %`} />
          </div>
        </div>
      )}
    </LabFrame>
  );
}

// ============================================================ Sampling

/** Distribution du token suivant : température, top-k, top-p, puis tirages. */
export function SamplingLab({ id = "sampling", challenge }: { id?: string; challenge?: string }) {
  const [T, setT] = useState(1);
  const [topK, setTopK] = useState(0);
  const [topP, setTopP] = useState(1);
  const [seed, setSeed] = useState(0);
  const d = samplingDist(T, topK, topP);
  const draws = seed > 0 ? drawSamples(d.final, 12, seed) : [];
  const solved = challenge ? CHALLENGES[challenge].check({ T, topK, kept: d.kept }) : false;

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-6 grid gap-x-8 gap-y-4 sm:grid-cols-3">
        <Slider label="Température" value={T} min={0.1} max={2} step={0.05} onChange={setT} display={fmt(T, 2)} />
        <Slider label="top-k (0 = désactivé)" value={topK} min={0} max={12} step={1} onChange={setTopK} display={topK === 0 ? "off" : String(topK)} />
        <Slider label="top-p (noyau)" value={topP} min={0.05} max={1} step={0.05} onChange={setTopP} display={fmt(topP, 2)} />
      </div>
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
        <div>
          <p className="mb-3 font-display text-lg font-bold">
            « {SAMPLING_PROMPT} <span className="text-mod-deep">…</span> »
          </p>
          <ul className="space-y-1.5">
            {CANDIDATES.map(([w], i) => (
              <li key={w} className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2 text-sm">
                <span className={clsx("font-semibold", d.final[i] === 0 && "text-muted line-through decoration-1")}>{w}</span>
                <span className="relative h-4 overflow-hidden rounded bg-sunken">
                  <span className="absolute inset-y-0 left-0 rounded bg-neg/40" style={{ width: `${d.raw[i] * 100}%` }} />
                  <span className="absolute inset-y-0 left-0 rounded transition-[width] duration-200" style={{ width: `${d.final[i] * 100}%`, background: "var(--mod)" }} />
                </span>
                <span className="num text-right text-xs">{d.final[i] > 0 ? `${fmt(d.final[i] * 100, 1)} %` : "0"}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Gris clair : probabilité après la température seule. Couleur : après top-k et top-p, renormalisée.</p>
        </div>
        <div className="space-y-3 self-start">
          <Readout label="Mots encore possibles" value={`${d.kept} / ${CANDIDATES.length}`} strong />
          <LabButton primary onClick={() => setSeed((s) => s + 1)}>
            <span className="flex items-center gap-1.5"><Dices size={15} /> Générer 12 fois</span>
          </LabButton>
          {draws.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {draws.map((k, i) => (
                <span key={i} className="rounded-lg bg-paper px-2 py-1 text-sm font-semibold">{CANDIDATES[k][0]}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </LabFrame>
  );
}

// ============================================================ Inférence

const CTXS = [1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072];

/** Mémoire GPU (poids + KV cache) et débit de génération estimé. */
export function InferenceLab({ id = "inference", challenge }: { id?: string; challenge?: string }) {
  const [c, setC] = useState<InfConfig>({ model: "70B", precision: "fp16", gqa: false, ctx: 32768, batch: 1, gpu: "80 Go" });
  const set = <K extends keyof InfConfig>(k: K) => (v: InfConfig[K]) => setC((x) => ({ ...x, [k]: v }));
  const b = inferenceBudget(c);
  const cap = c.gpu === "80 Go" ? 80 : 24;
  const solved = challenge ? CHALLENGES[challenge].check({ model: c.model, ctx: c.ctx, fits: b.fits, gpu: c.gpu }) : false;
  const scaleMax = Math.max(cap, b.total) * 1.05;

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <Segmented label="Modèle" value={c.model} onChange={set("model")} options={[{ value: "8B", label: "8 milliards" }, { value: "70B", label: "70 milliards" }]} />
        <Segmented label="GPU" value={c.gpu} onChange={set("gpu")} options={[{ value: "24 Go", label: "24 Go (grand public)" }, { value: "80 Go", label: "80 Go (datacenter)" }]} />
        <Segmented label="Précision des poids" value={c.precision} onChange={set("precision")} options={[{ value: "fp16", label: "16 bits" }, { value: "int8", label: "8 bits" }, { value: "int4", label: "4 bits" }]} />
        <Segmented label="Têtes key/value" value={c.gqa ? "gqa" : "mha"} onChange={(v) => set("gqa")(v === "gqa")} options={[{ value: "mha", label: "Une par tête (MHA)" }, { value: "gqa", label: "8 partagées (GQA)" }]} />
        <Slider label="Contexte par séquence" value={CTXS.indexOf(c.ctx)} min={0} max={CTXS.length - 1} step={1} onChange={(i) => set("ctx")(CTXS[i])} display={`${(c.ctx / 1024).toLocaleString("fr-FR")} k tokens`} />
        <Slider label="Séquences en parallèle (batch)" value={c.batch} min={1} max={32} step={1} onChange={set("batch")} display={String(c.batch)} />
      </div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-display text-lg font-bold">Mémoire du GPU</h4>
        <span className={clsx("text-sm font-bold", b.fits ? "text-good" : "text-[#9c2a10]")}>{b.fits ? "Ça tient." : `Il manque ${fmt(b.total - cap, 1)} Go.`}</span>
      </div>
      <div className="relative h-10 overflow-hidden rounded-xl bg-sunken">
        <span className="absolute inset-y-0 left-0" style={{ width: `${(b.weights / scaleMax) * 100}%`, background: "#2a78d6" }} />
        <span className="absolute inset-y-0" style={{ left: `${(b.weights / scaleMax) * 100}%`, width: `${(b.kv / scaleMax) * 100}%`, background: "#d97706" }} />
        <span className="absolute inset-y-0" style={{ left: `${((b.weights + b.kv) / scaleMax) * 100}%`, width: `${(1.5 / scaleMax) * 100}%`, background: "#a8adc4" }} />
        <span className="absolute inset-y-0 w-[3px] bg-ink" style={{ left: `${(cap / scaleMax) * 100}%` }} title="Capacité du GPU" />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#2a78d6]" /> poids {fmt(b.weights, 1)} Go</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#d97706]" /> KV cache {fmt(b.kv, 1)} Go</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#a8adc4]" /> activations, marge</span>
        <span className="flex items-center gap-1"><span className="h-3 w-[3px] bg-ink" /> capacité {cap} Go</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Readout label="KV cache par token" value={`${fmt(b.kvPerTokenMB * 1000, 0)} Ko`} sub="2 × couches × têtes KV × 128 × 2 octets" />
        <Readout label="Vitesse d'une séquence" value={`≈ ${Math.round(b.tokPerSeq)} tok/s`} />
        <Readout label="Débit total du GPU" value={`≈ ${Math.round(b.tokTotal)} tok/s`} strong sub="le décodage est limité par la lecture mémoire" />
      </div>
    </LabFrame>
  );
}

// ============================================================ RAG

/** Recherche dans le guide du service client : découpage, k, réécriture de la question, et ce qui part dans le prompt. */
export function RagLab({ id = "rag", challenge }: { id?: string; challenge?: string }) {
  const [qi, setQi] = useState(1);
  const [g, setG] = useState<Granularity>("page");
  const [k, setK] = useState(1);
  const [expand, setExpand] = useState<"non" | "oui">("non");
  const ex = expand === "oui";
  const q = RAG_QUESTIONS[qi];
  const hits = retrieve(q.q, g, k, ex);
  const evalAll = ragEval(g, k, ex);
  const solved = challenge ? CHALLENGES[challenge].check({ recall: evalAll.recall, avgTokens: evalAll.avgTokens }) : false;

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-5">
        <div className="mb-2 text-sm font-semibold text-muted">Question de l'utilisateur</div>
        <div className="flex flex-wrap gap-1.5">
          {RAG_QUESTIONS.map((x, i) => (
            <button
              key={i}
              onClick={() => setQi(i)}
              className={clsx("rounded-xl border-2 px-3 py-1.5 text-left text-sm font-semibold transition-colors", i === qi ? "border-mod bg-mod text-white" : "border-line bg-surface hover:border-mod")}
            >
              {x.q}
              <span className="ml-1.5">{evalAll.runs[i].found ? "✓" : "✗"}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="mb-6 grid gap-x-8 gap-y-4 sm:grid-cols-3">
        <Segmented label="Découpage du document" value={g} onChange={setG} options={[{ value: "phrase", label: "Phrases" }, { value: "paragraphe", label: "Paragraphes" }, { value: "page", label: "Pages" }]} />
        <Slider label="Morceaux récupérés k" value={k} min={1} max={5} step={1} onChange={setK} display={String(k)} />
        <Segmented label="Réécrire la question" value={expand} onChange={setExpand} options={[{ value: "non", label: "Non" }, { value: "oui", label: "Oui" }]} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] [&>*]:min-w-0">
        <div>
          {ex && <p className="mb-2 text-xs text-muted">Requête envoyée au moteur : <span className="font-mono">{expandQuery(q.q)}</span></p>}
          <ol className="space-y-2">
            {hits.map((h, i) => {
              const good = containsAnswer(h.chunk, q.answer);
              return (
                <li key={i} className={clsx("rounded-xl border-2 p-3 text-sm", good ? "border-good-bg bg-[#f6fef9]" : "border-line bg-surface")}>
                  <div className="mb-1 flex items-center justify-between text-xs font-semibold text-muted">
                    <span>n° {i + 1} · similarité <span className="num">{fmt(h.score, 2)}</span></span>
                    <span>{tokenCount(h.chunk.text)} tokens {good && <span className="text-good">· contient la réponse</span>}</span>
                  </div>
                  <p className="leading-snug">{h.chunk.text}</p>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="space-y-2 self-start">
          <Readout label="Rappel sur les 4 questions" value={`${Math.round(evalAll.recall * 100)} %`} strong sub="le bon passage est-il dans les k morceaux ?" />
          <Readout label="Contexte moyen envoyé au LLM" value={`${Math.round(evalAll.avgTokens)} tokens`} sub="coût, latence, et risque de diluer l'information" />
          <p className="text-xs text-muted">Recherche lexicale TF-IDF (similarité cosinus). Un vrai système combine souvent embeddings et mots-clés.</p>
        </div>
      </div>
    </LabFrame>
  );
}
