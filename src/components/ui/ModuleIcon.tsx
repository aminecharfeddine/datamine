import { Code2, Sigma, ChartColumn, Scale, GitBranch, Target, Network, Sparkles, Bot, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  maths: Sigma,
  stats: ChartColumn,
  fondamentaux: Scale,
  modeles: GitBranch,
  evaluation: Target,
  pratique: Code2,
  "deep-learning": Network,
  transformers: Sparkles,
  agents: Bot,
};

export function ModuleIcon({ id, size = 20, className }: { id: string; size?: number; className?: string }) {
  const Icon = ICONS[id] ?? Sigma;
  return <Icon size={size} strokeWidth={2.4} className={className} aria-hidden />;
}
