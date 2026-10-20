import type { ItvQuestion } from "./types";

export const DEEP: ItvQuestion[] = [
  {
    id: "deep-backprop",
    topic: "deep",
    kind: "oral",
    level: 1,
    lesson: "backpropagation",
    q: "Explique la backpropagation.",
    points: [
      "Passe avant : calcul de la sortie et de la loss, en gardant les activations intermédiaires",
      "Passe arrière : règle de dérivation en chaîne, de la loss vers les premières couches",
      "Chaque couche reçoit le gradient de sa sortie et calcule celui de ses poids et de son entrée",
      "Coût d'environ deux fois la passe avant, mémoire liée aux activations stockées",
      "Les frameworks construisent le graphe et automatisent le calcul (autograd)",
    ],
    answer:
      "C'est le calcul efficace du gradient de la loss par rapport à tous les poids. La passe avant calcule la prédiction et la loss en mémorisant les activations. La passe arrière applique la règle de la chaîne en remontant : chaque opération reçoit ∂L/∂sortie, en déduit ∂L/∂poids pour la mise à jour et ∂L/∂entrée qu'elle transmet à l'opération précédente. Tout le gradient coûte environ deux passes avant, au lieu d'une passe par paramètre. PyTorch enregistre le graphe pendant la passe avant et loss.backward() fait le reste ; l'optimiseur met ensuite les poids à jour.",
  },
  {
    id: "deep-zero-grad",
    topic: "deep",
    kind: "bug",
    level: 1,
    lang: "python",
    lesson: "entrainer-en-pytorch",
    q: "La loss diminue au début puis le modèle diverge de façon erratique. Il manque une instruction dans cette boucle : clique sur la ligne juste avant laquelle elle devrait apparaître.",
    code: `for epoch in range(n_epochs):
    for xb, yb in loader:
        pred = model(xb)
        loss = loss_fn(pred, yb)
        loss.backward()
        optimizer.step()`,
    line: 5,
    explain: "PyTorch accumule les gradients dans .grad à chaque backward(). Sans remise à zéro, chaque pas utilise la somme de tous les gradients précédents.",
    fix: "Ajouter optimizer.zero_grad() avant loss.backward() (en début d'itération).",
  },
  {
    id: "deep-softmax-ce",
    topic: "deep",
    kind: "bug",
    level: 2,
    lang: "python",
    trap: true,
    lesson: "entrainer-en-pytorch",
    q: "Le modèle de classification apprend très lentement et la loss plafonne. Quelle ligne est en cause ?",
    code: `class Classifieur(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(784, 256), nn.ReLU(), nn.Linear(256, 10))
    def forward(self, x):
        return torch.softmax(self.net(x), dim=1)

loss_fn = nn.CrossEntropyLoss()`,
    line: 6,
    explain: "nn.CrossEntropyLoss attend des logits bruts : elle applique elle-même log_softmax. Appliquer un softmax avant revient à faire softmax deux fois, ce qui écrase les gradients.",
    fix: "return self.net(x) ; appliquer softmax uniquement pour afficher des probabilités à l'inférence.",
  },
  {
    id: "deep-eval-mode",
    topic: "deep",
    kind: "bug",
    level: 2,
    lang: "python",
    lesson: "regularisation-deep-learning",
    q: "La précision de validation varie d'une exécution à l'autre sur les mêmes données, et reste inférieure à celle attendue. Quelle ligne est fautive ?",
    code: `def evaluer(model, loader):
    model.train()
    correct = 0
    with torch.no_grad():
        for xb, yb in loader:
            correct += (model(xb).argmax(1) == yb).sum().item()
    return correct / len(loader.dataset)`,
    line: 2,
    explain: "En mode train, le dropout reste actif (prédictions aléatoires) et la batch norm utilise les statistiques du batch au lieu des moyennes apprises.",
    fix: "model.eval() en début d'évaluation, puis model.train() de retour dans la boucle d'entraînement.",
  },
  {
    id: "deep-vanishing",
    topic: "deep",
    kind: "qcm",
    level: 1,
    lesson: "reseaux-de-neurones",
    q: "Un réseau profond à activations sigmoïdes n'apprend presque pas dans ses premières couches. Quelle combinaison de remèdes est la plus pertinente ?",
    options: [
      "Plus de couches sigmoïdes",
      "Activations ReLU (ou GELU), initialisation adaptée, connexions résiduelles et normalisation",
      "Un learning rate plus petit",
      "Supprimer les biais",
    ],
    answer: 1,
    explain: "La dérivée de la sigmoïde vaut au plus 0,25 : multipliée couche après couche, le gradient s'évanouit. ReLU, initialisation He, résidus et normalisation maintiennent un flux de gradient correct.",
  },
  {
    id: "deep-batchnorm-layernorm",
    topic: "deep",
    kind: "qcm",
    level: 2,
    lesson: "regularisation-deep-learning",
    q: "Pourquoi les Transformers utilisent-ils LayerNorm plutôt que BatchNorm ?",
    options: [
      "LayerNorm est plus ancien",
      "LayerNorm normalise chaque exemple sur ses features, indépendamment du batch : adapté aux séquences de longueurs variables, aux petits batchs et à la génération token par token",
      "BatchNorm ne fonctionne qu'en float16",
      "LayerNorm n'a pas de paramètres",
    ],
    answer: 1,
    explain: "BatchNorm dépend des statistiques du batch (problèmes avec padding, petits batchs, inférence d'un seul exemple). LayerNorm (ou RMSNorm) se calcule par token, identique à l'entraînement et à l'inférence.",
  },
  {
    id: "deep-loss-plate",
    topic: "deep",
    kind: "oral",
    level: 2,
    lesson: "entrainer-en-pytorch",
    q: "Ta loss d'entraînement ne descend pas du tout. Quelle est ta démarche de débogage ?",
    points: [
      "Essayer de sur-apprendre un tout petit batch : si impossible, c'est un bug",
      "Vérifier les données : images et étiquettes alignées, préprocessing, normalisation, mélange",
      "Vérifier la boucle : zero_grad, loss adaptée aux sorties (logits contre probabilités), mode train",
      "Learning rate : balayage (trop grand diverge, trop petit stagne)",
      "Inspecter gradients et activations : NaN, normes nulles ou explosives, neurones morts",
    ],
    answer:
      "Je commence par vérifier que le modèle peut sur-apprendre un batch de quelques exemples : sinon il y a un bug, pas un problème de réglage. Ensuite les données : j'affiche quelques exemples avec leurs étiquettes après tout le préprocessing, je vérifie la normalisation et le mélange. Puis la boucle : zero_grad, backward, step, la bonne loss pour la sortie, le mode train. Je teste plusieurs learning rates sur une échelle log. Enfin je regarde les normes des gradients par couche et la distribution des activations pour repérer gradients nuls, NaN ou ReLU mortes. Je compare aussi à une loss de référence (ln(10) ≈ 2,3 pour 10 classes au hasard).",
  },
  {
    id: "deep-transfer",
    topic: "deep",
    kind: "qcm",
    level: 1,
    lesson: "transfer-learning",
    q: "Tu as 800 images étiquetées pour classer 4 types de défauts. Quelle approche ?",
    options: [
      "Entraîner un grand CNN depuis zéro",
      "Partir d'un modèle pré-entraîné : remplacer la tête, l'entraîner avec le backbone gelé, puis dégeler et affiner avec un petit learning rate, avec de l'augmentation de données",
      "Un k-NN sur les pixels",
      "Attendre d'avoir un million d'images",
    ],
    answer: 1,
    explain: "Les features apprises sur de grands jeux (bords, textures, formes) se transfèrent. Avec peu de données, c'est de loin l'option la plus efficace ; la validation doit rester stricte car on overfitte vite.",
  },
  {
    id: "deep-cnn-pourquoi",
    topic: "deep",
    kind: "oral",
    level: 2,
    lesson: "cnn",
    q: "Pourquoi utiliser un CNN plutôt qu'un MLP pour des images ?",
    points: [
      "Connexions locales : un pixel est surtout lié à ses voisins",
      "Partage de poids : le même filtre sur toute l'image, beaucoup moins de paramètres",
      "Équivariance par translation : un motif est détecté où qu'il soit",
      "Hiérarchie : bords, textures, parties, objets au fil des couches",
      "Un MLP sur 224 × 224 × 3 entrées aurait des millions de poids dès la première couche et ignorerait la structure spatiale",
    ],
    answer:
      "Un MLP traite chaque pixel comme une entrée indépendante : sur une image 224 × 224 couleur, une couche de 1 000 neurones a déjà 150 millions de poids, et il doit réapprendre chaque motif à chaque position. Le CNN exploite deux propriétés des images : la localité (un filtre 3 × 3 regarde un voisinage) et la stationnarité (un bord est un bord partout), d'où le partage des poids. Il a beaucoup moins de paramètres, généralise mieux, et ses couches empilées construisent une hiérarchie de features de plus en plus abstraites. Les Vision Transformers concurrencent les CNN avec beaucoup de données ou de pré-entraînement.",
  },
  {
    id: "deep-nan",
    topic: "deep",
    kind: "qcm",
    level: 2,
    lesson: "entrainer-en-pytorch",
    q: "La loss devient NaN après quelques centaines d'itérations. Quelles causes vérifier en premier ?",
    options: [
      "Le jeu de test",
      "Learning rate trop élevé, gradients explosifs, log ou division de zéro, entrées contenant des NaN, débordement en float16",
      "Un modèle trop petit",
      "Le nombre d'époques",
    ],
    answer: 1,
    explain: "Remèdes classiques : baisser le learning rate ou ajouter un warmup, gradient clipping, utiliser les losses numériquement stables (logits plutôt que probabilités), vérifier les données, et le loss scaling en précision mixte.",
  },
  {
    id: "deep-rnn-transformer",
    topic: "deep",
    kind: "qcm",
    level: 2,
    lesson: "rnn-et-lstm",
    q: "Pourquoi les Transformers ont-ils largement remplacé les LSTM pour le texte ?",
    options: [
      "Les LSTM ne peuvent pas traiter de texte",
      "L'attention relie directement toutes les positions et s'entraîne en parallèle sur la séquence, alors qu'un LSTM traite les tokens un par un et peine sur les longues dépendances",
      "Les Transformers ont moins de paramètres",
      "Les LSTM n'ont pas de gradient",
    ],
    answer: 1,
    explain: "Le calcul séquentiel du RNN empêche de paralléliser sur la longueur et transmet l'information pas à pas. L'attention coûte O(n²) en longueur mais exploite parfaitement les GPU, ce qui a permis l'entraînement à très grande échelle.",
  },
  {
    id: "deep-overfit-signal",
    topic: "deep",
    kind: "qcm",
    level: 1,
    lesson: "regularisation-deep-learning",
    q: "La loss de validation remonte depuis l'époque 12 alors que la loss d'entraînement continue de baisser. Que faire ?",
    options: [
      "Entraîner plus longtemps",
      "Garder les poids de l'époque 12 (early stopping) et régulariser : augmentation de données, dropout, weight decay",
      "Augmenter le learning rate",
      "Supprimer le jeu de validation",
    ],
    answer: 1,
    explain: "C'est le signe classique d'overfitting. L'early stopping sauvegarde le meilleur checkpoint sur la validation ; la régularisation retarde le moment où la validation décroche.",
  },
];
