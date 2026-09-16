# Étape 8 — PWA, export, Open Graph, Sentry

> Rétrospective écrite après implémentation, avant merge. Périmètre (spec §9.8) :
> « PWA + export + OG + Sentry ». La spec ne donne pas de critère d'acceptation
> explicite pour cette étape — le proposé en fin de plan initial est repris
> ci-dessous, tenu.

## Ce qui a été livré

Quatre décisions actées avec l'humain avant l'implémentation :

1. **Open Graph par klash**, via un petit Worker Cloudflare (pas seulement des
   balises statiques).
2. **Sentry câblé, DSN facultatif** — l'app démarre sans.
3. **Export sur la vue `klashes_public` existante**, sans nouvelle migration.
4. **Icônes générées** depuis un nouveau mark « 101 » géométrique.

### PWA (spec §7)

- `vite-plugin-pwa` en `generateSW` / `autoUpdate` (`vite.config.ts`) : manifest,
  trois règles `runtimeCaching` (tuiles MapTiler et photos en `CacheFirst`,
  `klashes_public` en `NetworkFirst` — la seule lecture Supabase dont la réponse
  est identique pour `anon` et `authenticated`, le service worker ne pouvant pas
  lire la session dans `localStorage`).
- `src/features/pwa/` : bandeau d'installation (`beforeinstallprompt` +
  instructions manuelles iOS), enregistrement du service worker.
- Icônes générées par `@vite-pwa/assets-generator` depuis `public/icon-source.svg`
  (un « 101 » redessiné en formes géométriques — un glyphe de police ne survit
  pas à la rasterisation par cet outil ni par `sharp`).

**Piège rencontré** : `esbuild` (dépendance transitive de `vite`) déclare un
`interface URL {}` global vide dans son propre `.d.ts`. Sans la lib `DOM` dans
`tsconfig.node.json`, c'était la _seule_ définition de `URL` dans la portée de
`vite.config.ts`, et cassait le typage de `url.hostname`/`url.pathname` dans les
callbacks `urlPattern` du plugin PWA. Corrigé en ajoutant `DOM` à `lib`.

### Export (spec §6.7)

- `src/api/export.ts` pagine `klashes_public` par tranches de 1000 lignes (le
  plafond `max_rows` de PostgREST l'imposait de toute façon) plutôt que d'ajouter
  une RPC dédiée — écart assumé à la lettre de la spec, sans migration.
- Colonnes projetées explicitement pour exclure tout ce qui identifie l'auteur.
  `exportKlashSchema`/`exportKlashFromRow` (`src/types/klash.ts`) sont un schéma
  dédié, `klashFromRow` exigeant justement les colonnes qu'on ne veut pas — même
  motif que `foundProfileRowSchema` dans `src/api/admin.ts`.
- `src/utils/csv.ts` (RFC 4180 + BOM UTF-8) et `geojson.ts` (ordre `[lng, lat]`),
  tous deux testés en Vitest.
- `/export`, publique, avec un lien discret sur la carte
  (`src/components/AppFooterLinks.tsx`).

### Open Graph (spec §6.3, §9.8)

- `workers/app/src/index.ts` : un Worker placé devant le service d'assets sur
  `/k/*` uniquement (`wrangler.jsonc` → `assets.run_worker_first: ["/k/*"]`),
  qui lit le klash via PostgREST (clé anon, même lecture qu'un navigateur) et
  réécrit `<title>`/`og:*`/`twitter:*` avec `HTMLRewriter`. Toute erreur — klash
  introuvable, Supabase injoignable, timeout — renvoie la coquille par défaut
  intacte.
- Bouton de partage sur `/k/:id` (`useShareKlash.ts`) : absent du code alors que
  la spec l'exige, et c'est lui qui rend l'aperçu OG visible en pratique.

**Vérifié en local** avec `wrangler dev --local` (vrai `workerd`) et un faux
serveur Supabase jetable : un id valide réécrit correctement les balises
(échappement HTML de l'attribut `og:url` inclus), un id malformé et une panne
DNS retombent tous deux sur la coquille non modifiée, et toute autre route ne
passe pas par le Worker.

**Un bug réel trouvé par cette vérification, pas par la CI** : appeler
`env.ASSETS.fetch()` sur `/index.html` explicitement déclenche la normalisation
d'URL de Cloudflare (`/index.html` → `/`, redirection 307) — ce qui aurait envoyé
tout lien de klash dans une boucle de redirection vers la carte. Corrigé en
refetchant la requête d'origine (`/k/:id`) plutôt que `/index.html` : le
`not_found_handling: 'single-page-application'` s'applique alors normalement et
sert la coquille avec un 200, sans redirection.

### Sentry (spec §8 « Monitoring »)

- `src/lib/sentry.ts`, appelé en tout premier dans `main.tsx`. `VITE_SENTRY_DSN`
  n'est pas dans le schéma zod obligatoire de `src/env.ts` : son absence est un
  no-op silencieux, testé par le build de la CI (`quality`) qui ne la définit
  jamais.
- `src/components/AppErrorPage.tsx` (`errorElement` racine du routeur) — avant
  cette étape, une erreur de rendu produisait une page blanche muette.
- `src/lib/queryClient.ts` : `QueryCache`/`MutationCache.onError` remonte toute
  requête ou mutation TanStack Query en échec.

**Écart assumé sur un point du plan initial** : le plan supposait que
`initSentry()` appelé en premier dans `main.tsx` pourrait intercepter le
`throw` de `src/env.ts` sur des variables d'environnement invalides (le bug de
page blanche documenté dans le README pour les previews Cloudflare Workers
Builds). Ce n'est pas vrai : les imports d'un module ES sont résolus et exécutés
avant le corps du module importateur, donc au moment où `initSentry()`
s'exécuterait dans `main.tsx`, l'échec de `env.ts` — survenu pendant la
résolution des imports de `./router` — aurait déjà eu lieu. Corriger ça
demanderait d'armer Sentry depuis un `<script>` classique dans `index.html`,
avant même le script de module ; jugé disproportionné pour un cas déjà bruyant
(erreur console, page blanche) et déjà intercepté plus tôt par le build de
fumée de la CI. Documenté tel quel dans `src/lib/sentry.ts`.

## Ce qui reste ouvert (non traité, hors périmètre confirmé)

Turnstile, revue RLS, `get_klash_author_contact`, suppression de compte,
Playwright, mentions légales et politique de confidentialité restent à l'étape 9.
L'UI qui renseigne `duplicate_of` (dette la plus visible de l'étape 7) n'est pas
traitée ici.

## Vérification

`npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test` (127
tests, 17 fichiers) et `npm run build` — tous verts, avec et sans
`VITE_SENTRY_DSN`. Aucune migration : `supabase test db` n'a rien de nouveau à
couvrir pour cette étape.

`workers/app/src/index.ts` vérifié en navigateur réel via `wrangler dev --local`
(voir ci-dessus).

Restant pour la vérification humaine sur téléphone réel (non faisable depuis cet
environnement) : installation PWA effective sur Android et iOS, aperçu de lien
réel dans WhatsApp/Slack/Signal, export téléchargé et ouvert dans un tableur et
dans geojson.io, et une erreur Sentry réellement reçue une fois un DSN configuré.
