# Plan — brouillon de déclaration auto-sauvegardé et repris

## Contexte

Retour d'usage récurrent : un utilisateur commence à remplir la feuille « Décrire le
problème », puis quitte l'écran (retour navigateur, fausse manip, appel entrant,
verrouillage du téléphone) et perd sa déclaration sans avertissement — jusqu'à 12
photos déjà prises, compressées et lues en EXIF y compris, c'est-à-dire la partie la
plus coûteuse du travail de l'utilisateur.

Tout l'état du signalement en cours vit dans `useState` de `NewKlashPage`
(`src/features/newKlash/NewKlashPage.tsx`) : `position`, `step`, `formDraft` (6 champs)
et `photos` (des `File` compressés + une URL `blob:` par photo). Chaque « Annuler » et
chaque retour navigateur démonte la page et jette tout.

La spec ne mentionne un brouillon qu'« en mémoire pendant l'auth » (§6.2 étape 4, déjà
couvert par le login inline de `SubmitStep`), et exclut explicitement le hors-ligne de
la v1 (§7, §10). C'est donc une amélioration post-v1 (spec §9 étapes 1-9 terminées),
dans la lignée de `docs/plans/ameliorations-1.md` / `ameliorations-2.md`, pas une
nouvelle étape du plan de construction.

Décisions validées :

1. **Un seul brouillon, local à l'appareil, pour tous** (connecté ou non) — pas de
   table Postgres, pas de RLS, pas de « mes brouillons » dans `/me` : un brouillon
   contient des données non validées et des photos non envoyées, et `/me` liste des
   signalements _publiés_. Le brouillon ne suit pas d'un appareil à l'autre.
2. **Les photos sont sauvegardées**, en IndexedDB (localStorage ne peut pas porter des
   `Blob`), via un petit wrapper maison — aucune nouvelle dépendance.
3. **Reprise par deux chemins** : une puce « Déclaration en cours » sur la carte, et une
   restauration automatique à l'ouverture de `/new` sans position explicite.
4. **« Annuler » demande** : « Garder le brouillon » ou « Supprimer la déclaration ».

Aucune migration, aucun changement de schéma, aucune variable d'environnement, aucune
nouvelle dépendance : entièrement front.

---

## 1. Stockage — deux modules purs

### `src/features/newKlash/draftStorage.ts`

Métadonnées du brouillon en **localStorage**, clé `klash-draft`, sur le modèle de
`src/features/map/useMapLayer.ts` : fonctions pures exportées, chaque accès dans un
`try/catch` (Safari navigation privée lève), repli silencieux sur `null`.

- `storedDraftSchema` (zod) valide à la lecture, avec des sous-schémas **laxistes**
  (pas de `min()` sur le titre) : un brouillon est par nature incomplet.
- `readStoredDraft(now?)` → `StoredKlashDraft | null`. Purge et renvoie `null` si le
  JSON est corrompu, si `version` est inconnue, ou si `savedAt` dépasse 7 jours
  (`DRAFT_MAX_AGE_MS`). La lecture de `localStorage` et le `JSON.parse` sont dans des
  `try/catch` séparés : une erreur de lecture (rien à purger) est traitée différemment
  d'un JSON corrompu (qu'il faut purger, sinon il reste bloqué en boucle).
- `writeStoredDraft`, `clearStoredDraft`, `hasStoredDraft` (lecture bon marché pour la
  puce de la carte).
- `isDraftWorthKeeping(form, photoCount)` — `true` si au moins un champ texte/catégorie
  est renseigné ou s'il y a une photo ; un formulaire vide à l'urgence par défaut ne
  compte pas.

### `src/features/newKlash/draftPhotoStore.ts`

Les octets des photos en **IndexedDB** (base `klash-drafts`, store `photos`, clé =
l'`id` de la `PendingPhoto`, valeur = le `File` compressé). `saveDraftPhotos` remplace
le contenu du store en une transaction (les suppressions sont répercutées),
`loadDraftPhotos` renvoie une `Map<id, File>`, `clearDraftPhotos` vide le store. Toutes
les erreurs sont avalées : IndexedDB peut être refusé (navigation privée, quota), auquel
cas le texte du brouillon reste restaurable même si ses photos ne le sont pas. Pas de
test unitaire dédié (jsdom n'a pas d'IndexedDB) — la logique testable est dans
`draftStorage.ts`.

---

## 2. Sauvegarde automatique — `src/features/newKlash/useDraftAutosave.ts`

Hook appelé par `NewKlashPage` : débounce 500 ms sur les métadonnées, et les photos ne
sont réécrites en IndexedDB que si la liste d'ids change (taper du texte ne relance pas
une écriture de plusieurs Mo). N'écrit rien tant que `isDraftWorthKeeping` est faux
(purge alors le brouillon existant), et est désactivé une fois passé l'étape `form`
(soumission ou terminé).

---

## 3. Restauration dans `NewKlashPage`

Le type `Step` gagne `'resume'`. Le brouillon est lu une seule fois au montage
(`useState(() => readStoredDraft())`).

- **Sans `?lat=&lng=`** (puce de la carte, ou `/new` nu) et un brouillon existe →
  restauration immédiate : `position`, `step` et `formDraft` initialisent directement
  les `useState` correspondants.
- **Avec `?lat=&lng=`** (tap long, « Signaler où je suis ») et un brouillon existe →
  `DraftResumeStep` (nouveau composant) propose « Reprendre ma déclaration en cours »
  (applique le brouillon, y compris sa position) ou « Commencer une nouvelle
  déclaration ici » (purge le brouillon, repart de zéro à la position de l'URL).

Les photos sont rechargées depuis IndexedDB dans un effet asynchrone (au montage pour
la restauration immédiate, dans le handler pour la reprise explicite) : une **nouvelle**
`previewUrl` (`URL.createObjectURL`) est créée pour chaque photo restaurée — les
anciennes sont mortes avec l'onglet précédent. Le nettoyage existant de
`KlashFormStep` (révocation au démontage) reste inchangé.

Le brouillon est purgé après un envoi réussi (`runPendingAction`, avant `setStep('done')`,
pour la création **et** la confirmation d'un doublon) — pas à la déconnexion, puisqu'il
est lié à l'appareil et doit survivre au login inline de `SubmitStep`.

---

## 4. « Annuler » — `src/features/newKlash/CancelDraftSheet.tsx`

Les trois boutons « Annuler » passent par un `handleCancel()` commun dans
`NewKlashPage` : rien à garder → navigue directement, comme avant ; sinon → ouvre
`CancelDraftSheet` (modelé sur `PhotoSourceSheet` — `BottomSheet` ne peut pas
s'imbriquer), avec « Garder le brouillon » et « Supprimer la déclaration ».

---

## 5. Puce « Déclaration en cours » sur la carte

`src/features/map/DraftInProgressChip.tsx`, rendue par `MapPage` juste au-dessus du
bouton flottant « Signaler à ma position », sous les mêmes conditions de
non-encombrement. Visible si `hasStoredDraft()` au montage de la route. Un seul geste :
navigue vers `/new?draft=1` (le paramètre ne porte aucune logique, il garde
l'URL distincte dans l'historique).

---

## 6. Textes et tests

- `src/i18n/fr.ts` : nouveau groupe `fr.newKlash.draft` et une clé
  `fr.map.draftInProgress`.
- `src/utils/formatDate.ts` : nouvelle fonction `formatDateTime` (date + heure,
  `Europe/Paris`), pour afficher quand le brouillon a été enregistré.
- `src/features/newKlash/draftStorage.test.ts` : aller-retour write/read, JSON
  invalide, version inconnue, expiration à 7 jours, échecs de `localStorage`, table de
  vérité de `isDraftWorthKeeping`.
- `e2e/create-klash-draft.spec.ts` : remplir le formulaire + une photo, annuler en
  gardant le brouillon, vérifier la puce sur la carte, la suivre, vérifier la
  restauration (texte + photo), puis annuler en supprimant et vérifier la disparition
  de la puce.

---

## Vérification

1. `npm run lint`, `npm run typecheck`, `npm test`, `npm run format:check`.
2. `npm run dev`, à la main : remplir + photos → carte → puce → reprise (texte et
   vignettes intacts) ; arrivée par tap long avec un brouillon existant → écran
   « reprendre / nouvelle déclaration » ; Annuler → Garder (la puce reste) puis Annuler
   → Supprimer (elle disparaît) ; un envoi réussi ne laisse pas réapparaître la puce ;
   un `/new` quitté sans rien saisir ne crée aucune puce.
3. `npm run e2e` (nécessite `supabase start` + `db reset`).
4. Navigation privée Safari : le formulaire fonctionne sans brouillon ni erreur console.
5. Sur téléphone réel via la preview : quitter l'app en cours de saisie, la rouvrir,
   vérifier la reprise photos comprises.
