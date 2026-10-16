/**
 * Courbes d'apprentissage : erreur d'entraînement et de validation en fonction de la taille
 * du jeu d'entraînement, dans les deux situations typiques (biais élevé, variance élevée).
 */
export function LearningCurves() {
  const W = 300, H = 230, M = { l: 36, r: 12, t: 20, b: 40 };
  const x = (t: number) => M.l + t * (W - M.l - M.r);
  const y = (v: number) => M.t + (1 - v) * (H - M.t - M.b);
  const path = (f: (t: number) => number, ox: number) =>
    Array.from({ length: 41 }, (_, i) => i / 40)
      .map((t, i) => `${i ? "L" : "M"}${(ox + x(t)).toFixed(1)},${y(f(t)).toFixed(1)}`)
      .join(" ");
  const panel = (kind: "bias" | "variance", ox: number) => {
    const floor = 0.18;
    const train = kind === "bias" ? (t: number) => 0.62 - 0.12 * Math.exp(-5 * t) : (t: number) => 0.06 + 0.22 * t;
    const val = kind === "bias" ? (t: number) => 0.66 + 0.3 * Math.exp(-6 * t) : (t: number) => 0.33 + 0.6 * Math.exp(-3.2 * t);
    return (
      <g>
        <line x1={ox + M.l} x2={ox + W - M.r} y1={y(floor)} y2={y(floor)} stroke="var(--muted)" strokeDasharray="4 4" />
        <text x={ox + W - M.r} y={y(floor) + 14} fontSize={11} textAnchor="end" fill="var(--muted)">erreur visée</text>
        <line x1={ox + M.l} x2={ox + M.l} y1={M.t} y2={H - M.b} stroke="var(--line)" strokeWidth={2} />
        <line x1={ox + M.l} x2={ox + W - M.r} y1={H - M.b} y2={H - M.b} stroke="var(--line)" strokeWidth={2} />
        <path d={path(train, ox)} fill="none" stroke="var(--ink)" strokeWidth={2.5} />
        <path d={path(val, ox)} fill="none" stroke="var(--fp)" strokeWidth={2.5} />
        <text x={ox + M.l - 8} y={M.t + 8} fontSize={11} textAnchor="end" fill="var(--muted)">err.</text>
        <text x={ox + (M.l + W - M.r) / 2} y={H - M.b + 18} fontSize={11} textAnchor="middle" fill="var(--muted)">taille du jeu d'entraînement →</text>
        <text x={ox + (M.l + W - M.r) / 2} y={H - 2} fontSize={14} fontWeight={700} textAnchor="middle" fill="var(--ink)">
          {kind === "bias" ? "Biais élevé (underfitting)" : "Variance élevée (overfitting)"}
        </text>
      </g>
    );
  };
  return (
    <figure className="not-prose card my-8 p-4 sm:p-6">
      <svg viewBox="0 0 620 232" className="w-full" role="img" aria-label="Courbes d'apprentissage : en cas de biais élevé, les deux erreurs se rejoignent haut ; en cas de variance élevée, un grand écart se réduit avec plus de données.">
        {panel("bias", 0)}
        {panel("variance", 320)}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-sm text-muted">
        <span className="flex items-center gap-1.5"><span className="inline-block h-1 w-5 rounded bg-ink" /> erreur d'entraînement</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-1 w-5 rounded bg-fp" /> erreur de validation</span>
      </figcaption>
    </figure>
  );
}
