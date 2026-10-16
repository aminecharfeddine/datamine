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
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="text-muted">{props.label}</span>
        <span className="num font-semibold">{props.display}</span>
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
      <div className="mb-1.5 text-sm text-muted">{label}</div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            role="radio"
            aria-checked={o.value === value}
            onClick={() => onChange(o.value)}
            className={clsx(
              "rounded-full border px-3 py-1 text-sm transition-colors",
              o.value === value ? "border-ink bg-ink text-paper" : "border-line hover:border-ink",
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
      className={clsx(
        "rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-40",
        primary ? "bg-ink text-paper hover:bg-ink/85" : "border border-line hover:border-ink",
      )}
    >
      {children}
    </button>
  );
}

/** Cadre commun des labos. */
export function LabFrame({ children }: { children: React.ReactNode }) {
  return (
    <figure className="not-prose my-10 -mx-4 border-y border-line bg-surface px-4 py-6 sm:mx-0 sm:rounded-2xl sm:border sm:p-6">
      {children}
    </figure>
  );
}
