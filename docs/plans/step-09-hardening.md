# Step 9 — Durcissement

> Plan approuvé avant implémentation, puis mis à jour avec ce qui a réellement
> été livré. Voir `docs/handoff.md` pour le journal de passation.

## Contexte

Étapes 1 à 8 du plan §9 fusionnées sur `main`. L'étape 9 est la dernière du
plan de construction : durcissement plutôt que fonctionnalité — chaque
élément protège l'application d'un abus, honore une obligation légale, ou
prouve que les règles écrites en SQL tiennent réellement.

Trois chantiers étaient des dettes explicitement différées par des étapes
précédentes (`docs/handoff.md`) : la RPC de contact auteur, la suppression de
compte, un vrai harnais Playwright. Les trois autres — Turnstile, la revue
RLS, les pages légales — sont ce que la spec §9 étape 9 nomme directement.

## Ce qui a été livré

### 1. Cloudflare Turnstile sur la demande d'OTP (spec §5, §6.4)

- `src/lib/turnstile.ts`, `src/features/auth/useTurnstile.ts` : chargement du
  script Turnstile une seule fois, un widget invisible par instance du hook,
  `getToken()` exécute puis réinitialise le widget (un jeton Turnstile est à
  usage unique et expire après 300 s).
- `src/features/auth/useOtpLogin.ts` : extraction de la machine email → code
  → pseudo partagée par `LoginPage` et `SubmitStep` (la connexion inline de
  la feuille de création), qui la dupliquaient presque à l'identique.
  Turnstile n'a ainsi été câblé qu'à un seul endroit.
- `VITE_TURNSTILE_SITE_KEY` optionnelle dans `src/env.ts` : `env.ts` lève une
  exception au chargement du module sur une variable requise invalide, donc
  une clé requise sans valeur casserait tous les builds preview avant même
  la création du widget Cloudflare.
- `supabase/config.toml` : captcha activé localement (et en CI, qui réutilise
  ce fichier) avec le secret Cloudflare toujours-valide de test — vérifié en
  direct contre l'API Auth locale : une requête sans jeton est rejetée
  (`captcha_failed`), une requête avec le jeton de test réussit.
- Un bug de concurrence trouvé et corrigé après coup dans `useTurnstile.ts` :
  `getToken()` pouvait s'exécuter avant que l'effet de montage n'ait fini de
  rendre le widget, renvoyant silencieusement `undefined` — corrigé en
  faisant rendre son propre widget par `getToken()` à la demande.

### 2. Revue RLS (spec §2, §5)

Trois lacunes réelles trouvées en sondant une base Postgres locale en
conditions réelles (transactions annulées), pas seulement en lisant les
policies — et une quatrième demandée explicitement :

1. Un `moderator`/`admin` pouvait réassigner `author_id` d'un klash.
2. Une `authority` ne pouvait **pas** modifier son propre klash, alors que la
   spec §2 le permet — la même anomalie empêchait la suppression de compte
   pour un compte `authority` (SECURITY DEFINER ne change pas `auth.uid()`).
3. N'importe quel auteur pouvait forger `confirmations_count`,
   `comments_count`, `created_at`, `resolved_at` — empoisonnant le tri « plus
   confirmé », l'export, les statistiques `/admin`, et le filtre à 90 jours
   de la carte.
4. `klash_photos.storage_path` n'était pas validé contre `klash_id`.

Corrigées par la migration ci-dessous, avec assertions pgTAP dédiées.

### 3. `get_klash_author_contact` (spec §2, différée depuis l'étape 7)

RPC SECURITY DEFINER, journalisée dans `author_contact_lookups` (lecture
réservée à `admin`, écriture uniquement par la fonction — aucune policy
INSERT/UPDATE/DELETE), plus `purge_author_contact_lookups()` pour
l'engagement de rétention à 12 mois de la politique de confidentialité.
Bouton « Voir l'email de l'auteur » sur `/k/:id`, jamais appelé au
chargement de la page.

### 4. Suppression de compte RGPD (spec §6.5)

`delete_my_account()` : réassigne les klashs, photos, commentaires et
`status_changes` au profil sentinelle « Compte supprimé »
(`deleted-account@101ameliorations.invalid`, TLD réservé RFC 2606), retire
les confirmations, puis supprime la ligne `auth.users` — ordre imposé par les
clés étrangères. Section dédiée sur `/me` avec confirmation en deux temps.

### 5. Harnais Playwright complet (spec §8)

`e2e/` : 5 specs (`auth`, `create-klash`, `lifecycle`, `admin`,
`account-deletion`) + un test de fumée, contre une base Supabase locale
réelle (codes OTP lus via l'API Mailpit), sur deux projets — Chromium bureau
et un profil tactile `devices['iPhone 13']` (`docs/handoff.md` : c'est ce
profil qui avait trouvé les bugs de l'étape 7). A trouvé un vrai bug
préexistant en conditions réelles : l'étape pseudo de `SubmitStep` ne
libérait jamais l'action différée après validation/passage, bloquant
silencieusement la création pour tout utilisateur voyant cette étape.

Nouveau job CI `e2e`, autonome (son propre `supabase start` + `db reset`
seedé), utilisant un Chromium géré par Playwright plutôt que le contournement
« Chromium système » du bac à sable local (sans accès réseau sortant).

### 6. Mentions légales et politique de confidentialité (spec §9 étape 9)

Routes `/mentions-legales` et `/confidentialite`, contenu complet sous
`fr.legal`, identité de l'association en `TODO` explicites (non dérivable du
code). La politique de confidentialité documente spécifiquement la
consultation d'email et son journal d'audit (12 mois), comme l'exige la
spec §2.

## Fichiers créés ou modifiés (principaux)

- `supabase/migrations/20260918092650_step9_hardening.sql` — la seule
  migration de cette étape.
- `supabase/tests/author_contact_rls_test.sql`,
  `account_deletion_rls_test.sql` (nouveaux), `klash_lifecycle_test.sql`
  (étendu) — 147 assertions pgTAP au total sur 7 fichiers.
- `src/lib/turnstile.ts`, `src/features/auth/{useTurnstile,useOtpLogin}.ts`.
- `src/api/klashes.ts` (`getKlashAuthorContact`), `src/api/profiles.ts`
  (`deleteMyAccount`), et les hooks/UI associés sur `/k/:id` et `/me`.
- `src/features/legal/{LegalNoticePage,PrivacyPolicyPage}.tsx`.
- `e2e/` (specs + support), `playwright.config.ts`, `tsconfig.e2e.json`.
- `.github/workflows/ci.yml` — nouveau job `e2e`.

## Variables d'environnement ajoutées

| Où                                            | Variable                  | Valeur                                          |
| --------------------------------------------- | ------------------------- | ----------------------------------------------- |
| `.env.local`, `.env.example`                  | `VITE_TURNSTILE_SITE_KEY` | clé de test `1x00000000000000000000BB` en local |
| Variables du repo GitHub                      | `VITE_TURNSTILE_SITE_KEY` | la vraie clé de site, une fois créée            |
| Dashboard Supabase → Auth → Attack Protection | secret Turnstile          | jamais dans le repo                             |

## Critère d'acceptation

CLAUDE.md, définition du fini pour tout v1 : les tests RLS dans
`supabase/tests/` couvrent chaque action interdite du tableau de permissions
de la spec §2 — atteint (147 assertions). `npm run lint`, `typecheck`,
`test`, `db:test` et `e2e` tous verts, vérifiés sur l'état final commité.

## Dettes ouvertes à l'issue de cette étape

- Identité réelle de l'association dans les pages légales (placeholders
  `TODO`).
- Purge planifiée de `author_contact_lookups` : la fonction existe, rien ne
  l'appelle encore automatiquement.
- Aucune vérification sur téléphone réel de cette étape avant merge.
