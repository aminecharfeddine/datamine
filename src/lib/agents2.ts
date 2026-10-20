// Module 8 (suite) : orchestrer plusieurs agents. Latence, tokens et compromis.

export const ORCH_TASKS = 6; // six concurrents à analyser
export const TASK_SECONDS = 40; // recherche d'un concurrent par un agent
export const SYNTH_SECONDS = 30; // synthèse finale
export const LAUNCH_SECONDS = 3; // coordination par sous-agent lancé
export const AGENT_BASE = 6000; // prompt système + outils d'un agent
export const RESULT_TOKENS = 8000; // résultats bruts de recherche par concurrent
export const SUMMARY_TOKENS = 600; // résumé compact renvoyé par un sous-agent

export type OrchSetup = { subAgents: number; compact: boolean };

/**
 * Coût d'un plan. subAgents = 0 : un seul agent fait tout dans un seul contexte.
 * Sinon, un orchestrateur répartit les 6 tâches entre k sous-agents qui travaillent en parallèle, chacun dans son propre contexte.
 * Un agent qui enchaîne m recherches relit son contexte à chaque étape : m·base + 8 000·m(m+1)/2 tokens d'entrée.
 */
export function orchestrate({ subAgents, compact }: OrchSetup) {
  const work = (m: number) => m * AGENT_BASE + (RESULT_TOKENS * m * (m + 1)) / 2;
  if (subAgents === 0) {
    const tokens = work(ORCH_TASKS) + AGENT_BASE + ORCH_TASKS * RESULT_TOKENS; // synthèse sur tout l'historique
    return { tokens, seconds: ORCH_TASKS * TASK_SECONDS + SYNTH_SECONDS, contextPeak: AGENT_BASE + ORCH_TASKS * RESULT_TOKENS };
  }
  const k = Math.min(subAgents, ORCH_TASKS);
  const loads = Array.from({ length: k }, (_, i) => Math.floor(ORCH_TASKS / k) + (i < ORCH_TASKS % k ? 1 : 0));
  const returned = compact ? SUMMARY_TOKENS : RESULT_TOKENS * Math.max(...loads);
  const orchestrator = 2 * AGENT_BASE + ORCH_TASKS * (compact ? SUMMARY_TOKENS : RESULT_TOKENS); // planification + synthèse
  const tokens = loads.reduce((s, m) => s + work(m), 0) + orchestrator;
  const seconds = Math.max(...loads) * TASK_SECONDS + SYNTH_SECONDS + k * LAUNCH_SECONDS;
  return { tokens, seconds, contextPeak: Math.max(AGENT_BASE + RESULT_TOKENS * Math.max(...loads), AGENT_BASE + ORCH_TASKS * (compact ? SUMMARY_TOKENS : RESULT_TOKENS)), returned };
}

export const ORCH_MAX_SECONDS = 90;
export const ORCH_MAX_TOKENS = 100_000;
