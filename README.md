# 101améliorations

PWA de signalement de problèmes sur les voies cyclables du Pays basque et du sud des
Landes (CAPB + sud Landes). Spécification complète : [`docs/spec.md`](docs/spec.md).

## Stack

React 18 + Vite + TypeScript (strict) + Tailwind v4, react-router, TanStack Query, zod.
Backend : Supabase (Postgres + PostGIS, Auth email OTP, Storage, RLS). Hébergement :
Cloudflare Worker + assets statiques.

## Prérequis

- Node 22+ pour l'app (`nvm use` lit `.nvmrc`) ; Node 24 pour `wrangler` (`nvm use 24`
  avant `npm run build`/`npx wrangler …` si la version par défaut est plus basse)
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
nvm use 24                    # wrangler exige Node >= 22 ; la valeur par défaut peut être plus basse
npm run build
npx wrangler versions upload  # déploiement preview, ne touche pas le trafic prod
# npx wrangler versions deploy   # bascule une version preview en prod (validation humaine)
```

Config : [`wrangler.jsonc`](wrangler.jsonc) (dossier d'assets `./dist`, fallback SPA).

Nouvelle migration à pousser en prod : `npx supabase db push`. Rejouer `seed.sql` en
prod (données de test) : `npx supabase db query --linked -f supabase/seed.sql` — le
script est idempotent (voir son en-tête). Avant l'ouverture au public, supprimer ces
données de test : `npx supabase db query --linked -f scripts/cleanup-seed-data.sql`.
