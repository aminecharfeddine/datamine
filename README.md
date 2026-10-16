# Datamine

Un laboratoire interactif pour apprendre la data science en manipulant : prédire avant de voir, explorer des visualisations, relever des défis, puis réviser en répétition espacée.

## Démarrer

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # tests unitaires + composants
npm run build    # build de production
```

## Déployer sur Vercel

1. Pousser le dépôt sur GitHub.
2. Sur vercel.com → *Add New Project* → importer le dépôt. Aucune variable d'environnement n'est nécessaire pour l'instant.

## Comptes (Supabase)

Comptes par e-mail + mot de passe (avec pseudo et couleur d'avatar dans les métadonnées Supabase), mot de passe oublié, et lien magique en option ; la progression est stockée dans la table `progress` (une ligne JSON par utilisateur, protégée par RLS).

Configuration à faire une fois dans le tableau de bord Supabase :

1. **SQL Editor** → exécuter `supabase/migrations/001_progress.sql`.
2. **Authentication → Sign In / Providers → Email** : désactiver *Confirm email* pour une inscription immédiate (facultatif).
3. **Authentication → URL Configuration** : *Site URL* = l'URL Vercel de production ; ajouter dans *Redirect URLs* `https://<ton-projet>.vercel.app/**` et `http://localhost:3000/**`.

Fonctionnement : la progression reste locale pour une interface instantanée ; à la connexion, au retour sur l'onglet et 1,5 s après chaque changement, l'app fait « lire → fusionner → écrire ». La fusion (`src/lib/sync/merge.ts`) est commutative et idempotente : plusieurs appareils convergent sans jamais perdre de progrès. Un état local appartenant à un autre compte n'est jamais fusionné.

## Stack

- **Next.js 16** (App Router, Turbopack) + TypeScript
- **MDX** pour les leçons, formules en **KaTeX** (`$...$` et `$$...$$`)
- **Tailwind CSS 4** (tokens dans `src/app/globals.css`, une couleur d'identité par module dans `curriculum.ts`)
- **Bricolage Grotesque** (titres) + **Figtree** (texte), icônes **lucide-react**
- **d3-scale / d3-shape** pour les visualisations SVG
- **ts-fsrs** pour la répétition espacée (algorithme FSRS)
- **zustand** pour la progression (localStorage en mode invité)
- **Supabase** (auth par e-mail + Postgres avec RLS) pour les comptes et la synchronisation
- **Vitest** + Testing Library

## Structure

```
src/
  app/                    routes : / (Aujourd'hui), /parcours, /revisions, /fiches, /fiches/[slug], /profil, /compte, /lecons/[slug]
  content/lessons/*.mdx   contenu des leçons
  content/fiches/*.mdx    fiches récap (une par leçon, débloquée à la fin de la leçon, export PDF via l'impression)
  components/
    pedago/               Predict, Quiz, Callout, LessonComplete (utilisables dans le MDX)
    viz/                  labos interactifs (ThresholdLab, BayesLab, GradientLab, CltLab, CiLab, AbLab, PolyFitLab, RidgeLab, CvLab, LeakLab, KnnLab, TreeLab)
    pages/                écrans client (Today, SkillTree, Review, Profile)
  lib/
    curriculum.ts         modules → concepts → leçons (source de vérité du parcours)
    cards.ts              cartes de révision par concept
    challenges.ts         défis auto-validés des visualisations
    gamification.ts       XP, niveaux, séries, badges
    store.ts              état de progression + FSRS
    metrics.ts            métriques de classification (pures, testées)
    sims.ts               calculs des labos : Bayes, descente de gradient, TCL, IC, tests A/B, polynômes, ridge
    ml.ts                 validation croisée, fuite de données, k-NN, arbres de décision (CART)
```

## Ajouter une leçon

1. Déclarer la leçon (et ses concepts) dans `src/lib/curriculum.ts`.
2. Écrire `src/content/lessons/<slug>.mdx`. Les composants pédagogiques (`Predict`, `Exercise`, `Quiz`, `Interview`, `Recap`, `Callout`, `LessonComplete`) et tous les labos sont disponibles sans import.
3. Ajouter l'import dans `src/lib/lessons.ts`.
4. Ajouter 2 à 3 cartes par concept dans `src/lib/cards.ts`.
5. Écrire la fiche récap `src/content/fiches/<slug>.mdx` (blocs `FicheSection` essentiel, formules, pieges, entretien, astuces) et l'ajouter dans `src/lib/fiches.ts`.
6. Si la leçon a un défi, le définir dans `src/lib/challenges.ts` et vérifier dans `challenges.test.ts` qu'il est faisable et non résolu au départ.

### Grille de complétude

`src/lib/lessons-structure.test.ts` vérifie automatiquement que chaque leçon publiée contient : une prédiction d'accroche, un labo ou une illustration, au moins un défi, un exercice de calcul, une formule, un quiz de 4 questions ou plus, deux questions d'entretien avec réponse type, au moins trois types d'encadrés (intuition, piège, rappel, astuce, entretien), un encadré « À retenir », et au moins deux cartes de révision par concept.

### Boucle d'une leçon

Accroche (`Predict`) → exploration (viz) → formalisation (KaTeX) → vérification (`Quiz`) → défi (viz + `challenge`) → ancrage (`LessonComplete` ajoute les cartes au deck).

## Feuille de route

- [x] Phase 0 — fondations, composants pédagogiques, design system
- [x] Phase 1 — module Évaluation : confusion matrix, precision/recall/F1, ROC/AUC, PR curve
- [x] Phase 2 — comptes Supabase (lien magique), synchronisation multi-appareils, migration du mode invité
- [x] Phase 3 — Bayes, descente de gradient, TCL, intervalles de confiance, tests A/B et p-values, bias-variance, régularisation
- [x] Phase 3 (suite) — validation croisée, data leakage
- [ ] Phase 4 — Modèles classiques (k-NN et arbres faits ; régression logistique, ensembles, clustering à venir), Deep learning
- [ ] Phase 5 — Transformers, LLM, IA agentique
- [ ] Phase 6 — vitrine publique : landing, SEO, images de partage, accessibilité, version anglaise
