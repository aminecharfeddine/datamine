"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { Play, RotateCcw } from "lucide-react";
import { CIRCLE_DOMAIN, CIRCLE_TEST, CIRCLE_TRAIN, forward, makeTrainer, netAccuracy, NEURONS, NN_EPOCHS, type Act } from "@/lib/nn";
import { moonGrid } from "@/lib/ml";
import { CHALLENGES } from "@/lib/challenges";
import { ChallengeBanner } from "@/components/pedago/ChallengeBanner";
import { LabButton, LabFrame, Segmented, Slider } from "./controls";
import { AccReadouts, DecisionMap } from "./Classify2D";

const GRID = moonGrid(56, 56, CIRCLE_DOMAIN);

/**
 * Un réseau 2 → H → 1 entraîné en direct sur deux cercles concentriques.
 * Chaque neurone caché trace une droite (pointillés) ; la non-linéarité permet de les combiner.
 */
export function NeuralLab({ id = "nn", neurons = 1, act: a0 = "relu", challenge }: { id?: string; neurons?: number; act?: Act; challenge?: string }) {
  const [hi, setHi] = useState(Math.max(0, NEURONS.indexOf(neurons)));
  const [act, setAct] = useState<Act>(a0);
  const H = NEURONS[hi];
  const trainer = useRef(makeTrainer(CIRCLE_TRAIN, H, act));
  const [epoch, setEpoch] = useState(0);
  const [running, setRunning] = useState(false);
  const raf = useRef<number | null>(null);

  const reset = useCallback((h: number, a: Act) => {
    if (raf.current) cancelAnimationFrame(raf.current);
    trainer.current = makeTrainer(CIRCLE_TRAIN, h, a);
    setRunning(false);
    setEpoch(0);
  }, []);
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  const train = () => {
    if (running) return;
    setRunning(true);
    const tick = () => {
      const done = trainer.current.run(8);
      setEpoch(trainer.current.losses.length);
      if (done) {
        setRunning(false);
        raf.current = null;
      } else raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const net = trainer.current.net;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const predict = useMemo(() => GRID.cells.map((c) => (forward(net, c.x, c.y) >= 0.5 ? 1 : 0) as 0 | 1), [net, epoch]);
  const lines = useMemo(
    () => (act === "linear" ? [] : Array.from({ length: H }, (_, j) => [net.W1[2 * j], net.W1[2 * j + 1], net.b1[j]] as [number, number, number])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [net, epoch, act, H],
  );
  const trainAcc = netAccuracy(net, CIRCLE_TRAIN);
  const testAcc = netAccuracy(net, CIRCLE_TEST);
  const trained = epoch >= NN_EPOCHS;
  const solved = challenge ? CHALLENGES[challenge].check({ H, act, trained, testAcc }) : false;

  return (
    <LabFrame labKey={id}>
      {challenge && <ChallengeBanner labId={id} challengeId={challenge} solved={solved} />}
      <div className="mb-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <Slider
          label="Neurones dans la couche cachée"
          value={hi}
          min={0}
          max={NEURONS.length - 1}
          step={1}
          onChange={(v) => {
            setHi(v);
            reset(NEURONS[v], act);
          }}
          display={String(H)}
        />
        <Segmented
          label="Activation"
          value={act}
          onChange={(a) => {
            setAct(a);
            reset(H, a);
          }}
          options={[
            { value: "linear", label: "Linéaire" },
            { value: "relu", label: "ReLU" },
            { value: "tanh", label: "tanh" },
          ]}
        />
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <LabButton primary onClick={train} disabled={running || trained}>
          <span className="flex items-center gap-1.5">
            <Play size={14} fill="currentColor" /> {trained ? "Entraîné" : running ? "Entraînement…" : "Entraîner"}
          </span>
        </LabButton>
        <LabButton onClick={() => reset(H, act)}>
          <span className="flex items-center gap-1.5">
            <RotateCcw size={14} /> Réinitialiser
          </span>
        </LabButton>
        <span className="num text-sm text-muted">
          époque {epoch} / {NN_EPOCHS}
        </span>
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <DecisionMap
            predict={predict}
            cols={GRID.cols}
            rows={GRID.rows}
            points={CIRCLE_TRAIN}
            domain={CIRCLE_DOMAIN}
            lines={lines}
            title={`${H} neurone${H > 1 ? "s" : ""}, activation ${act === "linear" ? "linéaire" : act === "relu" ? "ReLU" : "tanh"}`}
          />
          {act !== "linear" && <p className="mt-2 text-xs text-muted">Pointillés : la droite où chaque neurone caché change d'avis (w₁x + w₂y + b = 0).</p>}
        </div>
        <div className="space-y-5">
          <LossCurve losses={trainer.current.losses} />
          <AccReadouts train={trainAcc} test={testAcc} />
        </div>
      </div>
    </LabFrame>
  );
}

export function LossCurve({ losses, total = NN_EPOCHS, title = "Loss d'entraînement", max }: { losses: number[]; total?: number; title?: string; max?: number }) {
  const W = 420, H = 200, M = { l: 36, r: 10, t: 12, b: 30 };
  const top = max ?? Math.max(0.75, ...losses.slice(0, 3));
  const x = scaleLinear().domain([0, total]).range([M.l, W - M.r]);
  const y = scaleLinear().domain([0, top]).range([H - M.b, M.t]).clamp(true);
  const d = line<number>().x((_, i) => x(i + 1)).y((v) => y(v))(losses) ?? "";
  return (
    <div>
      <h3 className="mb-2 font-display text-lg font-bold">{title}</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${title} : ${losses.length ? `dernière valeur ${losses.at(-1)!.toFixed(2)}` : "pas encore d'entraînement"}`}>
        {y.ticks(4).map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={M.l - 6} y={y(v) + 4} fontSize={10} textAnchor="end" fill="var(--muted)" className="num">{v}</text>
          </g>
        ))}
        <text x={(M.l + W - M.r) / 2} y={H - 6} fontSize={11} textAnchor="middle" fill="var(--muted)">époques</text>
        <path d={d} fill="none" stroke="var(--mod)" strokeWidth={2.5} />
      </svg>
    </div>
  );
}
