# Plan — 6 améliorations (photos, champs requis, rôle, /admin, solutions)

## Contexte

Deux ajustements demandés sur l'app, indépendants les uns des autres mais qui touchent le formulaire de création (`src/features/newKlash/`). Deux d'entre eux descendent jusqu'à la base (limite photos, nouvelle colonne « solutions »), donc deux migrations
et une régénération des types. Décisions validées : le spec `docs/spec.md` est mis à
jour avec le code (il reste la source de vérité) ; la proposition
de solution est visible dans le formulaire, sur `/k/:id` et signalée dans `/admin`.

---

## 1. Passer la limite de photos de 3 à 12

Cinq endroits figent le « 3 ». Tous doivent bouger ensemble, sinon les photos 4 à 12
seront acceptées par l'UI puis rejetées par le trigger.

- **Nouvelle migration** `supabase/migrations/<ts>_raise_photo_limit.sql` (timestamp
  strictement supérieur à `20260916001117`) : `create or replace function
public.enforce_photo_limit()` identique à
  `supabase/migrations/20260913140000_klash_photos_storage.sql:6-28`, avec
  `if photo_count >= 12` et le message `'photo limit exceeded: max 12 photos per klash'`.
  Le trigger existant n'a pas besoin d'être recréé (`create or replace function` suffit).
- **Constante partagée** : créer `src/config/photos.ts` sur le modèle de
  `src/config/serviceArea.ts`, avec `export const MAX_PHOTOS_PER_KLASH = 12`.
  `src/features/newKlash/KlashFormStep.tsx:19` importe la constante au lieu de
  redéclarer `MAX_PHOTOS` (3 usages : lignes 19, 90, 251).
- **i18n** : `src/i18n/fr.ts:233` — remplacer la chaîne figée par une fonction
  `photoLimitReached: (max: number) => \`Vous avez atteint la limite de ${max} photos.\``,
appelée avec `MAX_PHOTOS_PER_KLASH`.
- **Test RLS** : `supabase/tests/klash_photos_rls_test.sql:99-119` — insérer 12 lignes
  (`p1.jpg`…`p12.jpg`) dans le `lives_ok`, faire échouer la 13e dans le `throws_ok`,
  et aligner le message attendu. Le nombre d'assertions ne change pas, donc le
  `select plan(N)` en tête de fichier reste inchangé.
- **Spec** : `docs/spec.md:150` (« `enforce_photo_limit()` : max 12 photos par klash »)
  et `docs/spec.md:263` (critère de l'étape 5 : reformuler sur 12 photos).

**Conséquence à traiter dans la foulée (recommandé)** :
`src/features/newKlash/KlashFormStep.tsx:92-107` compresse toutes les photos
sélectionnées en parallèle (`Promise.all`) et
`src/features/newKlash/NewKlashPage.tsx:150-153` les envoie toutes en parallèle
(`Promise.allSettled`). À 3 photos c'est ce qui tenait le budget de 10 s ; à 12, sur un
téléphone en 4G, c'est 12 workers de compression et 12 uploads simultanés. Ajouter un
petit utilitaire `mapWithConcurrency(items, limit, fn)` dans `src/utils/` (testé avec
Vitest, comme `src/utils/distance.ts`) et l'utiliser aux deux endroits avec une limite
de 4. Conserver la sémantique actuelle : compression = échec global attrapé par le
`try/catch`, upload = `allSettled` avec comptage des échecs.

La galerie `src/features/klash/KlashPhotoGallery.tsx` est une grille `grid-cols-3` :
12 photos donnent 4 rangées, rien à changer sinon ajouter `loading="lazy"` sur les
vignettes.

---

## 2. Section « Propositions de solutions (facultative) »

C'est le point le plus lourd : il ajoute une colonne à `klashes`, donc à la vue
`klashes_public`, et **trois fonctions retournent `setof public.klashes_public`** —
elles doivent être supprimées puis recréées dans la même migration.

### 2a. Migration `supabase/migrations/<ts>_klash_proposed_solution.sql`

1. `alter table public.klashes add column proposed_solution text check (char_length(proposed_solution) <= 2000);`
   (même contrainte que `description`, `supabase/migrations/20260907225955_initial_schema.sql`).
2. `drop function public.create_klash(double precision, double precision, public.klash_category, public.klash_urgency, text, text);`
   `drop function public.klashes_in_bbox(double precision, double precision, double precision, double precision);`
   `drop function public.klashes_nearby(double precision, double precision, double precision);`
3. `drop view public.klashes_public;` puis recréation à l'identique de
   `supabase/migrations/20260908184555_...:8-31` avec `k.proposed_solution` inséré après
   `k.description`, en conservant `with (security_invoker = on)` et le
   `grant select ... to anon, authenticated`.
4. Recréer les trois fonctions verbatim depuis leurs migrations d'origine
   (`20260908184555_...:36-70` pour `klashes_in_bbox`, `20260912064457_...:105-131` pour
   `klashes_nearby`, `20260912064457_...:141-174` pour `create_klash`), avec leurs
   `grant execute`. Seule `create_klash` change : nouveau paramètre
   `proposed_solution text default null` **en dernière position** (le `default` garde
   l'appel rétrocompatible côté PostgREST) et colonne ajoutée à l'`insert`.
5. `create or replace function public.guard_klash_authority_columns()`
   (`supabase/migrations/20260915075244_klash_lifecycle.sql:267-290`) en ajoutant
   `or new.proposed_solution is distinct from old.proposed_solution` à la liste des
   colonnes interdites : une `authority` ne peut modifier que le statut. Reprendre le
   corps tel quel, y compris le `coalesce(public.current_user_role(), 'user')` dont le
   commentaire explique pourquoi il ne doit pas être simplifié.

Pas de changement de RLS : `klashes_update_author_new` autorise déjà l'auteur à éditer
sa ligne tant qu'elle est en `new`, colonne comprise.

Puis : `supabase db reset`, `npm run gen:types` (régénère `src/types/database.ts`).

### 2b. Types et API front

- `src/types/klash.ts` : `proposedSolution: z.string().nullable()` dans `klashSchema`,
  `proposed_solution` dans `klashRowSchema`, mapping dans `klashFromRow`.
- `src/api/klashes.ts` : `proposedSolution: string | null` dans `CreateKlashInput`, et
  `proposed_solution: input.proposedSolution as string` dans l'appel `supabase.rpc('create_klash', …)`
  — même cast et même commentaire que pour `description` (les types générés ne marquent
  pas un paramètre `text` comme nullable).
- `src/features/newKlash/newKlashSchemas.ts` : `klashProposedSolutionSchema =
z.string().trim().max(2000)`, champ `proposedSolution` dans `newKlashFormSchema`
  (nullable), dans `KlashFormDraft` et dans `emptyKlashFormDraft` (`''`). Le
  `draftToFormInput` du point 2 gère le `trim() === '' ? null`.

### 2c. UI

- **Formulaire** `src/features/newKlash/KlashFormStep.tsx` : dupliquer le bloc
  `<div className="flex flex-col gap-1">` de la description (lignes 208-221) juste en
  dessous, avec `id="new-klash-proposed-solution"`, `rows={3}`. Ajouter la branche de
  message dans `handleSubmit` (ligne 136-140) : si `issue?.path[0] === 'proposedSolution'`,
  afficher `fr.newKlash.form.invalidProposedSolution`.
- **Passage au submit** : `src/features/newKlash/NewKlashPage.tsx:135-142` — ajouter
  `proposedSolution: action.form.proposedSolution` à l'appel `createKlash`.
- **Détail** `src/features/klash/KlashDetailPage.tsx` : après le paragraphe description
  (lignes 110-112), un bloc conditionnel `{klash.proposedSolution && (…)}` avec un
  intitulé `fr.detail.proposedSolutionLabel` et le même rendu
  `text-sm whitespace-pre-wrap text-neutral-700`.
- **/admin** `src/features/admin/AdminKlashTable.tsx` : dans la cellule Titre (lignes
  157-164), après le `<Link>`, `{klash.proposedSolution && <Badge label={fr.admin.table.hasProposedSolution} tone="indigo" />}`.
- **i18n** `src/i18n/fr.ts` : `fr.newKlash.form.proposedSolutionLabel: 'Propositions de
solutions (facultative)'`, `proposedSolutionPlaceholder`, `invalidProposedSolution:
'Les propositions de solutions ne peuvent pas dépasser 2000 caractères.'` ;
  `fr.detail.proposedSolutionLabel: 'Propositions de solutions'` ;
  `fr.admin.table.hasProposedSolution: 'Solution proposée'`.

### 2d. Spec

`docs/spec.md` : ajouter `proposed_solution` au `create table klashes` du §4 et
mentionner le champ dans l'étape 3 du §6.2 et dans le §6.3.

---

## Vérification

Base (points 1 et 6) :

```
supabase db reset          # rejoue toutes les migrations
npm run gen:types          # régénère src/types/database.ts
npx supabase test db       # tests pgTAP, dont klash_photos_rls_test.sql
```

Front :

```
npm run lint
npm run typecheck
npm test                   # + nouveaux tests adminFilterParams et mapWithConcurrency
npm run format:check
```

Parcours manuel (`npm run dev`) :

1. `/new` — le bouton « Continuer » reste grisé tant que le titre fait moins de
   5 caractères, les astérisques sont visibles sur Catégorie/Urgence/Titre ; ajouter
   12 photos, la 13e n'est plus proposée ; remplir « Propositions de solutions » et
   envoyer.
2. `/k/:id` du klash créé — les 12 photos sont dans la galerie, la proposition de
   solution s'affiche sous la description.
3. `/admin` — les colonnes « Confirmations » puis « Commentaires » sont présentes, la
   pastille « Solution proposée » apparaît sur la ligne du klash créé.
4. `/admin` — changer onglet, statut, catégorie, période, recherche, page : l'URL suit ;
   recharger la page (F5) restaure exactement la même vue ; coller le lien dans un autre
   onglet donne le même résultat ; le bouton retour du navigateur ne rejoue pas chaque
   frappe ; une URL trafiquée (`?status=bogus&page=999`) ne casse rien.
5. `/me` — le rôle s'affiche ; le changer via `/admin` → onglet Rôles et vérifier que
   `/me` reflète le nouveau rôle après rechargement.
6. Vérifier avec un compte `authority` qu'un changement de statut passe toujours
   (le garde-fou `guard_klash_authority_columns` ne doit pas bloquer une transition
   légitime).

Puis commits conventionnels séparés par point (`feat:`, `db:`), push sur
`claude/compassionate-goodall-bch47g`, et l'URL de preview dans le message final.
