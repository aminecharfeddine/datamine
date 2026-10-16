"use client";
import clsx from "clsx";
import { Check, X } from "lucide-react";

/** Bouton de réponse commun aux prédictions, quiz et révisions. */
export function Choice({
  children,
  state,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  state: "idle" | "correct" | "wrong" | "dim";
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[0.97rem] font-medium transition-all",
        state === "idle" && "border-line bg-surface shadow-[0_3px_0_0_var(--line)] hover:border-mod hover:bg-[color-mix(in_srgb,var(--mod)_6%,white)] active:translate-y-0.5 active:shadow-none",
        state === "correct" && "border-good-bg bg-[#ecfdf3] text-[#05603a]",
        state === "wrong" && "border-fp bg-[#fff4ed] text-[#9c2a10]",
        state === "dim" && "border-line bg-surface opacity-50",
      )}
    >
      <span className="flex-1">{children}</span>
      {state === "correct" && <Check size={20} strokeWidth={3} className="shrink-0 text-good-bg" />}
      {state === "wrong" && <X size={20} strokeWidth={3} className="shrink-0 text-fp" />}
    </button>
  );
}

export const choiceState = (i: number, answer: number, choice: number | null): "idle" | "correct" | "wrong" | "dim" =>
  choice === null ? "idle" : i === answer ? "correct" : i === choice ? "wrong" : "dim";
