# Plan — sauvegardes de la base et des photos

> Plan établi le 2026-10-11. Partie A (comptes et secrets) faite par Antoine le
> 2026-10-16, sans la seconde clé `age` facultative. Partie B implémentée le 2026-10-16
> (même PR) ; reste le premier lancement en production et l'exercice de restauration,
> en fin de partie B. Procédure d'exploitation : README, « Sauvegardes et
> restauration ».

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

- [ ] R2 → **Manage API tokens** → **Account API Tokens** → _Create Account API token_
      (un jeton de compte reste valide si l'utilisateur quitte l'organisation) :
  - **Permissions** : **Object Read & Write**. Le choix du bucket n'apparaît qu'avec
    une permission « Object » ; « Admin » s'applique toujours à tous les buckets.
  - **Specify bucket(s)** : _Apply to specific buckets only_ →
    `101ameliorations-backups`.
  - **TTL** : _Forever_. **Client IP Address Filtering** : vide (les runners GitHub
    n'ont pas d'adresse fixe).
- [ ] Noter l'_Access Key ID_ et le _Secret Access Key_ : le secret n'est affiché
      qu'une fois. La _Token value_ n'est pas utilisée. Vérifier que l'endpoint S3
      affiché contient `.eu.` (juridiction UE).
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

## Partie B — implémentation

- [x] `docs/spec.md` amendé (§8 « Stack et outillage » et §11 « Décisions prises »).
- [x] Workflow `.github/workflows/backup.yml` : job `backup` planifié chaque nuit et
      lançable à la main, job `round-trip` sur les PR concernées.
- [x] Scripts `scripts/backup/` : `dump.sh`, `upload.sh` (rotation par préfixes,
      chiffrement `age`), `sync-photos.sh`, `restore.sh`, `verify.sh`,
      `restore-check.sh`, `restore-photos.sh`.
- [x] Test de restauration à chaque sauvegarde : nombre de lignes de chaque table et
      empreinte du schéma (`fingerprint.sql`) comparés à la source.
- [x] Pings de début, de succès et d'échec vers healthchecks.io.
- [x] Dump dans `deploy-production` avant `supabase db push`, seulement si des
      migrations sont en attente, bloquant, vers `db/pre-migration/`.
- [x] README : section « Sauvegardes et restauration », tableaux de la section CI.
- [x] Politique de confidentialité : sauvegardes chiffrées dans l'UE, conservation 6
      mois au plus.
- [ ] Après le merge : **Actions → Backup → Run workflow**, vérifier dans R2 la
      présence de `db/daily/…` et `photos/…`, et le ping vert dans healthchecks.io.
- [ ] **Exercice de restauration réel** par Antoine (README, « Restaurer », étapes 1 à 3) avec sa clé privée : tant qu'il n'a pas réussi, la sauvegarde n'est pas
      considérée comme en place.

## Ce que l'implémentation a appris

Tout a été testé en local contre des stacks Supabase jetables (CLI 2.120, Postgres 17),
y compris un sinistre complet : base restaurée dans une stack vide, photos remises
depuis le miroir et comparées octet par octet. Écarts par rapport à la conception :

- **`supabase db dump` ignore les schémas `auth` et `storage`**, donc les objets que nos
  migrations y posent : les 3 politiques RLS de `storage.objects` et le trigger
  `on_auth_user_created` (qui crée le profil à l'inscription). Sans eux, un projet
  restauré aurait semblé complet mais n'aurait plus créé de profils.
  `platform-hooks.sql` les régénère à chaque dump, et l'empreinte de schéma détecte
  leur absence.
- **L'historique des migrations** (`supabase_migrations`) n'est pas dans le dump par
  défaut : il est dumpé à part, sinon un `db push` après restauration rejouerait toutes
  les migrations.
- **Deux tables Storage** (`buckets_vectors`, `vector_indexes`, fonction réservée aux
  plans payants) ne sont pas inscriptibles par le rôle `postgres` sur un projet neuf :
  elles sont exclues du dump, et sont toujours vides ici.
- **`roles.sql`** contient des réglages de plateforme que `postgres` ne peut pas
  rejouer : il est appliqué en « meilleur effort », une erreur sur `log_min_messages`
  est attendue.
- **`--max-delete` de rclone** déplace des fichiers jusqu'au seuil avant d'échouer : un
  bucket vidé par erreur aurait drainé le miroir de 100 photos par nuit. Le script
  compte d'abord les disparitions et s'arrête avant tout changement.
- **Restauration des photos** : Storage liste comme présentes les photos dont la ligne
  `storage.objects` a été restaurée, même sans fichier ; `restore-photos.sh` copie donc
  sans comparer avec la destination.
- **Versions** : le dump passe par l'image Postgres de la CLI épinglée, à la bonne
  version. Si les services Auth/Storage hébergés deviennent plus récents que ceux de la
  CLI, le contrôle de restauration peut échouer sur des colonnes inconnues : mettre la
  CLI à jour.
- **Durée** : le dump de la base locale seedée (≈ 5 800 lignes) prend 6 s ; le contrôle
  de restauration, 30 s plus le téléchargement des images Docker en CI.

## Reste à vérifier au premier lancement en production

- L'endpoint R2 en juridiction UE (`https://<account-id>.eu.r2.cloudflarestorage.com`)
  et le jeton limité au bucket (pas de vérification ni de création du bucket).
- L'accès S3 à Storage avec la région `eu-west-3`.
- Le contrôle de restauration avec les données réelles, en particulier la
  compatibilité des colonnes `auth` entre l'hébergé et la CLI.
