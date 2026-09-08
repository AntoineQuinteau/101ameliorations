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
3. **Authentication → Emails → Templates → Magic Link** (et *Confirm signup*) :
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
