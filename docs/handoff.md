# Journal de passation

> Une entrée par étape terminée. Destiné à la session suivante : état réel,
> dettes connues, et pièges déjà payés une fois — pour qu'ils ne le soient pas
> deux fois.

---

## 2026-09-15 — Étape 8 (PWA, export, Open Graph, Sentry) terminée

**État** : branche `claude/blissful-goodall-8v6fwy`, pas encore mergée.
**Prochaine étape** : 9 — durcissement (Turnstile, revue RLS,
`get_klash_author_contact`, suppression de compte, Playwright, mentions
légales / politique de confidentialité).

Détail complet : [`docs/plans/step-08-pwa-export-og-sentry.md`](plans/step-08-pwa-export-og-sentry.md).

### Ce qui existe maintenant et qui n'existait pas

- PWA installable (`vite-plugin-pwa`, manifest, service worker, bandeau
  d'installation) avec mise en cache des tuiles, des photos et de
  `klashes_public`.
- `/export` : CSV et GeoJSON publics, sans donnée personnelle, paginés sur
  `klashes_public` (pas de nouvelle RPC).
- Aperçu Open Graph par klash sur `/k/:id`, via un Worker Cloudflare
  (`workers/app/`) placé devant le service d'assets — et le bouton de
  partage que la spec §6.3 demandait déjà mais que l'app n'avait jamais eu.
- Sentry câblé, `VITE_SENTRY_DSN` facultative — inerte tant qu'aucun compte
  n'est configuré.
- Icônes et image Open Graph générées depuis un mark « 101 » géométrique
  (`public/icon-source.svg`, scripts `gen:icons`/`gen:og-image`).

### Dettes connues

| Dette                                                                                                        | Gravité                            | Où                                                                                                            |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Aucune vérification humaine sur téléphone réel de cette étape (session sans accès à un appareil physique)    | À faire avant merge                | Installation PWA Android/iOS, aperçu de lien réel dans une appli de messagerie, export ouvert dans un tableur |
| Aucun compte Sentry créé — le câblage n'a jamais reçu de vraie erreur                                        | Fonctionnelle, mineure             | À faire une fois un DSN disponible                                                                            |
| `run_worker_first`/`--var` de wrangler vérifiés en local (`wrangler dev`), pas contre le vrai déploiement CI | À confirmer au premier déploiement | `.github/workflows/ci.yml`, `wrangler.jsonc`                                                                  |
| Dette de l'étape 7 toujours ouverte : rien ne renseigne `duplicate_of` dans l'app                            | Fonctionnelle, visible             | Non traité par cette étape                                                                                    |

### Pièges — déjà payés une fois

**1. `env.ASSETS.fetch()` sur `/index.html` explicitement déclenche une
redirection.** Cloudflare normalise les URLs de son service d'assets : une
requête _explicite_ vers `/index.html` est redirigée (307) vers `/`. Dans
`workers/app/src/index.ts`, cela aurait envoyé tout lien de klash dans une
boucle de redirection vers la carte. Toujours refetcher la requête d'origine
(`request`), jamais une URL construite à la main vers `/index.html` — le
`not_found_handling: 'single-page-application'` s'en charge très bien tout
seul pour un chemin non trouvé.

**2. `esbuild` casse le type global `URL` dans `tsconfig.node.json`.**
`esbuild` (dépendance transitive de `vite`) déclare `interface URL {}` (vide)
dans son propre `.d.ts`, à des fins internes. Sans la lib `DOM`, c'est la
seule définition de `URL` visible par `vite.config.ts` — `url.hostname`
devient une erreur de type dans les callbacks `urlPattern` de
`vite-plugin-pwa`. Solution : `"lib": ["ES2023", "DOM"]` dans
`tsconfig.node.json`. Si un futur fichier de config Node a besoin d'un type
`URL` complet, il aura le même problème.

**3. Les imports d'un module ES s'exécutent avant le corps du module qui
les importe.** `initSentry()` appelé en tête de `main.tsx` ne peut _pas_
intercepter le `throw` de `src/env.ts` sur des variables invalides : cet
échec survient pendant la résolution des imports de `./router` (dont
`env.ts` fait transitivement partie), donc avant que la moindre ligne du
corps de `main.tsx` — cet appel inclus — ne s'exécute. Une hypothèse du
plan initial d'étape 8 tenait pour acquis le contraire ; corrigée dans
`src/lib/sentry.ts` (commentaire) plutôt que dans le code, la vraie
solution (armer Sentry depuis un `<script>` classique avant le script de
module) étant disproportionnée pour ce cas.

### Notes d'environnement

- `wrangler dev --local` fonctionne dans ce type d'environnement (le binaire
  `workerd` est vendu avec `wrangler`) et permet de vérifier un Worker
  Cloudflare sans déploiement réel — utile pour toute future modification de
  `workers/app/` ou `workers/qr/`.
- Pas de Docker ni de navigateur réel disponibles dans cette session pour la
  vérification téléphone de la PWA — voir la dette ci-dessus.

---

## 2026-09-16 — Étape 7 (cycle de vie) terminée

**État** : PR #11 mergée sur `main`. Étapes 1 à 7 du plan §9 livrées.
**Prochaine étape** : 8 — PWA + export + Open Graph + Sentry.

Détail complet de ce qui a été fait et des écarts au plan :
[`docs/plans/step-07-lifecycle.md`](plans/step-07-lifecycle.md).

### Ce qui existe maintenant et qui n'existait pas

- Un graphe de transitions appliqué en base (`can_change_klash_status`), avec
  une RPC `change_klash_status` comme **seule voie** de changement de statut.
  Un `UPDATE` direct sur `klashes.status` est rejeté, y compris comme
  `postgres` — voir « pièges » ci-dessous.
- `status_changes` est enfin peuplée. `resolved_at` est posé/effacé
  automatiquement.
- Un socle rôles côté front : `useRole()`, `RequireRole`, et un miroir pur du
  graphe dans `src/lib/klashTransitions.ts`.
- `/admin` (table, file « à trier », gestion des rôles).
- Trois comptes staff dans le seed : `seed-moderator@`, `seed-authority@`,
  `seed-admin@` `101ameliorations.test`.

### Dettes connues

| Dette                                                                                                  | Gravité                | Où                                                                           |
| ------------------------------------------------------------------------------------------------------ | ---------------------- | ---------------------------------------------------------------------------- |
| **Rien ne renseigne `duplicate_of` dans l'app** — un klash passé en `duplicate` n'a aucun original lié | Fonctionnelle, visible | UI absente ; base prête                                                      |
| **Photos orphelines au Storage** — nettoyées seulement si la suppression passe par l'app               | Silencieuse            | `deleteKlash()` ; fermeture propre = job planifié ou Edge Function → étape 9 |
| `get_klash_author_contact` + table d'audit                                                             | Reportée (arbitrée)    | → étape 9, avec la politique de confidentialité                              |
| Actions par lot et statistiques `/admin`                                                               | Reportées (arbitrées)  | spec §6.6                                                                    |
| Masquer un commentaire le marque « Modifié »                                                           | Cosmétique             | `set_updated_at()` se déclenche sur tout UPDATE                              |
| Aucun test de composant dans le repo                                                                   | Structurelle           | 14 fichiers Vitest, tous sur des fonctions pures                             |

### Pièges — déjà payés une fois

**1. Une query TanStack désactivée reste `pending` pour toujours.**
`useProfile()` est `enabled: Boolean(user)`. Attendre son `isPending` pour
décider quoi que ce soit bloque indéfiniment un visiteur déconnecté. C'est ce
qui a produit un spinner infini sur `/admin`. Si tu écris un autre garde ou un
écran conditionné par le profil : traite le cas « pas d'utilisateur » comme
**résolu**, pas comme « en cours de chargement ».

**2. Ne jamais naviguer avant une mutation.**
`navigate()` démonte le composant, et avec lui la mutation locale — la requête
ne part pas et l'erreur n'a nulle part où s'afficher. C'est ce qui rendait la
suppression silencieuse. Navigue dans `onSuccess`. (`MePage` fait l'inverse
pour `signOut()`, mais c'est légitime : `signOut` vit sur le contexte d'auth,
qui survit au démontage. Ne pas généraliser ce motif.)

**3. Le Storage Supabase est inaccessible depuis SQL.**
`storage.protect_objects_delete` rejette tout `DELETE` direct sur
`storage.objects`, y compris depuis un trigger `security definer`. Toute
manipulation d'objets passe par l'API Storage (donc : client, Edge Function, ou
job externe). Un trigger qui l'ignore ne casse pas que lui-même — il annule
l'instruction appelante.

**4. Changer un statut en SQL exige de désactiver le trigger.**
`enforce_status_transition` rejette tout changement hors RPC, quel que soit le
rôle Postgres. Pour une fixture ou une maintenance :

```sql
alter table public.klashes disable trigger klashes_enforce_status_transition;
-- ... l'UPDATE ...
alter table public.klashes enable trigger klashes_enforce_status_transition;
```

C'est ce que fait `klash_creation_rls_test.sql` (test 6). Le seed n'est pas
concerné : il crée les klashs par `INSERT` avec un statut explicite, et les
triggers de statut ne se déclenchent que sur `UPDATE`.

**5. `current_user_role()` renvoie NULL hors session authentifiée.**
Donc pour tout `postgres`/`service_role`, y compris le seed. Un garde doit
toujours s'écrire `coalesce(public.current_user_role(), 'user') <> '<rôle>'`,
jamais sous forme négative — sinon la comparaison vaut NULL, plpgsql la traite
comme fausse, et le garde rejette le seed. Idiome déjà utilisé par
`guard_profiles_role`, `guard_comment_hidden`, `guard_klash_authority_columns`.

**6. Lint + typecheck + tests verts ≠ ça marche.**
Les trois bugs de cette étape sont passés au travers de toute la CI. Deux
d'entre eux tenaient à des trous de couverture : aucun test ne supprimait de
klash, et aucun ne visitait une page en tant qu'anonyme. La vérification en
navigateur (connexion réelle, chaque rôle, desktop **et** profil tactile
`devices['iPhone 13']`) n'est pas une formalité de fin d'étape — c'est ce qui
les a trouvés.

### Notes d'environnement

- **Les previews CI pointent sur la base de production** (cf. README). Après un
  `db push`, promouvoir un compte à la main pour tester : récupérer son id via
  `select id from auth.users where email = '…'`, puis le motif
  `disable trigger profiles_guard_role` / `update` / `enable trigger`.
- Playwright **n'est pas** une dépendance du repo. Il a été utilisé en ad hoc
  depuis le scratchpad (`npm install playwright --no-save`), avec
  `executablePath: '/usr/bin/chromium-browser'`. Les OTP locaux se lisent via
  l'API Mailpit (`http://127.0.0.1:54324/api/v1/messages`). La spec §8 prévoit
  un vrai harnais Playwright ; l'étape 9 l'exige.
- `npm run format` **avant** de commiter : `format:check` est dans la CI.
