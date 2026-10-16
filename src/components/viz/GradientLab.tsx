"use client";

import { useEffect, useMemo, useState } from "react";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { gdSteps, grad, loss, W_DOMAIN, type GdPath } from "@/lib/sims";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { LabButton, LabFrame, Slider } from "./controls";

const fmt = (v: number, d = 2) => v.toFixed(d).replace(".", ",").replace("-", "−");

type Control = "lr" | "w0";

/**
 * Descente de gradient sur une perte 1D : la tangente montre la pente, chaque pas vaut −lr × pente.
 */
export function GradientLab({
  id = "gd",
  w0: w0Init = 2,
  lr: lrInit = 0.1,
  controls = ["lr", "w0"],
  showTangent = true,
  challenge,
}: {
  id?: string;
  w0?: number;
  lr?: number;
  controls?: Control[];
  showTangent?: boolean;
  challenge?: string;
}) {
  const [w0, setW0] = useState(w0Init);
  const [lr, setLr] = useState(lrInit);
  const [path, setPath] = useState<GdPath>({ ws: [w0Init], diverged: false });
  const [pending, setPending] = useState(0);

  // Changer un réglage repart de zéro.
  const restart = (nw0 = w0) => {
    setPending(0);
    setPath({ ws: [nw0], diverged: false });
  };

  // Animation des pas en file d'attente.
  useEffect(() => {
    if (pending <= 0) return;
    const t = setTimeout(() => {
      setPath((p) => gdSteps(p, lr, 1));
      setPending((n) => n - 1);
    }, 110);
    return () => clearTimeout(t);
  }, [pending, lr]);

  useEffect(() => {
    if (path.diverged) setPending(0);
  }, [path.diverged]);

  const w = path.ws[path.ws.length - 1];
  const g = grad(w);
  const steps = path.ws.length - 1;
  const solved = challenge ? !pending && CHALLENGES[challenge].check({ w0, lr, path }) : false;

  // ---- tracé
  const W = 560, H = 320, M = { l: 40, r: 14, t: 16, b: 34 };
  const x = scaleLinear().domain(W_DOMAIN).range([M.l, W - M.r]);
  const y = scaleLinear().domain([-0.3, 4.2]).range([H - M.b, M.t]);
  const curve = useMemo(() => {
    const pts = Array.from({ length: 200 }, (_, i) => W_DOMAIN[0] + ((W_DOMAIN[1] - W_DOMAIN[0]) * i) / 199);
    return line<number>().x((v) => x(v)).y((v) => y(Math.min(4.6, loss(v))))(pts) ?? "";
  }, [x, y]);
  const clampW = (v: number) => Math.max(W_DOMAIN[0], Math.min(W_DOMAIN[1], v));
  const visible = path.ws.map(clampW);

  // petite courbe de la perte par itération
  const lossHist = path.ws.map((v) => (Math.abs(v) >= 3 ? NaN : loss(v)));

  return (
    <LabFrame>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}

      <div className="mb-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {controls.includes("lr") && (
          <Slider
            label="Learning rate (taille des pas)"
            value={lr}
            min={0.01}
            max={1.2}
            step={0.01}
            onChange={(v) => {
              setLr(v);
              restart();
            }}
            display={fmt(lr)}
          />
        )}
        {controls.includes("w0") && (
          <Slider
            label="Point de départ w₀"
            value={w0}
            min={-2.4}
            max={2.4}
            step={0.1}
            onChange={(v) => {
              setW0(v);
              restart(v);
            }}
            display={fmt(w0, 1)}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Fonction de perte. Position actuelle w = ${fmt(w)}, pente ${fmt(g)}.`}>
            {[0, 1, 2, 3, 4].map((v) => (
              <g key={v}>
                <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
                <text x={M.l - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)" className="num">{v}</text>
              </g>
            ))}
            {[-2, -1, 0, 1, 2].map((v) => (
              <text key={v} x={x(v)} y={H - M.b + 16} fontSize={10} textAnchor="middle" fill="var(--muted)" className="num">{fmt(v, 0)}</text>
            ))}
            <text x={(M.l + W - M.r) / 2} y={H - 4} fontSize={11} textAnchor="middle" fill="var(--muted)">paramètre w</text>
            <text transform={`translate(11, ${(M.t + H - M.b) / 2}) rotate(-90)`} fontSize={11} textAnchor="middle" fill="var(--muted)">perte L(w)</text>

            <path d={curve} fill="none" stroke="var(--ink)" strokeWidth={2} />

            {/* chemin parcouru */}
            {visible.slice(1).map((v, i) => (
              <line
                key={i}
                x1={x(visible[i])}
                y1={y(Math.min(4.2, loss(visible[i])))}
                x2={x(v)}
                y2={y(Math.min(4.2, loss(v)))}
                stroke="var(--accent)"
                strokeWidth={1.5}
                opacity={0.25 + (0.6 * (i + 1)) / visible.length}
              />
            ))}
            {visible.slice(0, -1).map((v, i) => (
              <circle key={i} cx={x(v)} cy={y(Math.min(4.2, loss(v)))} r={3.5} fill="var(--accent)" opacity={0.35} />
            ))}

            {/* tangente au point courant */}
            {showTangent && !path.diverged && (
              <line
                x1={x(clampW(w - 0.6))}
                y1={y(loss(w) - 0.6 * g)}
                x2={x(clampW(w + 0.6))}
                y2={y(loss(w) + 0.6 * g)}
                stroke="var(--fn)"
                strokeWidth={2}
                strokeDasharray="5 4"
              />
            )}
            <circle
              cx={x(clampW(w))}
              cy={y(Math.min(4.2, loss(clampW(w))))}
              r={8}
              fill={path.diverged ? "var(--fp)" : "var(--accent)"}
              stroke="var(--surface)"
              strokeWidth={2}
            />
          </svg>
          {showTangent && (
            <p className="mt-1 text-xs text-muted">
              <span className="mr-1 inline-block h-0.5 w-4 bg-fn align-middle" /> tangente : sa pente est la dérivée L′(w)
            </p>
          )}
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Readout label="Position w" value={path.diverged ? "∞" : fmt(w)} />
            <Readout label="Perte L(w)" value={path.diverged ? "∞" : fmt(loss(w))} />
            <Readout label="Pente L′(w)" value={path.diverged ? "–" : fmt(g)} />
            <Readout label="Prochain pas" value={path.diverged ? "–" : fmt(-lr * g)} />
          </div>
          <p className="num text-xs text-muted">w ← w − {fmt(lr)} × L′(w) · {steps} pas effectués</p>

          <div className="flex flex-wrap gap-2">
            <LabButton primary onClick={() => setPath((p) => gdSteps(p, lr, 1))} disabled={path.diverged || pending > 0}>
              1 pas
            </LabButton>
            <LabButton onClick={() => setPending(10)} disabled={path.diverged || pending > 0}>
              10 pas ▸
            </LabButton>
            <LabButton onClick={() => restart()}>Recommencer</LabButton>
          </div>
          {path.diverged && <p className="text-sm font-semibold text-accent">Divergence : les pas grandissent au lieu de rétrécir.</p>}

          <MiniLoss values={lossHist} />
        </div>
      </div>
    </LabFrame>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-paper p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="num mt-0.5 text-xl font-semibold">{value}</div>
    </div>
  );
}

function MiniLoss({ values }: { values: number[] }) {
  const W = 260, H = 90, M = 6;
  if (values.length < 2) return <p className="text-xs text-muted">La courbe de perte par itération apparaîtra ici.</p>;
  const finite = values.filter(Number.isFinite);
  const max = Math.max(1, ...finite);
  const x = scaleLinear().domain([0, Math.max(10, values.length - 1)]).range([M, W - M]);
  const y = scaleLinear().domain([0, max]).range([H - M, M]);
  const d = line<number>()
    .defined(Number.isFinite)
    .x((_, i) => x(i))
    .y((v) => y(v))(values) ?? "";
  return (
    <div>
      <div className="mb-1 text-xs text-muted">Perte à chaque itération</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg border border-line bg-paper">
        <path d={d} fill="none" stroke="var(--ink)" strokeWidth={2} />
      </svg>
    </div>
  );
}
