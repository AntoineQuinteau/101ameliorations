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
} as const
