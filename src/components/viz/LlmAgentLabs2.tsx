"use client";

import { useState } from "react";
import { judgeCalls, judgeWinRate, JUDGE_LENGTH_BIAS, JUDGE_N, JUDGE_POSITION_BIAS, JUDGE_TOLERANCE, TRUE_WIN_B, type JudgeOrder } from "@/lib/llm3";
import { LAUNCH_SECONDS, ORCH_MAX_SECONDS, ORCH_MAX_TOKENS, ORCH_TASKS, orchestrate, SYNTH_SECONDS, TASK_SECONDS } from "@/lib/agents2";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { LabFrame, Segmented } from "./controls";

const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")} %`;
const kTok = (v: number) => `${Math.round(v / 1000)} k`;

function Readout({ label, value, strong, sub }: { label: string; value: string; strong?: boolean; sub?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: strong ? "color-mix(in srgb, var(--mod) 10%, white)" : "var(--paper)" }}>
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className="num mt-0.5 text-xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

function Gauge({ value, max, label, ok }: { value: number; max: number; label: string; ok: boolean }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="num">{ok ? "dans le budget" : "hors budget"}</span>
      </div>
      <div className="relative h-3 rounded-full bg-sunken">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / (max * 2)) * 100)}%`, background: ok ? "#12b76a" : "#f97066" }} />
        <span className="absolute inset-y-[-3px] left-1/2 w-0.5 bg-ink" aria-hidden />
      </div>
    </div>
  );
}

// ============================================================ 1. LLM juge

const ORDER_LABEL: Record<JudgeOrder, string> = { "A-first": "A toujours en premier", "B-first": "B toujours en premier", both: "Les deux ordres, moyennés" };

/** Comparer deux modèles avec un LLM juge biaisé (position et longueur) : comment retrouver le vrai taux de victoire. */
export function JudgeLab({ id = "juge", challenge }: { id?: string; challenge?: string }) {
  const [order, setOrder] = useState<JudgeOrder>("A-first");
  const [lengthControl, setLengthControl] = useState(false);
  const est = judgeWinRate({ order, lengthControl, positionBias: JUDGE_POSITION_BIAS, lengthBias: JUDGE_LENGTH_BIAS });
  const solved = challenge ? CHALLENGES[challenge].check({ estimate: est, truth: TRUE_WIN_B }) : false;
  const err = est - TRUE_WIN_B;

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <p className="mb-4 rounded-2xl bg-paper px-4 py-3 text-[0.95rem]">
        {JUDGE_N} prompts. Pour chacun, le juge reçoit la réponse du modèle A (souvent plus longue) et celle du modèle B, et désigne la meilleure.
      </p>
      <div className="grid gap-5 sm:grid-cols-2 [&>*]:min-w-0">
        <Segmented label="Ordre de présentation au juge" value={order} onChange={setOrder} options={(Object.keys(ORDER_LABEL) as JudgeOrder[]).map((o) => ({ value: o, label: ORDER_LABEL[o] }))} />
        <Segmented
          label="Biais de longueur"
          value={lengthControl ? "on" : "off"}
          onChange={(v) => setLengthControl(v === "on")}
          options={[{ value: "off", label: "Consigne simple" }, { value: "on", label: "Grille + longueur neutralisée" }]}
        />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Readout label="Taux de victoire de B (juge)" value={pct(est)} strong />
        <Readout label="Vrai taux (humains)" value={pct(TRUE_WIN_B)} />
        <Readout label="Erreur" value={`${err >= 0 ? "+" : "−"}${(Math.abs(err) * 100).toFixed(1).replace(".", ",")} pts`} sub={Math.abs(err) <= JUDGE_TOLERANCE ? "moins de 2 points" : "objectif : moins de 2 points"} />
        <Readout label="Appels au juge" value={String(judgeCalls(order))} />
      </div>
      <p className="mt-3 text-sm text-muted">
        Le juge simulé favorise la réponse qu'il lit en premier et les réponses longues. Le vrai taux est celui qu'obtiendraient des annotateurs humains attentifs.
      </p>
    </LabFrame>
  );
}

// ============================================================ 2. Orchestration

/** Un agent seul ou un orchestrateur avec des sous-agents parallèles : latence, tokens et taille de contexte. */
export function OrchestrationLab({ id = "orchestration", challenge }: { id?: string; challenge?: string }) {
  const [k, setK] = useState(0);
  const [compact, setCompact] = useState(false);
  const r = orchestrate({ subAgents: k, compact });
  const solved = challenge ? CHALLENGES[challenge].check({ seconds: r.seconds, tokens: r.tokens, maxSeconds: ORCH_MAX_SECONDS, maxTokens: ORCH_MAX_TOKENS }) : false;
  const loads = k ? Array.from({ length: k }, (_, i) => Math.floor(ORCH_TASKS / k) + (i < ORCH_TASKS % k ? 1 : 0)) : [ORCH_TASKS];

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <p className="mb-4 rounded-2xl bg-paper px-4 py-3 text-[0.95rem]">
        <b>Tâche :</b> « Rédige une note de veille sur nos 6 concurrents. » Chaque recherche prend {TASK_SECONDS} s et ramène environ 8 000 tokens de résultats ; la synthèse prend {SYNTH_SECONDS} s.
      </p>
      <div className="grid gap-5 sm:grid-cols-2 [&>*]:min-w-0">
        <Segmented
          label="Architecture"
          value={String(k)}
          onChange={(v) => setK(Number(v))}
          options={[{ value: "0", label: "Un seul agent" }, ...[2, 3, 6].map((n) => ({ value: String(n), label: `${n} sous-agents` }))]}
        />
        <Segmented
          label="Ce que les sous-agents renvoient"
          value={compact ? "on" : "off"}
          onChange={(v) => setCompact(v === "on")}
          options={[{ value: "off", label: "Tous les résultats" }, { value: "on", label: "Un résumé de 600 tokens" }]}
        />
      </div>

      <div className="mt-5 space-y-1.5">
        {loads.map((m, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-24 shrink-0 font-semibold text-muted">{k ? `Sous-agent ${i + 1}` : "Agent unique"}</span>
            <div className="flex flex-1 gap-0.5">
              {Array.from({ length: m }, (_, j) => (
                <span key={j} className="h-5 rounded" style={{ width: `${(TASK_SECONDS / (ORCH_TASKS * TASK_SECONDS + SYNTH_SECONDS)) * 100}%`, background: "var(--mod)", opacity: 0.75 }} />
              ))}
              {!k && <span className="h-5 rounded bg-ink" style={{ width: `${(SYNTH_SECONDS / (ORCH_TASKS * TASK_SECONDS + SYNTH_SECONDS)) * 100}%` }} />}
            </div>
          </div>
        ))}
        {k > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="w-24 shrink-0 font-semibold text-muted">Orchestrateur</span>
            <div className="flex flex-1 gap-0.5">
              <span className="h-5" style={{ width: `${((Math.max(...loads) * TASK_SECONDS + k * LAUNCH_SECONDS) / (ORCH_TASKS * TASK_SECONDS + SYNTH_SECONDS)) * 100}%` }} />
              <span className="h-5 rounded bg-ink" style={{ width: `${(SYNTH_SECONDS / (ORCH_TASKS * TASK_SECONDS + SYNTH_SECONDS)) * 100}%` }} />
            </div>
          </div>
        )}
        <p className="pt-1 text-xs text-muted">Barres colorées : recherches. Barre foncée : synthèse. Les sous-agents travaillent en parallèle.</p>
      </div>

      <div className="mt-5 grid gap-6 md:grid-cols-2 [&>*]:min-w-0">
        <div className="space-y-4">
          <Gauge label={`Latence : ${r.seconds} s (budget ${ORCH_MAX_SECONDS} s)`} value={r.seconds} max={ORCH_MAX_SECONDS} ok={r.seconds <= ORCH_MAX_SECONDS} />
          <Gauge label={`Tokens d'entrée : ${kTok(r.tokens)} (budget ${kTok(ORCH_MAX_TOKENS)})`} value={r.tokens} max={ORCH_MAX_TOKENS} ok={r.tokens <= ORCH_MAX_TOKENS} />
        </div>
        <div className="grid grid-cols-2 content-start gap-2">
          <Readout label="Plus gros contexte" value={`${kTok(r.contextPeak)} tokens`} />
          <Readout label="Appels de modèle" value={String(k ? ORCH_TASKS + 2 : ORCH_TASKS + 1)} />
        </div>
      </div>
    </LabFrame>
  );
}
