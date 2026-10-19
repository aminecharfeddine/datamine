"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check, Play, RotateCcw, ShieldCheck, ShieldAlert, X } from "lucide-react";
import {
  actionText, AGENT_ANSWER, AGENT_BASE_TOKENS, AGENT_TASK, assembleContext, checkToolCall, EVAL_TASKS, GUARDS, INBOX, LYON, runAgentTool, runEval,
  securityOutcome, TOOL_REQUESTS, TOOLS, turnTokens, type AgentAction, type ContextStrategy, type Guard, type ToolCheck,
} from "@/lib/agents";
import { SHOP, VILLES } from "@/lib/practice";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { Highlighted } from "@/components/code/Code";
import { LabButton, LabFrame, Segmented } from "./controls";

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

// ============================================================ 1. Tool use

const TEMPLATE = '{\n  "name": "",\n  "arguments": {}\n}';
const toolJson = (t: (typeof TOOLS)[number]) =>
  JSON.stringify({ name: t.name, description: t.description, parameters: t.parameters }, null, 2);

/** Tu joues le modèle : à toi d'écrire l'appel d'outil en JSON. L'application le valide comme elle le ferait en production. */
export function ToolCallLab({ id = "tool-use", challenge }: { id?: string; challenge?: string }) {
  const [ri, setRi] = useState(0);
  const [drafts, setDrafts] = useState(TOOL_REQUESTS.map(() => TEMPLATE));
  const [results, setResults] = useState<(ToolCheck | null)[]>(TOOL_REQUESTS.map(() => null));
  const [showTool, setShowTool] = useState(0);
  const solved = results.filter((r) => r?.ok).length;
  const done = challenge ? CHALLENGES[challenge].check({ solved, total: TOOL_REQUESTS.length }) : false;
  const res = results[ri];

  const send = () => setResults((rs) => rs.map((r, i) => (i === ri ? checkToolCall(drafts[ri], TOOL_REQUESTS[ri]) : r)));

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={done} />}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] [&>*]:min-w-0">
        <div>
          <div className="mb-2 text-sm font-semibold text-muted">Outils déclarés au modèle (schémas JSON)</div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {TOOLS.map((t, i) => (
              <button key={t.name} onClick={() => setShowTool(i)} className={clsx("rounded-lg border-2 px-2.5 py-1 font-mono text-xs font-semibold", i === showTool ? "border-mod bg-mod text-white" : "border-line bg-surface")}>
                {t.name}
              </button>
            ))}
          </div>
          <pre className="max-h-80 overflow-auto rounded-2xl bg-[#171a2e] px-4 py-3">
            <Highlighted code={toolJson(TOOLS[showTool])} />
          </pre>
        </div>
        <div>
          <div className="mb-2 text-sm font-semibold text-muted">Message de l'utilisateur</div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {TOOL_REQUESTS.map((r, i) => (
              <button key={i} onClick={() => setRi(i)} className={clsx("flex items-center gap-1 rounded-xl border-2 px-3 py-1.5 text-sm font-semibold", i === ri ? "border-mod bg-mod text-white" : "border-line bg-surface")}>
                Demande {i + 1} {results[i]?.ok && <Check size={14} strokeWidth={3} />}
              </button>
            ))}
          </div>
          <p className="mb-3 rounded-2xl bg-paper px-4 py-3 text-[0.95rem]">« {TOOL_REQUESTS[ri].message} »</p>
          <label className="mb-1 block text-xs font-semibold text-muted" htmlFor={`${id}-call`}>Ton appel d'outil (JSON)</label>
          <textarea
            id={`${id}-call`}
            value={drafts[ri]}
            onChange={(e) => setDrafts((d) => d.map((x, i) => (i === ri ? e.target.value : x)))}
            spellCheck={false}
            rows={7}
            className="w-full rounded-2xl bg-[#171a2e] px-4 py-3 font-mono text-[0.86rem] leading-relaxed text-[#eef0fb] outline-none ring-2 ring-transparent focus:ring-mod"
          />
          <div className="mt-2 flex items-center gap-3">
            <LabButton primary onClick={send}>Envoyer à l'application</LabButton>
          </div>
          {res && (
            <div className={clsx("mt-3 rounded-xl px-4 py-3 text-sm", res.ok ? "bg-[#ecfdf3] text-[#05603a]" : "bg-[#fff4ed] text-[#9c2a10]")}>
              {res.ok ? (
                <p className="font-semibold">Appel valide, l'outil est exécuté. Son résultat sera renvoyé au modèle, qui rédigera la réponse.</p>
              ) : (
                <ul className="space-y-1">{res.errors.map((e, i) => <li key={i}>• {e}</li>)}</ul>
              )}
            </div>
          )}
        </div>
      </div>
    </LabFrame>
  );
}

// ============================================================ 2. Boucle d'agent

type Step = { action: AgentAction; obs: string; tokens: number };

/** Tu es la politique de l'agent : à chaque tour, choisis l'action ; les outils s'exécutent pour de vrai sur les données de la boutique. */
export function AgentLoopLab({ id = "agent-loop", challenge }: { id?: string; challenge?: string }) {
  const [tool, setTool] = useState<AgentAction["tool"]>("lister_clients");
  const [ville, setVille] = useState("Lyon");
  const [client, setClient] = useState(SHOP.clients[0].id);
  const [steps, setSteps] = useState<Step[]>([]);
  const answered = steps.find((s) => s.action.tool === "repondre")?.action as Extract<AgentAction, { tool: "repondre" }> | undefined;
  const observed = new Set(steps.filter((s) => s.action.tool === "total_depenses" || s.action.tool === "commandes_client").map((s) => (s.action as { client_id: number }).client_id));
  const coverage = LYON.every((c) => observed.has(c.id));
  const tokens = AGENT_BASE_TOKENS + steps.reduce((a, s) => a + s.tokens, 0);
  const solved = challenge ? CHALLENGES[challenge].check({ answered: answered?.client_id ?? null, correct: AGENT_ANSWER.id, steps: steps.length, coverage }) : false;

  const run = () => {
    if (answered) return;
    const action: AgentAction = tool === "lister_clients" ? { tool, ville } : { tool, client_id: client };
    const obs = runAgentTool(action);
    setSteps((s) => [...s, { action, obs, tokens: turnTokens(action, obs) }]);
  };

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <p className="mb-4 rounded-2xl bg-paper px-4 py-3 text-[0.95rem]"><b>Tâche de l'utilisateur :</b> « {AGENT_TASK} »</p>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr] [&>*]:min-w-0">
        <div className="space-y-4">
          <Segmented
            label="Prochaine action"
            value={tool}
            onChange={setTool}
            options={[
              { value: "lister_clients", label: "lister_clients" },
              { value: "total_depenses", label: "total_depenses" },
              { value: "commandes_client", label: "commandes_client" },
              { value: "repondre", label: "repondre" },
            ]}
          />
          {tool === "lister_clients" ? (
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
              ville
              <select value={ville} onChange={(e) => setVille(e.target.value)} className="rounded-xl border-2 border-line bg-surface px-2 py-1.5 text-sm font-semibold text-ink">
                {VILLES.map((v) => <option key={v}>{v}</option>)}
              </select>
            </label>
          ) : (
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
              client_id
              <select value={client} onChange={(e) => setClient(Number(e.target.value))} className="rounded-xl border-2 border-line bg-surface px-2 py-1.5 text-sm font-semibold text-ink">
                {SHOP.clients.map((c) => <option key={c.id} value={c.id}>{c.id}</option>)}
              </select>
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <LabButton primary onClick={run} disabled={!!answered}>
              <span className="flex items-center gap-1.5"><Play size={14} fill="currentColor" /> Exécuter</span>
            </LabButton>
            <LabButton onClick={() => setSteps([])}>
              <span className="flex items-center gap-1.5"><RotateCcw size={14} /> Recommencer</span>
            </LabButton>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Readout label="Appels d'outils" value={String(steps.length)} strong />
            <Readout label="Taille du contexte" value={`${tokens.toLocaleString("fr-FR")} tokens`} sub="chaque observation s'ajoute" />
          </div>
          {answered && (
            <p className={clsx("rounded-xl px-4 py-3 text-sm font-semibold", answered.client_id === AGENT_ANSWER.id ? "bg-[#ecfdf3] text-[#05603a]" : "bg-[#fff4ed] text-[#9c2a10]")}>
              {answered.client_id === AGENT_ANSWER.id ? "Bonne réponse." : "Ce n'est pas le client qui a le plus dépensé à Lyon."}
              {!coverage && " Mais l'agent n'a pas vérifié tous les clients lyonnais : il a eu de la chance, ou il a deviné."}
            </p>
          )}
        </div>
        <ol className="max-h-[440px] space-y-2 overflow-auto rounded-2xl bg-paper p-3">
          <li className="text-xs text-muted">Contexte initial : prompt système, définitions des 4 outils, tâche ({AGENT_BASE_TOKENS} tokens).</li>
          {steps.map((s, i) => (
            <li key={i} className="rounded-xl bg-surface p-3 text-sm shadow-sm">
              <div className="mb-1 flex items-center justify-between text-xs font-semibold text-muted">
                <span>Tour {i + 1}</span>
                <span className="num">+{s.tokens} tokens</span>
              </div>
              <div className="font-mono text-[0.82rem]"><span className="font-bold text-mod-deep">Action</span> {actionText(s.action)}</div>
              <div className="mt-1 break-all font-mono text-[0.78rem] text-muted"><span className="font-bold text-ink">Observation</span> {s.obs}</div>
            </li>
          ))}
          {!steps.length && <li className="px-1 py-6 text-center text-sm text-muted">Aucune action pour l'instant.</li>}
        </ol>
      </div>
    </LabFrame>
  );
}

// ============================================================ 3. Contexte

/** Ce qui part réellement dans la fenêtre de contexte, selon la stratégie de gestion de l'historique. */
export function ContextLab({ id = "contexte", challenge }: { id?: string; challenge?: string }) {
  const [s, setS] = useState<ContextStrategy>({ window: 4000, history: "all", memory: false, toolsMode: "all" });
  const set = <K extends keyof ContextStrategy>(k: K) => (v: ContextStrategy[K]) => setS((x) => ({ ...x, [k]: v }));
  const ctx = assembleContext(s);
  const solved = challenge ? CHALLENGES[challenge].check({ window: s.window, used: ctx.used, fits: ctx.fits, hasKey: ctx.hasKey }) : false;
  const verdict = !ctx.fits
    ? { ok: false, text: "Erreur de l'API : le contexte dépasse la fenêtre. Rien n'est généré." }
    : !ctx.hasKey
      ? { ok: false, text: "« Pouvez-vous me rappeler votre numéro de commande ? » Pire : certains modèles en inventent un." }
      : { ok: true, text: "« Je lance le remboursement de la commande n° 4521. »" };
  const scaleMax = Math.max(s.window, ctx.used);

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <Segmented label="Fenêtre de contexte" value={String(s.window)} onChange={(v) => set("window")(Number(v))} options={[{ value: "4000", label: "4 000" }, { value: "8000", label: "8 000" }, { value: "32000", label: "32 000" }]} />
        <Segmented label="Historique" value={s.history} onChange={set("history")} options={[{ value: "all", label: "Tout garder" }, { value: "sliding", label: "Fenêtre glissante" }, { value: "summary", label: "Résumer les anciens tours" }]} />
        <Segmented label="Mémoire long terme (faits extraits)" value={s.memory ? "oui" : "non"} onChange={(v) => set("memory")(v === "oui")} options={[{ value: "non", label: "Non" }, { value: "oui", label: "Oui" }]} />
        <Segmented label="Définitions d'outils" value={s.toolsMode} onChange={set("toolsMode")} options={[{ value: "all", label: "Les 12 outils" }, { value: "relevant", label: "Seulement les utiles" }]} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
        <div>
          <h4 className="mb-2 font-display text-lg font-bold">Contenu envoyé au modèle</h4>
          <ul className="space-y-1">
            {ctx.items.map((it) => (
              <li key={it.id} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
                <span className={clsx("truncate", it.key && "font-bold text-mod-deep")}>{it.label}</span>
                <span className="num text-xs text-muted">{it.tokens.toLocaleString("fr-FR")}</span>
                <span className="col-span-2 -mt-0.5 h-1.5 rounded bg-sunken">
                  <span className="block h-full rounded" style={{ width: `${(it.tokens / 1800) * 100}%`, maxWidth: "100%", background: it.key ? "var(--mod)" : "var(--neg)" }} />
                </span>
              </li>
            ))}
          </ul>
          {ctx.dropped > 0 && <p className="mt-2 text-xs text-muted">{ctx.dropped} ancien{ctx.dropped > 1 ? "s" : ""} tour{ctx.dropped > 1 ? "s" : ""} retiré{ctx.dropped > 1 ? "s" : ""} du contexte.</p>}
        </div>
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-xs font-semibold text-muted">
              <span>Remplissage de la fenêtre</span>
              <span className="num">{ctx.used.toLocaleString("fr-FR")} / {s.window.toLocaleString("fr-FR")}</span>
            </div>
            <div className="relative h-6 overflow-hidden rounded-lg bg-sunken">
              <span className="absolute inset-y-0 left-0" style={{ width: `${(ctx.used / scaleMax) * 100}%`, background: ctx.fits ? "var(--mod)" : "var(--fp)" }} />
              <span className="absolute inset-y-0 w-[3px] bg-ink" style={{ left: `${(s.window / scaleMax) * 100}%` }} />
            </div>
          </div>
          <Readout label="Numéro de commande dans le contexte" value={ctx.hasKey ? "Oui" : "Non"} strong />
          <div className={clsx("rounded-xl px-4 py-3 text-sm", verdict.ok ? "bg-[#ecfdf3] text-[#05603a]" : "bg-[#fff4ed] text-[#9c2a10]")}>
            <div className="mb-1 text-xs font-semibold opacity-70">Réponse du modèle</div>
            {verdict.text}
          </div>
        </div>
      </div>
    </LabFrame>
  );
}

// ============================================================ 4. Évaluation

/** Trois équipes lancent le même benchmark (50 tâches) sur deux versions d'un agent. Concluent-elles la même chose ? */
export function AgentEvalLab({ id = "evaluation-agents", challenge }: { id?: string; challenge?: string }) {
  const [k, setK] = useState(1);
  const runs = [1, 2, 3].map((seed) => runEval(k, seed));
  const solved = challenge ? CHALLENGES[challenge].check({ k, pValues: runs.map((r) => r.p), diffs: runs.map((r) => r.diff) }) : false;
  const x = (v: number) => `${Math.max(0, Math.min(100, ((v - 0.3) / 0.6) * 100))}%`;

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-6 max-w-lg">
        <Segmented label="Essais par tâche (chaque essai est un nouveau tirage de l'agent)" value={String(k)} onChange={(v) => setK(Number(v))} options={["1", "3", "5", "10"].map((v) => ({ value: v, label: v }))} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {runs.map((r, i) => {
          const sig = r.p < 0.05;
          return (
            <div key={i} className="rounded-2xl border-2 border-line p-4">
              <div className="mb-3">
                <div className="font-display font-bold">Évaluation {String.fromCharCode(65 + i)}</div>
                <div className="num text-xs text-muted">{r.n} essais par version</div>
              </div>
              {([["v1", r.rate1, r.ci1, "var(--neg)"], ["v2", r.rate2, r.ci2, "var(--mod)"]] as const).map(([lab, rate, ci, col]) => (
                <div key={lab} className="mb-2">
                  <div className="mb-0.5 flex justify-between text-xs font-semibold"><span>{lab}</span><span className="num">{pct(rate)}</span></div>
                  <div className="relative h-3 rounded bg-sunken">
                    <span className="absolute inset-y-0 rounded" style={{ left: x(ci[0]), width: `calc(${x(ci[1])} - ${x(ci[0])})`, background: col, opacity: 0.35 }} />
                    <span className="absolute inset-y-[-3px] w-[3px] rounded" style={{ left: x(rate), background: col }} />
                  </div>
                </div>
              ))}
              <p className={clsx("mt-3 text-sm font-semibold", sig ? (r.diff > 0 ? "text-good" : "text-[#9c2a10]") : "text-muted")}>
                p = {r.p < 0.001 ? "< 0,001" : fmt(r.p, 3)} · {sig ? (r.diff > 0 ? "la v2 est meilleure" : "la v1 est meilleure") : "pas de conclusion"}
              </p>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-sm text-muted">
        Vrais taux de réussite moyens : 58 % (v1) et 66 % (v2) sur les {EVAL_TASKS} tâches. Barres : intervalles de confiance à 95 %. Le coût de l'évaluation est proportionnel au nombre d'essais : {(2 * EVAL_TASKS * k).toLocaleString("fr-FR")} exécutions d'agent ici.
      </p>
    </LabFrame>
  );
}

// ============================================================ 5. Sécurité

/** Un agent qui lit la boîte mail et peut répondre et payer des factures. Quels garde-fous ? */
export function SecurityLab({ id = "securite-agents", challenge }: { id?: string; challenge?: string }) {
  const [g, setG] = useState<Set<Guard>>(new Set());
  const out = securityOutcome(g);
  const attacks = out.filter((o) => o.attack);
  const legit = out.filter((o) => !o.attack);
  const state = { attacksBlocked: attacks.filter((o) => o.ok).length, attacks: attacks.length, legitOk: legit.filter((o) => o.ok).length, legit: legit.length };
  const solved = challenge ? CHALLENGES[challenge].check(state) : false;
  const toggle = (x: Guard) => setG((s) => { const n = new Set(s); if (n.has(x)) n.delete(x); else n.add(x); return n; });

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <p className="mb-4 text-sm text-muted">Outils de l'agent : <span className="font-mono">lire_emails</span>, <span className="font-mono">envoyer_email</span>, <span className="font-mono">payer_facture</span>, <span className="font-mono">rechercher_docs</span>.</p>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr] [&>*]:min-w-0">
        <div>
          <div className="mb-2 text-sm font-semibold text-muted">Garde-fous</div>
          <ul className="space-y-2">
            {GUARDS.map((x) => (
              <li key={x.id}>
                <button onClick={() => toggle(x.id)} aria-pressed={g.has(x.id)} className={clsx("w-full rounded-xl border-2 px-3 py-2 text-left transition-colors", g.has(x.id) ? "border-mod bg-[color-mix(in_srgb,var(--mod)_8%,white)]" : "border-line bg-surface hover:border-mod")}>
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <span className={clsx("flex h-4 w-4 items-center justify-center rounded border-2", g.has(x.id) ? "border-mod bg-mod text-white" : "border-line")}>{g.has(x.id) && <Check size={11} strokeWidth={3.5} />}</span>
                    {x.label}
                  </span>
                  <span className="mt-0.5 block pl-6 text-xs text-muted">{x.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-2 grid grid-cols-2 gap-2">
            <Readout label="Attaques bloquées" value={`${state.attacksBlocked} / ${state.attacks}`} strong />
            <Readout label="Demandes légitimes traitées" value={`${state.legitOk} / ${state.legit}`} strong />
          </div>
          <ul className="space-y-2">
            {INBOX.map((m, i) => {
              const o = out[i];
              return (
                <li key={m.id} className={clsx("rounded-xl border-2 p-3 text-sm", o.ok ? "border-good-bg/40 bg-[#f6fef9]" : "border-fp/40 bg-[#fffaf5]")}>
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted">
                    {m.attack ? <ShieldAlert size={14} className="text-fp" /> : <ShieldCheck size={14} className="text-good-bg" />}
                    <span className="truncate">{m.from}</span>
                    <span className="ml-auto">{m.attack ? "attaque" : "légitime"}</span>
                  </div>
                  <p className="mt-1">{m.subject}</p>
                  <p className={clsx("mt-1 flex items-center gap-1 text-xs font-semibold", o.ok ? "text-good" : "text-[#9c2a10]")}>
                    {o.ok ? <Check size={13} strokeWidth={3} /> : <X size={13} strokeWidth={3} />} {o.note}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </LabFrame>
  );
}
