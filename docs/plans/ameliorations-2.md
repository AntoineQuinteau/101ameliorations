# Plan — 3 améliorations carte & photos (galerie, zoom max, satellite)

## Contexte

Trois retours d'usage sur mobile, indépendants les uns des autres, tous postérieurs à
la v1 (spec §9 étapes 1-9 terminées) — donc dans la lignée de
`docs/plans/ameliorations-1.md`, pas une nouvelle étape du plan de construction.

1. **Photos** — l'ajout de photo ouvre directement l'appareil photo, sans laisser le
   choix de la galerie. La spec prévoit pourtant « caméra **ou** fichier »
   (`docs/spec.md:206`) : c'est un écart au comportement spécifié, pas une évolution.
2. **Zoom** — au-delà de la limite, un effet élastique ramène le zoom en arrière. La
   cause est identifiée (voir §2), et la limite actuelle (18) est inférieure à ce que
   les tuiles MapTiler savent servir.
3. **Satellite** — aucune couche satellite n'existe ; une seule `TileLayer` est
   configurée (`src/features/map/MapTiles.tsx:28`).

Décisions validées : zoom max **20 en plan / 22 en satellite** (on s'arrête au zoom
natif de chaque couche pour ne jamais dégrader la qualité) ; bascule = **bouton
flottant en bas à droite**, au-dessus du `ZoomControl` ; couche choisie **mémorisée en
`localStorage`**.

Aucune migration, aucun changement de schéma, aucune nouvelle variable
d'environnement (`VITE_MAPTILER_KEY` couvre déjà le satellite) et aucune nouvelle
dépendance : les trois points sont purement front.

---

## 1. Choix caméra / galerie à l'ajout de photo

### Origine

`src/features/newKlash/KlashFormStep.tsx:307-322` — un unique `<input type="file">`
(le seul du dépôt) porte `capture="environment"` (ligne 314). Cet attribut force
l'appareil photo sur mobile et, sur la plupart des navigateurs, **annule aussi
`multiple`** : l'utilisateur ne peut ni ouvrir sa galerie, ni sélectionner plusieurs
photos d'un coup. Supprimer `capture` tout court rendrait la galerie accessible mais
ferait perdre l'accès direct à la caméra, qui reste le geste principal sur le terrain —
d'où une bascule explicite.

### Deux inputs plutôt qu'un attribut dynamique

Garder **deux** `<input type="file">` cachés (`className="sr-only"`), chacun avec son
`ref`, plutôt qu'un seul input dont on muterait `capture` avant le `.click()` :
muter un attribut puis déclencher le clic dans le même tick est précisément le genre de
comportement que Safari iOS applique de façon inconstante.

- Input « caméra » : `accept="image/*"` + `capture="environment"`, **sans** `multiple`
  (la caméra ne rend qu'une photo de toute façon).
- Input « galerie » : `accept="image/*"` + `multiple`, **sans** `capture`.

Les deux appellent le `handleFilesSelected` existant
(`KlashFormStep.tsx:103-130`) puis remettent `event.target.value = ''`. Cette fonction
est déjà agnostique de la source : elle tronque à `MAX_PHOTOS - photos.length`, lit le
GPS EXIF avant compression et applique `mapWithConcurrency(files, 4, …)`. **Rien à
changer dans la chaîne compression / EXIF / upload.**

Le bouton « Ajouter une photo » (ligne 308) devient un `<button type="button">` — plus
un `<label>` — qui ouvre le sélecteur ci-dessous.

### Nouveau composant `src/features/newKlash/PhotoSourceSheet.tsx`

Un sélecteur à deux choix + Annuler. Attention au conteneur : `src/components/BottomSheet.tsx:14`
est en `absolute … z-[1000]` et `NewKlashPage.tsx:201-252` enveloppe **déjà** tout le
flux de création dedans — en imbriquer un second ne fonctionnerait pas. Reprendre à la
place le motif de `PhotoLightbox` (`src/features/klash/KlashPhotoGallery.tsx:93-105`),
seul vrai overlay du dépôt : `fixed inset-0 z-[2000]`, fermeture au clic sur le fond et
à `Escape` via un `useEffect` sur `keydown` (`KlashPhotoGallery.tsx:80-88`).

Il n'existe aucun composant Modal/Dialog partagé, ni focus trap, nulle part dans `src`
— ne pas en introduire un ici : deux boutons dans un overlay suffisent. Prévoir
`role="dialog"` + `aria-modal="true"` + `aria-label`, et des cibles tactiles d'au moins
44 px. Style des boutons repris de `MobileFiltersSheet.tsx:166-172` (plein teal) et de
`KlashFormStep.tsx:308` (bordure neutre).

### Ne pas afficher le choix sur desktop

Sur un poste sans caméra, « Prendre une photo » n'a pas de sens : réutiliser
`useHasHover()` (`src/features/map/useHasHover.ts`) — déjà employé par `MapPage` pour
distinguer tactile et pointeur fin. Si `hasHover` est vrai, le bouton déclenche
directement l'input galerie sans ouvrir le sélecteur.

### i18n — `src/i18n/fr.ts`

Ajouter dans `fr.newKlash.form` (bloc photos, lignes 271-279) :

```ts
photoSourceTitle: 'Ajouter une photo',
photoSourceCamera: 'Prendre une photo',
photoSourceGallery: 'Choisir dans la galerie',
photoSourceCancel: 'Annuler',
```

### Permissions

Rien à coder : un `<input type="file">` délègue au sélecteur natif du système, qui gère
lui-même la permission stockage/photos. Il n'y a **pas** d'API de permission à demander
côté web, et aucun appel `navigator.permissions` à ajouter. Le seul cas à couvrir est
l'utilisateur qui annule le sélecteur : `handleFilesSelected` retourne déjà
immédiatement sur une `FileList` vide (`KlashFormStep.tsx:104`).

### Spec

`docs/spec.md:206` décrit déjà « caméra ou fichier » — le code s'y conforme enfin,
donc **aucune modification de la spec** sur ce point.

---

## 2. Zoom : supprimer le rebond et relever la limite

### Origine du rebond

Deux causes distinctes, à traiter ensemble :

1. **`bounceAtZoomLimits`** — jamais défini nulle part dans le dépôt, donc laissé à sa
   valeur Leaflet par défaut : `true`. C'est littéralement l'effet décrit : à la fin
   d'un pinch qui dépasse `maxZoom`, Leaflet ré-anime la carte vers la limite. Le
   docblock de `MapTiles.tsx:17` le mentionne déjà (« only clamps at gesture end ») mais
   l'option n'a jamais été posée. **C'est la cause du rebond.**
2. **`MAX_MAP_ZOOM = 18`** (`src/config/serviceArea.ts:26`) — plafond arbitraire, plus
   bas que ce que les tuiles savent rendre. C'est ce qui rend le rebond fréquent.

Le viewport n'est pas en cause : `index.html:6` ne fixe ni `user-scalable` ni
`maximum-scale`.

### Changements

- **`src/config/serviceArea.ts`** — remplacer `MAX_MAP_ZOOM = 18` par deux constantes,
  et documenter l'origine des valeurs (zoom natif de chaque tuileset) :

  ```ts
  export const MAX_MAP_ZOOM = 20 // streets-v2
  export const MAX_SATELLITE_MAP_ZOOM = 22 // satellite-v2
  ```

- **`src/features/map/MapPage.tsx:107`** et **`src/features/newKlash/NewKlashPage.tsx:190`**
  — passer `maxZoom` **et** ajouter `bounceAtZoomLimits={false}` sur les deux
  `MapContainer`. Sans ce second réglage, relever la limite ne fait que déplacer le
  rebond plus haut.

- **Zoom max dépendant de la couche** : `MapContainer` ne lit ses options qu'à la
  construction — c'est exactement ce qu'explique le docblock de
  `ServiceAreaBounds.tsx:5-11` à propos de `maxBounds`. Donner `MAX_SATELLITE_MAP_ZOOM`
  (la plus haute des deux) en prop statique, puis ajuster à chaud via `map.setMaxZoom()`
  dans le composant de couche décrit en §3, sur le même motif impératif
  `useMap()` + `useEffect` que `ServiceAreaBounds`. Si le zoom courant dépasse le
  nouveau maximum en repassant en plan, appeler `map.setZoom(MAX_MAP_ZOOM)` — `setMaxZoom`
  seul ne recadre pas une vue déjà trop zoomée.

- **`src/features/map/MapTiles.tsx:33-34`** — laisser `maxZoom={24}` tel quel (la marge
  qui empêche `GridLayer._setView` de blanchir les tuiles pendant un pinch, cf. le
  docblock lignes 14-24 : ce raisonnement reste valable et la marge doit rester
  au-dessus de 22), et porter `maxNativeZoom` de 18 à **20**, sinon les niveaux 19-20 du
  plan seraient des tuiles 18 ré-échelonnées, donc floues.

- **`src/features/map/ClusteredKlashMarkers.tsx:48`** — `disableClusteringAtZoom: 17`
  reste valide et inchangé (toujours sous le nouveau maximum).

**Déjà vérifié avec la clé du projet** : `streets-v2` renvoie des tuiles réelles (200,
taille plausible) sur Bayonne aux zooms 18 à 22 — le 20 retenu est donc du natif, servi
et net, et non du ré-échelonnage. Contrôle reproductible :

```
curl -o /dev/null -w '%{http_code} %{size_download}\n' \
  "https://api.maptiler.com/maps/streets-v2/20/520006/383339.png?key=$VITE_MAPTILER_KEY"
```

On s'arrête à 20 plutôt qu'à 22 parce qu'au-delà un style rasterisé n'apporte plus de
détail cartographique réel (les tuiles restent servies mais le dessin ne s'affine plus),
là où l'imagerie satellite, elle, gagne encore en finesse jusqu'à 22.

### Spec

`docs/spec.md:193` — la phrase fixe « zoom 10, zoom minimum 8 » sans mentionner de
maximum ; y ajouter le zoom maximum (20 en plan, 22 en satellite) et la couche
satellite, en même temps que le §3 ci-dessous.

---

## 3. Couche satellite + bascule Plan / Satellite

### Tuiles

**Vérifié avec la clé du projet** (`curl` sur des tuiles de Bayonne + TileJSON) — trois
points contre-intuitifs, à ne pas reprendre au jugé :

- L'imagerie satellite est un **tileset**, servi par `/tiles/`, et non un style servi
  par `/maps/` comme le plan. `https://api.maptiler.com/maps/satellite-v2/…` renvoie
  **404**. L'URL correcte est :

  ```
  https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${env.VITE_MAPTILER_KEY}
  ```

- Sa grille est en **256 px** (`tileSize` absent du TileJSON) : ne **pas** reprendre les
  `tileSize={512}` / `zoomOffset={-1}` de la couche plan, qui sont propres au style
  rasterisé. Laisser les valeurs Leaflet par défaut.
- Le suffixe retina `@2x` renvoie **404** sur ce tileset : ne pas mettre `detectRetina`
  sur cette `TileLayer` (avec `{r}` dans l'URL, toutes les tuiles disparaîtraient sur
  écran haute densité — donc sur la quasi-totalité des téléphones).

Le TileJSON (`/tiles/satellite-v2/tiles.json`) donne `maxzoom: 22`, confirmé par des
tuiles réelles jusqu'à 22 : `maxNativeZoom={22}` et `maxZoom={24}` (même marge anti-pinch
que le plan, cf. le docblock `MapTiles.tsx:14-24`).

Attribution : le TileJSON renvoie exactement la même chaîne que la couche plan
(`© MapTiler` + `© OpenStreetMap contributors`) — la constante `ATTRIBUTION` existante
(`MapTiles.tsx:6-8`) est donc réutilisable telle quelle, sans seconde chaîne à écrire.

### `src/features/map/MapTiles.tsx`

Étendre le composant existant plutôt que d'en créer un second :
`MapTiles({ layer }: { layer: MapLayer })`, `MapLayer = 'plan' | 'satellite'`, et
rendre la `TileLayer` correspondante avec une `key={layer}` — sans `key`, react-leaflet
réutilise l'instance et ne reconstruit pas la grille sur changement d'URL. Une seule
couche montée à la fois (pas de superposition : rien ne la justifie ici et cela
doublerait la consommation de tuiles).

Les deux `TileLayer` ne partagent **que** `attribution` et `maxZoom={24}` : la grille
(512 px + `zoomOffset={-1}` + `detectRetina` en plan, défauts 256 px sans retina en
satellite) et `maxNativeZoom` (20 / 22) diffèrent. Écrire deux blocs `<TileLayer>`
explicites dans une branche, plutôt qu'un seul bloc dont chaque prop serait un ternaire
— c'est justement là que se glisserait un `{r}` fatal sur le satellite.

`KlashMiniMap.tsx:26` et le `MapContainer` de `NewKlashPage.tsx:195` appellent aussi
`<MapTiles />` : leur passer `layer="plan"` (mini-carte de détail et carte de création
restent en plan, la bascule n'a de sens que sur la carte principale).

### État de la couche — `src/features/map/useMapLayer.ts`

Petit hook dédié, sur le modèle de `useHasHover.ts` : état `MapLayer`, initialisé
depuis `localStorage` (clé `'map-layer'`), écrit à chaque changement. Envelopper lecture
et écriture dans un `try/catch` — `localStorage` lève en navigation privée sur Safari —
avec `'plan'` comme valeur de repli, et valider la valeur lue (une clé trafiquée ne doit
pas monter une couche inexistante).

La couche n'est **pas** mise dans l'URL : ce n'est pas un filtre de résultats, et
`filterParams.ts` n'a pas à la connaître.

### Ajustement du zoom max — `src/features/map/MapLayerZoom.tsx`

Composant impératif rendant `null`, enfant de `MapContainer`, qui applique
`map.setMaxZoom()` selon la couche active et recadre le zoom courant si besoin (cf. §2).
Même motif que `ServiceAreaBounds` / `BboxWatcher`.

### Bouton de bascule — `src/features/map/MapLayerToggle.tsx`

Bouton flottant, **frère** de `MapContainer` et non un `L.Control` : c'est le motif
suivi par tous les overlays de `MapPage` (`absolute … z-[1000]`, lignes 136-143 pour le
bouton Filtres). `ZoomControl` occupe déjà `bottomright` (`MapPage.tsx:115`) ; placer le
bouton juste au-dessus (`absolute bottom-24 right-3 z-[1000]`, à ajuster pour ne pas
recouvrir la pile de zoom) avec le style arrondi blanc translucide du bouton Filtres.

Le libellé annonce la couche vers laquelle on bascule (« Satellite » quand on est en
plan, et inversement), avec `aria-pressed` pour l'état courant.

Ne l'afficher que quand les autres contrôles le sont, c'est-à-dire `hasHover || !isFiltersOpen`
(`MapPage.tsx:145`) : sur mobile, la feuille de filtres occupe 92 % de la hauteur et
tout le reste s'efface derrière elle.

### i18n — `src/i18n/fr.ts`

Dans `fr.map` (lignes 55-88) :

```ts
layer: {
  plan: 'Plan',
  satellite: 'Satellite',
  switchToPlan: 'Afficher le plan',
  switchToSatellite: 'Afficher la vue satellite',
},
```

### Cache PWA

`vite.config.ts:52-62` met en cache tout `api.maptiler.com` en `CacheFirst`, plafonné à
500 entrées — les tuiles satellite y entrent donc automatiquement, mais **partagent ce
plafond** avec le plan. Deux couches et des niveaux de zoom plus profonds feront tourner
le cache plus vite. Relever `maxEntries` à 1000 dans la même règle ; ne pas séparer en
deux caches (le `urlPattern` est par hôte, les distinguer imposerait de tester le
chemin pour un gain nul).

---

## Vérification

Pas de migration : ni `supabase db reset`, ni `npm run gen:types`, ni `npm run db:test`
ne sont nécessaires.

```
npm run lint
npm run typecheck
npm test
npm run format:check
npm run e2e          # aucun test ne touche au canvas ni aux photos, doit rester vert
```

Tests à ajouter : `src/features/map/useMapLayer.test.ts` (valeur par défaut, aller-retour
de persistance, valeur stockée invalide, `localStorage` qui lève) — c'est de la logique
pure, donc conforme au périmètre des tests unitaires du projet (spec §8 : utilitaires
seulement, pas de rendu de composant ; il n'y a ni `@testing-library` ni test de
`MapContainer` dans le dépôt).

Parcours manuel — **sur téléphone réel**, c'est la seule vérification qui vaut pour les
trois points (`npm run dev` puis preview) :

1. `/new` → étape formulaire → « Ajouter une photo » : le sélecteur propose les deux
   options. « Prendre une photo » ouvre la caméra ; « Choisir dans la galerie » ouvre la
   galerie et permet d'en sélectionner **plusieurs** d'un coup. Annuler ne laisse pas le
   bouton bloqué sur « Traitement de la photo… ».
2. Une photo prise avec GPS à plus de 25 m du pin déclenche toujours l'invite
   « utiliser la position de la photo ? » quelle que soit la source.
3. Sur desktop, le bouton ouvre directement le sélecteur de fichiers, sans l'étape
   caméra/galerie.
4. Carte `/` : pincer pour zoomer à fond — le zoom **s'arrête net**, sans revenir en
   arrière, et les tuiles ne blanchissent pas pendant le geste rapide. Idem à la souris
   (molette) et avec les boutons +/−.
5. Basculer en satellite : l'imagerie s'affiche, l'attribution change, on zoome deux
   crans plus loin qu'en plan et l'image reste nette (pas de flou de ré-échelonnage).
6. Revenir en plan depuis le zoom 22 : la vue se recadre au zoom 20 sans écran blanc.
7. Recharger la page : la dernière couche choisie est conservée. Tester aussi en
   navigation privée (aucune erreur console).
8. Les marqueurs, le clustering et les klashs restent visibles et cliquables sur les deux
   couches ; ouvrir les filtres sur mobile masque bien le bouton de bascule.
9. Mode avion après avoir chargé une zone : les tuiles récentes des deux couches
   s'affichent encore (cache PWA).

Commits conventionnels séparés par point (`fix:` pour le choix caméra/galerie, qui
aligne le code sur `docs/spec.md:206`, `fix:` pour le rebond de zoom, `feat:` pour la
couche satellite), sur une branche `feat/ameliorations-2`, et l'URL de preview dans le
message final.
