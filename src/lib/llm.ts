// Calculs des labos LLM : tokenisation BPE et self-attention. Purs et déterministes.
import { normals } from "./metrics";

// ============================================================ BPE (byte pair encoding, version caractères)

/** Petit corpus d'entraînement du tokenizer (texte original). */
export const BPE_CORPUS = `Le modèle lit le texte morceau par morceau. Chaque morceau est un token, et chaque token reçoit un numéro.
Pour entraîner un modèle de langue, on lui montre des milliards de phrases et il apprend à prédire le token suivant.
Les données sont nettoyées, puis découpées en tokens, puis transformées en vecteurs.
Un bon tokenizer découpe les mots fréquents en un seul token et les mots rares en plusieurs morceaux.
Les mots les plus fréquents de la langue française, comme le, la, les, de, des, et, est, un, une, reviennent sans cesse.
On parle de données d'entraînement, de données de test, de données de validation.
Le modèle prédit, le modèle apprend, le modèle se trompe, puis le modèle corrige ses erreurs.
Les phrases longues contiennent plus de tokens, et chaque token coûte du calcul et de l'argent.
Entraîner, entraînement, entraîné : ces mots partagent le même début, et le tokenizer le remarque.
Prédire, prédiction, prédit : là encore, un morceau commun apparaît.
La tokenisation transforme le texte en une suite de nombres que le réseau peut traiter.
Un token correspond en moyenne à quelques caractères, souvent un mot court ou une partie de mot long.
Les chiffres, la ponctuation et les espaces comptent aussi comme des tokens.
Le modèle ne voit jamais les lettres : il ne voit que des numéros de tokens.
C'est pour cela qu'il a parfois du mal à compter les lettres d'un mot.
Plus le vocabulaire est grand, plus les phrases sont courtes en tokens, mais plus la table des embeddings est grosse.
Les modèles récents utilisent des vocabulaires de cinquante mille à deux cent mille tokens.
Une langue peu présente dans les données d'entraînement est découpée en plus de tokens, donc elle coûte plus cher.`;

export const SPACE = "▁";

/** Pré-découpage : chaque mot (précédé de son espace, noté ▁) est traité séparément. */
export const preTokenize = (text: string) =>
  text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => SPACE + w);

export type Merge = [string, string];

/** Apprend jusqu'à `max` fusions : à chaque étape, la paire de symboles adjacents la plus fréquente devient un symbole. */
export function trainBpe(corpus: string, max: number): Merge[] {
  const counts = new Map<string, number>();
  for (const w of preTokenize(corpus)) counts.set(w, (counts.get(w) ?? 0) + 1);
  let words = [...counts].map(([w, n]) => ({ sym: [...w], n }));
  const merges: Merge[] = [];
  for (let m = 0; m < max; m++) {
    const pairs = new Map<string, number>();
    for (const { sym, n } of words)
      for (let i = 0; i < sym.length - 1; i++) {
        const k = sym[i] + "\u0000" + sym[i + 1];
        pairs.set(k, (pairs.get(k) ?? 0) + n);
      }
    let best: string | null = null, bestN = 1;
    for (const [k, n] of pairs) if (n > bestN || (n === bestN && best !== null && k < best)) [best, bestN] = [k, n];
    if (best === null) break;
    const [a, b] = best.split("\u0000");
    merges.push([a, b]);
    words = words.map(({ sym, n }) => {
      const out: string[] = [];
      for (let i = 0; i < sym.length; i++) {
        if (i < sym.length - 1 && sym[i] === a && sym[i + 1] === b) {
          out.push(a + b);
          i++;
        } else out.push(sym[i]);
      }
      return { sym: out, n };
    });
  }
  return merges;
}

/** Encode un texte avec les `k` premières fusions (on applique toujours la fusion de plus petit rang possible). */
export function encodeBpe(text: string, merges: Merge[], k = merges.length): string[] {
  const rank = new Map(merges.slice(0, k).map(([a, b], i) => [a + "\u0000" + b, i]));
  return preTokenize(text).flatMap((w) => {
    let sym = [...w];
    for (;;) {
      let bestI = -1, bestR = Infinity;
      for (let i = 0; i < sym.length - 1; i++) {
        const r = rank.get(sym[i] + "\u0000" + sym[i + 1]);
        if (r !== undefined && r < bestR) [bestI, bestR] = [i, r];
      }
      if (bestI < 0) return sym;
      sym = [...sym.slice(0, bestI), sym[bestI] + sym[bestI + 1], ...sym.slice(bestI + 2)];
    }
  });
}

export const BPE_MAX = 300;
export const baseVocab = (corpus: string) => new Set([...preTokenize(corpus).join("")]).size;

// ============================================================ Self-attention

export function softmax(xs: number[], temperature = 1) {
  const m = Math.max(...xs.filter(Number.isFinite));
  const e = xs.map((x) => (Number.isFinite(x) ? Math.exp((x - m) / temperature) : 0));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

export const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);

/** Phrase d'exemple et « clés » 2D choisies à la main : proches quand les mots se répondent. */
export const ATTN_TOKENS = ["Le", "chat", "dort", "car", "il", "est", "fatigué"];
export const ATTN_KEYS: [number, number][] = [
  [-0.55, -0.35], // Le
  [0.95, 0.45], // chat : un nom animé, ce que cherche un pronom
  [-0.2, 0.95], // dort : un verbe
  [-0.85, 0.25], // car
  [0.4, -0.75], // il
  [-0.45, 0.6], // est
  [0.15, 1.0], // fatigué : un état
];
export const ATTN_SOURCE = 4; // « il » est le token qui interroge

/** Poids d'attention d'une requête 2D (angle en degrés, norme) sur les clés, divisés par √d (d = 2). */
export function steeredWeights(angleDeg: number, norm: number) {
  const q = [norm * Math.cos((angleDeg * Math.PI) / 180), norm * Math.sin((angleDeg * Math.PI) / 180)];
  return softmax(ATTN_KEYS.map((k) => dot(q, k) / Math.SQRT2));
}

/**
 * Matrice d'attention en dimension d : Q et K aléatoires (gaussiens), plus un peu de structure.
 * Sans la division par √d, les scores ont un écart-type ≈ √d et le softmax sature.
 */
export function attentionMatrix(n: number, d: number, scaled: boolean, causal: boolean, seed = 5) {
  const z = normals(2 * n * d, seed);
  const Q = Array.from({ length: n }, (_, i) => z.slice(i * d, (i + 1) * d));
  const K = Array.from({ length: n }, (_, i) => z.slice((n + i) * d, (n + i + 1) * d));
  return Q.map((q, i) =>
    softmax(K.map((k, j) => (causal && j > i ? -Infinity : dot(q, k) / (scaled ? Math.sqrt(d) : 1)))),
  );
}

/** Entropie moyenne des lignes, normalisée (1 = attention uniforme, 0 = un seul token). */
export function meanEntropy(A: number[][]) {
  return (
    A.reduce((s, row) => {
      const nz = row.filter((p) => p > 0);
      const h = -nz.reduce((t, p) => t + p * Math.log(p), 0);
      return s + (nz.length > 1 ? h / Math.log(nz.length) : 0);
    }, 0) / A.length
  );
}
