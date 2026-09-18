# 101améliorations

PWA de signalement de problèmes sur les voies cyclables du Pays basque et du sud des
Landes (CAPB + sud Landes). Spécification complète : [`docs/spec.md`](docs/spec.md).

## Stack

React 18 + Vite + TypeScript (strict) + Tailwind v4, react-router, TanStack Query, zod.
Backend : Supabase (Postgres + PostGIS, Auth email OTP, Storage, RLS). Hébergement :
Cloudflare Worker + assets statiques.

## Prérequis

- Node 24 (LTS) — `nvm use` lit `.nvmrc`
- [Supabase CLI](https://supabase.com/docs/guides/cli) via `npx supabase`
- Docker (pour `npx supabase start`)

## Démarrage

```bash
npm install
cp .env.example .env.local   # puis renseigner les valeurs (voir ci-dessous)
npx supabase start           # base locale + Auth + Storage
npx supabase db reset        # applique les migrations + seed
npm run gen:types            # régénère src/types/database.ts
npm run dev
```

### Variables d'environnement (`.env.local`, non versionné)

| Variable                        | Rôle                                                                |
| ------------------------------- | ------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | URL de l'API Supabase (local : `http://127.0.0.1:54321`)            |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clé publishable Supabase (`sb_publishable_…`)                       |
| `VITE_MAPTILER_KEY`             | Clé API MapTiler                                                    |
| `VITE_TURNSTILE_SITE_KEY`       | Clé de site Cloudflare Turnstile — **optionnelle**, voir ci-dessous |
| `VITE_SENTRY_DSN`               | DSN Sentry — **optionnelle**, l'app démarre sans                    |
| `SUPABASE_SECRET_KEY`           | Usage scripts/CLI uniquement — jamais lue par le front              |

`VITE_TURNSTILE_SITE_KEY` : sans elle, l'app démarre normalement et se
connecte sans vérification Turnstile (voir `src/env.ts` et
`src/features/auth/useTurnstile.ts`) — utile avant la création du widget
Cloudflare. En local et en CI, utiliser une des clés de test Cloudflare :
`1x00000000000000000000BB` (invisible, toujours acceptée) ou
`2x00000000000000000000BB` (invisible, toujours refusée, pour tester le
message d'erreur). La protection captcha côté Supabase est un interrupteur
global au niveau du projet (Auth → Attack Protection) : ne l'activer en
production qu'une fois un build portant une vraie
`VITE_TURNSTILE_SITE_KEY` déployé, sinon toute connexion échoue.

## Scripts

| Commande               | Effet                                                   |
| ---------------------- | ------------------------------------------------------- |
| `npm run dev`          | Serveur de développement Vite                           |
| `npm run build`        | `tsc -b` puis build de production dans `dist/`          |
| `npm run lint`         | ESLint                                                  |
| `npm run typecheck`    | `tsc -b --noEmit`                                       |
| `npm test`             | Vitest (une fois)                                       |
| `npm run gen:types`    | Régénère `src/types/database.ts` depuis la base locale  |
| `npm run gen:icons`    | Régénère les icônes PWA depuis `public/icon-source.svg` |
| `npm run gen:og-image` | Régénère `public/og-image.png` depuis l'icône 512×512   |

## Base de données

Migrations versionnées dans `supabase/migrations/`. Ne jamais éditer une migration
appliquée : chaque changement de schéma est un nouveau fichier. Après une nouvelle
migration : `npx supabase db reset` puis `npm run gen:types`.

## Auth (OTP par email)

Connexion sans mot de passe : email → code à 6 chiffres → session persistante
(localStorage). En local, `supabase/config.toml` (`[auth.email.template.*]`) et
`supabase/templates/*.html` suffisent — les codes arrivent dans Mailpit
(http://127.0.0.1:54324). Ce fichier n'est **pas** appliqué au projet distant par
`db push` : les actions suivantes sont à faire à la main dans le dashboard Supabase
avant de tester le parcours sur un téléphone réel.

1. **Authentication → Emails → SMTP** : activer un SMTP applicatif (Resend,
   Postmark…), nom d'expéditeur « 101améliorations », adresse sur un domaine
   maîtrisé. ⚠️ Sans cela le SMTP intégré plafonne à ~2 emails/heure et n'envoie
   qu'aux adresses des membres du projet — un code envoyé à une adresse
   personnelle n'arrive jamais, silencieusement.
2. **DNS** : SPF + DKIM (et DMARC) sur le domaine d'envoi.
3. **Authentication → Emails → Templates → Magic Link** (et _Confirm signup_) :
   coller le contenu de `supabase/templates/magic_link.html`, sujet FR. Vérifier
   la présence de `{{ .Token }}` — sans elle Supabase envoie un lien au lieu d'un
   code.
4. **Authentication → URL Configuration** : Site URL = origine de prod, Redirect
   URLs = origines de preview.
5. **Authentication → Providers → Email** : « Confirm email » désactivé (aligné
   sur le local), OTP length 6, OTP expiry 3600.
6. **Authentication → Rate Limits** : relever la limite d'envoi d'emails au-delà
   de 2/h une fois le SMTP applicatif en place (2/h est global au projet).

## PWA

`vite-plugin-pwa` en mode `generateSW` / `registerType: 'autoUpdate'` (voir
`vite.config.ts`) : manifest, service worker, mise en cache des tuiles MapTiler et
des photos de klash (`CacheFirst`, 7 jours), et de la lecture `klashes_public`
(`NetworkFirst`, 5 min — la seule lecture Supabase dont la réponse est identique
pour `anon` et `authenticated`, le service worker ne pouvant pas lire la session
dans `localStorage`). Bandeau d'installation (`src/features/pwa/`) : flux natif
`beforeinstallprompt` sur Android/desktop, instructions manuelles sur iOS (qui ne
déclenche jamais cet évènement).

Icônes et image Open Graph générées depuis `public/icon-source.svg` — voir le
tableau des scripts ci-dessus. Ne jamais éditer les PNG générés à la main.

## Export des données

`/export` (spec §6.7) : CSV et GeoJSON de tous les klashs publics, sans donnée
personnelle, paginés côté client sur `klashes_public` (`src/api/export.ts`) — pas
de RPC dédiée, la vue est déjà lisible publiquement et PostgREST impose de toute
façon la pagination (`max_rows = 1000`).

## Open Graph (aperçus de lien)

Un lien `/k/:id` partagé affiche le titre, la description et la photo du klash
dans son aperçu (WhatsApp, Slack, etc.). Une SPA ne peut pas produire ça seule
(les robots n'exécutent pas son JS) : `workers/app/src/index.ts` s'exécute avant
le service d'assets sur `/k/*` (`wrangler.jsonc` → `assets.run_worker_first`),
lit le klash via PostgREST (clé anon) et réécrit les balises `<title>`/`og:*`
avec `HTMLRewriter`. Toute erreur (klash introuvable, Supabase injoignable,
timeout) renvoie la coquille par défaut telle quelle — jamais un point de panne
pour la page elle-même. Toutes les autres routes ne passent pas par ce Worker.

## Monitoring (Sentry)

`src/lib/sentry.ts` : optionnel, activé uniquement si `VITE_SENTRY_DSN` est
définie. Sans elle, l'app démarre normalement (voir le tableau des variables
ci-dessus). Erreurs de rendu (`src/components/AppErrorPage.tsx`, l'`errorElement`
racine du routeur) et toute requête/mutation TanStack Query en échec
(`src/lib/queryClient.ts`) sont remontées. Pas de tracing ni de session replay
(offre gratuite), et `sendDefaultPii: false` — les emails ne doivent jamais
sortir de l'app (spec §2).

## Déploiement (Cloudflare Worker + assets)

Les variables `VITE_*` sont injectées dans le bundle **au build**, pas lues au
runtime par le Worker : `.env.local` pointe volontairement vers la base locale
(développement), donc un build destiné au déploiement doit utiliser les valeurs de
prod. Créer `.env.production.local` (non versionné, lu automatiquement par Vite en
mode production, prioritaire sur `.env.local`) :

```bash
# .env.production.local
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…   # npx supabase projects api-keys --project-ref <ref>
VITE_MAPTILER_KEY=…                              # même clé qu'en local
VITE_SENTRY_DSN=…                                # facultative
```

```bash
nvm use                       # Node 24, cf. .nvmrc
npm run build
# --var : variables d'exécution du Worker (workers/app/src/index.ts, l'Open
# Graph par klash) — distinctes des VITE_* ci-dessus, inlinées dans le bundle
# au build et donc invisibles pour le Worker.
npx wrangler versions upload \
  --var "SUPABASE_URL:https://<project-ref>.supabase.co" \
  --var "SUPABASE_PUBLISHABLE_KEY:sb_publishable_…"
# déploiement preview, ne touche pas le trafic prod
# npx wrangler versions deploy   # bascule une version preview en prod (validation humaine)
```

Config : [`wrangler.jsonc`](wrangler.jsonc) (dossier d'assets `./dist`, fallback SPA,
Worker `workers/app/src/index.ts` sur `/k/*` seulement).

Nouvelle migration à pousser en prod : `npx supabase db push`. Rejouer `seed.sql` en
prod (données de test) : `npx supabase db query --linked -f supabase/seed.sql` — le
script est idempotent (voir son en-tête). Avant l'ouverture au public, supprimer ces
données de test : `npx supabase db query --linked -f scripts/cleanup-seed-data.sql`.

## CI (GitHub Actions)

Le repo est aussi connecté à **Cloudflare Workers Builds** (intégration Git native).
Son déclencheur Preview a un bug d'UI connu : les _Build variables and secrets_ saisies
dans Settings → Build ne s'appliquent qu'au déclencheur de production, pas à celui de
preview, et l'UI n'offre aucun emplacement pour en saisir sur ce scope. Résultat vérifié
sur une preview de branche : le bundle ne contient aucune des trois `VITE_*` inlinées,
`src/env.ts` lève « Invalid environment variables » et la page est blanche — alors que
les builds de `main` contiennent bien les valeurs.

C'est pour ça que `.github/workflows/ci.yml` construit les previews à la place : les
valeurs viennent des secrets GitHub, dont le scope n'a pas cette limitation. Pour éviter
deux builds concurrents par PR sur le même Worker, le déclencheur **Preview** de
Cloudflare doit être désactivé (Worker → Settings → Builds), en ne gardant que
`main` → production côté Cloudflare. **Action manuelle restant à faire dans le dashboard
Cloudflare** — rien côté CI ne peut le faire à sa place.

**Jobs (`.github/workflows/ci.yml`)** :

| Job                 | Déclencheur             | Fait                                                                                                                                    |
| ------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `quality`           | PR + push `main`        | `lint`, `format:check`, `typecheck`, `test`, puis un build avec des `VITE_*` factices (prouve juste que ça compile)                     |
| `database`          | PR + push `main`        | `supabase start`, `db reset --no-seed`, `supabase test db`, vérifie que `src/types/database.ts` est à jour                              |
| `preview`           | PR (pas depuis un fork) | Build avec les vrais `VITE_*`, `wrangler versions upload --preview-alias pr-<N> --var …` (vars du Worker), commentaire de PR (URL + QR) |
| `deploy-production` | push `main`             | Build avec les vrais `VITE_*`, `wrangler deploy --var …`                                                                                |

Le job `preview` est sauté sur les PR venant d'un fork (les secrets ne leur sont pas
exposés) — dans ce cas, tester avec le workflow habituel (`wrangler versions upload` en
local, cf. section Déploiement).

### Secrets et variables requis

À saisir une fois, dans **Settings → Secrets and variables → Actions** du repo (ou via
`gh`). Seuls les deux jetons Cloudflare sont de vrais secrets ; les trois `VITE_*` sont
des **variables**, pas des secrets — elles sont conçues pour être publiques (clé
« publishable » Supabase et URL d'API, RLS fait la vraie sécurité ; clé MapTiler
restreinte par domaine) et se retrouvent de toute façon en clair dans le bundle JS livré
au navigateur. Les mettre en `secret` les masquerait sans les protéger, et donnerait une
fausse impression de confidentialité :

```bash
gh variable set VITE_SUPABASE_URL               # https://<project-ref>.supabase.co
gh variable set VITE_SUPABASE_PUBLISHABLE_KEY   # sb_publishable_…
gh variable set VITE_MAPTILER_KEY
gh variable set VITE_SENTRY_DSN                 # facultative — voir la section Monitoring
gh secret set CLOUDFLARE_API_TOKEN              # scope minimal : Workers Scripts:Edit
gh secret set CLOUDFLARE_ACCOUNT_ID
gh variable set QR_WORKER_URL                   # URL du worker QR, voir ci-dessous
```

Les `VITE_*` sont celles de `.env.production.local` (voir section Déploiement).
`VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` sont aussi réutilisées, sans
variable de dépôt supplémentaire, comme variables d'exécution du Worker (voir
Open Graph ci-dessus) — passées via `wrangler --var` par la CI, jamais lues au
build.

### QR code de preview

`workers/qr/` est un petit Worker Cloudflare séparé : il reçoit `?u=<url>`, valide que
l'URL est en `https://` sur un hôte `*.workers.dev` (garde-fou anti-abus — sans ça,
n'importe qui pourrait s'en servir comme générateur de QR ouvert), et renvoie un QR en
SVG (`uqr`), caché indéfiniment côté client (l'alias de preview est stable pour toute la
durée de vie de la PR).

Déploiement (à refaire seulement si `workers/qr/src/index.ts` change) :

```bash
npx wrangler deploy --config workers/qr/wrangler.jsonc
```

Puis mettre à jour la variable de dépôt `QR_WORKER_URL` avec l'URL affichée.

### Previews et base de données

Les previews CI pointent vers la base de production Supabase (mêmes secrets que
`deploy-production`). Depuis l'étape 4 (création), tester une preview depuis un
téléphone crée un vrai klash — et potentiellement un vrai compte — en base de
production. Décision assumée plutôt qu'une base dédiée aux previews : le produit n'a
pas encore d'utilisateurs réels, et dupliquer projet Supabase / migrations / seed pour
cette seule raison serait disproportionné à ce stade.

Après un test manuel de création (compte de test, ex. `test-<quelquechose>@<domaine
que tu contrôles>`), nettoyer avec :

```bash
psql "$(npx supabase status -o env --linked | grep DB_URL | cut -d= -f2-)" \
  -v email=<email-utilise-pour-le-test> \
  -f scripts/cleanup-test-klash.sql
```

Supprime les klashs, confirmations et le compte de cet email uniquement. Distinct de
`scripts/cleanup-seed-data.sql`, qui cible seulement les 12 utilisateurs de seed.
