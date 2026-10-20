import Link from "next/link";
import { ALL_LESSONS, MODULES } from "@/lib/curriculum";
import { CARDS } from "@/lib/cards";
import { TOTAL_LABS } from "@/lib/achievements";
import { questionById, QUESTIONS } from "@/lib/interview";
import { ModuleIcon } from "@/components/ui/ModuleIcon";
import { HeroLab } from "./HeroLab";
import { ResumeBanner, SampleQuestion } from "./LandingClient";

const LESSONS = ALL_LESSONS.filter((l) => l.available);
const FIRST = LESSONS[0];

const LOOP = [
  { title: "Tu prédis", text: "Chaque leçon s'ouvre sur une question où l'intuition se trompe souvent. Tu t'engages avant de lire la réponse." },
  { title: "Tu manipules", text: "Un labo interactif te laisse bouger le seuil, la régularisation, le nombre d'étapes d'un modèle de diffusion, et voir l'effet tout de suite." },
  { title: "Tu formalises", text: "Les formules arrivent après l'intuition, avec le code Python, PyTorch ou SQL que tu écriras au travail." },
  { title: "Tu relèves le défi", text: "Un objectif précis dans le labo, un exercice de calcul, du code à compléter et un quiz : tu sais si tu as compris." },
  { title: "Tu retiens", text: "Les cartes de révision reviennent juste avant que tu oublies (répétition espacée FSRS), et une fiche résume la leçon." },
];

export function Landing() {
  const sample = questionById("choix-extrapolation")!;
  return (
    <>
      <ResumeBanner />

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 lg:grid-cols-[1fr_1.05fr] lg:pt-16">
        <div>
          <h1 className="font-display text-[2.6rem] font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
            La data science, en manipulant.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted sm:text-xl">
            Statistiques, machine learning, deep learning, LLM et agents. Un parcours gratuit en français pour comprendre les fondamentaux qu'on attend en
            entretien, en touchant à chaque concept avant de le formaliser.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/lecons/${FIRST.slug}`} className="btn-3d bg-accent px-6 py-3 text-white">
              Commencer la première leçon
            </Link>
            <Link href="/parcours" className="btn-ghost px-6 py-3">
              Voir le parcours
            </Link>
          </div>
          <p className="mt-6 text-sm text-muted">
            {LESSONS.length} leçons, {TOTAL_LABS} labos interactifs, {QUESTIONS.length} questions d'entretien, {CARDS.length} cartes de révision. Sans compte : ta
            progression reste sur ton appareil, et se synchronise si tu te connectes.
          </p>
        </div>
        <HeroLab />
      </section>

      <section className="border-y border-line bg-surface" aria-labelledby="parcours-titre">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 id="parcours-titre" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Neuf modules, des probabilités aux agents
          </h2>
          <p className="mt-3 max-w-2xl text-muted">
            Chaque module s'appuie sur les précédents. On peut suivre l'ordre ou piocher directement le sujet de son prochain entretien.
          </p>
          <ol className="mt-10 grid gap-x-10 gap-y-2 md:grid-cols-2">
            {MODULES.map((m) => {
              const n = m.lessons.filter((l) => l.available).length;
              return (
                <li key={m.id}>
                  <Link href={`/parcours#${m.id}`} className="group flex items-start gap-4 rounded-2xl px-3 py-3 transition-colors hover:bg-paper">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: m.color }}>
                      <ModuleIcon id={m.id} size={20} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-baseline gap-2">
                        <span className="num text-sm font-bold" style={{ color: m.deep }}>{m.index}</span>
                        <span className="font-display text-lg font-bold leading-tight group-hover:underline">{m.title}</span>
                      </span>
                      <span className="mt-0.5 block text-sm text-muted">
                        {m.tagline} {n} leçon{n > 1 ? "s" : ""}.
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="methode-titre">
        <h2 id="methode-titre" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Une leçon, cinq temps
        </h2>
        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {LOOP.map((s, i) => (
            <li key={s.title} className="relative border-t-4 pt-4" style={{ borderColor: i === 1 ? "var(--accent)" : "var(--line)" }}>
              <span className="num text-sm font-bold text-muted">{i + 1}</span>
              <h3 className="mt-1 font-display text-xl font-bold">{s.title}</h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-ink text-white" aria-labelledby="entretiens-titre">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <h2 id="entretiens-titre" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Et pour l'entretien
            </h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-white/80">
              {QUESTIONS.length} questions comme on en pose vraiment : expliquer un concept à l'oral, choisir entre deux modèles, trouver le bug dans du
              PyTorch ou du SQL, déjouer les pièges. En entraînement libre, ou en entretien blanc chronométré avec un bilan par thème.
            </p>
            <Link href="/entretiens" className="btn-3d mt-8 inline-block bg-accent px-6 py-3 text-white">
              S'entraîner aux entretiens
            </Link>
          </div>
          <div className="text-ink">
            <SampleQuestion q={sample} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="projet-titre">
        <h2 id="projet-titre" className="font-display text-2xl font-bold tracking-tight">
          Le projet
        </h2>
        <div className="mt-4 grid gap-8 text-[0.95rem] leading-relaxed text-muted md:grid-cols-2">
          <p>
            Datamine est un projet personnel d'Amine Charfeddine, ingénieur et data scientist. Les labos tournent entièrement dans le navigateur : les modèles,
            les métriques et même une base SQLite sont calculés en direct, sans serveur. Chaque défi est testé pour avoir une solution, et chaque leçon passe une
            grille de complétude automatique.
          </p>
          <p>
            Construit avec Next.js, TypeScript, MDX et KaTeX, des visualisations en SVG, une répétition espacée FSRS et une synchronisation Supabase. Le code
            source est sur{" "}
            <a href="https://github.com/aminecharfeddine/datamine" className="font-semibold text-accent underline-offset-2 hover:underline">
              GitHub
            </a>
            .
          </p>
        </div>
      </section>
    </>
  );
}
