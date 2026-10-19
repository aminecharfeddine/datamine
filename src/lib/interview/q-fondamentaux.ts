import type { ItvQuestion } from "./types";

export const FONDAMENTAUX: ItvQuestion[] = [
  {
    id: "fond-biais-variance",
    topic: "fondamentaux",
    kind: "oral",
    level: 1,
    lesson: "biais-variance",
    q: "Explique le compromis biais-variance, comme tu le ferais au tableau.",
    points: [
      "Biais : erreur due à un modèle trop simple, qui rate la structure (underfitting)",
      "Variance : sensibilité du modèle à l'échantillon d'entraînement (overfitting)",
      "Erreur attendue = biais² + variance + bruit irréductible",
      "Augmenter la complexité baisse le biais et augmente la variance ; plus de données ou de régularisation réduisent la variance",
      "Diagnostic par l'écart entre erreur d'entraînement et de validation",
    ],
    answer:
      "L'erreur de généralisation se décompose en biais², variance et bruit irréductible. Un modèle trop simple a un biais élevé : il se trompe de la même façon quel que soit l'échantillon, et l'erreur d'entraînement est déjà haute. Un modèle trop flexible a une variance élevée : il apprend le bruit, change beaucoup d'un échantillon à l'autre, et l'écart entre entraînement et validation est grand. On cherche la complexité qui minimise la somme, en jouant sur la capacité du modèle, la régularisation et la quantité de données, et on la choisit par validation.",
  },
  {
    id: "fond-overfit-diag",
    topic: "fondamentaux",
    kind: "qcm",
    level: 1,
    lesson: "biais-variance",
    q: "Accuracy d'entraînement 99 %, accuracy de validation 71 %. Quelle action a le plus de chances d'aider ?",
    options: ["Ajouter des features polynomiales", "Augmenter la régularisation ou collecter plus de données", "Entraîner plus longtemps", "Réduire la taille du jeu de validation"],
    answer: 1,
    explain: "Grand écart entre entraînement et validation : variance élevée. On contraint le modèle (régularisation, profondeur, early stopping) ou on augmente les données. Ajouter des features ou entraîner plus longtemps aggrave l'overfitting.",
  },
  {
    id: "fond-underfit-data",
    topic: "fondamentaux",
    kind: "qcm",
    level: 2,
    trap: true,
    lesson: "biais-variance",
    q: "Ton modèle fait 75 % en entraînement et 74 % en validation, loin de l'objectif de 90 %. Ton manager propose d'acheter deux fois plus de données. Ton avis ?",
    options: [
      "Excellente idée, plus de données améliore toujours le modèle",
      "Ça aidera peu : le problème est un biais élevé, il faut un modèle plus expressif ou de meilleures features",
      "Il faut plutôt augmenter la régularisation",
      "Il faut réduire le jeu de validation",
    ],
    answer: 1,
    explain: "Les deux erreurs sont proches et élevées : c'est de l'underfitting. Plus de données réduit la variance, pas le biais. On augmente la capacité (modèle plus riche, moins de régularisation) ou on apporte de l'information (features). Une learning curve qui plafonne le confirme.",
  },
  {
    id: "fond-l1-l2",
    topic: "fondamentaux",
    kind: "oral",
    level: 1,
    lesson: "regularisation",
    q: "Quelle différence entre régularisation L1 et L2 ? Quand choisir l'une ou l'autre ?",
    points: [
      "L1 pénalise la somme des |w|, L2 la somme des w²",
      "L1 met des poids exactement à zéro : sélection de variables, modèle parcimonieux",
      "L2 réduit tous les poids sans les annuler, stable avec des variables corrélées",
      "Elastic net combine les deux",
      "Standardiser les variables avant, sinon la pénalité est inéquitable",
    ],
    answer:
      "Les deux ajoutent une pénalité sur la taille des poids pour réduire la variance. L1 (lasso) utilise la valeur absolue : sa géométrie en losange produit des solutions avec des poids exactement nuls, donc une sélection de variables. L2 (ridge) utilise le carré : elle rétrécit tous les poids, répartit l'effet entre variables corrélées et reste stable. Je prends L1 quand je soupçonne peu de variables utiles ou que je veux un modèle simple à expliquer, L2 par défaut, elastic net avec des groupes de variables corrélées. Dans tous les cas, on standardise avant et on choisit lambda par validation croisée.",
  },
  {
    id: "fond-ridge-train",
    topic: "fondamentaux",
    kind: "qcm",
    level: 2,
    trap: true,
    lesson: "regularisation",
    q: "Tu augmentes fortement le lambda d'une régression ridge. Que fait l'erreur d'entraînement ?",
    options: ["Elle diminue", "Elle augmente (ou au mieux reste stable)", "Elle ne change pas, seule l'erreur de test change", "Elle devient nulle"],
    answer: 1,
    explain: "La régularisation contraint le modèle : il ne peut plus coller aussi bien aux données d'entraînement. L'erreur d'entraînement monte toujours avec lambda ; c'est l'erreur de validation qui peut baisser (puis remonter si lambda est trop grand).",
  },
  {
    id: "fond-leak-scaler",
    topic: "fondamentaux",
    kind: "bug",
    level: 1,
    lang: "python",
    lesson: "pipelines-scikit-learn",
    q: "Ce code donne une estimation de performance trop optimiste. Quelle ligne pose problème ?",
    code: `from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression

X_scaled = StandardScaler().fit_transform(X)
X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=0)
model = LogisticRegression().fit(X_train, y_train)
print(model.score(X_test, y_test))`,
    line: 5,
    explain: "Le scaler est ajusté sur toutes les données, test compris : la moyenne et l'écart-type du test fuient dans l'entraînement (data leakage). L'effet est faible pour un scaler, énorme pour une imputation ou un target encoding, et c'est surtout le réflexe qui est évalué.",
    fix: "Découper d'abord, puis mettre le scaler et le modèle dans un Pipeline : make_pipeline(StandardScaler(), LogisticRegression()).fit(X_train, y_train).",
  },
  {
    id: "fond-kfold-choix",
    topic: "fondamentaux",
    kind: "oral",
    level: 2,
    lesson: "validation-croisee",
    q: "Comment choisis-tu ta stratégie de validation croisée ? Dans quels cas le k-fold classique est-il faux ?",
    points: [
      "k = 5 ou 10 : compromis entre biais de l'estimation, variance et coût",
      "Séries temporelles : validation dans le temps (TimeSeriesSplit), jamais de futur dans l'entraînement",
      "Données groupées (plusieurs lignes par patient ou client) : GroupKFold",
      "Classes déséquilibrées : StratifiedKFold",
      "Nested CV si l'on choisit les hyperparamètres et veut une estimation non biaisée",
    ],
    answer:
      "Par défaut un k-fold stratifié avec k = 5 ou 10. Mais la règle est de reproduire la situation de production : si on prédit le futur, on valide sur des périodes postérieures à l'entraînement ; si plusieurs lignes appartiennent à la même entité (patient, client, magasin), toutes ses lignes doivent être du même côté, sinon le modèle reconnaît l'entité plutôt que d'apprendre. Avec des classes rares, on stratifie. Et si la même CV sert à choisir les hyperparamètres, son score est optimiste : on garde un test final ou on fait une nested CV.",
  },
  {
    id: "fond-leak-feature",
    topic: "fondamentaux",
    kind: "qcm",
    level: 2,
    trap: true,
    lesson: "validation-croisee",
    q: "Ton modèle de churn atteint une AUC de 0,99 au premier essai. Parmi les features : « nombre de jours depuis la dernière connexion », « motif de résiliation », « ancienneté ». Que suspectes-tu ?",
    options: [
      "Rien, le modèle est excellent",
      "Une fuite : le motif de résiliation n'existe qu'une fois le client parti",
      "Un problème d'échelle de l'ancienneté",
      "Un jeu de test trop petit",
    ],
    answer: 1,
    explain: "Une performance trop belle pour être vraie est d'abord un bug ou une fuite. Le motif de résiliation est renseigné après l'événement à prédire : indisponible au moment de la prédiction. Il faut construire chaque feature avec les seules informations connues à la date de prédiction (point-in-time).",
  },
  {
    id: "fond-calc-fits",
    topic: "fondamentaux",
    kind: "calcul",
    level: 1,
    lesson: "validation-croisee",
    q: "Une recherche sur grille teste 4 valeurs de max_depth et 5 valeurs de learning_rate, avec une validation croisée à 5 plis. Combien d'entraînements de modèle (sans compter le réentraînement final) ?",
    answer: 100,
    tolerance: 0,
    explain: "4 × 5 = 20 combinaisons, chacune entraînée 5 fois : 100 entraînements, plus un réentraînement final sur tout le jeu avec la meilleure combinaison. D'où l'intérêt d'une recherche aléatoire ou bayésienne quand la grille grossit.",
  },
  {
    id: "fond-lr-trop-grand",
    topic: "fondamentaux",
    kind: "qcm",
    level: 1,
    lesson: "descente-de-gradient",
    q: "Pendant une descente de gradient, la loss oscille puis explose. Cause la plus probable ?",
    options: ["Learning rate trop petit", "Learning rate trop grand", "Trop de données", "Modèle trop simple"],
    answer: 1,
    explain: "Chaque pas dépasse le minimum et rebondit de plus en plus loin. On baisse le learning rate (souvent d'un facteur 3 à 10), on utilise un warmup, ou on normalise les features pour mieux conditionner le problème.",
  },
  {
    id: "fond-sgd-batch",
    topic: "fondamentaux",
    kind: "oral",
    level: 2,
    lesson: "descente-de-gradient",
    q: "Batch, mini-batch, stochastique : quelles différences, et pourquoi tout le monde utilise des mini-batchs ?",
    points: [
      "Batch complet : gradient exact mais un pas coûte un passage sur toutes les données",
      "Stochastique (un exemple) : pas très bon marché mais gradient très bruité",
      "Mini-batch : compromis, et exploite la vectorisation sur GPU",
      "Le bruit aide à sortir des plateaux et des mauvais minima, avec un effet régularisant",
      "Taille de batch et learning rate se règlent ensemble",
    ],
    answer:
      "Le gradient batch est exact mais coûteux : un seul pas par passage sur les données. Le SGD pur fait un pas par exemple : rapide mais très bruité, et il exploite mal le matériel. Le mini-batch (32 à quelques milliers d'exemples) donne une estimation du gradient assez bonne, profite du parallélisme GPU, et garde un bruit utile pour explorer et généraliser. Quand on augmente la taille du batch, on augmente généralement le learning rate, avec un warmup.",
  },
  {
    id: "fond-dimension",
    topic: "fondamentaux",
    kind: "qcm",
    level: 2,
    lesson: "knn",
    q: "Ton k-NN marche bien avec 10 features et s'effondre avec 2 000 features (dont beaucoup de bruit). Pourquoi ?",
    options: [
      "Le k-NN ne supporte pas plus de 1 000 colonnes",
      "En grande dimension, les distances se concentrent : le plus proche et le plus lointain voisin sont presque à la même distance",
      "Il faut augmenter k proportionnellement au nombre de features",
      "Les features doivent être binaires",
    ],
    answer: 1,
    explain: "C'est la malédiction de la dimension : le volume explose, les données deviennent éparses et les distances perdent leur pouvoir discriminant, surtout quand les dimensions bruitées dominent. Remèdes : sélection de variables, réduction de dimension, ou un modèle qui apprend quelles variables comptent.",
  },
  {
    id: "fond-scaling",
    topic: "fondamentaux",
    kind: "oral",
    level: 1,
    lesson: "feature-engineering",
    q: "Pourquoi standardiser les features ? Pour quels modèles est-ce inutile ?",
    points: [
      "Modèles à distance (k-NN, k-means, SVM) : sinon la variable de plus grande échelle domine",
      "Descente de gradient : convergence plus rapide et stable",
      "Régularisation : sinon la pénalité traite les coefficients inéquitablement",
      "Arbres et ensembles d'arbres : insensibles aux transformations monotones",
      "Paramètres ajustés sur l'entraînement uniquement",
    ],
    answer:
      "Standardiser met les variables sur une échelle comparable. C'est indispensable pour les méthodes à distance (sinon un revenu en euros écrase un âge en années), utile pour la descente de gradient (meilleur conditionnement) et nécessaire pour que la régularisation pénalise équitablement les coefficients. Les arbres de décision, forêts et boosting coupent sur des seuils et sont insensibles à toute transformation monotone : inutile pour eux. Et le scaler s'ajuste sur le train, dans un pipeline.",
  },
  {
    id: "fond-generatif",
    topic: "fondamentaux",
    kind: "oral",
    level: 2,
    q: "Quelle différence entre un modèle génératif et un modèle discriminatif ? Donne un exemple de chaque.",
    points: [
      "Discriminatif : modélise directement P(y | x) ou la frontière (régression logistique, SVM, boosting)",
      "Génératif : modélise P(x, y) ou P(x | y) et P(y) (Naive Bayes, mélange gaussien, LLM pour P(x))",
      "Un génératif peut produire de nouvelles données et gérer des entrées manquantes",
      "Avec peu de données, le génératif converge souvent plus vite ; avec beaucoup, le discriminatif est souvent meilleur pour classer",
    ],
    answer:
      "Un modèle discriminatif apprend seulement ce qu'il faut pour décider : P(y | x), comme la régression logistique ou le gradient boosting. Un modèle génératif apprend comment les données sont produites, P(x | y) et P(y), puis en déduit P(y | x) par Bayes : Naive Bayes, les mélanges gaussiens, et plus largement les modèles qui génèrent (un LLM modélise P(texte)). Le génératif fait des hypothèses plus fortes, converge avec moins de données et peut simuler ; le discriminatif est en général plus précis quand les données abondent.",
  },
  {
    id: "fond-tuning-test",
    topic: "fondamentaux",
    kind: "bug",
    level: 2,
    lang: "python",
    lesson: "validation-croisee",
    q: "Le score annoncé à la fin est trop optimiste. Quelle ligne est en cause ?",
    code: `X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=0)
best_c, best_score = None, 0
for c in [0.01, 0.1, 1, 10, 100]:
    model = LogisticRegression(C=c, max_iter=1000).fit(X_train, y_train)
    score = model.score(X_test, y_test)
    if score > best_score:
        best_c, best_score = c, score
print(f"C = {best_c}, performance attendue : {best_score:.3f}")`,
    line: 5,
    explain: "Les hyperparamètres sont choisis sur le jeu de test, puis ce même score est annoncé comme performance attendue : le test a servi à la sélection, il n'est plus indépendant. Avec beaucoup de candidats, l'optimisme devient important.",
    fix: "Choisir C par validation croisée sur le train (GridSearchCV), puis évaluer une seule fois le modèle retenu sur le test.",
  },
  {
    id: "fond-no-free-lunch",
    topic: "fondamentaux",
    kind: "qcm",
    level: 2,
    q: "Un collègue affirme : « Le gradient boosting est le meilleur algorithme, inutile d'essayer autre chose. » Quelle réponse est la plus juste ?",
    options: [
      "Il a raison sur tous les types de données",
      "Aucun algorithme n'est meilleur partout : le boosting excelle souvent sur le tabulaire, moins sur images, texte ou très petits jeux",
      "La régression linéaire est toujours meilleure",
      "Il faut toujours un réseau de neurones",
    ],
    answer: 1,
    explain: "C'est l'idée du no free lunch : la performance dépend de l'adéquation entre les hypothèses du modèle et les données. Sur du tabulaire, le boosting est une excellente référence ; sur des données non structurées, le deep learning domine ; avec peu de données ou un besoin d'interprétabilité, un modèle linéaire peut gagner. On compare toujours à une baseline.",
  },
];
