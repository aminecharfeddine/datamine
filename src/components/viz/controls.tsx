"use client";
import clsx from "clsx";

export function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold text-muted">{props.label}</span>
        <span className="num rounded-lg px-2 py-0.5 font-bold" style={{ background: "color-mix(in srgb, var(--mod) 12%, white)", color: "var(--mod-deep)" }}>
          {props.display}
        </span>
      </div>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </label>
  );
}

/** Groupe de boutons à choix unique (ex. choix d'une distribution). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-muted">{label}</div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            role="radio"
            aria-checked={o.value === value}
            onClick={() => onChange(o.value)}
            className={clsx(
              "rounded-xl border-2 px-3 py-1.5 text-sm font-semibold transition-colors",
              o.value === value ? "border-mod bg-mod text-white" : "border-line bg-surface hover:border-mod",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function LabButton({ children, onClick, primary, disabled }: { children: React.ReactNode; onClick: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx("px-4 py-2 text-sm", primary ? "btn-3d text-white" : "btn-ghost")}
      style={primary ? { background: "var(--mod)", ["--btn-shadow" as string]: "var(--mod-deep)" } : undefined}
    >
      {children}
    </button>
  );
}

/** Cadre commun des labos. */
export function LabFrame({ children }: { children: React.ReactNode }) {
  return (
    <figure className="not-prose card my-10 -mx-4 rounded-none border-x-0 px-4 py-6 sm:mx-0 sm:rounded-3xl sm:border-x sm:p-7">
      {children}
    </figure>
  );
}
