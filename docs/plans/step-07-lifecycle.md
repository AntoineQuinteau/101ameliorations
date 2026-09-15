# Étape 7 — Cycle de vie des klashs

> Rétrospective écrite le 2026-09-16, après merge de la PR #11 sur `main`.
> Le plan initial avait été validé avant implémentation ; ce document consigne
> ce qui a été livré, ce qui s'en écarte, et ce qui reste ouvert.

**Périmètre (spec §9.7)** : transitions de statut, historique, notes, rôles
`moderator`/`authority`, `/admin`.
**Critère d'acceptation** : « tests SQL des transitions interdites ». Atteint —
62 assertions pgTAP dans `supabase/tests/klash_lifecycle_test.sql`, 102 au total
sur les 5 fichiers.

## Ce qui a été livré

### Base de données

Trois migrations :

| Fichier                                               | Contenu                   |
| ----------------------------------------------------- | ------------------------- |
| `20260915075244_klash_lifecycle.sql`                  | Cœur de l'étape           |
| `20260915081200_admin_role_management.sql`            | `find_profile_by_email()` |
| `20260916001117_drop_klash_photo_objects_trigger.sql` | Correctif (voir plus bas) |

- **`can_change_klash_status(role, from, to)`** — source unique de vérité du
  graphe §3, appelée par le trigger _et_ par la RPC, et exposée en RPC pour que
  le front puisse interroger la base plutôt que dupliquer la règle.
- **`enforce_status_transition()`** (trigger `BEFORE UPDATE OF status`) —
  revalide le graphe indépendamment, rejette tout changement de statut hors RPC,
  et pose/efface `resolved_at`.
- **`change_klash_status(klash_id, to_status, note)`** — RPC `security definer`,
  seule voie supportée. Acteur toujours `auth.uid()`, jamais un paramètre.
  `select ... for update` pour sérialiser deux clics concurrents.
- **Faille d'auteur fermée** — `klashes_update_author_new` réaffirme désormais
  `status = 'new'` dans son `WITH CHECK`.
- **`guard_klash_authority_columns()`** — une `authority` ne peut modifier que
  `status` (spec §5).
- **Garde-fous `duplicate_of`** — CHECK anti-auto-référence, index, FK passée en
  `on delete set null`.

### Front

- `useRole()` / `RequireRole` — socle rôles, attendant la résolution de l'auth
  _et_ du profil.
- `src/lib/klashTransitions.ts` — miroir pur du graphe, testé en Vitest (12 tests).
- `/k/:id` — historique des statuts, formulaire de changement avec note,
  suppression, `hideComment`, et affichage de l'`organization` pour les comptes
  `authority` (écart préexistant corrigé).
- `/admin` — table paginée/filtrée/recherchable, file « à trier » (> 7 jours),
  gestion des rôles pour `admin`.

## Écarts par rapport au plan

### 1. Nettoyage des photos au Storage : approche changée en cours de route

**Plan** : trigger `AFTER DELETE` sur `klashes` supprimant les objets dans
`storage.objects`.
**Réalité** : impossible sur cette plateforme. Supabase protège ses propres
tables par `storage.protect_objects_delete`, qui lève :

> Direct deletion from storage tables is not allowed. Use the Storage API instead.

Levée depuis un trigger `AFTER DELETE`, cette exception annulait l'instruction
entière — **plus aucun klash n'était supprimable, par personne**. Le trigger a
été retiré et le nettoyage déplacé côté client (`deleteKlash()` appelle
`supabase.storage.remove()` avant de supprimer la ligne), en best-effort pour
qu'un échec Storage ne rende jamais un klash non supprimable.

_Leçon_ : le plan supposait qu'un trigger SQL pouvait toucher au Storage. Cette
hypothèse n'avait pas été vérifiée contre la base avant d'être écrite.

### 2. `RequireRole` redirige tout le monde vers `/`

**Plan** : anonyme → `/login`, rôle insuffisant → `/`.
**Livré** : tout le monde → `/`. `/admin` dépend d'un rôle, pas d'une session :
proposer la connexion à un anonyme laisserait croire qu'elle suffit à obtenir
l'accès. Changé sur retour utilisateur.

### 3. `mapStatusChangeError` abandonné

Le plan prévoyait un mappeur d'erreurs calqué sur `mapCommentError`. À
l'écriture, il s'est avéré qu'il n'aurait eu qu'une seule branche utile (l'UI
n'offrant que des transitions déjà valides pour le rôle) : la fonction aurait
retourné son `fallback` dans tous les cas. Le message est utilisé directement au
point d'appel. `statusChangeSchemas.ts` ne contient donc que `statusNoteSchema`.

### 4. `plan(50)` → `plan(62)`

Le plan annonçait ~50 assertions. 62 au final : un test supplémentaire pour la
branche `auth.uid() is null` de la RPC (le blocage anonyme se fait en réalité au
niveau du `grant`, pas dans le corps de la fonction), 4 pour
`find_profile_by_email`, et 7 pour la suppression — ajoutés _après_ coup, suite
au bug ci-dessous.

### 5. `/admin` accessible aussi aux `authority`

La spec §6.6 dit « rôles ≥ moderator ». Il n'existe pas de hiérarchie stricte
entre `moderator` et `authority` (§2 les traite en parallèle), et une
`authority` a besoin de la table pour son propre travail de traitement. La route
autorise donc `['moderator', 'authority', 'admin']`. À confirmer si la lecture
littérale de la spec doit primer.

## Trois bugs livrés puis corrigés (trouvés par le test humain, pas par la CI)

| Bug                                             | Cause                                                                                                                               | Correctif                                          |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Recherche de compte par email toujours en échec | La RPC renvoie une ligne réduite sans `created_at`, mais le client la parsait avec le schéma `Profile` complet qui l'exige          | Schéma dédié `FoundProfile`                        |
| `/admin` en chargement infini pour un anonyme   | `isResolved` attendait `useProfile().isPending`, or **une query TanStack désactivée reste `pending` indéfiniment**                  | Un déconnecté est résolu dès que l'auth répond     |
| Suppression sans effet                          | (a) le trigger Storage ci-dessus ; (b) `handleDelete` naviguait _avant_ la mutation, démontant le composant et la mutation avec lui | Trigger retiré ; navigation uniquement `onSuccess` |

Les trois ont passé `lint`, `typecheck`, `test` et `db:test` sans broncher. Voir
`docs/handoff.md` pour ce que ça implique pour les étapes suivantes.

## Ce qui reste ouvert

### Reporté volontairement (arbitré avec l'humain)

- **`get_klash_author_contact(klash_id)`** (spec §2, §11.5) → **étape 9**. La
  spec l'exige « journalisée », ce qui implique une table d'audit ; l'étape 9
  contient déjà la revue RLS et la politique de confidentialité, où la mention
  légale de cette consultation doit figurer. Les livrer ensemble évite une
  fenêtre où le staff lit des emails sans trace.
- **Actions par lot** et **statistiques** dans `/admin` (spec §6.6) → étape
  ultérieure. `/admin` restreint et solide plutôt que complet et fragile.

### Gaps identifiés, non planifiés

- **Rien ne renseigne `duplicate_of` dans l'app.** Les garde-fous existent en
  base et `/k/:id` affiche « voir le signalement original » _si_ la colonne est
  remplie — mais aucune UI ne permet de désigner l'original. Un modérateur qui
  passe un klash en `duplicate` le laisse donc sans cible. Le seed est le seul
  à peupler cette colonne. **C'est le manque fonctionnel le plus visible de
  l'étape.**
- **Photos orphelines : dette rouverte, pas fermée.** Le nettoyage ne couvre que
  les suppressions passant par l'app. Une suppression en SQL direct laisse ses
  objets. Fermer ça proprement demande un job planifié ou une Edge Function
  utilisant l'API Storage → étape 9.
- **Masquer un commentaire le marque « Modifié »**, parce que `set_updated_at()`
  se déclenche sur tout UPDATE. Cosmétique, comportement de trigger préexistant.
- **Aucun test de composant.** Le socle rôles (`useRole`, `RequireRole`) n'est
  couvert que par la vérification manuelle — et c'est précisément là qu'est né
  le bug du spinner infini.

## Vérification

`npm run lint`, `format:check`, `typecheck`, `test` (109), `db:test` (102),
`build` — tous verts au moment du merge.

Vérification en navigateur (Playwright ad hoc, non versionné) : connexion OTP
réelle pour les trois rôles, changement de statut avec note, masquage de
commentaire, `/admin` complet, suppression d'un klash avec photo réelle
(ligne, `klash_photos` et objet Storage vérifiés disparus), et un passage sur
profil tactile réel (`devices['iPhone 13']`).
