# Suivi des campagnes et attribution

101améliorations est diffusée par plusieurs canaux (Txirrind'Ola, la presse, la CPAM).
Ce document décrit comment on sait par quel canal arrive un visiteur, comment créer un
lien de campagne, et quelles données sont stockées (utile pour la politique de
confidentialité, déjà à jour dans `src/i18n/fr.ts`).

## Convention de nommage

| Champ      | Sens                               | Exemple                                                                          |
| ---------- | ---------------------------------- | -------------------------------------------------------------------------------- |
| `source`   | qui communique (liste extensible)  | `txdo`, `presse`, `cpam`                                                         |
| `medium`   | type de support, **liste fermée**  | `unspecified` (« Non précisé », par défaut), `social`, `email`, `print`, `press` |
| `campaign` | l'opération et sa date             | `lancement-2026-10`                                                              |
| `content`  | le support précis (peut être vide) | `papillon-velo`                                                                  |

Toutes les valeurs : minuscules, sans accents, sans espaces, mots séparés par des
tirets (`^[a-z0-9]+(-[a-z0-9]+)*$`, 64 caractères au plus). La règle est vérifiée **en
base** (`is_campaign_token()`), jamais seulement dans le navigateur. Dans la page
Campagnes on ne saisit jamais de `utm_*` : les champs « précision » et « nom de
campagne » sont du texte libre, normalisé automatiquement.

Un émetteur (une source) se crée directement dans le formulaire « Créer un lien »,
sans migration ni déploiement : voir ci-dessous. Les noms `direct` et `referral` sont
réservés (ce sont les sources de l'attribution sans lien) et refusés.

La clé d'un émetteur (ex. `office-tourisme`) est définitive dès qu'un lien l'utilise :
la base interdit de la modifier, même par migration. Seul son **libellé** (ce que
l'on voit dans les listes) peut se corriger, par une migration
(`update campaign_sources set label = …`).

## Ajouter un type de support

La liste des supports est le type Postgres `public.campaign_medium`, et lui seul : la
validation SQL de l'attribution (`sanitize_attribution_touch`), le formulaire, la lecture
des `utm_*` à l'arrivée et le Worker du manifeste iOS la lisent depuis le type généré
(`src/types/database.ts`). Pour ajouter un support :

1. Une migration d'une ligne, avec `before` ou `after` pour fixer sa place dans la liste
   déroulante (l'ordre du formulaire est celui du type) :
   `alter type public.campaign_medium add value 'video' after 'print';`
2. `npx supabase db reset` puis `npm run gen:types`.
3. Le libellé dans `fr.campaigns.medium` (`src/i18n/fr.ts`). Un libellé oublié fait
   échouer `npm run typecheck` (`MEDIUM_LABELS`, `src/features/campaigns/campaignLabels.ts`).

Déploiement : appliquer la migration en production (`npx supabase db push`) **avant** de
fusionner, sinon le front connaîtrait une valeur que la base refuse. Dans l'autre sens,
un lien créé avec la nouvelle valeur avant le déploiement du front ferait échouer
l'affichage de `/campaigns` tant que l'ancien front est en ligne.

## Créer une campagne et un lien

Réservé aux comptes qui ont le droit « Peut créer et suivre les liens de campagne »
(`profiles.can_manage_campaigns`) et aux administrateurs. Ce droit est distinct des
rôles : un administrateur le donne dans **Administration → Rôles** (recherche par email,
case à cocher). Il se cumule avec n'importe quel rôle, et il est indépendant de
l'administration : un compte qui n'a que ce droit n'accède pas à `/admin`, un modérateur
qui ne l'a pas n'accède pas aux campagnes.

La page s'ouvre depuis **Mon espace → Gérer les campagnes** (`/campaigns`). Elle a deux
onglets : **Liens** (créer, retrouver, copier) et **Résultats** (les chiffres).

1. **Onglet Liens → Créer un lien.**
2. Choisir l'émetteur, le type de support et saisir la précision (ex. « papillon vélo »).
   Pour un nouvel émetteur, choisir « Nouvel émetteur… » en bas de la liste et saisir son
   nom (ex. « Office de tourisme ») : l'identifiant qui en découle (`office-de-tourisme`)
   s'affiche et apparaîtra dans l'adresse courte. Si le nom correspond à un émetteur
   existant (« Association » → `txdo`), celui-ci est utilisé. L'émetteur n'est créé qu'à
   l'étape 4, après une confirmation.
3. Campagne : en choisir une existante, ou « Nouvelle campagne… » (nom + mois, ex.
   « lancement » + octobre 2026 → `lancement-2026-10`).
4. **Créer le lien.** L'écran affiche l'adresse courte (`https://101ameliorations.org/r/<slug>`)
   à copier et le QR code : image à copier, ou à télécharger en SVG (impression) et en PNG
   haute résolution. Le QR encode l'adresse **courte** : la destination peut changer sans
   réimprimer.
5. Taille d'impression : au moins 2 cm de côté pour un papillon ; pour une affiche,
   environ un dixième de la distance de lecture.

Pour retrouver un lien plus tard : l'onglet Liens liste les liens actifs (filtres par
campagne et par émetteur ; case « Afficher les liens désactivés »). Sur chaque ligne,
**Copier le lien**, **QR code** (se déplie sous la ligne, un seul à la fois pour ne pas
scanner le mauvais) et **Modifier** (destination, désactiver / réactiver).

Le slug est généré (`source` + premier mot de la précision, sinon précision complète,
sinon suffixe `-2`, `-3`…), unique, immuable et jamais réutilisé. **Un lien ne se
supprime pas** (un QR imprimé reste en circulation) : on le désactive, et il renvoie
alors vers l'accueil. Seules la destination (un chemin interne, `/` par défaut) et l'état
actif/désactivé sont modifiables ; source, support, campagne et précision sont figés.

Sur une adresse de test (preview, localhost) l'écran avertit que l'adresse n'est pas
l'officielle : n'imprimez que des QR créés depuis `101ameliorations.org`.

## Comment ça marche

1. `/r/<slug>` (Worker `workers/app/src/redirect.ts`) enregistre le passage et répond
   par une redirection 302, `Cache-Control: no-store`, vers la destination avec
   `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`. Slug inconnu ou lien
   désactivé : redirection vers l'accueil sans paramètres. Les robots d'aperçu de liens
   (messageries, réseaux sociaux) et les requêtes `HEAD` ne sont pas comptés.
2. À l'arrivée, l'app (`src/features/attribution/`) lit les `utm_*`, mémorise dans le
   navigateur `first_touch` (écrit une seule fois) et `last_touch` (mis à jour à chaque
   arrivée avec utm), puis retire les `utm_*` de l'adresse. Sans utm mais avec un
   referrer externe (article de presse publiant l'adresse nue), seul le **nom de domaine**
   du referrer est conservé. `launch=pwa` ne modifie jamais l'attribution.
3. À la création du compte, les deux touches sont transmises au serveur, qui les
   **revalide** (longueur, caractères, liste fermée des supports) et les stocke dans
   `profile_attributions`. Valeur invalide : le champ est ignoré, l'inscription n'est
   jamais bloquée. Sans attribution : source `direct` ; referrer seul : `referral`.
4. Installation de l'app : événement `appinstalled`, et sur iOS le premier lancement en
   mode standalone, comptés dans `install_events` avec l'attribution du navigateur.
   Sur iOS le stockage de l'app installée est séparé de celui de Safari : le Worker sert
   un manifest dont le `start_url` embarque l'attribution validée, restaurée uniquement
   si le stockage de l'app est vide.
5. Onglet Résultats : scans → inscriptions → installations → klashs, taux de conversion et
   klashs par inscription, par lien, par émetteur et par campagne, attribués au premier ou
   au dernier contact. Une inscription compte quand l'email est confirmé. Les klashs sont
   ceux des comptes venus du canal, hors rejetés et doublons ; à la suppression d'un compte,
   ses klashs passent au profil anonyme et sortent du compteur avec l'inscription.

## Données stockées et où

| Donnée                  | Table                                           | Contenu                                                                                                                               | Accès                                     |
| ----------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Liens                   | `campaign_links`                                | slug, source, medium, campaign, content, destination, actif, auteur, date                                                             | gestionnaires de campagne                 |
| Passages                | `campaign_link_scans`                           | slug, horodatage, lien actif ou non. **Ni IP, ni user-agent, ni identifiant**                                                         | aucun accès direct (compteurs uniquement) |
| Attribution d'un compte | `profile_attributions`                          | source, medium, campaign, content, domaine du referrer, pour first et last touch, `first_seen_at`. Immuable. Supprimée avec le compte | aucun accès direct (agrégats uniquement)  |
| Installations           | `install_events`                                | horodatage, plateforme, first/last touch. **Aucun lien avec un compte ou un appareil**                                                | aucun accès direct (agrégats uniquement)  |
| Navigateur du visiteur  | `localStorage` (`101ameliorations:attribution`) | first/last touch, date de première visite                                                                                             | le visiteur                               |

Les attributions sont dans une table privée et non sur `profiles` (lisible par tous) :
le canal d'un compte ne doit pas être public.

## Mesure des visites (Umami)

Les pages vues sont mesurées avec Umami Cloud, sans cookie, uniquement si
`VITE_UMAMI_WEBSITE_ID` est défini dans le build de production (variable de dépôt
GitHub `VITE_UMAMI_WEBSITE_ID`). La première page vue envoie l'adresse d'arrivée avec ses
`utm_*` (Umami les ventile), les suivantes le chemin seul. Le réglage « Ne pas me suivre »
du navigateur est respecté. La redirection et l'attribution n'en dépendent pas.

## Mise en service

- Déployer avant toute impression : un navigateur qui a l'ancien service worker sert
  l'application sur `/r/*` jusqu'à sa mise à jour automatique.
- Donner le droit « campagnes » aux membres concernés (Administration → Rôles).
- Créer le site dans Umami Cloud et renseigner la variable `VITE_UMAMI_WEBSITE_ID`.
- À valider sur un iPhone réel : installation de l'app avant l'inscription (restauration
  de l'attribution via le manifest iOS).
