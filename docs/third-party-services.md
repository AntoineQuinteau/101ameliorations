# Services tiers, variables et secrets

Inventaire de tous les services externes utilisés par 101améliorations, de leur rôle, et
de chaque variable / secret associé avec **l'endroit où il est défini**. Les détails
d'installation restent dans le [`README.md`](../README.md) ; ce document sert de carte.

Légende des emplacements :

| Abréviation       | Où                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| **GH var**        | GitHub → Settings → Secrets and variables → Actions → _Variables_ (niveau dépôt)               |
| **GH secret**     | GitHub → Settings → Secrets and variables → Actions → _Secrets_ (niveau dépôt)                 |
| **GH env secret** | GitHub → Settings → Environments → `staging` / `production` → secret d'environnement           |
| **GH env var**    | GitHub → Settings → Environments → `production` → variable d'environnement                     |
| **Hors ligne**    | Gardé par Antoine (gestionnaire de mots de passe + copie hors ligne), jamais en ligne ni en CI |
| **Worker var**    | Variable d'exécution du Worker Cloudflare, injectée par la CI via `wrangler --var`             |
| **Dashboard X**   | Réglé à la main dans le dashboard du service X (pas versionné)                                 |
| **`.env.local`**  | Fichier local non versionné (modèle : [`.env.example`](../.env.example))                       |
| **`config.toml`** | [`supabase/config.toml`](../supabase/config.toml) — Supabase **local et CI uniquement**        |

> Les `VITE_*` sont inlinées dans le bundle JS au build : elles sont **publiques par
> nature** et donc stockées en _variables_ GitHub, pas en secrets (voir README,
> « Secrets et variables requis »). Les vrais secrets sont listés en gras ci-dessous.

---

## Vue d'ensemble

| Service                   | Rôle                                                             | Obligatoire ?           |
| ------------------------- | ---------------------------------------------------------------- | ----------------------- |
| Supabase (prod + STAGING) | Base Postgres/PostGIS, Auth OTP email, Storage photos, RLS       | Oui                     |
| Fournisseur SMTP          | Envoi des emails OTP de Supabase Auth (Resend, Postmark…)        | Oui en prod             |
| Cloudflare Workers        | Hébergement du front statique + Worker `/k/*`, `/r/*`            | Oui                     |
| Cloudflare Turnstile      | Captcha invisible à la connexion                                 | Oui en prod (build)     |
| Cloudflare Worker QR      | Génère le QR code des previews de PR                             | CI uniquement           |
| MapTiler                  | Tuiles de fond de carte                                          | Oui (sauf proxy de dev) |
| Sentry                    | Remontée d'erreurs front                                         | Non                     |
| Umami Cloud               | Mesure d'audience sans cookie (prod uniquement)                  | Non                     |
| Cloudflare R2             | Stockage des sauvegardes chiffrées (base + photos), UE           | Oui (sauvegardes)       |
| healthchecks.io           | Alerte email si la sauvegarde nocturne échoue ou ne tourne plus  | Oui (sauvegardes)       |
| GitHub Actions            | CI : lint, tests, migrations, previews, déploiement, sauvegardes | Oui                     |
| OpenStreetMap             | Données cartographiques (via MapTiler) — attribution seule       | — (aucune clé)          |

Outils open source utilisés par les sauvegardes, sans compte : `age` (chiffrement des
dumps) et `rclone` (copie vers R2, version épinglée et vérifiée par SHA-256 dans
`scripts/backup/install-tools.sh`, téléchargée depuis les releases GitHub de rclone).

---

## Supabase

**Rôle** : tout le backend — Postgres + PostGIS, Auth par OTP email, Storage des photos,
RLS. Deux projets distants : **production** et **STAGING** (utilisé par les previews de
PR). En local : `npx supabase start` (Docker), configuré par `config.toml`.

| Variable / secret                       | Usage                                                                              | Défini où                                                                                                   |
| --------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`                     | URL de l'API, lue par le front (`src/lib/supabase.ts`)                             | GH var (prod) · `.env.local`                                                                                |
| `VITE_SUPABASE_PUBLISHABLE_KEY`         | Clé publishable `sb_publishable_…` du front                                        | GH var (prod) · `.env.local`                                                                                |
| `VITE_STAGING_SUPABASE_URL`             | Idem pour les builds de preview (job `preview`)                                    | GH var                                                                                                      |
| `VITE_STAGING_SUPABASE_PUBLISHABLE_KEY` | Idem pour les builds de preview                                                    | GH var                                                                                                      |
| `SUPABASE_URL`                          | Lue par le Worker (`workers/app/src/redirect.ts`, Open Graph)                      | Worker var — valeur reprise de `VITE_(STAGING_)SUPABASE_URL` par la CI                                      |
| `SUPABASE_PUBLISHABLE_KEY`              | Idem, clé publishable côté Worker                                                  | Worker var — reprise de `VITE_(STAGING_)SUPABASE_PUBLISHABLE_KEY`                                           |
| **`SUPABASE_DB_URL`**                   | Chaîne de connexion _Session pooler_ (mot de passe inclus) pour `supabase db push` | **GH env secret** `staging` **et** `production` (deux valeurs distinctes ; `production` restreint à `main`) |
| **`SUPABASE_SECRET_KEY`**               | Scripts / CLI uniquement, jamais lue par le front                                  | `.env.local` uniquement                                                                                     |

Réglages **hors repo**, à faire à la main dans le **Dashboard Supabase** de chaque projet
(`db push` ne les applique pas — checklist complète dans README, « Auth ») :

- Authentication → Emails → **SMTP** (voir section suivante) ;
- Authentication → Emails → **Templates** (contenu de `supabase/templates/magic_link.html`) ;
- Authentication → **URL Configuration** (Site URL, Redirect URLs des previews) ;
- Authentication → Providers → Email (OTP length 6, expiry 3600) ;
- Authentication → **Rate Limits** ;
- Authentication → **Attack Protection** → captcha Turnstile + **secret key Turnstile**
  (voir section Turnstile) ;
- Storage → Settings → **S3 connection** (projet de **production** uniquement) : accès
  S3 activé et clé d'accès créée pour la copie des photos par les sauvegardes.

Accès S3 au Storage de production, utilisés par la sauvegarde des photos
(`scripts/backup/sync-photos.sh`, `restore-photos.sh`) :

| Variable / secret                   | Usage                                     | Défini où                      |
| ----------------------------------- | ----------------------------------------- | ------------------------------ |
| `SUPABASE_S3_ENDPOINT`              | Endpoint S3 du Storage                    | GH env var `production`        |
| `SUPABASE_S3_REGION`                | Région S3 (`eu-west-3`)                   | GH env var `production`        |
| **`SUPABASE_S3_ACCESS_KEY_ID`**     | Identifiant de la clé d'accès S3          | **GH env secret** `production` |
| **`SUPABASE_S3_SECRET_ACCESS_KEY`** | Clé secrète S3 (accès à tous les buckets) | **GH env secret** `production` |

`SUPABASE_DB_URL` (environnement `production`) sert aussi au dump de la sauvegarde
nocturne et au dump pris avant chaque migration de production.

## Fournisseur SMTP (Resend, Postmark…)

**Rôle** : envoyer les codes OTP. Sans SMTP applicatif, Supabase plafonne à ~2 emails/h et
n'envoie qu'aux membres du projet. Le fournisseur n'est pas figé dans le code.

| Secret                                                   | Défini où                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Hôte, port, utilisateur, mot de passe / clé API SMTP** | **Dashboard Supabase** → Authentication → Emails → SMTP (prod et STAGING) |
| Enregistrements SPF / DKIM / DMARC                       | DNS du domaine d'envoi                                                    |

En local, aucun SMTP : les emails arrivent dans Mailpit (`http://127.0.0.1:54324`).

## Cloudflare Workers (hébergement)

**Rôle** : servir le bundle statique (`dist/`) et un Worker minimal
([`workers/app/`](../workers/app/)) pour les tags Open Graph de `/k/:id`, la redirection
`/r/:slug` et le manifeste iOS. Config : [`wrangler.jsonc`](../wrangler.jsonc) (Worker
`101ameliorations`). Previews : `wrangler versions upload --preview-alias pr-<N>` ;
production : `wrangler deploy`.

| Variable / secret                          | Usage                                                       | Défini où                                                                |
| ------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| **`CLOUDFLARE_API_TOKEN`**                 | Authentifie `wrangler` en CI (scope : Workers Scripts:Edit) | **GH secret** · créé dans Dashboard Cloudflare → My Profile → API Tokens |
| **`CLOUDFLARE_ACCOUNT_ID`**                | Compte Cloudflare ciblé par `wrangler`                      | **GH secret** (stocké en secret par convention, pas sensible en soi)     |
| `ASSETS`                                   | Binding vers les assets statiques                           | `wrangler.jsonc` (`assets.binding`)                                      |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Voir section Supabase                                       | Worker var (CI)                                                          |

Le domaine `101ameliorations.org` n'est pas déclaré dans `wrangler.jsonc` : son
rattachement au Worker se fait dans le **Dashboard Cloudflare** (Workers → Settings →
Domains & Routes).

## Cloudflare Turnstile (captcha)

**Rôle** : captcha invisible au moment de demander un code OTP, vérifié par Supabase Auth.
La clé de site est côté front, la clé secrète côté Supabase.

| Variable / secret                 | Usage                                                                                                                            | Défini où                                                                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_TURNSTILE_SITE_KEY`         | Clé de site du widget (`src/features/auth/useTurnstile.ts`) — **le build de prod échoue sans** (`vite-plugins/buildEnvGuard.ts`) | GH var · `.env.local` (clé de test `1x00000000000000000000BB`)                                                                        |
| `VITE_STAGING_TURNSTILE_SITE_KEY` | Widget dédié STAGING (facultatif, sinon repli sur la clé prod)                                                                   | GH var                                                                                                                                |
| **Clé secrète Turnstile**         | Vérification du jeton par Supabase Auth                                                                                          | **Dashboard Supabase** → Auth → Attack Protection (prod et STAGING) ; en local/CI : clé de test dans `config.toml` (`[auth.captcha]`) |

Widgets créés dans **Dashboard Cloudflare** → Turnstile (domaines autorisés à y déclarer).

## Cloudflare R2 (sauvegardes)

**Rôle** : stocker les sauvegardes, dans le bucket `101ameliorations-backups` (juridiction
UE). Le plan gratuit Supabase n'en fait aucune : `.github/workflows/backup.yml` dumpe la
base chaque nuit (01:23 UTC), la chiffre avec `age` et l'envoie dans R2, puis copie les
photos du Storage avec `rclone`. `deploy-production` (`ci.yml`) y dépose aussi un dump
avant d'appliquer des migrations. Rotation et durées de conservation : règles
d'expiration du bucket (dashboard Cloudflare), pas le code. Détails : README,
« Sauvegardes et restauration », et
[`docs/plans/database-backups.md`](plans/database-backups.md).

| Variable / secret            | Usage                                                      | Défini où                                                                                                  |
| ---------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `BACKUP_R2_BUCKET`           | Nom du bucket (`101ameliorations-backups`)                 | GH env var `production`                                                                                    |
| **`R2_ACCESS_KEY_ID`**       | Identifiant du jeton R2 limité au bucket                   | **GH env secret** `production` · créé dans Dashboard Cloudflare → R2 → Manage API tokens (jeton de compte) |
| **`R2_SECRET_ACCESS_KEY`**   | Clé secrète du même jeton                                  | **GH env secret** `production`                                                                             |
| `R2_ACCOUNT_ID`              | Compte R2 (sert à construire l'endpoint)                   | Pas de valeur propre : la CI y passe `CLOUDFLARE_ACCOUNT_ID`                                               |
| `BACKUP_AGE_RECIPIENT`       | Clé(s) publique(s) `age` (`age1…`) qui chiffrent les dumps | GH env var `production` (publique, pas un secret)                                                          |
| **Clé privée `age`**         | Seule à pouvoir déchiffrer un dump                         | **Hors ligne** — jamais dans GitHub ni dans R2                                                             |
| `BACKUP_MAX_PHOTO_DELETIONS` | Garde-fou : photos supprimables par run (défaut 100)       | Entrée du lancement manuel du workflow `Backup`                                                            |

## healthchecks.io

**Rôle** : surveiller la sauvegarde nocturne. Le job envoie un ping au début, au succès et
à l'échec ; healthchecks.io envoie un email si un ping d'échec arrive ou si aucun ping
n'arrive (délai de grâce de 6 h) — par exemple quand GitHub désactive les workflows
planifiés d'un dépôt après 60 jours sans activité.

| Secret                       | Usage                                  | Défini où                                                        |
| ---------------------------- | -------------------------------------- | ---------------------------------------------------------------- |
| **`BACKUP_HEALTHCHECK_URL`** | URL de ping du check (contient son id) | **GH env secret** `production` · check créé dans healthchecks.io |

## Worker QR (previews)

**Rôle** : Worker Cloudflare séparé ([`workers/qr/`](../workers/qr/), nom
`101ameliorations-qr`) qui renvoie le QR code SVG d'une URL de preview `*.workers.dev`,
affiché dans le commentaire de PR. Déployé à la main (`npx wrangler deploy --config
workers/qr/wrangler.jsonc`).

| Variable        | Usage                                | Défini où |
| --------------- | ------------------------------------ | --------- |
| `QR_WORKER_URL` | URL du Worker QR, utilisée par la CI | GH var    |

## MapTiler

**Rôle** : tuiles du fond de carte (`api.maptiler.com`, `src/features/map/`). Clé à
restreindre par domaine dans le dashboard MapTiler.

| Variable             | Usage                                                                                       | Défini où                               |
| -------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------- |
| `VITE_MAPTILER_KEY`  | Clé API côté front (publique, restreinte par domaine)                                       | GH var (prod et preview) · `.env.local` |
| `VITE_TILE_BASE_URL` | Optionnelle : redirige vers le proxy de dev `/__tiles` (vide en prod)                       | `.env.local` · job `e2e` de la CI       |
| `MAPTILER_KEY`       | Clé utilisée **côté serveur de dev** par `vite-plugins/tileProxy.ts`, jamais dans le bundle | `.env.local` uniquement                 |

## Sentry

**Rôle** : remontée des erreurs de rendu et des requêtes TanStack Query en échec
(`src/lib/sentry.ts`). Optionnel : sans DSN, rien n'est envoyé. `sendDefaultPii: false`.

| Variable                  | Usage                                          | Défini où                                                   |
| ------------------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| `VITE_SENTRY_DSN`         | DSN du projet Sentry (public par conception)   | GH var · `.env.local` (facultatif)                          |
| `VITE_SENTRY_ENVIRONMENT` | Tag d'environnement (`staging` / `production`) | Codé en dur dans `.github/workflows/ci.yml` ; vide en local |

## Umami Cloud

**Rôle** : mesure d'audience sans cookie (`cloud.umami.is`, `src/lib/analytics.ts`),
chargée uniquement dans le build de **production**. Détails :
[`docs/campaign-tracking.md`](campaign-tracking.md).

| Variable                | Usage                     | Défini où                                        |
| ----------------------- | ------------------------- | ------------------------------------------------ |
| `VITE_UMAMI_WEBSITE_ID` | Identifiant du site Umami | GH var (lue par le seul job `deploy-production`) |

## GitHub Actions

**Rôle** : CI/CD ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)) — lint,
typecheck, tests, migrations + tests RLS sur base jetable, e2e Playwright, `db push`
STAGING puis prod, previews Cloudflare, déploiement production. Sauvegardes
([`.github/workflows/backup.yml`](../.github/workflows/backup.yml)) — sauvegarde
nocturne de la prod et aller-retour dump/restauration sur les PR concernées.

| Variable / secret | Usage                                      | Défini où                       |
| ----------------- | ------------------------------------------ | ------------------------------- |
| `GITHUB_TOKEN`    | Commentaire de PR avec URL + QR de preview | Automatique (fourni par GitHub) |

Environnements GitHub : `staging` (sans restriction de branche) et `production`
(restreint à `main`), chacun portant son `SUPABASE_DB_URL`. `production` porte en plus
tous les accès des sauvegardes (R2, S3 Supabase, healthchecks.io).

## OpenStreetMap

Données cartographiques sous-jacentes aux tuiles MapTiler. Aucune clé ; seule
l'attribution « © OpenStreetMap contributors » est affichée sur la carte.

---

## Récapitulatif par emplacement

**GitHub — variables de dépôt** : `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
`VITE_STAGING_SUPABASE_URL`, `VITE_STAGING_SUPABASE_PUBLISHABLE_KEY`, `VITE_MAPTILER_KEY`,
`VITE_TURNSTILE_SITE_KEY`, `VITE_STAGING_TURNSTILE_SITE_KEY` (facultative),
`VITE_SENTRY_DSN` (facultative), `VITE_UMAMI_WEBSITE_ID` (facultative), `QR_WORKER_URL`.

**GitHub — secrets de dépôt** : `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

**GitHub — environnement `staging`** : secret `SUPABASE_DB_URL`.

**GitHub — environnement `production`** : secrets `SUPABASE_DB_URL`, `R2_ACCESS_KEY_ID`,
`R2_SECRET_ACCESS_KEY`, `SUPABASE_S3_ACCESS_KEY_ID`, `SUPABASE_S3_SECRET_ACCESS_KEY`,
`BACKUP_HEALTHCHECK_URL` ; variables `BACKUP_R2_BUCKET`, `BACKUP_AGE_RECIPIENT`,
`SUPABASE_S3_ENDPOINT`, `SUPABASE_S3_REGION`.

**Cloudflare** : variables d'exécution du Worker `SUPABASE_URL` /
`SUPABASE_PUBLISHABLE_KEY` (poussées par la CI à chaque déploiement, rien à saisir) ;
widgets Turnstile ; domaine personnalisé ; jeton API ; bucket R2 des sauvegardes, ses
règles d'expiration et son jeton d'accès.

**Supabase (dashboard, par projet)** : identifiants SMTP, clé secrète Turnstile, templates
d'email, URLs de redirection, rate limits ; accès S3 au Storage (production).

**healthchecks.io** : le check de la sauvegarde et ses alertes email.

**Hors ligne** : clé privée `age` de déchiffrement des sauvegardes.

**Local (`.env.local`)** : toutes les `VITE_*` utiles en dev, plus `MAPTILER_KEY` et
`SUPABASE_SECRET_KEY`. **`config.toml`** : clé secrète Turnstile de test (local/CI
seulement).
