# Services tiers, variables et secrets

Inventaire de tous les services externes utilisés par 101améliorations, de leur rôle, et
de chaque variable / secret associé avec **l'endroit où il est défini**. Les détails
d'installation restent dans le [`README.md`](../README.md) ; ce document sert de carte.

Légende des emplacements :

| Abréviation       | Où                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------- |
| **GH var**        | GitHub → Settings → Secrets and variables → Actions → _Variables_ (niveau dépôt)        |
| **GH secret**     | GitHub → Settings → Secrets and variables → Actions → _Secrets_ (niveau dépôt)          |
| **GH env secret** | GitHub → Settings → Environments → `staging` / `production` → secret d'environnement    |
| **Worker var**    | Variable d'exécution du Worker Cloudflare, injectée par la CI via `wrangler --var`      |
| **Dashboard X**   | Réglé à la main dans le dashboard du service X (pas versionné)                          |
| **`.env.local`**  | Fichier local non versionné (modèle : [`.env.example`](../.env.example))                |
| **`config.toml`** | [`supabase/config.toml`](../supabase/config.toml) — Supabase **local et CI uniquement** |

> Les `VITE_*` sont inlinées dans le bundle JS au build : elles sont **publiques par
> nature** et donc stockées en _variables_ GitHub, pas en secrets (voir README,
> « Secrets et variables requis »). Les vrais secrets sont listés en gras ci-dessous.

---

## Vue d'ensemble

| Service                   | Rôle                                                       | Obligatoire ?           |
| ------------------------- | ---------------------------------------------------------- | ----------------------- |
| Supabase (prod + STAGING) | Base Postgres/PostGIS, Auth OTP email, Storage photos, RLS | Oui                     |
| Fournisseur SMTP          | Envoi des emails OTP de Supabase Auth (Resend, Postmark…)  | Oui en prod             |
| Cloudflare Workers        | Hébergement du front statique + Worker `/k/*`, `/r/*`      | Oui                     |
| Cloudflare Turnstile      | Captcha invisible à la connexion                           | Oui en prod (build)     |
| Cloudflare Worker QR      | Génère le QR code des previews de PR                       | CI uniquement           |
| MapTiler                  | Tuiles de fond de carte                                    | Oui (sauf proxy de dev) |
| Sentry                    | Remontée d'erreurs front                                   | Non                     |
| Umami Cloud               | Mesure d'audience sans cookie (prod uniquement)            | Non                     |
| GitHub Actions            | CI : lint, tests, migrations, previews, déploiement        | Oui                     |
| OpenStreetMap             | Données cartographiques (via MapTiler) — attribution seule | — (aucune clé)          |

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
  (voir section Turnstile).

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
STAGING puis prod, previews Cloudflare, déploiement production.

| Variable / secret | Usage                                      | Défini où                       |
| ----------------- | ------------------------------------------ | ------------------------------- |
| `GITHUB_TOKEN`    | Commentaire de PR avec URL + QR de preview | Automatique (fourni par GitHub) |

Environnements GitHub : `staging` (sans restriction de branche) et `production`
(restreint à `main`), chacun portant son `SUPABASE_DB_URL`.

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

**GitHub — secrets d'environnement** : `SUPABASE_DB_URL` dans `staging` et dans
`production`.

**Cloudflare** : variables d'exécution du Worker `SUPABASE_URL` /
`SUPABASE_PUBLISHABLE_KEY` (poussées par la CI à chaque déploiement, rien à saisir) ;
widgets Turnstile ; domaine personnalisé ; jeton API.

**Supabase (dashboard, par projet)** : identifiants SMTP, clé secrète Turnstile, templates
d'email, URLs de redirection, rate limits.

**Local (`.env.local`)** : toutes les `VITE_*` utiles en dev, plus `MAPTILER_KEY` et
`SUPABASE_SECRET_KEY`. **`config.toml`** : clé secrète Turnstile de test (local/CI
seulement).
