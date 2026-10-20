"use client";

import { useState } from "react";
import clsx from "clsx";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { Highlighted } from "@/components/code/Code";
import { LabButton, LabFrame, Slider } from "./controls";

const X = 2, Y = 1, W0 = -0.5, B0 = 0.1;
const sig = (z: number) => 1 / (1 + Math.exp(-z));
const fmt = (v: number, d = 3) => (Object.is(v, -0) ? 0 : v).toFixed(d).replace(".", ",").replace("-", "−");

type Phase = "start" | "forward" | "backward";

/**
 * Graphe de calcul d'un neurone : x, w, b → z = w·x + b → a = σ(z) → L = −log a (ici y = 1).
 * On enchaîne à la main forward, backward et mise à jour, comme le font loss.backward() et optimizer.step().
 */
export function BackpropLab({ id = "backprop", challenge }: { id?: string; challenge?: string }) {
  const [w, setW] = useState(W0);
  const [b, setB] = useState(B0);
  const [lr, setLr] = useState(0.3);
  const [phase, setPhase] = useState<Phase>("start");
  const [updates, setUpdates] = useState(0);
  const [history, setHistory] = useState<number[]>([]);

  const z = w * X + b;
  const a = sig(z);
  const L = -Math.log(a);
  // Rétropropagation : chaque nœud multiplie le gradient reçu par sa dérivée locale.
  const dL_da = -1 / a;
  const da_dz = a * (1 - a);
  const dL_dz = dL_da * da_dz; // = a − y
  const dL_dw = dL_dz * X;
  const dL_db = dL_dz;

  const fwd = phase !== "start";
  const bwd = phase === "backward";
  const solved = challenge ? CHALLENGES[challenge].check({ loss: fwd ? L : Infinity, updates }) : false;

  const step = () => {
    setW((v) => v - lr * dL_dw);
    setB((v) => v - lr * dL_db);
    setUpdates((u) => u + 1);
    setHistory((h) => [...h, L]);
    setPhase("start");
  };
  const reset = () => {
    setW(W0);
    setB(B0);
    setUpdates(0);
    setHistory([]);
    setPhase("start");
  };

  const code = [
    { t: "z = w * x + b; a = torch.sigmoid(z)", on: phase === "forward" },
    { t: "loss = -torch.log(a)          # y = 1", on: phase === "forward" },
    { t: "loss.backward()      # remplit w.grad, b.grad", on: phase === "backward" },
    { t: "with torch.no_grad():", on: false },
    { t: "    w -= lr * w.grad; b -= lr * b.grad", on: false },
    { t: "    w.grad.zero_(); b.grad.zero_()", on: false },
  ];

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}

      <div className="mb-5 grid gap-x-8 gap-y-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Slider label="Learning rate η" value={lr} min={0.05} max={2} step={0.05} onChange={setLr} display={fmt(lr, 2)} />
        <div className="flex flex-wrap gap-2">
          <LabButton primary={phase === "start"} onClick={() => setPhase("forward")} disabled={phase !== "start"}>
            1. Forward
          </LabButton>
          <LabButton primary={phase === "forward"} onClick={() => setPhase("backward")} disabled={phase !== "forward"}>
            2. Backward
          </LabButton>
          <LabButton primary={phase === "backward"} onClick={step} disabled={phase !== "backward"}>
            3. Step
          </LabButton>
          <LabButton onClick={reset}>Réinitialiser</LabButton>
        </div>
      </div>

      <Graph fwd={fwd} bwd={bwd} v={{ w, b, z, a, L }} g={{ dL_da, da_dz, dL_dz, dL_dw, dL_db }} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr] [&>*]:min-w-0">
        <pre className="min-w-0 overflow-x-auto rounded-2xl bg-[#171a2e] p-3" tabIndex={0}>
          {code.map((c, i) => (
            <div key={i} className={clsx("rounded px-1.5", c.on && "bg-white/10")}>
              <Highlighted code={c.t} />
            </div>
          ))}
        </pre>
        <div className="grid grid-cols-2 gap-2 self-start">
          <div className="rounded-xl p-3" style={{ background: "color-mix(in srgb, var(--mod) 10%, white)" }}>
            <div className="text-xs font-semibold text-muted">Loss</div>
            <div className="num mt-0.5 text-xl font-bold">{fwd ? fmt(L) : "?"}</div>
          </div>
          <div className="rounded-xl border border-line bg-paper p-3">
            <div className="text-xs font-semibold text-muted">Mises à jour</div>
            <div className="num mt-0.5 text-xl font-bold">{updates}</div>
          </div>
          {history.length > 0 && (
            <p className="col-span-2 text-xs text-muted">
              Loss avant chaque step : <span className="num">{history.map((h) => fmt(h, 2)).join(" → ")}</span>
            </p>
          )}
        </div>
      </div>
    </LabFrame>
  );
}

type V = { w: number; b: number; z: number; a: number; L: number };
type G = { dL_da: number; da_dz: number; dL_dz: number; dL_dw: number; dL_db: number };

function Graph({ fwd, bwd, v, g }: { fwd: boolean; bwd: boolean; v: V; g: G }) {
  const W = 860, H = 250;
  const nodes = [
    { id: "x", x: 60, y: 55, label: "x", val: fmt(X, 0), grad: null as string | null },
    { id: "w", x: 60, y: 125, label: "w", val: fmt(v.w), grad: bwd ? fmt(g.dL_dw) : null, param: true },
    { id: "b", x: 60, y: 195, label: "b", val: fmt(v.b), grad: bwd ? fmt(g.dL_db) : null, param: true },
    { id: "z", x: 320, y: 125, label: "z = w·x + b", val: fwd ? fmt(v.z) : "?", grad: bwd ? fmt(g.dL_dz) : null },
    { id: "a", x: 560, y: 125, label: "a = σ(z)", val: fwd ? fmt(v.a) : "?", grad: bwd ? fmt(g.dL_da) : null },
    { id: "L", x: 790, y: 125, label: "L = −log a", val: fwd ? fmt(v.L) : "?", grad: bwd ? "1" : null },
  ];
  const by = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const edges: [string, string, string, string][] = [
    ["x", "z", "", ""],
    ["w", "z", "∂z/∂w = x", `= ${fmt(X, 0)}`],
    ["b", "z", "∂z/∂b = 1", ""],
    ["z", "a", "∂a/∂z = a(1−a)", `= ${fwd ? fmt(g.da_dz) : "?"}`],
    ["a", "L", "∂L/∂a = −1/a", `= ${fwd ? fmt(g.dL_da) : "?"}`],
  ];
  return (
    <div className="overflow-x-auto" tabIndex={0}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[640px]" role="img" aria-label="Graphe de calcul d'un neurone, avec valeurs (forward) et gradients (backward).">
        <defs>
          <marker id="bp-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--muted)" />
          </marker>
        </defs>
        {edges.map(([f, t, lab, val]) => {
          const A = by[f], B = by[t];
          const x1 = A.x + 52, x2 = B.x - 62;
          const diag = A.y !== B.y;
          const lx = diag ? x1 + 22 : (x1 + x2) / 2;
          const ly = diag ? (A.y < B.y ? A.y + 2 : A.y - 4) : A.y - 22;
          return (
            <g key={f + t}>
              <line x1={x1} y1={A.y} x2={x2} y2={B.y} stroke="var(--line)" strokeWidth={2} markerEnd="url(#bp-arrow)" />
              {lab && (
                <text x={lx} y={ly} fontSize={10.5} textAnchor={diag ? "start" : "middle"} fill={bwd ? "var(--fp)" : "var(--muted)"} className="num">
                  <tspan>{lab}</tspan>
                  {val && <tspan x={lx} dy={13}>{val}</tspan>}
                </text>
              )}
            </g>
          );
        })}
        {nodes.map((n) => (
          <g key={n.id} transform={`translate(${n.x},${n.y})`}>
            <rect x={n.id === "x" || "param" in n ? -48 : -60} y={-30} width={n.id === "x" || "param" in n ? 100 : 122} height={60} rx={14} fill="var(--surface)" stroke={"param" in n ? "var(--mod)" : "var(--line)"} strokeWidth={2} />
            <text y={-11} textAnchor="middle" fontSize={11.5} fontWeight={700} fill="var(--muted)">{n.label}</text>
            <text y={8} textAnchor="middle" fontSize={14} fontWeight={800} fill="var(--fn)" className="num">{n.val}</text>
            {n.grad !== null && (
              <text y={24} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--fp)" className="num">∇ {n.grad}</text>
            )}
          </g>
        ))}
      </svg>
      <div className="mt-1 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-fn" /> valeur (forward)</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-fp" /> gradient ∂L/∂· (backward)</span>
        <span>x = {fmt(X, 0)}, y = 1</span>
      </div>
    </div>
  );
}
