# Migration React 18 → 19

> Migration exécutée le 2026-10-02, après l'étape 9 du plan de construction
> (spec §9), comme recommandé par la version précédente de ce document
> (relevé du 2026-09-11, conservé ci-dessous en historique).

## Résumé

`react`, `react-dom` et `react-leaflet` passent en 19.x / 5.x. `docs/spec.md`
§8, `README.md` et `CLAUDE.md` ont été amendés en premier (le spec fait
autorité, cf. CLAUDE.md).

## Surface react-leaflet réelle au moment de la migration

La note du 2026-09-11 listait 5 fichiers ; les refontes carte/création
intervenues depuis (contrôles carte, création en 4 étapes) en ont ajouté
d'autres. Surface complète vérifiée (13 fichiers) :

| Fichier                                      | Symboles importés        |
| -------------------------------------------- | ------------------------ |
| `src/features/map/MapPage.tsx`               | `MapContainer`           |
| `src/features/map/MapTiles.tsx`              | `TileLayer`              |
| `src/features/map/BboxWatcher.tsx`           | `useMap`, `useMapEvents` |
| `src/features/map/ClusteredKlashMarkers.tsx` | `useMap`                 |
| `src/features/map/PendingPinMarker.tsx`      | `useMap`                 |
| `src/features/map/MapClickToReport.tsx`      | `useMapEvents`           |
| `src/features/map/ServiceAreaBounds.tsx`     | `useMap`                 |
| `src/features/map/UserPositionMarker.tsx`    | `Circle`, `CircleMarker` |
| `src/features/map/MapLayerZoom.tsx`          | `useMap`                 |
| `src/features/newKlash/NewKlashPage.tsx`     | `MapContainer`           |
| `src/features/newKlash/DraggablePin.tsx`     | `useMap`                 |
| `src/features/newKlash/MapRecenter.tsx`      | `useMap`                 |
| `src/features/klash/KlashMiniMap.tsx`        | `MapContainer`, `Marker` |

L'API publique de ces symboles est identique entre react-leaflet 4.2.1 et
5.0.0 (vérifié dans les `.d.ts` du paquet 5.0.0). `MapContainer` reste un
`forwardRef` exposant l'instance Leaflet (`React.ForwardRefExoticComponent<MapContainerProps & React.RefAttributes<LeafletMap>>`),
donc les `ref={setMap}` de `MapPage.tsx` et `NewKlashPage.tsx` continuent de
fonctionner sans changement.

`ClusteredKlashMarkers.tsx` contourne déjà react-leaflet pour le clustering
(le `MarkerClusterGroup` est piloté à la main via `useMap()`, faute de
binding v4) — cette partie, la plus délicate, ne dépend donc que de `useMap`.

`leaflet` (1.9.4) et `leaflet.markercluster` (1.5.3) n'ont pas bougé : ils ne
dépendent pas de React.

## Ajustements de code requis

Contrairement à l'évaluation initiale (« aucun changement de code »), deux
points ont dû être corrigés pour compiler avec `@types/react@19` :

- `src/features/map/BboxWatcher.tsx` : `useRef<ReturnType<typeof setTimeout>>()`
  (sans argument) est une erreur de type en React 19 — `useRef` exige
  désormais un argument explicite. Corrigé en
  `useRef<ReturnType<typeof setTimeout>>(undefined)`.
- `MutableRefObject` (type toujours exporté mais déprécié en 19, au profit de
  `RefObject`) était utilisé dans `src/features/auth/{EmailStep,CodeStep,TurnstileSlot}.tsx`
  pour typer la ref de conteneur Turnstile — remplacé par `RefObject`.

Scan du reste de `src/` (2 758 lignes au 2026-09-11) : toujours aucun usage
des API supprimées par React 19 — pas de `propTypes`, pas de `defaultProps`
sur composant fonction, pas de refs string, pas de `forwardRef` legacy côté
app (seul react-leaflet l'utilise en interne), pas de `createFactory`, pas de
`ReactDOM.render`/`hydrate`. `src/main.tsx` utilise déjà `createRoot`.
Aucun test de composant (`@testing-library/react` n'est pas installé ; les
tests Vitest portent sur des utilitaires purs) — rien à réécrire côté tests
unitaires ; le filet de sécurité pour le rendu carte est le harnais
Playwright (`e2e/`, voir `docs/handoff.md`).

## Dépendances de l'écosystème

| Paquet                          | Peer dependency                        | Verdict                       |
| ------------------------------- | -------------------------------------- | ----------------------------- |
| `@tanstack/react-query` 5.x     | `^18 \|\| ^19`                         | OK sans changement            |
| `react-router-dom` 7.x          | `>=18`                                 | OK sans changement            |
| `@sentry/react` 10.x            | `^16.14 \|\| 17.x \|\| 18.x \|\| 19.x` | OK sans changement            |
| `@vitejs/plugin-react` 4.7.0    | `vite ^4 \|\| ^5 \|\| ^6 \|\| ^7`      | OK — **ne pas** monter en 6.x |
| `eslint-plugin-react-hooks` 5.2 | peer sur `eslint` uniquement           | OK — **ne pas** monter en 7.x |

## Pièges évités

- **`@vitejs/plugin-react@latest` (6.1.1) exige `vite ^8.0.0`** ; le projet
  est en Vite 6. Resté en 4.7.0 (couvre Vite 6). Cette migration n'a pas
  embarqué de montée de Vite.
- **`eslint-plugin-react-hooks@latest` (7.x)** ajoute les règles liées à React
  Compiler — hors périmètre de cette migration. Resté en 5.2.0.

## Procédure appliquée

```bash
npm i react@^19.3.0 react-dom@^19.3.0 react-leaflet@^5.0.0
npm i -D @types/react@^19.3.0 @types/react-dom@^19.3.0
npm run lint && npm run typecheck && npm test && npm run build
```

## Vérification sur téléphone réel

Checklist suivie avant merge (carte et création sont la surface à risque —
double montage plus strict en `StrictMode` React 19, typiquement une carte
Leaflet initialisée deux fois) :

- [ ] Carte `/` : rendu, clustering, survol/sélection marqueur
- [ ] Chargement par bbox au déplacement de la carte (`BboxWatcher`,
      `useMapEvents`)
- [ ] Géolocalisation / bouton localiser (`MapZoomLocateControls`)
- [ ] `/new` : pin déplaçable, recentrage, clic long pour replacer le pin
- [ ] Création complète d'un klash (pin → photos → envoi)
- [ ] Mini-carte en page détail (`KlashMiniMap`)
- [ ] Navigation arrière entre pages carte sans carte grise/blanche ni erreur
      console « Map container is already initialized »

## Historique — état des lieux du 2026-09-11

<details>
<summary>Version précédente de ce document, avant exécution</summary>

> Hors périmètre du plan de construction (spec §9) à l'époque. Consignait
> l'état des lieux pour que la décision, une fois prise, n'ait pas à être
> réinstruite.

Aucun arbitrage n'avait été posé : le spec avait été écrit avec « React 18 »
et tout avait suivi — pas une contrainte technique, un défaut hérité.

Le seul vrai blocage identifié était `react-leaflet` v4.2.1, qui déclare une
peer dependency stricte `react: ^18.0.0` — d'où la nécessité de
`react-leaflet` v5.0.0 (peer `react: ^19.0.0`, `@react-leaflet/core` 3.x).

Recommandation de calendrier : pas pendant l'étape 4 (le projet était alors au
step 4/9) ; les étapes 5 à 8 (photos, filtres, PWA) n'ajoutant pas de surface
react-leaflet, faire la migration après l'étape 8, en un seul lot, coûtait
moins cher que de l'insérer dans une étape en cours.

Versions relevées le 2026-09-11 : `react@19.3.0`, `@types/react@19.3.0`,
`react-leaflet@5.0.0`, `@vitejs/plugin-react@6.1.1` — toutes en `latest`.

</details>
