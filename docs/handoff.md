# Journal de passation

> Une entrée par étape terminée. Destiné à la session suivante : état réel,
> dettes connues, et pièges déjà payés une fois — pour qu'ils ne le soient pas
> deux fois.

---

## 2026-09-18 — Étape 9 (durcissement) terminée

**État** : branche `step-9-hardening`, pas encore mergée. C'était la
dernière étape du plan de construction (spec §9) — v1 fonctionnellement
complète, sous réserve des dettes listées plus bas et de la vérification sur
téléphone réel.

Détail complet : [`docs/plans/step-09-hardening.md`](plans/step-09-hardening.md).

### Ce qui existe maintenant et qui n'existait pas

- Turnstile invisible sur la demande d'OTP (`src/features/auth/useTurnstile.ts`,
  `useOtpLogin.ts` — qui a aussi éliminé la duplication entre `LoginPage` et
  `SubmitStep`), câblé aux quatre points d'envoi. `VITE_TURNSTILE_SITE_KEY`
  reste optionnelle : le widget créé par le compte reste à ajouter aux
  variables du repo GitHub.
- `get_klash_author_contact(klash_id)`, journalisée dans
  `author_contact_lookups` (lecture admin uniquement, écriture impossible
  hors de la fonction), plus `purge_author_contact_lookups()` pour la
  rétention à 12 mois promise par la politique de confidentialité.
- `delete_my_account()` : suppression de compte RGPD par anonymisation vers
  un profil sentinelle « Compte supprimé », section dédiée sur `/me`.
- Trois lacunes RLS réelles corrigées (spec §2) : un moderator/admin pouvait
  réassigner `author_id` ; une `authority` ne pouvait pas modifier **son
  propre** klash (contraire à la spec, et ce qui bloquait aussi la
  suppression de compte pour ce rôle) ; un auteur pouvait forger
  `confirmations_count`/`comments_count`/`created_at`/`resolved_at`.
- `/mentions-legales` et `/confidentialite`, contenu complet, identité de
  l'association en `TODO` (non dérivable du code).
- Un vrai harnais Playwright (`e2e/`, `playwright.config.ts`) : 5 specs +
  fumée, sur Chromium bureau et un profil tactile `devices['iPhone 13']`,
  job CI `e2e` autonome. A trouvé un vrai bug préexistant (voir pièges
  ci-dessous).
- 147 assertions pgTAP sur 7 fichiers (2 nouveaux, 1 étendu) : couverture
  RLS complète du tableau de permissions de la spec §2, per CLAUDE.md.

### Dettes connues

| Dette                                                                         | Gravité                | Où                                                                     |
| ----------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------- |
| Identité réelle de l'association dans les pages légales (nom, SIRET, adresse) | Bloquant avant prod    | `src/i18n/fr.ts` (`fr.legal`), marqué `TODO`                           |
| Purge de `author_contact_lookups` non planifiée                               | Fonctionnelle, mineure | La fonction existe (`purge_author_contact_lookups`), rien ne l'appelle |
| `klash_photos` orphelines au Storage lors de l'anonymisation d'un compte      | Silencieuse, acceptée  | `delete_my_account()` ne touche pas Storage — voir pièges              |
| Aucune vérification sur téléphone réel de cette étape                         | À faire avant merge    | —                                                                      |
| Dette de l'étape 7 toujours ouverte : rien ne renseigne `duplicate_of`        | Fonctionnelle, visible | Non traité par cette étape                                             |

### Pièges — déjà payés une fois

**1. Supabase captcha est un interrupteur global au niveau du projet, pas par
requête.** L'activer dans le dashboard rejette _toute_ requête `signInWithOtp`
sans `captchaToken` valide, y compris pour des clients pas encore mis à jour.
`VITE_TURNSTILE_SITE_KEY` doit être déployée (build + preview) **avant**
d'activer la protection captcha côté Supabase, jamais après.

**2. Un jeton Turnstile est à usage unique et expire en 300 s.** Le bouton
« Renvoyer un code » est un second envoi indépendant : il ne peut pas
réutiliser le jeton du premier envoi. `useTurnstile.ts` réinitialise le
widget après chaque `getToken()`.

**3. `getToken()` et l'effet de montage du widget attendent la même promesse
de chargement du script — mais un seul des deux la consommait.** Une
implémentation initiale faisait rendre le widget uniquement par l'effet de
montage ; un appel à `getToken()` arrivant avant la résolution de cette
promesse (plausible sur une connexion lente) trouvait `widgetIdRef` encore
`null` et renvoyait silencieusement `undefined` — jeton absent, rejeté
`captcha_failed` par Supabase. Corrigé en faisant rendre son propre widget
par `getToken()` à la demande, sur premier usage — un seul chemin de code
renseigne désormais `widgetIdRef`.

**4. `current_user_role()` lit le JWT de l'appelant, pas le rôle Postgres —
y compris depuis une fonction SECURITY DEFINER.** `delete_my_account()`
réassigne les klashs de l'utilisateur qui se supprime ; pour un compte
`authority`, cela déclenchait `guard_klash_authority_columns` (« an
authority can only change a klash status ») car ce trigger n'avait pas
d'exemption pour le propre klash de l'acteur. Toute fonction SECURITY
DEFINER qui modifie une ligne au nom de l'appelant peut retomber sur ce
genre de garde — vérifier qu'elle a une échappatoire pour l'auteur lui-même,
pas seulement pour le rôle.

**5. Un trigger d'immutabilité générique doit connaître `pg_trigger_depth()`
ET la position de son propre nom dans l'ordre d'exécution.**
`guard_klash_system_columns` (nouveau, interdit de forger
`confirmations_count`/`comments_count`/`created_at`, et `resolved_at` hors
changement de statut) a cassé deux choses avant sa version finale, chacune
vérifiée en base locale avant correction :

- Sans l'exemption `pg_trigger_depth() > 1`, poster un commentaire était
  rejeté : `refresh_comments_count()` est elle-même un `UPDATE` SECURITY
  DEFINER sur `klashes`, déclenchée à la profondeur 2.
- `resolved_at` ne peut PAS être protégée sans condition, même avec cette
  exemption : le propre `UPDATE` de `change_klash_status()` est une
  instruction de premier niveau dans le corps de la fonction, donc à la
  profondeur 1, pas 2. Il faut nommer le trigger pour qu'il s'exécute
  _après_ `klashes_enforce_status_transition` (Postgres trie les triggers
  de même timing par nom) et ne protéger `resolved_at` que quand `status`
  est inchangé.

**6. Le Storage Supabase reste inaccessible depuis SQL (toujours vrai,
piège déjà noté à l'étape 8).** `delete_my_account()` ne touche donc pas aux
fichiers Storage des photos réassignées — elles restent rattachées au klash
anonymisé, ce qui est le comportement voulu (préserver la donnée
collective), mais un futur besoin de purge des photos d'un compte supprimé
devra passer par le client ou une Edge Function, jamais par la RPC SQL.

**7. Les specs Playwright ont trouvé un bug de production réel, pas
seulement des bugs de test.** `SubmitStep` (connexion inline dans la feuille
de création) ne faisait jamais avancer son état après l'étape pseudo
(validation ou passage) — l'effet qui déclenche l'action différée
(création/confirmation du klash) restait bloqué indéfiniment sur
`step === 'nickname'`. Ce bug préexistait à cette étape (même défaut dans le
code d'avant l'extraction de `useOtpLogin`) et n'avait été détecté par
aucune des trois étapes précédentes ni par la CI — seul un vrai navigateur
driving le parcours complet l'a révélé. Rappel de la leçon de l'étape 7 :
lint + typecheck + tests verts ne veut toujours pas dire que ça marche.

**8. Mailpit renvoie les messages triés du plus récent au plus ancien, et
les trois comptes staff seedés sont réutilisés par plusieurs specs qui
tournent en parallèle.** Chercher « le message le plus récent pour cette
adresse » sans borne temporelle peut retourner le code d'un test précédent
pas encore lu, provoquant un `verifyOtp` avec un code périmé. Passer un
horodatage `sentAfter` (capturé juste avant le déclenchement de l'envoi) et
ne matcher que `Created >= sentAfter` élimine l'ambiguïté sans marge de
recul, puisque la liste est déjà triée.

### Notes d'environnement

- Bac à sable local sans accès réseau sortant vers le CDN de Playwright :
  `npx playwright install` échoue. `playwright.config.ts` utilise le
  Chromium système (`/usr/bin/chromium-browser`, déjà exploité ad hoc à
  l'étape 7) via `launchOptions.executablePath`, strictement conditionné à
  `!process.env.CI` — la CI installe son propre Chromium géré par
  Playwright et ne doit jamais dépendre de ce chemin, qui n'existe pas sur
  ses runners.
- `devices['iPhone 13']` a pour navigateur par défaut WebKit, non installé
  ici : forcer `browserName: 'chromium'` sur ce projet tout en gardant le
  viewport/UA/émulation tactile de l'appareil — sans quoi Playwright passe
  le flag de lancement WebKit `--inspector-pipe` au binaire Chromium, qui se
  ferme aussitôt et silencieusement (code de sortie 0).
- Les clés de test Cloudflare Turnstile (toujours acceptées/toujours
  refusées, en version visible et invisible) valident uniquement contre le
  secret de test correspondant — un vrai secret de production rejette un
  jeton de test. `supabase/config.toml` porte le secret de test ; ne jamais
  y mettre le vrai secret.
- `npm run format` avant de commiter : `format:check` est dans la CI (déjà
  noté à l'étape 8, toujours vrai).

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
