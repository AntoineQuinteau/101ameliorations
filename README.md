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

| Variable                        | Rôle                                                     |
| ------------------------------- | -------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | URL de l'API Supabase (local : `http://127.0.0.1:54321`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clé publishable Supabase (`sb_publishable_…`)            |
| `VITE_MAPTILER_KEY`             | Clé API MapTiler                                         |
| `SUPABASE_SECRET_KEY`           | Usage scripts/CLI uniquement — jamais lue par le front   |

## Scripts

| Commande            | Effet                                                  |
| ------------------- | ------------------------------------------------------ |
| `npm run dev`       | Serveur de développement Vite                          |
| `npm run build`     | `tsc -b` puis build de production dans `dist/`         |
| `npm run lint`      | ESLint                                                 |
| `npm run typecheck` | `tsc -b --noEmit`                                      |
| `npm test`          | Vitest (une fois)                                      |
| `npm run gen:types` | Régénère `src/types/database.ts` depuis la base locale |

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
```

```bash
nvm use                       # Node 24, cf. .nvmrc
npm run build
npx wrangler versions upload  # déploiement preview, ne touche pas le trafic prod
# npx wrangler versions deploy   # bascule une version preview en prod (validation humaine)
```

Config : [`wrangler.jsonc`](wrangler.jsonc) (dossier d'assets `./dist`, fallback SPA).

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

| Job                 | Déclencheur             | Fait                                                                                                                |
| ------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `quality`           | PR + push `main`        | `lint`, `format:check`, `typecheck`, `test`, puis un build avec des `VITE_*` factices (prouve juste que ça compile) |
| `database`          | PR + push `main`        | `supabase start`, `db reset --no-seed`, `supabase test db`, vérifie que `src/types/database.ts` est à jour          |
| `preview`           | PR (pas depuis un fork) | Build avec les vrais `VITE_*`, `wrangler versions upload --preview-alias pr-<N>`, commentaire de PR (URL + QR)      |
| `deploy-production` | push `main`             | Build avec les vrais `VITE_*`, `wrangler deploy`                                                                    |

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
gh secret set CLOUDFLARE_API_TOKEN              # scope minimal : Workers Scripts:Edit
gh secret set CLOUDFLARE_ACCOUNT_ID
gh variable set QR_WORKER_URL                   # URL du worker QR, voir ci-dessous
```

Les trois `VITE_*` sont celles de `.env.production.local` (voir section Déploiement).

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
