# Journal de passation

> Une entrée par étape terminée. Destiné à la session suivante : état réel,
> dettes connues, et pièges déjà payés une fois — pour qu'ils ne le soient pas
> deux fois.

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
