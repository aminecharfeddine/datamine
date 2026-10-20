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

## Gamification

Principe : l'XP ne récompense que des actes d'apprentissage (prédire, réussir un défi ou un exercice, réviser, terminer une leçon). Tout le reste en découle.

- **Niveaux et rangs** (`gamification.ts`, `cosmetics.ts`) : le titre par défaut suit le niveau, de « Point de donnée » à « Oracle bayésien ».
- **Succès** (`achievements.ts`) : 40 succès en cinq familles (régularité, maîtrise, rigueur, curiosité, secrets), avec paliers bronze, argent, or et platine. Tous sont dérivés de la progression ; un test vérifie le catalogue.
- **Vestiaire** : glyphes d'avatar, cadres inspirés de visualisations, thèmes d'accent, titres et célébrations, débloqués par niveau ou par succès. Purement visuels.
- **Objectif hebdomadaire** : 4 jours d'apprentissage sur 7, plus doux qu'une série quotidienne.
- Les explorations (labos manipulés, fiches lues, indices affichés…) sont stockées dans `explored` et synchronisées ; les cosmétiques équipés dans `cosmetics` (le changement le plus récent gagne).

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
    viz/                  labos interactifs (ThresholdLab, BayesLab, GradientLab, CltLab, CiLab, AbLab, PolyFitLab, RidgeLab, CvLab, LeakLab, KnnLab, TreeLab, SigmoidLab, LogRegLab, ForestLab, BoostLab, KMeansLab, NeuralLab, BackpropLab, TrainLoopLab, BpeLab, AttentionLab, AttentionMatrixLab, PandasLab, BroadcastLab, PipelineLab, FeatureLab, DriftLab, SqlLab, TransformerSizeLab, LoraLab, SamplingLab, InferenceLab, RagLab, RegLab, ConvLab, TransferLab, EmbeddingLab, RnnLab)
    code/                 blocs de code colorés (les ``` du MDX), CodeChoice (complète le code), Parsons (remets les lignes dans l'ordre)
    pages/                écrans client (Today, SkillTree, Review, Profile)
    game/                 avatar et cadres, médailles, célébrations, onglets Succès et Vestiaire
  lib/
    curriculum.ts         modules → concepts → leçons (source de vérité du parcours)
    cards.ts              cartes de révision par concept
    challenges.ts         défis auto-validés des visualisations
    gamification.ts       XP, niveaux, séries
    achievements.ts       succès (catalogue, statistiques dérivées de la progression)
    cosmetics.ts          cosmétiques du Vestiaire et règles de déblocage
    mastery.ts            niveau de maîtrise d'un concept
    store.ts              état de progression + FSRS
    metrics.ts            métriques de classification (pures, testées)
    sims.ts               calculs des labos : Bayes, descente de gradient, TCL, IC, tests A/B, polynômes, ridge
    ml.ts                 validation croisée, fuite de données, k-NN, arbres de décision (CART)
    models.ts             régression logistique (Newton), forêt aléatoire, gradient boosting, k-means
    nn.ts                 petit MLP avec backprop écrite à la main, Adam, boucle d'entraînement et ses bugs
    llm.ts                tokenizer BPE, attention (softmax, masque causal, effet de √d)
    practice.ts           boutique fictive (clients, commandes), mini-pandas, pipeline de churn, ventes quotidiennes, dérive et PSI
    sqlExercises.ts       exercices SQL (requête de départ, solution de référence, comparaison des résultats)
    dl.ts                 dropout et weight decay, transfer learning, convolutions, embeddings (PPMI + SVD), gradient des RNN
    llm2.ts               taille d'un Transformer, LoRA (SVD par Jacobi), sampling, mémoire d'inférence, RAG (TF-IDF)
```

## SQL dans le navigateur

Le labo SQL charge SQLite compilé en WebAssembly (`sql.js`) depuis `public/sql-wasm.wasm`. Après une mise à jour de `sql.js`, recopier ce fichier depuis `node_modules/sql.js/dist/`. `next.config.mjs` neutralise les modules Node (`fs`, `path`, `crypto`) que `sql.js` référence sans les utiliser dans le navigateur.

## Ajouter une leçon

1. Déclarer la leçon (et ses concepts) dans `src/lib/curriculum.ts`.
2. Écrire `src/content/lessons/<slug>.mdx`. Les composants pédagogiques (`Predict`, `Exercise`, `Quiz`, `Interview`, `Recap`, `Callout`, `CodeChoice`, `Parsons`, `LessonComplete`) et tous les labos sont disponibles sans import. Les blocs ``` sont colorés automatiquement.
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
- [x] Phase 1 (suite) — Évaluation complète : multiclasse (macro, micro, weighted), calibration (ECE, Platt, temperature scaling), métriques de régression (MAE, RMSE, R², pinball loss), métriques de ranking (precision@k, MRR, NDCG)
- [x] Phase 2 — comptes Supabase (lien magique), synchronisation multi-appareils, migration du mode invité
- [x] Phase 3 — Bayes, descente de gradient, TCL, intervalles de confiance, tests A/B et p-values, bias-variance, régularisation
- [x] Phase 3 (suite) — validation croisée, data leakage
- [x] Phase 4 — Modèles classiques : régression logistique, k-NN, arbres, forêts et boosting, k-means
- [x] Phase 5 — Deep learning : neurones et MLP, backpropagation et autograd, boucle d'entraînement PyTorch
- [x] Phase 6 — LLM : tokenisation BPE, self-attention
- [x] Phase 7 — LLM (suite) : architecture Transformer complète, pré-entraînement / fine-tuning / LoRA, décodage et sampling, inférence (KV cache, quantization), RAG
- [x] Phase 8 — ML en pratique : NumPy/pandas, pipelines scikit-learn, feature engineering, SQL (vrai SQLite dans le navigateur via sql.js), MLOps
- [x] Phase 9 — Deep learning (suite) : régularisation, CNN, transfer learning, embeddings, RNN et LSTM
- [x] Phase 9 (suite) — IA agentique : tool use (schémas JSON, MCP), boucle ReAct, mémoire et contexte, évaluation d'agents (pass@k, pass^k), sécurité (injection de prompt, moindre privilège)
- [x] Phase 9 (suite) — Compléments modules 5 à 8 : séries temporelles, interprétabilité (SHAP, permutation, PDP), optimisation d'hyperparamètres, modèles génératifs (VAE, GAN, diffusion), détection et segmentation, évaluation des LLM, orchestration multi-agents
- [x] Phase 9 (suite) — ACP (projection interactive, standardisation, éboulis)
- [x] Module spécial Entretiens : 221 questions types centrées sur la compréhension des concepts et le choix de modèles (QCM, réponses orales auto-évaluées, bugs à trouver, 45 pièges) sur 10 thèmes, entraînement filtré et entretien blanc chronométré avec bilan
- [ ] Phase 10 — vitrine publique : landing, SEO, images de partage, accessibilité, version anglaise
