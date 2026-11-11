# Plan — bascule des comptes et du domaine vers l'association

> Plan établi le 2026-11-11. Rien n'est encore fait. Les procédures des services tiers
> (transfert de dépôt, de projet, de domaine) sont décrites telles que connues à cette
> date : relire la documentation du service avant chaque étape marquée « à vérifier ».

## Objectif

L'association Txirrind'Ola est déjà l'éditeur du site et le responsable du traitement
des données (mentions légales, politique de confidentialité). Aujourd'hui pourtant, tous
les comptes techniques, le nom de domaine et la clé de déchiffrement des sauvegardes
sont au nom d'Antoine. Si Antoine devient indisponible, personne ne peut renouveler le
domaine, corriger une panne ni restaurer une sauvegarde.

À la fin de ce plan :

- chaque compte a pour propriétaire `administrateur@txirrindola.org` ;
- Antoine n'y est plus qu'un membre, que l'association peut retirer sans rien casser ;
- le domaine `101ameliorations.org` est au nom de l'association, qui en paie le
  renouvellement ;
- au moins deux personnes de l'association peuvent se connecter partout et déchiffrer
  une sauvegarde, sans Antoine.

Ce plan ne déplace ni la base ni le site : ils restent chez Supabase et Cloudflare.
L'option d'un hébergement chez OVH est chiffrée en annexe.

## Principe : changer le propriétaire, pas le compte

Pour chaque service, deux méthodes existent.

| Méthode                               | Ce qu'on fait                                                                                             | Conséquence technique                                         |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **A — ajouter un propriétaire**       | Inviter `administrateur@` comme propriétaire du compte existant, puis rétrograder Antoine en membre       | Aucune : URL, clés et secrets ne changent pas                 |
| **B — nouveau compte puis transfert** | Créer un compte au nom de l'asso, y transférer ou y recréer la ressource, puis supprimer l'ancienne copie | Clés et secrets à régénérer, CI à repointer, coupure possible |

La méthode A est retenue partout où le service la permet et où le compte actuel ne
contient que 101améliorations. La méthode B ne sert que si le compte actuel d'Antoine
contient aussi des projets personnels (voir « Décisions à prendre », D1).

Pour les services qui n'ont pas de notion de membre, l'adresse du compte devient
`administrateur@` et le mot de passe va dans le gestionnaire de mots de passe de
l'association, auquel Antoine a accès.

## Décisions à prendre avant de commencer

| N°  | Question                                                                                        | Recommandation                                                                                                   | Qui décide       |
| --- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------- |
| D1  | Les comptes Cloudflare et Supabase d'Antoine contiennent-ils autre chose que 101améliorations ? | Si non : méthode A. Si oui : méthode B pour le service concerné                                                  | Antoine          |
| D2  | Où est enregistré le domaine : Cloudflare (compte de l'asso) ou OVH ?                           | Cloudflare si la méthode A s'applique (rien à déplacer) ; OVH si l'asso veut une seule facture pour ses domaines | Asso             |
| D3  | Quel gestionnaire de mots de passe partagé ?                                                    | Celui que l'asso utilise déjà ; sinon en choisir un qui gère aussi les codes à usage unique (TOTP)               | Asso             |
| D4  | Qui sont les deux référents de l'asso (lecture de `administrateur@`, accès au coffre) ?         | Deux personnes nommées, dont une à l'aise avec un terminal pour l'exercice de restauration                       | Asso             |
| D5  | Quel moyen de paiement pour le domaine et pour R2 (carte demandée même en palier gratuit) ?     | Carte de l'association                                                                                           | Asso (trésorier) |

## Vue d'ensemble

| Phase | Contenu                                         | Durée estimée | Risque de coupure                    |
| ----- | ----------------------------------------------- | ------------- | ------------------------------------ |
| 0     | Prérequis : boîte mail, coffre, référents       | 1 h           | Aucun                                |
| 1     | Services périphériques                          | 1 h           | Aucun                                |
| 2     | Dépôt GitHub                                    | 1 h           | Aucun (CI à l'arrêt pendant l'étape) |
| 3     | Supabase                                        | 30 min        | Aucun en méthode A                   |
| 4     | Cloudflare et nom de domaine                    | 1 à 2 h       | Faible en A, réel en B ou vers OVH   |
| 5     | Sauvegardes : seconde clé de déchiffrement      | 30 min        | Aucun                                |
| 6     | Exercice de reprise sans Antoine, documentation | 2 h           | Aucun                                |

Les phases 1 à 5 se font dans cet ordre, une par séance, en visio ou côte à côte avec un
référent qui lit `administrateur@` : chaque création de compte et chaque invitation
envoie un code de validation à cette adresse.

Inventaire de référence des services, variables et secrets :
[`docs/third-party-services.md`](../third-party-services.md).

---

## Phase 0 — prérequis

- [ ] Répondre aux décisions D1 à D5.
- [ ] Les deux référents confirment qu'ils reçoivent bien les messages envoyés à
      `administrateur@txirrindola.org`.
- [ ] Créer dans le gestionnaire de mots de passe un dossier « 101améliorations »,
      partagé entre les deux référents et Antoine.
- [ ] Convenir de la règle pour la double authentification : le secret TOTP de chaque
      compte `administrateur@` est enregistré dans le coffre (pas sur le téléphone d'une
      seule personne), et les codes de secours aussi.
- [ ] Prendre une sauvegarde manuelle juste avant de commencer : **Actions → Backup →
      Run workflow**, puis vérifier qu'elle est verte.

## Phase 1 — services périphériques

Aucun de ces services n'est sur le chemin d'une requête critique : une erreur ici ne
coupe pas l'app. C'est la phase d'échauffement.

Pour chaque service : méthode A si le service gère des membres ou une équipe, sinon
changement de l'adresse du compte vers `administrateur@` et dépôt des identifiants dans
le coffre.

| Service          | À faire                                                                                                | Vérification                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| MapTiler         | Compte au nom de `administrateur@`. La clé `VITE_MAPTILER_KEY` ne change pas si le compte est conservé | La carte s'affiche en production                      |
| Fournisseur SMTP | Compte au nom de `administrateur@`. Les identifiants SMTP saisis dans Supabase ne changent pas         | Demander un code de connexion : l'email arrive        |
| Sentry           | Inviter `administrateur@` comme propriétaire de l'organisation, Antoine reste membre                   | L'asso voit le projet ; les alertes arrivent aux deux |
| Umami Cloud      | Compte ou équipe au nom de `administrateur@`                                                           | Les visites du jour s'affichent                       |
| healthchecks.io  | Transférer le projet à `administrateur@`, ajouter Antoine comme membre                                 | Voir ci-dessous                                       |

- [ ] MapTiler.
- [ ] Fournisseur SMTP. Si le compte doit être recréé (méthode B), il faut régénérer les
      identifiants SMTP et les ressaisir dans le dashboard Supabase de **production et
      de STAGING**, puis refaire la validation DKIM/SPF du domaine d'envoi.
- [ ] Sentry.
- [ ] Umami Cloud.
- [ ] healthchecks.io : l'alerte « sauvegarde en échec » doit partir vers
      `administrateur@` **et** vers Antoine. Vérifier avec le bouton d'envoi d'une
      notification de test.
- [ ] Sur chaque service : les emails de facturation et d'alerte arrivent à
      `administrateur@`.

Si une clé change pendant cette phase, mettre à jour la variable GitHub correspondante
(tableaux de `docs/third-party-services.md`) et relancer un déploiement.

## Phase 2 — dépôt GitHub

Le dépôt est aujourd'hui `AntoineQuinteau/101ameliorations`. Il porte le code, la CI,
et tous les secrets de déploiement et de sauvegarde.

- [ ] Créer un compte GitHub pour `administrateur@txirrindola.org`, double
      authentification active, identifiants dans le coffre.
- [ ] Depuis ce compte, créer une **organisation GitHub** gratuite au nom de
      l'association. Le dépôt étant public, le palier gratuit suffit pour les
      environnements protégés.
- [ ] Inviter Antoine dans l'organisation. Deux propriétaires au minimum : le compte
      `administrateur@` et un référent ; Antoine peut rester propriétaire le temps de la
      bascule.
- [ ] Vérifier qu'aucun workflow ne tourne, puis transférer le dépôt :
      **Settings → General → Danger Zone → Transfer ownership**. GitHub redirige
      l'ancienne adresse vers la nouvelle.
- [ ] **À vérifier après le transfert** : la présence de tous les secrets, variables et
      environnements listés dans le « Récapitulatif par emplacement » de
      `docs/third-party-services.md`. Les valeurs des secrets ne sont pas lisibles : si
      l'un manque, il faut le régénérer à sa source.
- [ ] Vérifier la protection de l'environnement `production` : _Deployment branches_
      limité à `main`. Sans cela, une branche de PR pourrait lire l'accès à la base de
      production.
- [ ] Vérifier que les workflows planifiés sont toujours actifs (**Actions → Backup**) :
      un transfert peut les désactiver.
- [ ] Réinstaller les applications GitHub utilisées sur le dépôt (dont Claude) sur la
      nouvelle organisation.
- [ ] Mettre à jour l'adresse du dépôt sur les postes de développement :

  ```bash
  git remote set-url origin git@github.com:<organisation>/101ameliorations.git
  ```

**Vérification de la phase** : ouvrir une PR sans contenu fonctionnel (par exemple la
mise à jour de la documentation de la phase 6). Les jobs `quality`, `database`,
`migrate-staging` et `preview` passent, le commentaire de preview s'affiche. Après le
merge, `deploy-production` passe. Lancer ensuite **Backup** à la main : il est vert.

**Retour arrière** : transférer le dépôt dans l'autre sens.

## Phase 3 — Supabase

Deux projets : production et STAGING.

### Méthode A (recommandée) — l'organisation actuelle ne contient que ces deux projets

- [ ] Créer le compte Supabase de `administrateur@`, double authentification active.
- [ ] Dans l'organisation actuelle : **Team → Invite** → `administrateur@`, rôle
      **Owner**.
- [ ] Renommer l'organisation au nom de l'association.
- [ ] Une fois l'invitation acceptée, passer Antoine du rôle Owner au rôle
      Administrator ou Developer.

Rien d'autre ne change : références de projet, URL, clés, chaînes de connexion et
réglages Auth restent identiques.

### Méthode B — l'organisation contient d'autres projets

- [ ] `administrateur@` crée une organisation Supabase en plan gratuit et y invite
      Antoine comme Owner (nécessaire pour le transfert).
- [ ] **À vérifier** : les conditions du transfert de projet dans la documentation
      Supabase (rôles requis, limite de deux projets gratuits, intégrations actives).
- [ ] Transférer STAGING d'abord : **Project Settings → General → Transfer project**.
      Vérifier qu'une preview de PR fonctionne.
- [ ] Transférer la production de la même façon.
- [ ] Rétrograder Antoine dans la nouvelle organisation.

Un transfert conserve la référence du projet, donc les URL et les clés.

**Vérification de la phase**, dans les deux cas :

- [ ] Connexion par code email sur la production (vérifie Auth, SMTP et Turnstile).
- [ ] Création d'un signalement de test avec photo sur STAGING (vérifie base et Storage),
      puis nettoyage avec `scripts/cleanup-test-klash.sql`.
- [ ] Les réglages Auth du dashboard sont inchangés (checklist du README, section
      « Auth »).
- [ ] Lancer **Backup** à la main : il est vert (vérifie `SUPABASE_DB_URL` et l'accès S3).

## Phase 4 — Cloudflare et nom de domaine

Le compte Cloudflare porte le Worker de production (`101ameliorations`), le Worker QR
(`101ameliorations-qr`), les widgets Turnstile, le bucket R2 des sauvegardes, la zone
DNS et l'enregistrement du domaine.

### 4.1 Compte Cloudflare

#### Méthode A (recommandée) — le compte ne contient que 101améliorations

- [ ] Créer l'utilisateur Cloudflare `administrateur@`, double authentification active.
- [ ] **Manage Account → Members** → inviter `administrateur@` avec le rôle **Super
      Administrator**.
- [ ] Renommer le compte au nom de l'association.
- [ ] Remplacer le moyen de paiement par celui de l'association (D5).
- [ ] Remplacer le jeton de déploiement : `CLOUDFLARE_API_TOKEN` a été créé dans le
      profil d'Antoine et cesserait de fonctionner si Antoine quittait le compte. Créer
      à la place un **jeton de compte** (**Manage Account → Account API Tokens**),
      permission _Workers Scripts : Edit_, puis :

  ```bash
  gh secret set CLOUDFLARE_API_TOKEN
  ```

  Le jeton R2 des sauvegardes est déjà un jeton de compte : rien à faire.

- [ ] Vérifier le nouveau jeton en relançant le dernier déploiement de `main`, puis
      révoquer l'ancien jeton dans le profil d'Antoine.
- [ ] Rétrograder Antoine du rôle Super Administrator vers un rôle d'administrateur
      sans accès à la facturation ni à la gestion des membres.

#### Méthode B — le compte contient d'autres sites

À éviter si possible : tout est à recréer dans un nouveau compte, avec une coupure à
prévoir au moment du changement de zone DNS.

- [ ] Créer le compte de l'association, y inviter Antoine.
- [ ] Recréer le bucket R2 (juridiction UE, règles d'expiration du
      [plan de sauvegarde](database-backups.md), partie A1), y copier le contenu de
      l'ancien avec `rclone`, créer un nouveau jeton de compte, mettre à jour
      `R2_ACCESS_KEY_ID` et `R2_SECRET_ACCESS_KEY`.
- [ ] Recréer les widgets Turnstile (production et STAGING) ; mettre à jour
      `VITE_TURNSTILE_SITE_KEY`, `VITE_STAGING_TURNSTILE_SITE_KEY` et la clé secrète
      dans le dashboard Supabase des deux projets, **dans la même séance** : entre les
      deux, la connexion échoue.
- [ ] Mettre à jour `CLOUDFLARE_ACCOUNT_ID` et `CLOUDFLARE_API_TOKEN`, déployer le
      Worker par la CI, redéployer le Worker QR et mettre à jour `QR_WORKER_URL`.
- [ ] Déplacer le domaine et sa zone vers le nouveau compte. **À vérifier** : la
      procédure Cloudflare de déplacement d'un domaine entre deux comptes. Recréer à
      l'identique les enregistrements DNS, dont ceux de l'envoi d'emails (SPF, DKIM,
      DMARC).
- [ ] Rattacher `101ameliorations.org` au nouveau Worker (**Workers → Settings →
      Domains & Routes**).
- [ ] Ajouter le nouveau sous-domaine `workers.dev` aux _Redirect URLs_ de Supabase
      STAGING et aux domaines autorisés de la clé MapTiler.

### 4.2 Nom de domaine

Dans tous les cas :

- [ ] Mettre le **contact titulaire** du domaine au nom de l'association (raison
      sociale, adresse du siège, `administrateur@`). C'est ce contact, et non le compte
      qui paie, qui fait foi sur la propriété du domaine.
- [ ] Activer le renouvellement automatique et vérifier que le moyen de paiement est
      celui de l'association.

Si la décision D2 est de garder le domaine chez Cloudflare, il n'y a rien d'autre à
faire en méthode A.

Si la décision D2 est de l'enregistrer chez OVH :

- [ ] Attendre 60 jours après la date d'achat du domaine : un transfert est refusé avant.
- [ ] Chez Cloudflare : déverrouiller le domaine et demander le code de transfert.
- [ ] Chez OVH, dans le compte de l'association : lancer le transfert entrant en
      choisissant de **conserver les serveurs DNS actuels** (ceux de Cloudflare). Le
      transfert ajoute un an à la date d'expiration et se paie à OVH.
- [ ] **Point de vigilance** : si OVH remplace les serveurs DNS par les siens, le site,
      les liens courts `/r/…` imprimés et l'envoi des emails tombent. Vérifier les
      serveurs DNS juste après le transfert et les remettre sur ceux de Cloudflare si
      besoin.

La zone DNS reste gérée chez Cloudflare même si le domaine est enregistré chez OVH :
c'est une condition pour que le Worker réponde sur `101ameliorations.org`.

**Vérification de la phase** :

- [ ] `https://101ameliorations.org` s'ouvre, la carte s'affiche, la connexion par code
      fonctionne.
- [ ] Un lien `/k/<id>` partagé dans une messagerie affiche son aperçu.
- [ ] Un lien court `/r/<slug>` existant redirige.
- [ ] Une PR produit une preview avec son QR code.
- [ ] **Backup** lancé à la main est vert, et un nouveau fichier apparaît dans
      `db/daily/` du bucket.

## Phase 5 — sauvegardes : seconde clé de déchiffrement

Les dumps sont chiffrés avec `age`. Seule la clé privée d'Antoine peut les lire
aujourd'hui : c'est la dépendance la plus forte du projet, et aucun transfert de compte
ne la lève.

- [ ] Un référent génère sa propre paire de clés (partie A2 du
      [plan de sauvegarde](database-backups.md)) et range la clé privée dans le coffre
      de l'association, avec une copie hors ligne.
- [ ] Ajouter sa clé publique à la variable, en conservant celle d'Antoine (clés
      séparées par un espace) :

  ```bash
  gh variable set BACKUP_AGE_RECIPIENT --env production   # "age1… age1…"
  ```

- [ ] Lancer **Backup** à la main. Le référent déchiffre l'archive produite avec **sa**
      clé (README, « Sauvegardes et restauration → Restaurer », étapes 1 et 2).
- [ ] Les archives antérieures restent lisibles par la seule clé d'Antoine jusqu'à leur
      expiration (185 jours au plus). Pour couvrir cette période, Antoine dépose une
      copie de sa clé privée dans le coffre de l'association.

## Phase 6 — exercice de reprise et documentation

L'objectif n'est atteint que si l'association peut agir sans Antoine. On le prouve une
fois.

- [ ] Un référent, sans aide d'Antoine, se connecte avec les identifiants du coffre à :
      GitHub, Supabase, Cloudflare, le fournisseur SMTP, MapTiler, Sentry, Umami,
      healthchecks.io et, s'il y a lieu, OVH.
- [ ] Il retire puis réinvite Antoine sur un service au choix.
- [ ] Il déroule l'exercice de restauration du README jusqu'à
      `scripts/backup/restore-check.sh`, avec sa propre clé.
- [ ] Mettre à jour la documentation, dans une PR :
  - `docs/third-party-services.md` : ligne « Hors ligne » de la légende (la clé n'est
    plus gardée par Antoine seul), type du jeton `CLOUDFLARE_API_TOKEN` ;
  - `README.md` : adresse du dépôt si elle y figure ;
  - `docs/plans/database-backups.md` : la seconde clé `age` est en place ;
  - ce plan : cocher les étapes et dater la fin de bascule.
- [ ] Ajouter au coffre une fiche « En cas d'absence d'Antoine » : où est le code, où
      sont les sauvegardes, comment restaurer (lien vers le README), qui contacter.
- [ ] Inscrire au calendrier de l'association la date d'expiration du domaine et une
      vérification annuelle des accès.

## Ce qui reste dépendant d'une personne après la bascule

La bascule transfère la propriété, pas la compétence. Faire évoluer l'app ou corriger un
bug demande toujours quelqu'un qui sait lire ce dépôt. Ce qui limite ce risque :

- l'app tourne sans intervention : pas de serveur à mettre à jour, sauvegardes et
  déploiements automatiques, alerte par email si la sauvegarde s'arrête ;
- le code est public et documenté (`docs/spec.md`, `README.md`) : un autre développeur
  peut le reprendre ;
- les données s'exportent à tout moment (page `/export`, dumps SQL standard).

---

## Annexe — et si le site devait être hébergé chez OVH ?

Pour mémoire, afin de chiffrer la discussion. Ce n'est pas le scénario retenu.

| Élément                      | Faisable sur un hébergement web OVH ?                                                                                   | Travail                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Fichiers statiques du site   | Oui                                                                                                                     | Déploiement par FTP ou SSH depuis la CI à écrire                    |
| Aperçus de lien `/k/:id`     | À réécrire (PHP), le Worker Cloudflare ne tourne pas chez OVH                                                           | Quelques jours, tests compris                                       |
| Liens courts `/r/:slug`      | À réécrire, sans casser les QR codes déjà imprimés                                                                      | Idem                                                                |
| Previews de PR avec QR code  | Pas d'équivalent simple                                                                                                 | Perte de l'outil de recette sur téléphone, ou sous-domaines à gérer |
| Base de données et connexion | Non : l'app repose sur Postgres/PostGIS, l'authentification, le stockage et les règles de sécurité fournis par Supabase | Réécriture du backend, ou serveur dédié à administrer (payant)      |
| Anti-robot (Turnstile)       | Reste chez Cloudflare                                                                                                   | Un compte Cloudflare reste nécessaire                               |
| Sauvegardes (R2)             | Déplaçables vers un stockage objet OVH (payant)                                                                         | Scripts à adapter et à revalider par un exercice de restauration    |

Conclusion : déplacer les fichiers statiques est possible mais coûte quelques jours et
fait perdre les previews, sans supprimer le compte Cloudflare. Déplacer la base revient
à réécrire une partie de l'application ou à confier un serveur à un bénévole, ce qui
augmente la dépendance à une personne au lieu de la réduire.

Ce qu'OVH peut porter sans rien changer à l'app : l'enregistrement du nom de domaine
(décision D2), et un sous-domaine de `txirrindola.org` qui redirige vers
`101ameliorations.org`.
