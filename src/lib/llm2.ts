// Calculs des labos LLM (suite) : taille d'un Transformer, LoRA, sampling, mémoire d'inférence, RAG.
import { mulberry32 } from "./metrics";

// ============================================================ Taille d'un Transformer décodeur

export type Arch = {
  d: number; // dimension du modèle
  L: number; // nombre de blocs
  V: number; // taille du vocabulaire
  ctx: number; // contexte maximal
  ffn: "gelu4" | "swiglu83" | "swiglu35"; // type et largeur du MLP
  pos: "learned" | "rope";
  tied: boolean; // matrice de sortie partagée avec les embeddings
  gqa: 1 | 8; // têtes de query par tête de key/value (1 = attention multi-têtes classique)
};

export const ffDim = (a: Pick<Arch, "d" | "ffn">) =>
  a.ffn === "gelu4" ? 4 * a.d : a.ffn === "swiglu35" ? Math.round(3.5 * a.d) : Math.ceil((8 * a.d) / 3 / 256) * 256;

/** Nombre de paramètres, poste par poste. Style GPT-2 (GELU) : biais et LayerNorm ; style Llama (SwiGLU) : sans biais, RMSNorm. */
export function countParams(a: Arch) {
  const gpt = a.ffn === "gelu4";
  const ff = ffDim(a);
  const kv = a.d / a.gqa;
  const embeddings = a.V * a.d + (a.pos === "learned" ? a.ctx * a.d : 0);
  const attention = a.L * (2 * a.d * a.d + 2 * a.d * kv + (gpt ? 2 * a.d + 2 * kv : 0));
  const mlp = a.L * (gpt ? 2 * a.d * ff + ff + a.d : 3 * a.d * ff);
  const norms = (2 * a.L + 1) * (gpt ? 2 * a.d : a.d);
  const head = a.tied ? 0 : a.V * a.d;
  const total = embeddings + attention + mlp + norms + head;
  return { embeddings, attention, mlp, norms, head, total };
}

export const PRESETS: Record<string, Arch> = {
  "Llama 2 7B": { d: 4096, L: 32, V: 32000, ctx: 4096, ffn: "swiglu83", pos: "rope", tied: false, gqa: 1 },
  "Llama 3 70B": { d: 8192, L: 80, V: 128256, ctx: 8192, ffn: "swiglu35", pos: "rope", tied: false, gqa: 8 },
};
export const GPT2_SMALL: Arch = { d: 768, L: 12, V: 50257, ctx: 1024, ffn: "gelu4", pos: "learned", tied: true, gqa: 1 };

// ============================================================ LoRA : approximation de rang faible

/** Valeurs et vecteurs propres d'une matrice symétrique (méthode de Jacobi). */
export function symEig(S0: number[][]) {
  const n = S0.length;
  const A = S0.map((r) => [...r]);
  const V: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] ** 2;
    if (off < 1e-18) break;
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-15) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p], akq = A[k][q];
          A[k][p] = c * akp - s * akq;
          A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k], aqk = A[q][k];
          A[p][k] = c * apk - s * aqk;
          A[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p], vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq;
          V[k][q] = s * vkp + c * vkq;
        }
      }
  }
  const order = A.map((r, i) => [r[i], i] as const).sort((x, y) => y[0] - x[0]);
  return { values: order.map(([v]) => v), vectors: order.map(([, i]) => V.map((r) => r[i])) };
}

export const LORA_N = 32;

/** La « mise à jour » ΔW d'un fine-tuning : quelques directions fortes, plus un bruit faible. */
export function makeDelta(n = LORA_N, seed = 6): number[][] {
  const r = mulberry32(seed);
  const comps: { u: number[]; v: number[]; s: number }[] = [
    { u: Array.from({ length: n }, (_, i) => Math.sin((i / n) * Math.PI)), v: Array.from({ length: n }, (_, j) => Math.cos((j / n) * Math.PI)), s: 9 },
    { u: Array.from({ length: n }, (_, i) => (i < n / 2 ? 1 : -1) * 0.7), v: Array.from({ length: n }, (_, j) => Math.sin((2 * j * Math.PI) / n)), s: 6 },
    { u: Array.from({ length: n }, (_, i) => Math.cos((3 * i * Math.PI) / n)), v: Array.from({ length: n }, (_, j) => (j % 8 < 4 ? 0.8 : -0.8)), s: 4 },
    { u: Array.from({ length: n }, (_, i) => Math.sin((5 * i * Math.PI) / n)), v: Array.from({ length: n }, (_, j) => Math.cos((4 * j * Math.PI) / n)), s: 2 },
  ];
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => comps.reduce((acc, c) => acc + (c.s * c.u[i] * c.v[j]) / 4, 0) + 0.06 * (r() * 2 - 1)),
  );
}

/** Décomposition en valeurs singulières via les vecteurs propres de MᵀM ; approximations de rang r. */
export function lowRank(M: number[][]) {
  const n = M.length;
  const MtM = Array.from({ length: n }, (_, a) => Array.from({ length: n }, (_, b) => M.reduce((s, row) => s + row[a] * row[b], 0)));
  const { values, vectors } = symEig(MtM);
  const sig = values.map((v) => Math.sqrt(Math.max(v, 0)));
  const U = vectors.map((v, k) => M.map((row) => row.reduce((s, x, j) => s + x * v[j], 0) / (sig[k] || 1)));
  const energy = sig.reduce((s, x) => s + x * x, 0);
  return {
    sigma: sig,
    /** Erreur relative (norme de Frobenius) de la meilleure approximation de rang r. */
    error: (r: number) => Math.sqrt(sig.slice(r).reduce((s, x) => s + x * x, 0) / energy),
    approx: (r: number) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => sig.slice(0, r).reduce((s, sk, k) => s + sk * U[k][i] * vectors[k][j], 0))),
  };
}

// ============================================================ Sampling

export const SAMPLING_PROMPT = "Ce soir, je vais manger une";
export const CANDIDATES: [string, number][] = [
  ["pizza", 3.2], ["salade", 2.6], ["soupe", 2.2], ["crêpe", 1.9], ["omelette", 1.5], ["glace", 1.2],
  ["raclette", 0.9], ["banane", 0.3], ["voiture", -1.0], ["théière", -1.8], ["galaxie", -2.5], ["équation", -3.0],
];

/** Pipeline de décodage : température, puis top-k (0 = désactivé), puis top-p, puis renormalisation. */
export function samplingDist(T: number, topK: number, topP: number) {
  const logits = CANDIDATES.map(([, l]) => l);
  const m = Math.max(...logits);
  const e = logits.map((l) => Math.exp((l - m) / Math.max(T, 1e-6)));
  const s = e.reduce((a, b) => a + b, 0);
  const raw = e.map((v) => v / s);
  const order = raw.map((p, i) => [p, i] as const).sort((a, b) => b[0] - a[0]);
  const keep = new Set<number>();
  let cum = 0;
  for (const [p, i] of order) {
    if (topK > 0 && keep.size >= topK) break;
    if (keep.size > 0 && cum >= topP - 1e-12) break;
    keep.add(i);
    cum += p;
  }
  const z = [...keep].reduce((a, i) => a + raw[i], 0);
  return { raw, final: raw.map((p, i) => (keep.has(i) ? p / z : 0)), kept: keep.size };
}

export function drawSamples(probs: number[], n: number, seed: number) {
  const r = mulberry32(seed);
  return Array.from({ length: n }, () => {
    let u = r();
    for (let i = 0; i < probs.length; i++) {
      u -= probs[i];
      if (u <= 0) return i;
    }
    return probs.findLastIndex((p) => p > 0);
  });
}

// ============================================================ Mémoire et débit d'inférence

export const INF_MODELS = {
  "8B": { params: 8.0e9, L: 32, heads: 32, dHead: 128 },
  "70B": { params: 70.6e9, L: 80, heads: 64, dHead: 128 },
} as const;
export type InfModel = keyof typeof INF_MODELS;
export const BYTES = { fp16: 2, int8: 1, int4: 0.5 } as const;
export const GPUS = { "24 Go": { mem: 24, bw: 1.0 }, "80 Go": { mem: 80, bw: 3.35 } } as const; // Go, To/s

export type InfConfig = { model: InfModel; precision: keyof typeof BYTES; gqa: boolean; ctx: number; batch: number; gpu: keyof typeof GPUS };

/** Poids + KV cache (en fp16) en Go, et débit de génération estimé (le décodage est limité par la bande passante mémoire). */
export function inferenceBudget(c: InfConfig) {
  const m = INF_MODELS[c.model];
  const kvHeads = c.gqa ? 8 : m.heads;
  const weights = (m.params * BYTES[c.precision]) / 1e9;
  const kvPerToken = 2 * m.L * kvHeads * m.dHead * 2; // K et V, chaque couche, 2 octets
  const kv = (kvPerToken * c.ctx * c.batch) / 1e9;
  const gpu = GPUS[c.gpu];
  const total = weights + kv + 1.5; // + activations et marge du runtime
  // À chaque pas, on relit tous les poids (une fois pour le batch) et le cache de chaque séquence.
  const stepSeconds = (weights + kv) / (gpu.bw * 1000);
  return { weights, kv, kvPerTokenMB: kvPerToken / 1e6, total, fits: total <= gpu.mem, tokPerSeq: 1 / stepSeconds, tokTotal: c.batch / stepSeconds };
}

// ============================================================ RAG

export const RAG_DOC = [
  "Datamine Shop expédie ses commandes depuis Lyon. La livraison standard prend trois à cinq jours ouvrés. La livraison express, facturée 9,90 €, arrive le lendemain pour toute commande passée avant 14 h.",
  "La livraison standard est offerte dès 50 € d'achat. En dessous, elle coûte 4,90 €. Les frais de port ne sont jamais facturés deux fois pour une même commande, même livrée en plusieurs colis.",
  "Les retours sont acceptés pendant 30 jours après la réception du colis. L'article doit être renvoyé dans son emballage d'origine, avec le bon de retour imprimé depuis l'espace client.",
  "Le remboursement est effectué sur le moyen de paiement d'origine, sous dix jours après réception du retour à l'entrepôt. Les frais de livraison initiaux ne sont pas remboursés, sauf si l'article est défectueux.",
  "Les produits Tech bénéficient d'une garantie de deux ans. En cas de panne, le client ouvre une demande de garantie depuis son espace client et joint une photo du numéro de série.",
  "Le paiement est possible par carte bancaire, PayPal ou virement. Le paiement en trois fois sans frais est proposé à partir de 150 € d'achat, uniquement par carte bancaire.",
  "Le programme de fidélité attribue un point par euro dépensé. Cent points donnent droit à un bon d'achat de cinq euros, valable six mois sur tout le site.",
  "Le service client répond par chat du lundi au samedi, de 9 h à 19 h. Les demandes envoyées par e-mail reçoivent une réponse sous 48 heures ouvrées.",
  "Une commande peut être modifiée ou annulée tant qu'elle n'est pas expédiée, depuis la page « Mes commandes ». Une fois le colis parti, il faut attendre la livraison puis faire un retour.",
  "Les données personnelles sont hébergées en France et ne sont jamais revendues. Le client peut demander la suppression de son compte à tout moment depuis les paramètres.",
];

export const RAG_QUESTIONS = [
  { q: "Combien coûte la livraison express ?", answer: [0, 2] }, // [paragraphe, phrase]
  { q: "Puis-je renvoyer un article reçu il y a trois semaines ?", answer: [2, 0] },
  { q: "Quand serai-je remboursé ?", answer: [3, 0] },
  { q: "Peut-on payer en plusieurs fois ?", answer: [5, 1] },
] as const;

const STOP = new Set(
  "le la les l un une des de du d et en à a au aux pour par sur dans avec sans est sont son sa ses ce cette qui que quoi il elle on je j me se s y ne n pas plus tout toute tous depuis puis peut puis-je combien quand comment être".split(" "),
);
const strip = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Mots normalisés : minuscules, sans accents, sans mots vides, pluriels simples retirés. */
export const terms = (s: string) =>
  strip(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => (w.length > 3 && /[sx]$/.test(w) ? w.slice(0, -1) : w));

/** Réécriture de la question, comme le ferait un LLM avant la recherche : on ajoute les synonymes du domaine. */
const EXPANSIONS: Record<string, string> = {
  renvoyer: "retour retours",
  rembourse: "remboursement",
  payer: "paiement",
  plusieurs: "trois fois",
  cout: "coute facture",
};
export const expandQuery = (q: string) => [q, ...terms(q).map((t) => EXPANSIONS[t] ?? "")].join(" ").trim();

export type Granularity = "phrase" | "paragraphe" | "page";
export type Chunk = { text: string; para: number; sentences: number[] }; // indices des phrases du paragraphe

const sentencesOf = (p: string) => p.match(/[^.!?]+[.!?]/g)!.map((s) => s.trim());

export function chunkDoc(g: Granularity): Chunk[] {
  if (g === "phrase") return RAG_DOC.flatMap((p, para) => sentencesOf(p).map((text, i) => ({ text, para, sentences: [i] })));
  if (g === "paragraphe") return RAG_DOC.map((text, para) => ({ text, para, sentences: sentencesOf(text).map((_, i) => i) }));
  // Pages de trois paragraphes : on garde le paragraphe de départ, et toutes ses phrases comptent.
  const out: Chunk[] = [];
  for (let i = 0; i < RAG_DOC.length; i += 3) out.push({ text: RAG_DOC.slice(i, i + 3).join(" "), para: i, sentences: [-1] });
  return out;
}

export const tokenCount = (s: string) => Math.round(s.split(/\s+/).length * 1.3);

/** Recherche TF-IDF (cosinus) : renvoie les k meilleurs morceaux et leur score. */
export function retrieve(question: string, g: Granularity, k: number, expand: boolean) {
  const chunks = chunkDoc(g);
  const docs = chunks.map((c) => terms(c.text));
  const df = new Map<string, number>();
  docs.forEach((d) => new Set(d).forEach((t) => df.set(t, (df.get(t) ?? 0) + 1)));
  const idf = (t: string) => Math.log((1 + chunks.length) / (1 + (df.get(t) ?? 0))) + 1;
  const vec = (ws: string[]) => {
    const v = new Map<string, number>();
    ws.forEach((w) => v.set(w, (v.get(w) ?? 0) + 1));
    for (const [w, n] of v) v.set(w, n * idf(w));
    return v;
  };
  const norm = (v: Map<string, number>) => Math.sqrt([...v.values()].reduce((s, x) => s + x * x, 0)) || 1;
  const qv = vec(terms(expand ? expandQuery(question) : question));
  const scored = docs.map((d, i) => {
    const dv = vec(d);
    let dotp = 0;
    for (const [w, x] of qv) dotp += x * (dv.get(w) ?? 0);
    return { chunk: chunks[i], score: dotp / (norm(qv) * norm(dv)) };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, k);
}

/** Le morceau contient-il la phrase qui répond ? */
export const containsAnswer = (c: Chunk, answer: readonly [number, number]) =>
  g_contains(c, answer);
function g_contains(c: Chunk, [para, sent]: readonly [number, number]) {
  if (c.sentences[0] === -1) return para >= c.para && para < c.para + 3;
  return c.para === para && c.sentences.includes(sent);
}

/** Rappel sur les 4 questions et taille moyenne du contexte envoyé au LLM. */
export function ragEval(g: Granularity, k: number, expand: boolean) {
  const runs = RAG_QUESTIONS.map((q) => {
    const hits = retrieve(q.q, g, k, expand);
    return { found: hits.some((h) => containsAnswer(h.chunk, q.answer)), tokens: hits.reduce((s, h) => s + tokenCount(h.chunk.text), 0) };
  });
  return { recall: runs.filter((r) => r.found).length / runs.length, avgTokens: runs.reduce((s, r) => s + r.tokens, 0) / runs.length, runs };
}
