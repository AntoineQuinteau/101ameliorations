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
} as const
