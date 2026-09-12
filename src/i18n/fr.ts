// All user-facing strings live here (see CLAUDE.md). Never hardcode French in components.

export const fr = {
  app: {
    name: '101améliorations',
    tagline:
      'Signalement des problèmes sur les voies cyclables du Pays basque et du sud des Landes',
  },
  common: {
    loading: 'Chargement…',
    error: 'Une erreur est survenue.',
    retry: 'Réessayer',
    anonymousAuthor: 'Usager',
    backToMap: '← Retour à la carte',
    close: 'Fermer',
  },
  category: {
    category_1: 'Catégorie 1',
    category_2: 'Catégorie 2',
    category_3: 'Catégorie 3',
    category_4: 'Catégorie 4',
    category_5: 'Catégorie 5',
  },
  urgency: {
    low: 'Urgence faible',
    medium: 'Urgence moyenne',
    high: 'Urgence élevée',
  },
  status: {
    new: 'Nouveau',
    acknowledged: 'Pris en compte',
    in_progress: 'En cours de traitement',
    resolved: 'Résolu',
    rejected: 'Rejeté',
    duplicate: 'Doublon',
  },
  notFound: {
    title: 'Page introuvable',
    body: "Cette page n'existe pas.",
  },
  map: {
    loadError: 'Impossible de charger les klashs de cette zone.',
    viewDetail: 'Voir le détail',
    confirmationsCount: (count: number) =>
      count === 0
        ? 'Aucune confirmation'
        : count === 1
          ? '1 confirmation'
          : `${count} confirmations`,
    reportHere: 'Signaler ici',
    longPressHint: 'Astuce : maintenez appuyé sur la carte pour signaler à un point précis.',
  },
  detail: {
    notFoundTitle: 'Signalement introuvable',
    notFoundBody: "Ce klash n'existe pas ou n'est plus visible.",
    loadError: 'Impossible de charger ce signalement.',
    reportedBy: 'Signalé par',
    resolvedOn: (date: string) => `Résolu le ${date}`,
    updatedOn: (date: string) => `Mis à jour le ${date}`,
    confirmations: 'Confirmations',
    duplicateOfNotice: "Ce signalement est marqué comme doublon d'un autre klash.",
    confirm: 'Je confirme',
    confirmed: 'Confirmé ✓',
    confirmError: "Impossible d'enregistrer votre confirmation.",
  },
  auth: {
    signIn: 'Se connecter',
    mySpace: 'Mon espace',
  },
  login: {
    title: 'Connexion',
    emailStep: {
      label: 'Adresse email',
      placeholder: 'vous@exemple.fr',
      submit: 'Recevoir le code',
      submitting: 'Envoi en cours…',
    },
    codeStep: {
      instructions: (email: string) => `Saisissez le code à 6 chiffres envoyé à ${email}.`,
      label: 'Code de connexion',
      submit: 'Valider',
      submitting: 'Vérification…',
      changeEmail: "Modifier l'adresse",
      resend: 'Renvoyer un code',
      resendCooldown: (seconds: number) => `Renvoyer un code (${seconds}s)`,
    },
    nicknameStep: {
      title: 'Choisissez un pseudo',
      body: 'Facultatif : il sera affiché sur vos signalements. Sans pseudo, vous apparaissez comme « Usager ».',
      label: 'Pseudo',
      invalidLength: 'Le pseudo doit contenir entre 2 et 40 caractères.',
      submit: 'Enregistrer',
      skip: 'Passer',
    },
    errors: {
      invalidEmail: 'Adresse email invalide.',
      invalidOrExpiredCode: 'Code incorrect ou expiré. Vérifiez le code ou demandez-en un nouveau.',
      rateLimited: 'Trop de tentatives. Veuillez réessayer dans quelques minutes.',
      signupDisabled: 'Les inscriptions sont temporairement fermées.',
      network: 'Impossible de contacter le serveur. Vérifiez votre connexion.',
      unknown: 'Une erreur est survenue. Veuillez réessayer.',
    },
  },
  me: {
    title: 'Mon espace',
    myKlashes: 'Mes signalements',
    myKlashesEmpty: "Vous n'avez pas encore signalé de klash.",
    myKlashesEmptyCta: 'Voir la carte',
    loadError: 'Impossible de charger vos signalements.',
    pseudoLabel: 'Pseudo',
    pseudoSave: 'Enregistrer',
    pseudoSaved: 'Pseudo enregistré.',
    signOut: 'Se déconnecter',
  },
  newKlash: {
    title: 'Signaler un problème',
    cancel: 'Annuler',
    outOfArea: {
      title: 'Hors zone de signalement',
      body: "Ce point est hors du Pays basque et du sud des Landes, la zone couverte par l'application. Déplacez le repère pour continuer.",
    },
    position: {
      title: 'Position du problème',
      instructions: 'Déplacez le repère pour ajuster la position exacte.',
      accuracyGood: (accuracyM: number) => `Précision GPS : ${Math.round(accuracyM)} m`,
      accuracyPoor: 'Précision GPS insuffisante : affinez la position manuellement.',
      geolocationDenied: 'Géolocalisation indisponible : placez le repère manuellement.',
      continue: 'Continuer',
    },
    duplicates: {
      title: 'Signalements à proximité',
      body: 'Un ou plusieurs signalements existent déjà près de cette position. Est-ce le même problème ?',
      sameProblem: "C'est le même problème → je confirme",
      differentProblem: "Non, c'est un autre problème → continuer",
      loadError: 'Impossible de vérifier les doublons.',
      confirmed: 'Confirmation enregistrée. Merci !',
    },
    form: {
      title: 'Décrire le problème',
      categoryLabel: 'Catégorie',
      urgencyLabel: 'Urgence',
      titleLabel: 'Titre',
      titlePlaceholder: 'Ex. : nid de poule sur la piste cyclable',
      descriptionLabel: 'Description (facultative)',
      descriptionPlaceholder: 'Précisez si besoin…',
      invalidTitle: 'Le titre doit contenir entre 5 et 120 caractères.',
      invalidDescription: 'La description ne peut pas dépasser 2000 caractères.',
      submit: 'Continuer',
    },
    submit: {
      loginIntro: 'Pour envoyer votre signalement, connectez-vous.',
      submitting: 'Envoi du signalement…',
      submitError: "Impossible d'envoyer ce signalement.",
      outOfAreaError: 'Ce point est hors de la zone de signalement.',
      rateLimitError: "Vous avez atteint la limite de signalements pour aujourd'hui.",
      done: {
        title: 'Signalement envoyé !',
        body: 'Merci, votre signalement a été transmis.',
        viewIt: 'Voir mon signalement',
        backToMap: 'Retour à la carte',
      },
    },
  },
} as const
