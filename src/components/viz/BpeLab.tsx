"use client";

import { useMemo, useState } from "react";
import { BPE_CORPUS, BPE_MAX, baseVocab, encodeBpe, preTokenize, SPACE, trainBpe } from "@/lib/llm";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { LabFrame, Slider } from "./controls";

let mergesCache: ReturnType<typeof trainBpe> | null = null;
const getMerges = () => (mergesCache ??= trainBpe(BPE_CORPUS, BPE_MAX));
const CORPUS_CHARS = preTokenize(BPE_CORPUS).join("").length;
const BASE = baseVocab(BPE_CORPUS);
const TINTS = ["#dbeafe", "#fde2d3", "#d1fadf", "#ede9fe", "#fce7f3", "#fef3c7"];
const fmt = (v: number, d = 2) => v.toFixed(d).replace(".", ",");

/** Tokenizer BPE entraîné en direct sur un petit corpus : chaque fusion crée un nouveau token. */
export function BpeLab({ id = "bpe", merges: m0 = 0, text: t0 = "Le modèle apprend à prédire le prochain token.", challenge }: { id?: string; merges?: number; text?: string; challenge?: string }) {
  const merges = getMerges();
  const [k, setK] = useState(Math.min(m0, merges.length));
  const [text, setText] = useState(t0);
  const tokens = useMemo(() => encodeBpe(text, merges, k), [text, merges, k]);
  const corpusTokens = useMemo(() => encodeBpe(BPE_CORPUS, merges, k).length, [merges, k]);
  const ratio = CORPUS_CHARS / corpusTokens;
  const words = preTokenize(text).length;
  const solved = challenge ? CHALLENGES[challenge].check({ merges: k, ratio, words, tokens: tokens.length, allMerges: k === merges.length }) : false;

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-5 max-w-xl">
        <Slider label="Fusions apprises" value={k} min={0} max={merges.length} step={1} onChange={setK} display={`${k} / ${merges.length}`} />
      </div>

      <label className="mb-2 block text-sm font-semibold text-muted" htmlFor={`${id}-text`}>
        Texte à découper (modifiable)
      </label>
      <textarea
        id={`${id}-text`}
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, 280))}
        rows={2}
        className="w-full rounded-xl border-2 border-line bg-surface px-3 py-2 text-[0.95rem] outline-none focus:border-mod"
      />
      <div className="mt-3 flex flex-wrap gap-1 rounded-2xl bg-paper p-3" aria-label={`${tokens.length} tokens`}>
        {tokens.map((t, i) => (
          <span key={i} className="rounded-md px-1.5 py-0.5 font-mono text-[0.9rem] text-ink" style={{ background: TINTS[i % TINTS.length] }}>
            {t.startsWith(SPACE) ? (
              <>
                <span className="text-muted/60">·</span>
                {t.slice(1)}
              </>
            ) : (
              t
            )}
          </span>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted">Un point · marque l'espace qui précède un mot : il fait partie du token.</p>

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Tokens dans ton texte" value={String(tokens.length)} strong />
        <Stat label="Taille du vocabulaire" value={String(BASE + k)} />
        <Stat label="Tokens du corpus" value={String(corpusTokens)} />
        <Stat label="Caractères par token" value={fmt(ratio)} />
      </div>

      {k > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-sm font-semibold text-muted">Dernières fusions apprises</div>
          <ul className="flex flex-wrap gap-1.5">
            {merges
              .slice(Math.max(0, k - 8), k)
              .reverse()
              .map(([a, b], i) => (
                <li key={i} className="rounded-lg border border-line bg-surface px-2 py-1 font-mono text-xs">
                  {show(a)} + {show(b)} → <b>{show(a + b)}</b>
                </li>
              ))}
          </ul>
        </div>
      )}
    </LabFrame>
  );
}

const show = (t: string) => t.replaceAll(SPACE, "·");

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl p-3" style={{ background: strong ? "color-mix(in srgb, var(--mod) 10%, white)" : "var(--paper)" }}>
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="num mt-0.5 text-xl font-bold">{value}</div>
    </div>
  );
}
