import type { ItvQuestion } from "./types";

export const DATA: ItvQuestion[] = [
  {
    id: "data-having",
    topic: "data",
    kind: "bug",
    level: 1,
    lang: "sql",
    lesson: "sql-pour-la-data",
    q: "On veut les clients ayant passé plus de 5 commandes. La requête plante. Quelle ligne corriger ?",
    code: `SELECT client_id, COUNT(*) AS nb_commandes
FROM commandes
WHERE COUNT(*) > 5
GROUP BY client_id
ORDER BY nb_commandes DESC;`,
    line: 3,
    explain: "WHERE filtre les lignes avant l'agrégation : une fonction d'agrégat n'y est pas autorisée. Le filtre sur un agrégat se fait après le GROUP BY, avec HAVING.",
    fix: "Supprimer la ligne 3 et ajouter HAVING COUNT(*) > 5 après le GROUP BY.",
  },
  {
    id: "data-left-join-where",
    topic: "data",
    kind: "bug",
    level: 2,
    lang: "sql",
    trap: true,
    lesson: "sql-pour-la-data",
    q: "On veut tous les clients, avec leurs commandes de 2026 s'ils en ont (zéro sinon). Les clients sans commande disparaissent du résultat. Quelle ligne est fautive ?",
    code: `SELECT c.client_id, COUNT(o.commande_id) AS nb_2026
FROM clients c
LEFT JOIN commandes o ON o.client_id = c.client_id
WHERE o.date_commande >= '2026-01-01'
GROUP BY c.client_id;`,
    line: 4,
    explain: "Pour un client sans commande, o.date_commande est NULL ; la condition du WHERE est alors inconnue et la ligne est éliminée. Le LEFT JOIN se comporte comme un INNER JOIN.",
    fix: "Déplacer la condition dans la jointure : LEFT JOIN commandes o ON o.client_id = c.client_id AND o.date_commande >= '2026-01-01'.",
  },
  {
    id: "data-count",
    topic: "data",
    kind: "qcm",
    level: 1,
    lesson: "sql-pour-la-data",
    q: "Une table a 100 lignes ; la colonne email a 10 valeurs NULL et 80 valeurs distinctes. Que renvoient COUNT(*), COUNT(email) et COUNT(DISTINCT email) ?",
    options: ["100, 100, 80", "100, 90, 80", "90, 90, 80", "100, 90, 90"],
    answer: 1,
    explain: "COUNT(*) compte les lignes, COUNT(col) ignore les NULL, COUNT(DISTINCT col) compte les valeurs distinctes non NULL.",
  },
  {
    id: "data-null-egal",
    topic: "data",
    kind: "qcm",
    level: 2,
    trap: true,
    lesson: "sql-pour-la-data",
    q: "SELECT * FROM clients WHERE telephone = NULL renvoie 0 ligne alors que 300 clients n'ont pas de téléphone. Pourquoi ?",
    options: [
      "La table est vide",
      "Toute comparaison avec NULL donne « inconnu », jamais vrai : il faut écrire telephone IS NULL",
      "Il faut écrire telephone == NULL",
      "NULL vaut 0",
    ],
    answer: 1,
    explain: "SQL utilise une logique à trois valeurs. NULL = NULL n'est pas vrai, et telephone <> 'x' exclut aussi les NULL. On utilise IS NULL, IS NOT NULL, ou COALESCE.",
  },
  {
    id: "data-window",
    topic: "data",
    kind: "oral",
    level: 2,
    lesson: "sql-pour-la-data",
    q: "À quoi servent les window functions en SQL ? Donne deux exemples d'usage.",
    points: [
      "Calcul sur un ensemble de lignes liées à la ligne courante, sans regrouper les lignes (contrairement à GROUP BY)",
      "PARTITION BY pour les groupes, ORDER BY pour l'ordre dans la fenêtre",
      "ROW_NUMBER ou RANK : top n par groupe, déduplication (dernière ligne par client)",
      "LAG / LEAD : comparer à la période précédente",
      "SUM ou AVG OVER : cumuls, moyennes glissantes",
    ],
    answer:
      "Une window function calcule une valeur pour chaque ligne à partir d'une fenêtre de lignes associées, sans écraser le détail comme le ferait un GROUP BY. Par exemple, ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY date DESC) numérote les commandes de chaque client : on garde la ligne 1 pour obtenir la dernière commande. LAG(ca) OVER (ORDER BY mois) récupère le chiffre du mois précédent pour calculer une évolution, et SUM(ca) OVER (ORDER BY mois) donne un cumul.",
  },
  {
    id: "data-merge-doublons",
    topic: "data",
    kind: "bug",
    level: 2,
    lang: "python",
    trap: true,
    lesson: "numpy-et-pandas",
    q: "Le chiffre d'affaires total calculé est 30 % plus élevé que celui de la comptabilité. La table clients contient quelques client_id en double (adresses successives). Quelle ligne produit l'erreur ?",
    code: `commandes = pd.read_csv("commandes.csv")    # une ligne par commande
clients = pd.read_csv("clients.csv")        # client_id, ville, adresse
df = commandes.merge(clients, on="client_id", how="left")
ca_total = df["montant"].sum()
ca_par_ville = df.groupby("ville")["montant"].sum()`,
    line: 3,
    explain: "Chaque commande d'un client présent deux fois dans clients est dupliquée par la jointure : le montant est compté deux fois. Le merge ne prévient pas.",
    fix: "Dédupliquer clients (garder l'adresse la plus récente) puis merge(..., validate=\"many_to_one\"), qui lève une erreur si la clé n'est pas unique à droite. Et toujours comparer le nombre de lignes avant et après.",
  },
  {
    id: "data-manquants",
    topic: "data",
    kind: "qcm",
    level: 1,
    trap: true,
    lesson: "feature-engineering",
    q: "30 % des lignes ont au moins une valeur manquante, réparties sur plusieurs colonnes. Que fais-tu en premier ?",
    options: [
      "Supprimer toutes les lignes incomplètes",
      "Comprendre pourquoi les valeurs manquent, puis imputer (ajustée sur le train) en ajoutant si utile un indicateur « manquant »",
      "Remplacer tout par 0",
      "Supprimer toutes les colonnes concernées",
    ],
    answer: 1,
    explain: "Supprimer 30 % des lignes jette de l'information et biaise l'échantillon si les manquants ne sont pas aléatoires. Le fait qu'une valeur manque est parfois prédictif lui-même. L'imputation s'ajuste sur le train, dans le pipeline ; les modèles de boosting gèrent aussi les manquants nativement.",
  },
  {
    id: "data-cardinalite",
    topic: "data",
    kind: "oral",
    level: 2,
    lesson: "feature-engineering",
    q: "Comment encodes-tu une variable catégorielle à très forte cardinalité, comme 30 000 codes postaux ?",
    points: [
      "One-hot : trop de colonnes, catégories rares mal estimées",
      "Target encoding avec lissage et calcul hors pli (out-of-fold) pour éviter la fuite",
      "Encodage par fréquence, regroupement des catégories rares",
      "Hashing ou embeddings appris (réseaux de neurones)",
      "Remonter à des variables plus générales (département, données démographiques) ; encodage natif de CatBoost ou LightGBM",
    ],
    answer:
      "Le one-hot produirait 30 000 colonnes clairsemées et des catégories trop rares pour être estimées. Je commencerais par regrouper : département, ou variables externes par code postal (densité, revenu médian). Ensuite un target encoding lissé vers la moyenne globale, calculé hors pli pour ne pas encoder la cible de la ligne elle-même. Alternatives : fréquence, hashing, embeddings dans un réseau, ou le traitement natif des catégories de CatBoost. Je valide le gain par CV.",
  },
  {
    id: "data-groupby-transform",
    topic: "data",
    kind: "bug",
    level: 2,
    lang: "python",
    lesson: "numpy-et-pandas",
    q: "On veut ajouter à chaque commande le montant moyen du client. La nouvelle colonne ne contient presque que des NaN. Quelle ligne est fautive ?",
    code: `df = pd.read_csv("commandes.csv")   # commande_id, client_id, montant
df["moy_client"] = df.groupby("client_id")["montant"].mean()
df["ecart"] = df["montant"] - df["moy_client"]
print(df.head())`,
    line: 2,
    explain: "groupby().mean() renvoie une série indexée par client_id (une ligne par client). L'assignation aligne sur l'index : seules les lignes dont l'index coïncide avec un client_id reçoivent une valeur, et pas la bonne.",
    fix: "df[\"moy_client\"] = df.groupby(\"client_id\")[\"montant\"].transform(\"mean\"), qui renvoie une valeur par ligne d'origine.",
  },
  {
    id: "data-smote",
    topic: "data",
    kind: "qcm",
    level: 2,
    trap: true,
    q: "Pour un problème déséquilibré, un collègue applique SMOTE sur tout le jeu, puis fait une validation croisée. Le recall est excellent. Problème ?",
    options: [
      "Aucun",
      "Les exemples synthétiques créés à partir de points de validation se retrouvent dans l'entraînement : fuite, score surestimé. Il faut rééchantillonner uniquement dans les plis d'entraînement",
      "SMOTE ne fonctionne qu'avec des images",
      "Il faut appliquer SMOTE sur le test aussi",
    ],
    answer: 1,
    explain: "Tout rééchantillonnage se fait à l'intérieur de la boucle de validation, sur le train de chaque pli (imblearn.pipeline). Le jeu de validation garde la distribution réelle. Souvent, des poids de classe ou un seuil ajusté suffisent.",
  },
  {
    id: "data-outliers",
    topic: "data",
    kind: "oral",
    level: 1,
    q: "Comment détectes-tu et traites-tu les valeurs aberrantes ?",
    points: [
      "Visualiser (boxplot, histogramme, nuage de points) et règles simples (IQR, z-score robuste)",
      "Comprendre l'origine : erreur de saisie ou vraie valeur extrême",
      "Corriger ou retirer les erreurs ; garder les vrais extrêmes s'ils existent en production",
      "Réduire leur influence : transformation log, winsorisation, loss robuste (Huber, MAE), modèles d'arbres",
      "Décider à partir du train, et le documenter",
    ],
    answer:
      "Je commence par regarder : distributions, boxplots, règles de type IQR ou écart à la médiane, et croisements entre variables (un âge de 3 ans avec un crédit immobilier). Puis je cherche la cause : une erreur (unité, saisie, valeur sentinelle comme 999999) se corrige ou se retire ; une vraie valeur extrême doit souvent rester, car le modèle la rencontrera en production. Pour limiter son influence : transformation log, plafonnement, loss robuste ou modèle peu sensible comme les arbres. Les seuils sont fixés sur le train.",
  },
  {
    id: "data-lag-fuite",
    topic: "data",
    kind: "qcm",
    level: 2,
    trap: true,
    lesson: "feature-engineering",
    q: "Pour prévoir les ventes du jour J, tu crées la feature « moyenne des ventes sur 7 jours » avec rolling(7).mean(). Le modèle est étonnamment bon. Pourquoi ?",
    options: [
      "Les moyennes glissantes sont toujours très prédictives",
      "La fenêtre inclut les ventes du jour J lui-même : la cible fuit dans la feature. Il faut décaler (shift(1)) avant de calculer la moyenne",
      "Il faut une fenêtre de 30 jours",
      "Le modèle est en underfitting",
    ],
    answer: 1,
    explain: "Une feature temporelle ne doit utiliser que l'information disponible au moment de la prédiction. Si la prévision se fait la veille, il faut même s'arrêter à J−1, voire plus tôt selon le délai de disponibilité des données.",
  },
  {
    id: "data-vectorisation",
    topic: "data",
    kind: "qcm",
    level: 1,
    lesson: "numpy-et-pandas",
    q: "Calculer prix × quantité sur 10 millions de lignes avec df.iterrows() prend 10 minutes. Quelle est la bonne approche ?",
    options: ["Utiliser apply avec une lambda", "df[\"total\"] = df[\"prix\"] * df[\"quantite\"] : opération vectorisée", "Paralléliser la boucle", "Convertir en liste Python"],
    answer: 1,
    explain: "Les opérations vectorisées s'exécutent en code compilé sur des tableaux entiers : souvent 100 à 1 000 fois plus rapides qu'une boucle Python. apply reste une boucle Python ligne par ligne.",
  },
  {
    id: "data-mutable-default",
    topic: "data",
    kind: "bug",
    level: 1,
    lang: "python",
    trap: true,
    q: "Classique d'entretien Python : le deuxième appel affiche ['a', 'b'] au lieu de ['b']. Quelle ligne est fautive ?",
    code: `def ajouter_tag(tag, tags=[]):
    tags.append(tag)
    return tags

print(ajouter_tag("a"))
print(ajouter_tag("b"))`,
    line: 1,
    explain: "La valeur par défaut est évaluée une seule fois, à la définition de la fonction : la même liste est partagée entre tous les appels.",
    fix: "def ajouter_tag(tag, tags=None): puis if tags is None: tags = [] au début du corps.",
  },
  {
    id: "data-dedup-sql",
    topic: "data",
    kind: "qcm",
    level: 2,
    lesson: "sql-pour-la-data",
    q: "Pour garder la commande la plus récente de chaque client, quelle construction est la plus adaptée ?",
    options: [
      "SELECT DISTINCT client_id, date_commande, montant FROM commandes",
      "ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY date_commande DESC) dans une sous-requête, puis filtrer sur le rang 1",
      "GROUP BY client_id avec MAX(date_commande) et montant non agrégé",
      "ORDER BY date_commande DESC LIMIT 1",
    ],
    answer: 1,
    explain: "DISTINCT ne déduplique que les lignes identiques. Le GROUP BY avec une colonne non agrégée est invalide (ou arbitraire selon le moteur). LIMIT 1 renvoie une seule ligne au total. La window function numérote dans chaque client.",
  },
];
