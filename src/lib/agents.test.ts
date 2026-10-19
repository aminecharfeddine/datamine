import { describe, expect, it } from "vitest";
import { CHALLENGES } from "./challenges";
import { AGENT_ANSWER, assembleContext, checkToolCall, LYON, passAtK, passHatK, runAgentTool, runEval, securityOutcome, TOOL_REQUESTS, type Guard } from "./agents";

const C = (id: string, s: unknown) => CHALLENGES[id].check(s);

describe("tool use", () => {
  it("valide le JSON, les types, les valeurs permises et l'intention", () => {
    const [r1, r2, r3] = TOOL_REQUESTS;
    expect(checkToolCall('{"name": "suivre_livraison", "arguments": {"commande_id": 42}}', r1).ok).toBe(true);
    expect(checkToolCall('{"name": "suivre_livraison", "arguments": {"commande_id": "42"}}', r1).ok).toBe(false);
    expect(checkToolCall("{name: 'suivre_livraison'}", r1).errors[0]).toContain("JSON invalide");
    expect(checkToolCall('{"name": "rembourser", "arguments": {"commande_id": 17, "montant": 59.9, "motif": "defectueux"}}', r2).ok).toBe(true);
    expect(checkToolCall('{"name": "rembourser", "arguments": {"commande_id": 17, "montant": 59.9, "motif": "casse"}}', r2).ok).toBe(false);
    expect(checkToolCall('{"name": "rechercher_faq", "arguments": {"question": "délais de livraison"}}', r3).ok).toBe(true);
    expect(checkToolCall('{"name": "suivre_livraison", "arguments": {"commande_id": 42}}', r3).ok).toBe(false);
    expect(C("tool-calls", { solved: 3, total: 3 })).toBe(true);
  });
});

describe("boucle d'agent", () => {
  it("les outils renvoient les vraies données ; 9 appels suffisent", () => {
    expect(JSON.parse(runAgentTool({ tool: "lister_clients", ville: "Lyon" })).length).toBe(LYON.length);
    const totals = LYON.map((c) => JSON.parse(runAgentTool({ tool: "total_depenses", client_id: c.id })).total_eur);
    expect(Math.max(...totals)).toBe(JSON.parse(runAgentTool({ tool: "total_depenses", client_id: AGENT_ANSWER.id })).total_eur);
    expect(1 + LYON.length + 1).toBeLessThanOrEqual(9);
    expect(C("react-efficient", { answered: AGENT_ANSWER.id, correct: AGENT_ANSWER.id, steps: 9, coverage: true })).toBe(true);
    expect(C("react-efficient", { answered: AGENT_ANSWER.id, correct: AGENT_ANSWER.id, steps: 2, coverage: false })).toBe(false);
  });
});

describe("contexte", () => {
  it("la fenêtre glissante perd le fait clé ; résumé ou mémoire le gardent", () => {
    const sliding = assembleContext({ window: 4000, history: "sliding", memory: false, toolsMode: "all" });
    expect(sliding.fits && !sliding.hasKey).toBe(true);
    expect(assembleContext({ window: 4000, history: "all", memory: false, toolsMode: "all" }).fits).toBe(false);
    const good = assembleContext({ window: 4000, history: "summary", memory: false, toolsMode: "relevant" });
    expect(C("ctx-budget", { window: 4000, ...good })).toBe(true);
    const bad = assembleContext({ window: 4000, history: "summary", memory: false, toolsMode: "all" });
    expect(C("ctx-budget", { window: 4000, ...bad })).toBe(false);
  });
});

describe("évaluation", () => {
  it("10 essais par tâche : trois évaluations concluent ; 1 essai : non", () => {
    const at = (k: number) => [1, 2, 3].map((s) => runEval(k, s));
    const k10 = at(10);
    expect(C("eval-signif", { k: 10, pValues: k10.map((r) => r.p), diffs: k10.map((r) => r.diff) })).toBe(true);
    const k1 = at(1);
    expect(C("eval-signif", { k: 1, pValues: k1.map((r) => r.p), diffs: k1.map((r) => r.diff) })).toBe(false);
  });
  it("pass@k et pass^k", () => {
    expect(passAtK(0.6, 3)).toBeCloseTo(0.936, 3);
    expect(passHatK(0.6, 3)).toBeCloseTo(0.216, 3);
  });
});

describe("sécurité", () => {
  const score = (g: Guard[]) => {
    const o = securityOutcome(new Set(g));
    return { attacksBlocked: o.filter((x) => x.attack && x.ok).length, attacks: 2, legitOk: o.filter((x) => !x.attack && x.ok).length, legit: 3 };
  };
  it("seule la combinaison restriction d'envoi + confirmation humaine passe le défi", () => {
    expect(C("agent-guard", score([]))).toBe(false);
    expect(C("agent-guard", score(["separer"]))).toBe(false);
    expect(C("agent-guard", score(["lecture_seule"]))).toBe(false); // sûr mais inutile
    expect(C("agent-guard", score(["destinataires", "retirer_paiement"]))).toBe(false);
    expect(C("agent-guard", score(["destinataires", "confirmation"]))).toBe(true);
  });
});
