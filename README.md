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

Connexion par lien magique envoyé par e-mail ; la progression est stockée dans la table `progress` (une ligne JSON par utilisateur, protégée par RLS).

Configuration à faire une fois dans le tableau de bord Supabase :

1. **SQL Editor** → exécuter `supabase/migrations/001_progress.sql`.
2. **Authentication → URL Configuration** : *Site URL* = l'URL Vercel de production ; ajouter dans *Redirect URLs* `https://<ton-projet>.vercel.app/**` et `http://localhost:3000/**`.

Fonctionnement : la progression reste locale pour une interface instantanée ; à la connexion, au retour sur l'onglet et 1,5 s après chaque changement, l'app fait « lire → fusionner → écrire ». La fusion (`src/lib/sync/merge.ts`) est commutative et idempotente : plusieurs appareils convergent sans jamais perdre de progrès. Un état local appartenant à un autre compte n'est jamais fusionné.

## Stack

- **Next.js 16** (App Router, Turbopack) + TypeScript
- **MDX** pour les leçons, formules en **KaTeX** (`$...$` et `$$...$$`)
- **Tailwind CSS 4** (tokens de couleur dans `src/app/globals.css`, clair/sombre)
- **d3-scale / d3-shape** pour les visualisations SVG
- **ts-fsrs** pour la répétition espacée (algorithme FSRS)
- **zustand** pour la progression (localStorage en mode invité)
- **Supabase** (auth par e-mail + Postgres avec RLS) pour les comptes et la synchronisation
- **Vitest** + Testing Library

## Structure

```
src/
  app/                    routes : / (Aujourd'hui), /parcours, /revisions, /profil, /lecons/[slug]
  content/lessons/*.mdx   contenu des leçons
  components/
    pedago/               Predict, Quiz, Callout, LessonComplete (utilisables dans le MDX)
    viz/                  labos interactifs (ThresholdLab, BayesLab, GradientLab, CltLab, PolyFitLab)
    pages/                écrans client (Today, SkillTree, Review, Profile)
  lib/
    curriculum.ts         modules → concepts → leçons (source de vérité du parcours)
    cards.ts              cartes de révision par concept
    challenges.ts         défis auto-validés des visualisations
    gamification.ts       XP, niveaux, séries, badges
    store.ts              état de progression + FSRS
    metrics.ts            métriques de classification (pures, testées)
    sims.ts               calculs des labos : Bayes, descente de gradient, TCL, régression polynomiale
```

## Ajouter une leçon

1. Déclarer la leçon (et ses concepts) dans `src/lib/curriculum.ts`.
2. Écrire `src/content/lessons/<slug>.mdx`. Les composants `Predict`, `Quiz`, `Callout`, `ThresholdLab` et `LessonComplete` sont disponibles sans import.
3. Ajouter l'import dans `src/lib/lessons.ts`.
4. Ajouter 2 à 3 cartes par concept dans `src/lib/cards.ts`.
5. Si la leçon a un défi, le définir dans `src/lib/challenges.ts` et vérifier dans `challenges.test.ts` qu'il est faisable et non résolu au départ.

### Boucle d'une leçon

Accroche (`Predict`) → exploration (viz) → formalisation (KaTeX) → vérification (`Quiz`) → défi (viz + `challenge`) → ancrage (`LessonComplete` ajoute les cartes au deck).

## Feuille de route

- [x] Phase 0 — fondations, composants pédagogiques, design system
- [x] Phase 1 — module Évaluation : confusion matrix, precision/recall/F1, ROC/AUC, PR curve
- [x] Phase 2 — comptes Supabase (lien magique), synchronisation multi-appareils, migration du mode invité
- [x] Phase 3 (en cours) — Bayes, descente de gradient, théorème central limite, bias-variance
- [ ] Phase 3 (suite) — tests & p-values, intervalles de confiance, cross-validation, data leakage, régularisation
- [ ] Phase 4 — Modèles classiques, Deep learning (playground TensorFlow.js)
- [ ] Phase 5 — Transformers, LLM, IA agentique
- [ ] Phase 6 — vitrine publique : landing, SEO, images de partage, accessibilité, version anglaise
