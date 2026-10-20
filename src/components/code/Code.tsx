"use client";
import { isValidElement, useState } from "react";
import clsx from "clsx";
import { Check, Copy } from "lucide-react";
import { tokenize, TOK_CLASS } from "./highlight";

/** Code coloré, sans cadre. Utilisé par les blocs, les exercices et les cartes. */
export function Highlighted({ code, className, inline, lang }: { code: string; className?: string; inline?: boolean; lang?: "python" | "sql" }) {
  return (
    <code className={clsx("code-raw whitespace-pre font-mono", inline ? "inline" : "block", "text-[0.86rem] leading-[1.65]", className)}>
      {tokenize(code, lang).map((t, i) => (
        <span key={i} className={TOK_CLASS[t.k]}>
          {t.t}
        </span>
      ))}
    </code>
  );
}

/** Bloc de code d'une leçon, avec bouton copier. */
export function CodeBlock({ code, lang = "python", title }: { code: string; lang?: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* presse-papiers indisponible : rien à faire */
    }
  };
  return (
    <figure className="not-prose group my-7 overflow-hidden rounded-2xl bg-[#171a2e] shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
        <span className="font-mono text-xs font-semibold text-[#9196b8]">{title ?? lang}</span>
        <button onClick={copy} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[#cbd0ea] hover:bg-white/10" aria-label="Copier le code">
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copié" : "Copier"}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3.5" tabIndex={0}>
        <Highlighted code={code} />
      </pre>
    </figure>
  );
}

/** Remplace le <pre> produit par les blocs ``` du MDX. */
export function MdxPre(props: { children?: React.ReactNode }) {
  const child = props.children;
  if (isValidElement<{ className?: string; children?: string }>(child)) {
    const lang = child.props.className?.replace("language-", "") ?? "text";
    const code = String(child.props.children ?? "").replace(/\n$/, "");
    return <CodeBlock code={code} lang={lang} />;
  }
  return <pre>{props.children}</pre>;
}
