import type { ItvQuestion } from "./types";

export const LLM: ItvQuestion[] = [
  {
    id: "llm-attention",
    topic: "llm",
    kind: "oral",
    level: 1,
    lesson: "self-attention",
    q: "Explique le mécanisme de self-attention.",
    points: [
      "Chaque token est projeté en query, key et value (matrices apprises)",
      "Scores = QKᵀ / √d_k, puis softmax : poids d'attention de chaque token sur les autres",
      "Sortie = moyenne pondérée des values",
      "Plusieurs têtes en parallèle pour capter différentes relations",
      "Masque causal dans un décodeur ; coût quadratique en longueur de séquence",
    ],
    answer:
      "Chaque token produit trois vecteurs : une query (ce qu'il cherche), une key (ce qu'il offre) et une value (ce qu'il transmet). On calcule le produit scalaire de la query avec toutes les keys, divisé par √d_k, puis un softmax qui donne des poids ; la sortie du token est la somme des values pondérée par ces poids. Ainsi « il » peut aller chercher l'information de « le chat » dix tokens plus tôt. On fait cela dans plusieurs têtes en parallèle, puis on concatène. Dans un modèle génératif, un masque causal interdit de regarder les tokens futurs. Le coût est en O(n²) en longueur, ce qui motive le KV cache, FlashAttention et les variantes efficaces.",
  },
  {
    id: "llm-sqrt-dk",
    topic: "llm",
    kind: "qcm",
    level: 2,
    lesson: "self-attention",
    q: "Pourquoi divise-t-on les scores d'attention par √d_k ?",
    options: [
      "Pour économiser de la mémoire",
      "Le produit scalaire de vecteurs de dimension d_k a une variance proportionnelle à d_k ; sans mise à l'échelle, le softmax sature et ses gradients deviennent minuscules",
      "Pour que les poids somment à 1",
      "Pour rendre l'attention causale",
    ],
    answer: 1,
    explain: "Avec des composantes de variance 1, q·k a une variance d_k. Diviser par √d_k ramène la variance à 1 et garde le softmax dans une zone où il n'est pas quasi binaire.",
  },
  {
    id: "llm-masque-bug",
    topic: "llm",
    kind: "bug",
    level: 2,
    lang: "python",
    trap: true,
    lesson: "self-attention",
    q: "Cette attention causale laisse quand même chaque token regarder les tokens futurs. Quelle ligne est fautive ?",
    code: `scores = q @ k.transpose(-2, -1) / math.sqrt(d_k)
masque = torch.tril(torch.ones(n, n, dtype=torch.bool))
scores = scores.masked_fill(~masque, 0.0)
poids = torch.softmax(scores, dim=-1)
sortie = poids @ v`,
    line: 3,
    explain: "Un score de 0 n'interdit rien : après softmax, exp(0) = 1 donne un poids non nul aux tokens futurs. Il faut un score de −∞ pour obtenir un poids exactement nul.",
    fix: "scores = scores.masked_fill(~masque, float(\"-inf\")).",
  },
  {
    id: "llm-kv-cache",
    topic: "llm",
    kind: "calcul",
    level: 2,
    lesson: "inference-llm",
    q: "Un modèle a 32 couches, 32 têtes de dimension 128 (sans GQA), en fp16. Quelle est la taille du KV cache pour une séquence de 4 096 tokens, en Gio ?",
    answer: 2,
    tolerance: 0.02,
    unit: "Gio",
    explain: "Par token et par couche : K et V, soit 2 × 32 × 128 = 8 192 valeurs × 2 octets = 16 Kio. × 32 couches = 512 Kio par token. × 4 096 tokens = 2 Gio, par séquence. D'où l'intérêt du GQA, de la quantization du cache et du paged attention pour servir beaucoup d'utilisateurs.",
  },
  {
    id: "llm-memoire-poids",
    topic: "llm",
    kind: "calcul",
    level: 1,
    lesson: "inference-llm",
    q: "Combien de Go faut-il pour stocker les poids d'un modèle de 7 milliards de paramètres en fp16 ?",
    answer: 14,
    tolerance: 0.2,
    unit: "Go",
    explain: "7 × 10⁹ × 2 octets = 14 Go. En int4, environ 3,5 Go. Il faut ajouter le KV cache et les activations ; pour l'entraînement complet avec Adam, compter plutôt 16 octets par paramètre.",
  },
  {
    id: "llm-temperature",
    topic: "llm",
    kind: "qcm",
    level: 1,
    lesson: "decodage-et-sampling",
    q: "Tu extrais des champs d'une facture en JSON avec un LLM. Quel réglage de génération ?",
    options: [
      "Température élevée pour plus de créativité",
      "Température basse (ou 0), avec une sortie structurée contrainte par un schéma",
      "Top-p à 1 et température 2",
      "Peu importe",
    ],
    answer: 1,
    explain: "Pour de l'extraction, on veut la réponse la plus probable et reproductible. Le décodage contraint (JSON schema, structured outputs) garantit un format valide ; on valide ensuite le contenu côté code.",
  },
  {
    id: "llm-rag-vs-ft",
    topic: "llm",
    kind: "oral",
    level: 2,
    lesson: "rag",
    q: "RAG ou fine-tuning : comment choisis-tu ?",
    points: [
      "RAG pour des connaissances : documents qui changent, besoin de citer les sources, droits d'accès",
      "Fine-tuning pour un comportement : format, style, tâche spécialisée, vocabulaire, prompts plus courts",
      "Le fine-tuning injecte mal des faits précis et ne se met pas à jour facilement",
      "Commencer par le prompting et le RAG, mesurer, puis fine-tuner si nécessaire",
      "Les deux se combinent",
    ],
    answer:
      "Ils répondent à des besoins différents. Si le problème est que le modèle ne connaît pas l'information (documentation interne, données qui changent chaque semaine), le RAG est le bon outil : mise à jour immédiate, sources citables, filtrage par droits d'accès. Si le problème est la manière de répondre (format strict, ton, tâche de classification spécialisée, latence ou coût avec de longs prompts), le fine-tuning, souvent en LoRA, est adapté. J'avance par étapes mesurées sur un jeu d'évaluation : prompt, puis RAG, puis fine-tuning, et je combine les deux si besoin.",
  },
  {
    id: "llm-eval-rag",
    topic: "llm",
    kind: "oral",
    level: 2,
    lesson: "rag",
    q: "Comment évalues-tu un système RAG ?",
    points: [
      "Jeu de questions représentatif avec réponses et passages de référence",
      "Retrieval séparément : recall@k, MRR sur les passages attendus",
      "Génération : fidélité aux sources (pas d'affirmation non supportée), pertinence, exactitude, citations",
      "LLM juge avec grille, calibré sur des annotations humaines",
      "Cas sans réponse dans les documents : le système doit le dire",
    ],
    answer:
      "Je construis d'abord un jeu de questions réelles avec la réponse attendue et les passages qui la justifient. J'évalue le retrieval seul (recall@k, MRR) : si le bon passage n'est pas retrouvé, la génération ne peut pas réussir. Puis la génération : exactitude, fidélité (chaque affirmation est-elle soutenue par le contexte ?), citations correctes, à l'aide d'un LLM juge avec une grille précise, validé sur un échantillon annoté. J'inclus des questions hors périmètre pour vérifier qu'il refuse de répondre, et je suis la latence et le coût. Chaque changement (chunking, embeddings, reranker, prompt) est comparé sur ce banc.",
  },
  {
    id: "llm-hallucinations",
    topic: "llm",
    kind: "qcm",
    level: 2,
    lesson: "rag",
    q: "Un assistant interne invente des procédures qui n'existent pas. Quelle combinaison réduit le plus le problème ?",
    options: [
      "Augmenter la température",
      "RAG sur la documentation, consigne de répondre uniquement à partir du contexte avec citations, possibilité de dire « je ne sais pas », et évaluation de la fidélité",
      "Un modèle plus petit",
      "Supprimer le prompt système",
    ],
    answer: 1,
    explain: "Les hallucinations viennent d'un modèle qui génère du plausible sans source. On lui donne les sources, on exige qu'il les cite, on autorise l'abstention et on mesure la fidélité. Aucune méthode ne les élimine totalement : on mesure et on surveille.",
  },
  {
    id: "llm-lora-params",
    topic: "llm",
    kind: "calcul",
    level: 2,
    lesson: "pre-entrainement-et-fine-tuning",
    q: "LoRA de rang r = 8 sur une matrice de poids de 4 096 × 4 096. Combien de paramètres entraînables pour cette matrice ?",
    answer: 65536,
    tolerance: 0,
    explain: "ΔW = B·A avec A de taille 8 × 4 096 et B de taille 4 096 × 8 : 2 × 4 096 × 8 = 65 536 paramètres, contre 16,8 millions pour la matrice complète (0,4 %).",
  },
  {
    id: "llm-tokens-lettres",
    topic: "llm",
    kind: "qcm",
    level: 1,
    lesson: "tokenisation",
    q: "Pourquoi un LLM se trompe-t-il souvent quand on lui demande combien de « r » contient un mot ?",
    options: [
      "Il ne connaît pas l'alphabet",
      "Il voit des tokens (morceaux de mots), pas des lettres : l'orthographe exacte n'est pas directement visible",
      "Sa température est trop haute",
      "Il manque de paramètres",
    ],
    answer: 1,
    explain: "La tokenisation BPE découpe le texte en sous-mots. Le modèle doit avoir appris de quelles lettres est fait chaque token, ce qui est imparfait. Même cause pour certaines difficultés en arithmétique.",
  },
  {
    id: "llm-padding-gen",
    topic: "llm",
    kind: "bug",
    level: 3,
    lang: "python",
    trap: true,
    lesson: "inference-llm",
    q: "Génération en batch avec un modèle décodeur : les réponses des prompts courts sont incohérentes. Quelle ligne est en cause ?",
    code: `tokenizer = AutoTokenizer.from_pretrained(nom_modele)
tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right"
batch = tokenizer(prompts, return_tensors="pt", padding=True)
sorties = model.generate(**batch, max_new_tokens=100)`,
    line: 3,
    explain: "Un décodeur génère à la suite du dernier token de chaque ligne. Avec un padding à droite, les prompts courts se terminent par des tokens de padding : le modèle continue après eux.",
    fix: "tokenizer.padding_side = \"left\" pour la génération (le padding à droite convient à l'entraînement).",
  },
  {
    id: "llm-embeddings-rag",
    topic: "llm",
    kind: "bug",
    level: 2,
    lang: "python",
    lesson: "rag",
    q: "La recherche du RAG ramène des passages sans rapport avec la question. Quelle ligne est fautive ?",
    code: `emb_docs = modele_a.encode(chunks, normalize_embeddings=True)
index.add(emb_docs)

def chercher(question, k=5):
    q = modele_b.encode([question], normalize_embeddings=True)
    scores, ids = index.search(q, k)
    return [chunks[i] for i in ids[0]]`,
    line: 5,
    explain: "Les documents et la question doivent être encodés par le même modèle d'embeddings : deux modèles différents produisent des espaces sans correspondance, même à dimension égale.",
    fix: "Utiliser modele_a pour la question (avec son éventuel préfixe de requête), et réindexer tout le corpus si l'on change de modèle.",
  },
  {
    id: "llm-agent-boucle",
    topic: "llm",
    kind: "bug",
    level: 2,
    lang: "python",
    lesson: "boucle-agent",
    q: "En production, une session de cet agent a coûté 400 € en une nuit. Quelle ligne est en cause ?",
    code: `messages = [systeme, {"role": "user", "content": tache}]
while True:
    reponse = llm.generate(messages=messages, tools=outils)
    if not reponse.tool_calls:
        break
    for appel in reponse.tool_calls:
        messages.append(executer(appel))`,
    line: 2,
    explain: "Rien n'arrête un agent qui boucle (outil en erreur qu'il réessaie, tâche impossible). Et le contexte grandit à chaque tour, donc chaque appel coûte plus cher que le précédent.",
    fix: "for etape in range(MAX_ETAPES): … avec un budget de tokens ou de coût, et un arrêt propre avec message à l'utilisateur.",
  },
  {
    id: "llm-injection",
    topic: "llm",
    kind: "oral",
    level: 3,
    lesson: "securite-des-agents",
    q: "Un agent lit les e-mails des clients et peut émettre des remboursements. Comment le protèges-tu contre l'injection de prompt ?",
    points: [
      "Partir du principe que l'injection réussira parfois : limiter les conséquences",
      "Moindre privilège : outils et données strictement nécessaires",
      "Contraintes déterministes dans l'outil : plafond, commande appartenant au client, liste blanche",
      "Validation humaine des actions irréversibles ou au-delà d'un seuil",
      "Journalisation, alertes, cas d'attaque dans l'évaluation ; pas de secrets dans le contexte",
    ],
    answer:
      "Le contenu des e-mails est non fiable et le modèle ne distingue jamais parfaitement données et instructions. Je mets donc les garanties dans le code : l'outil de remboursement vérifie que la commande appartient à l'expéditeur authentifié, applique un plafond et refuse sinon, quoi que demande le modèle. Au-delà d'un seuil, une validation humaine qui voit le montant et la commande. L'agent n'a pas d'outil d'envoi vers l'extérieur ni d'accès aux autres clients. Tout appel d'outil est journalisé, et des e-mails piégés font partie du banc d'évaluation à chaque version.",
  },
  {
    id: "llm-alignement",
    topic: "llm",
    kind: "qcm",
    level: 2,
    lesson: "pre-entrainement-et-fine-tuning",
    q: "Qu'apportent le fine-tuning supervisé sur instructions puis RLHF ou DPO à un modèle de base pré-entraîné ?",
    options: [
      "Ils lui apprennent l'essentiel de ses connaissances",
      "Ils le transforment en assistant : suivre des instructions, format de dialogue, préférences humaines (utilité, refus appropriés)",
      "Ils réduisent sa taille",
      "Ils remplacent la tokenisation",
    ],
    answer: 1,
    explain: "Les connaissances viennent surtout du pré-entraînement. Le SFT montre des exemples de bonnes réponses ; RLHF ou DPO optimisent à partir de comparaisons entre réponses préférées et rejetées.",
  },
  {
    id: "llm-long-contexte",
    topic: "llm",
    kind: "qcm",
    level: 2,
    trap: true,
    lesson: "memoire-et-contexte",
    q: "Le modèle accepte un million de tokens. Un collègue propose de supprimer le RAG et de mettre toute la base documentaire dans chaque prompt. Ton avis ?",
    options: [
      "Parfait, plus de contexte donne toujours de meilleures réponses",
      "Coût et latence à chaque requête, informations noyées que le modèle exploite moins bien, pas de contrôle des droits d'accès : la recherche ciblée reste utile",
      "C'est impossible techniquement",
      "Il faut aussi augmenter la température",
    ],
    answer: 1,
    explain: "Chaque token se paie à chaque appel, et la qualité baisse quand l'information utile est diluée. Le long contexte est utile pour analyser un gros document précis ; pour une base qui grandit, un retrieval ciblé (avec prompt caching des parties stables) reste plus fiable et moins cher.",
  },
];
