// Coloration syntaxique minimaliste pour Python (et un peu de shell), sans dépendance.
// Suffisante pour des extraits pédagogiques ; ce n'est pas un vrai parseur.

export type TokKind = "kw" | "str" | "num" | "com" | "fn" | "builtin" | "deco" | "op" | "plain";
export type Tok = { k: TokKind; t: string };

const KEYWORDS = new Set(
  "def class return if elif else for in while import from as with not and or is None True False lambda yield pass break continue try except finally raise assert global nonlocal del async await".split(" "),
);
const BUILTINS = new Set("self print len range enumerate zip list dict tuple set int float str sum min max abs round super isinstance map sorted open type".split(" "));

const SQL_KEYWORDS = new Set(
  "SELECT FROM WHERE GROUP BY ORDER HAVING JOIN LEFT RIGHT INNER OUTER FULL ON AND OR NOT AS IN IS NULL DISTINCT LIMIT OFFSET UNION ALL WITH CASE WHEN THEN ELSE END OVER PARTITION ASC DESC INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE BETWEEN LIKE EXISTS".split(" "),
);
const SQL_FUNCS = new Set("COUNT SUM AVG MIN MAX ROW_NUMBER RANK DENSE_RANK LAG LEAD COALESCE ROUND CAST DATE".split(" "));

const RULES: [TokKind, RegExp][] = [
  ["com", /^#.*/],
  ["str", /^[rbfu]{0,2}("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')/i],
  ["deco", /^@[\w.]+/],
  ["num", /^(?:0x[\da-f]+|\d+(?:_\d+)*(?:\.\d*)?(?:e[+-]?\d+)?|\.\d+(?:e[+-]?\d+)?)j?/i],
  ["plain", /^[A-Za-z_]\w*/],
  ["op", /^(?:\*\*|\/\/|->|[-+*/%@=<>!&|^~]=?|[()[\]{}:,.;])/],
  ["plain", /^\s+/],
  ["plain", /^./],
];

export function tokenize(code: string, lang: "python" | "sql" = "python"): Tok[] {
  if (lang === "sql") return tokenizeSql(code);
  const out: Tok[] = [];
  let rest = code;
  while (rest.length) {
    for (const [k, re] of RULES) {
      const m = rest.match(re);
      if (!m) continue;
      const t = m[0];
      let kind: TokKind = k;
      if (k === "plain" && /^[A-Za-z_]/.test(t)) {
        if (KEYWORDS.has(t)) kind = "kw";
        else if (BUILTINS.has(t)) kind = "builtin";
        else if (/^\s*\(/.test(rest.slice(t.length))) kind = "fn";
      }
      const last = out[out.length - 1];
      if (last && last.k === kind && kind === "plain") last.t += t;
      else out.push({ k: kind, t });
      rest = rest.slice(t.length);
      break;
    }
  }
  return out;
}

function tokenizeSql(code: string): Tok[] {
  const out: Tok[] = [];
  const re = /(--.*)|('(?:''|[^'])*')|(\d+(?:\.\d+)?)|([A-Za-z_]\w*)|(\s+)|(.)/g;
  for (const m of code.matchAll(re)) {
    const [t, com, str, num, word] = m;
    let k: TokKind = "plain";
    if (com) k = "com";
    else if (str) k = "str";
    else if (num) k = "num";
    else if (word) k = SQL_KEYWORDS.has(word.toUpperCase()) ? "kw" : SQL_FUNCS.has(word.toUpperCase()) ? "fn" : "plain";
    else if (!/^\s/.test(t)) k = "op";
    out.push({ k, t });
  }
  return out;
}

export const TOK_CLASS: Record<TokKind, string> = {
  kw: "text-[#c4b5fd]",
  str: "text-[#86efac]",
  num: "text-[#fdba74]",
  com: "text-[#9196b8] italic",
  fn: "text-[#7dd3fc]",
  builtin: "text-[#f9a8d4]",
  deco: "text-[#fde68a]",
  op: "text-[#cbd0ea]",
  plain: "text-[#eef0fb]",
};
