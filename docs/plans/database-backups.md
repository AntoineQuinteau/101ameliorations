# Plan — sauvegardes de la base et des photos

> Plan établi le 2026-10-11. **Conception seulement, aucun code n'a été écrit.**
> La partie A (comptes et secrets) est à faire à la main par Antoine ; la partie B
> (workflow, CI, docs) fait l'objet d'une PR une fois la partie A terminée.

## Contexte

Le projet Supabase de production est en plan gratuit : aucune sauvegarde automatique,
et rien dans le repo ni dans la CI ne compense. Trois scénarios de perte à couvrir, du
plus au moins probable :

1. **Une migration qui abîme des données.** `deploy-production` lance
   `supabase db push` automatiquement à chaque merge sur `main`.
2. **Une erreur de manipulation** (`scripts/full-reset-prod.sql`, requête dans le
   dashboard, suppression du projet).
3. **Un incident ou une perte d'accès côté Supabase.**

Côté Cloudflare il n'y a rien à sauvegarder : `wrangler.jsonc` ne déclare ni KV, ni D1,
ni R2 ; le Worker et les assets se reconstruisent depuis git.

## Ce qui doit être couvert

| Élément                                | Couvert par                                              |
| -------------------------------------- | -------------------------------------------------------- |
| Schéma, RLS, fonctions                 | Déjà dans git (`supabase/migrations/`), plus le dump     |
| Données `public`                       | Dump SQL                                                 |
| `auth.users` (comptes, emails)         | Dump SQL — à vérifier par le test de restauration        |
| `storage.objects` (métadonnées photos) | Dump SQL — à vérifier par le test de restauration        |
| Fichiers du bucket `klash-photos`      | Copie séparée : un dump SQL ne contient pas les fichiers |
| Réglages du dashboard (auth, SMTP)     | Liste écrite dans le README (non exportables)            |

## Décisions prises (11/10/2026)

| Sujet                        | Décision                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| Destination                  | Cloudflare R2, bucket en juridiction UE                                                      |
| Fréquence                    | Un dump par jour (perte maximale acceptée : 24 h)                                            |
| Rétention des dumps          | 7 quotidiens, 4 hebdomadaires (dimanche), 6 mensuels (1ᵉʳ du mois) — 17 fichiers au plus     |
| Dump avant migration         | Oui, dans `deploy-production`, seulement si des migrations sont en attente ; bloquant ; 30 j |
| Photos supprimées dans l'app | Retirées de la copie après 30 jours                                                          |
| Chiffrement                  | `age`, clé publique côté CI, clé privée hors ligne                                           |
| Surveillance                 | Service tiers gratuit de type healthchecks.io (alerte si la sauvegarde ne tourne plus)       |
| Documentation                | Ajout à `docs/spec.md` et au README                                                          |

Écartés : les artifacts GitHub Actions (le repo est public et le dump contient des
emails) ; le plan Pro Supabase comme seule réponse (sauvegardes chez le même
fournisseur, 7 jours seulement, sans les photos).

## Architecture

Un workflow GitHub Actions planifié, sur `main`, dans l'environnement `production`
(qui n'a pas de validation manuelle obligatoire, vérifié le 11/10/2026 — sinon chaque
sauvegarde nocturne attendrait une approbation).

```
Supabase Postgres ──dump──> archive ──age──> R2  db/daily/        (expire à 7 j)
                                                 db/weekly/       (expire à 28 j)
                                                 db/monthly/      (expire à 185 j)
                                                 db/pre-migration/(expire à 30 j)
Supabase Storage ──rclone─────────────────> R2  photos/          (miroir)
                                                 photos-deleted/  (expire à 30 j)
```

- **Dump** : rôles, schéma et données dans une même archive, avec un manifeste (date,
  SHA git, dernière migration appliquée, nombre de lignes des tables principales). Le
  schéma est inclus parce qu'un dump mensuel vieux de cinq mois ne se rechargerait pas
  sur les migrations du jour.
- **Rotation** : le workflow dépose le dump dans `db/daily/`, et en plus dans
  `db/weekly/` le dimanche et `db/monthly/` le 1ᵉʳ. La suppression est faite par les
  règles d'expiration R2, pas par du code.
- **Photos** : `rclone sync` de Supabase Storage (accès S3) vers `photos/`. Les fichiers
  disparus de la source sont déplacés dans `photos-deleted/<date>/` au lieu d'être
  supprimés, et un garde-fou fait échouer le job si trop de fichiers disparaissent
  d'un coup (bucket vidé par erreur).
- **Test de restauration** : à chaque exécution, le dump est rechargé dans une instance
  Supabase locale du runner, et les comptages sont comparés au manifeste.
- **Surveillance** : ping de début, de succès et d'échec vers le service de
  surveillance. L'absence de ping de succès pendant plus d'un jour déclenche un email.
  C'est aussi ce qui détecte la désactivation des workflows planifiés par GitHub après
  60 jours sans activité sur un repo public.

## Partie A — à faire par Antoine

Compter 30 à 45 minutes. L'ordre importe peu, sauf A5 qui clôt la liste. Les secrets
vont dans l'**environnement GitHub `production`** (Settings → Environments →
production), pas au niveau du dépôt : ils restent ainsi réservés à `main`.

### A1. Cloudflare R2

- [ ] Dashboard Cloudflare → **R2** → activer R2. Une carte bancaire est demandée même
      pour le palier gratuit (10 Go, pas de frais de sortie).
- [ ] Créer un bucket nommé `101ameliorations-backups`, en choisissant **Juridiction →
      Union européenne**. Ce choix ne peut plus être changé après la création.
- [ ] Laisser le bucket **privé** : pas d'accès public, pas de domaine `r2.dev`.
- [ ] Dans le bucket → **Settings → Object lifecycle rules**, créer cinq règles de
      suppression :

  | Préfixe             | Supprimer après |
  | ------------------- | --------------- |
  | `db/daily/`         | 7 jours         |
  | `db/weekly/`        | 28 jours        |
  | `db/monthly/`       | 185 jours       |
  | `db/pre-migration/` | 30 jours        |
  | `photos-deleted/`   | 30 jours        |

- [ ] R2 → **Manage API tokens** → créer un jeton **Object Read & Write**, limité au
      seul bucket `101ameliorations-backups`. Noter l'_Access Key ID_ et le _Secret
      Access Key_ : le secret n'est affiché qu'une fois.
- [ ] Les enregistrer :

  ```bash
  gh secret set R2_ACCESS_KEY_ID --env production
  gh secret set R2_SECRET_ACCESS_KEY --env production
  gh variable set BACKUP_R2_BUCKET --env production   # 101ameliorations-backups
  ```

  L'identifiant de compte est déjà disponible (`CLOUDFLARE_ACCOUNT_ID`).

### A2. Clé de chiffrement `age`

- [ ] Installer l'outil : `sudo dnf install age`.
- [ ] Générer la paire **hors du dossier du repo** :

  ```bash
  age-keygen -o ~/101ameliorations-backup.key
  ```

  La commande affiche la clé publique (`age1…`).

- [ ] Ranger le contenu du fichier `.key` dans le gestionnaire de mots de passe, **et**
      en garder une seconde copie hors ligne (clé USB ou impression). Sans cette clé
      privée, aucune sauvegarde n'est lisible, et personne ne peut la régénérer.
- [ ] Supprimer le fichier `.key` du disque une fois les deux copies faites.
- [ ] Enregistrer la clé publique (ce n'est pas un secret) :

  ```bash
  gh variable set BACKUP_AGE_RECIPIENT --env production   # age1…
  ```

- [ ] (Recommandé) Faire générer une seconde paire par un autre membre de l'association
      et transmettre sa clé publique : `age` chiffre pour plusieurs destinataires, ce
      qui évite qu'une seule personne puisse restaurer.

### A3. Accès S3 au stockage Supabase

- [ ] Dashboard Supabase (projet de **production**) → **Storage → Settings → S3
      connection** → activer la connexion S3.
- [ ] Noter l'**endpoint** et la **région** affichés sur cette page.
- [ ] Créer une clé d'accès (_New access key_). Elle donne accès à tous les buckets
      sans passer par les RLS : c'est un vrai secret.
- [ ] Les enregistrer :

  ```bash
  gh secret set SUPABASE_S3_ACCESS_KEY_ID --env production
  gh secret set SUPABASE_S3_SECRET_ACCESS_KEY --env production
  gh variable set SUPABASE_S3_ENDPOINT --env production
  gh variable set SUPABASE_S3_REGION --env production
  ```

- [ ] Si l'option n'est pas proposée en plan gratuit, le signaler : la copie des photos
      passera alors par l'API Storage, avec la clé secrète du projet.

### A4. Service de surveillance

- [ ] Créer un compte sur healthchecks.io (palier gratuit).
- [ ] Créer un _check_ « 101améliorations — sauvegarde quotidienne » : période **1 jour**,
      délai de grâce **6 heures**.
- [ ] Vérifier que l'alerte part bien vers une adresse email relevée régulièrement.
- [ ] Enregistrer l'URL de ping (qui permet de fausser le suivi si elle fuite) :

  ```bash
  gh secret set BACKUP_HEALTHCHECK_URL --env production
  ```

### A5. Vérification et relevé

- [ ] `gh secret list --env production` affiche, en plus de `SUPABASE_DB_URL` :
      `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `SUPABASE_S3_ACCESS_KEY_ID`,
      `SUPABASE_S3_SECRET_ACCESS_KEY`, `BACKUP_HEALTHCHECK_URL`.
- [ ] `gh variable list --env production` affiche `BACKUP_R2_BUCKET`,
      `BACKUP_AGE_RECIPIENT`, `SUPABASE_S3_ENDPOINT`, `SUPABASE_S3_REGION`.
- [ ] Relever dans le dashboard Supabase (Settings → Usage) la taille de la base et du
      stockage, pour confirmer que le palier gratuit R2 suffit.

## Partie B — implémentation (une PR, après la partie A)

- [ ] `docs/spec.md` amendé en premier (§8 « Stack et outillage » et §11 « Décisions
      prises »), puisque la spec fait autorité.
- [ ] Nouveau workflow `.github/workflows/backup.yml` : planifié chaque nuit, plus
      `workflow_dispatch` pour un lancement manuel.
- [ ] Dump (rôles, schéma, données, manifeste), compression, chiffrement `age`, envoi
      vers `db/daily/`, et vers `db/weekly/` / `db/monthly/` les jours concernés.
- [ ] Copie des photos avec `rclone` et déplacement des fichiers disparus vers
      `photos-deleted/`, avec garde-fou sur le nombre de suppressions.
- [ ] Test de restauration dans une instance Supabase locale et comparaison des
      comptages (`klashes`, `klash_photos`, `comments`, `profiles`, `auth.users`,
      `storage.objects`).
- [ ] Pings de début, de succès et d'échec vers le service de surveillance.
- [ ] Étape de dump dans `deploy-production` avant `supabase db push`, exécutée
      seulement si des migrations sont en attente, bloquante, vers `db/pre-migration/`.
- [ ] README : section « Sauvegardes et restauration » (procédure pas à pas, liste des
      réglages du dashboard à refaire à la main) et mise à jour de « Secrets et
      variables requis ».
- [ ] Politique de confidentialité (`src/i18n/fr.ts`, sections « Durée de conservation »
      et « Hébergement et sous-traitants ») : mentionner les sauvegardes chiffrées,
      stockées chez Cloudflare dans l'UE, et la persistance d'un compte supprimé dans
      les sauvegardes pendant 6 mois au plus.
- [ ] Premier lancement manuel, puis **exercice de restauration réel** par Antoine avec
      sa clé privée, sur une instance locale : tant qu'il n'a pas réussi, la sauvegarde
      n'est pas considérée comme en place.

## Points à vérifier pendant l'implémentation

- Que `supabase db dump` inclut bien les données de `auth` et de `storage`. Le test de
  restauration le montrera ; sinon, passer à `pg_dump` avec la liste explicite des
  schémas.
- La version du client Postgres sur le runner : la base est en Postgres 17, le client
  doit être en 17 ou plus (`supabase db dump` passe par une image Docker à la bonne
  version).
- La durée réelle du dump, pour confirmer que l'étape d'avant migration reste courte.
- L'endpoint S3 de R2 pour un bucket en juridiction UE
  (`https://<account-id>.eu.r2.cloudflarestorage.com`).
