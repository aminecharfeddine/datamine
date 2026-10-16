/**
 * Pourquoi L1 donne des zéros : la solution régularisée est le premier point où les ellipses
 * de la perte touchent la région autorisée. Un disque (L2) est touché n'importe où ; un losange (L1)
 * est presque toujours touché par un coin, situé sur un axe (donc un coefficient nul).
 */
export function NormBalls() {
  const panel = (kind: "l2" | "l1", ox: number) => {
    const cx = ox + 150, cy = 150, r = 62;
    const ell = { x: cx + 100, y: cy - 100 }; // centre de la perte (solution non régularisée)
    // « Rayon » elliptique d'un point vis-à-vis du centre de la perte (ellipse tournée de −20°).
    const a = (10 * Math.PI) / 180;
    const q = (px: number, py: number) => {
      const dx = px - ell.x, dy = py - ell.y;
      const u = dx * Math.cos(a) + dy * Math.sin(a);
      const v = -dx * Math.sin(a) + dy * Math.cos(a);
      return Math.hypot(u / 1.1, v / 0.7);
    };
    // Point de la frontière de la région le plus « proche » au sens de la perte : c'est la solution régularisée.
    const boundary = Array.from({ length: 720 }, (_, i) => {
      const t = (i / 720) * 2 * Math.PI;
      if (kind === "l2") return { x: cx + r * Math.cos(t), y: cy + r * Math.sin(t) };
      const c = Math.cos(t), sn = Math.sin(t), k = r / (Math.abs(c) + Math.abs(sn));
      return { x: cx + k * c, y: cy + k * sn };
    });
    const touch = boundary.reduce((b, p) => (q(p.x, p.y) < q(b.x, b.y) ? p : b));
    const kMax = q(touch.x, touch.y);
    return (
      <g clipPath={`url(#nb-${kind})`}>
        <defs>
          <clipPath id={`nb-${kind}`}>
            <rect x={ox} y={0} width={300} height={345} />
          </clipPath>
        </defs>
        <line x1={ox + 20} x2={ox + 290} y1={cy} y2={cy} stroke="var(--line)" strokeWidth={2} />
        <line x1={cx} x2={cx} y1={20} y2={285} stroke="var(--line)" strokeWidth={2} />
        <text x={ox + 286} y={cy + 18} fontSize={13} textAnchor="end" fill="var(--muted)">w₁</text>
        <text x={cx + 8} y={30} fontSize={13} fill="var(--muted)">w₂</text>
        {kind === "l2" ? (
          <circle cx={cx} cy={cy} r={r} fill="var(--mod)" opacity={0.18} stroke="var(--mod)" strokeWidth={2.5} />
        ) : (
          <polygon
            points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
            fill="var(--mod)"
            opacity={0.18}
            stroke="var(--mod)"
            strokeWidth={2.5}
          />
        )}
        {[kMax * 0.38, kMax * 0.68, kMax].map((k, i) => (
          <ellipse
            key={i}
            cx={ell.x}
            cy={ell.y}
            rx={k * 1.1}
            ry={k * 0.7}
            transform={`rotate(10 ${ell.x} ${ell.y})`}
            fill="none"
            stroke="var(--fp)"
            strokeWidth={1.8}
            opacity={0.55 + i * 0.2}
          />
        ))}
        <circle cx={ell.x} cy={ell.y} r={4} fill="var(--fp)" />
        <circle cx={touch.x} cy={touch.y} r={7} fill="var(--ink)" stroke="var(--surface)" strokeWidth={2} />
        <text x={ox + 150} y={312} fontSize={15} fontWeight={700} textAnchor="middle" fill="var(--ink)">
          {kind === "l2" ? "L2 (ridge) : un disque" : "L1 (lasso) : un losange"}
        </text>
        <text x={ox + 150} y={332} fontSize={12.5} textAnchor="middle" fill="var(--muted)">
          {kind === "l2" ? "contact quelconque : w₁ et w₂ ≠ 0" : "contact sur un coin : w₁ = 0"}
        </text>
      </g>
    );
  };
  return (
    <figure className="not-prose card my-8 p-4 sm:p-6">
      <svg viewBox="0 0 620 345" className="w-full" role="img" aria-label="Comparaison des régions L1 et L2 : la perte touche le losange L1 sur un coin, ce qui annule un coefficient.">
        {panel("l2", 0)}
        {panel("l1", 310)}
      </svg>
      <figcaption className="mt-2 text-sm text-muted">
        <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-fp align-middle" /> ellipses : courbes de niveau de la perte, autour de la solution sans pénalité.{" "}
        <span className="mx-1 inline-block h-2.5 w-2.5 rounded-sm bg-mod align-middle opacity-60" /> zone : coefficients autorisés par la pénalité.{" "}
        <span className="mx-1 inline-block h-2.5 w-2.5 rounded-full bg-ink align-middle" /> solution régularisée.
      </figcaption>
    </figure>
  );
}
