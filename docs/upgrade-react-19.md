# Note de migration — React 18 → 19

> Hors périmètre du plan de construction (spec §9). Ce document n'engage rien :
> il consigne l'état des lieux relevé le 2026-09-11 pour que la décision, quand
> elle sera prise, n'ait pas à être réinstruite.
>
> **Préalable si cette migration est retenue** : `docs/spec.md` §8 « Stack et
> outillage » (ligne 247) et `README.md` (ligne 8) disent « React 18 ». Le spec
> fait autorité (cf. CLAUDE.md), il doit donc être amendé *avant* de toucher au
> code.

## Pourquoi ce n'est pas déjà fait

Aucun arbitrage n'a jamais été posé : le spec a été écrit avec « React 18 » et
tout a suivi. Ce n'est pas une contrainte technique, c'est un défaut hérité.

## Ce qui est prêt

Le code applicatif ne bloque pas. Scan des 2 758 lignes de `src/` :

- `src/main.tsx` utilise déjà `createRoot` (pas `ReactDOM.render`).
- **Aucun** usage des API supprimées par React 19 : pas de `propTypes`, pas de
  `defaultProps` sur des composants fonction, pas de refs string, pas de
  `forwardRef` legacy, pas de `createFactory`, pas de `ReactDOM.render`/`hydrate`.
- Aucun test de composant (`@testing-library/react` n'est pas installé ; les 53
  tests portent sur des utilitaires purs). Rien à réécrire côté tests.

Les dépendances de l'écosystème acceptent déjà React 19 :

| Paquet | Peer dependency | Verdict |
| --- | --- | --- |
| `@tanstack/react-query` 5.x | `^18 \|\| ^19` | OK sans changement |
| `react-router-dom` 7.x | `>=18` | OK sans changement |
| `@vitejs/plugin-react` 4.7.0 | `vite ^4 \|\| ^5 \|\| ^6 \|\| ^7` | OK sans changement |

## Le seul vrai blocage : react-leaflet

`react-leaflet` v4.2.1 déclare une peer dependency **stricte** `react: ^18.0.0`.
Passer à React 19 impose donc `react-leaflet` v5.0.0 (peer `react: ^19.0.0`),
qui embarque `@react-leaflet/core` 3.x au lieu de 2.x.

C'est un changement de major sur la brique centrale de l'app. La surface reste
néanmoins petite — 5 fichiers, 5 symboles :

| Fichier | Symboles importés |
| --- | --- |
| `src/features/map/MapPage.tsx` | `MapContainer` |
| `src/features/map/MapTiles.tsx` | `TileLayer` |
| `src/features/map/BboxWatcher.tsx` | `useMap`, `useMapEvents` |
| `src/features/map/ClusteredKlashMarkers.tsx` | `useMap` |
| `src/features/klash/KlashMiniMap.tsx` | `MapContainer`, `Marker` |

Circonstance favorable : `ClusteredKlashMarkers.tsx` contourne déjà react-leaflet
pour le clustering (le `MarkerClusterGroup` est piloté à la main via `useMap()`,
faute de binding v4 — voir le commentaire en tête du fichier). Cette partie,
la plus délicate, ne dépend donc pas de l'API react-leaflet.

`leaflet` (1.9.4) et `leaflet.markercluster` (1.5.3) ne bougent pas : ils ne
dépendent pas de React.

## Piège à ne pas déclencher

**Ne pas faire `npm install @vitejs/plugin-react@latest`** au passage.
La 6.1.1 exige `vite ^8.0.0` ; le projet est en Vite 6. Les 4.7.0 et 5.0.4
couvrent Vite 6. Cette migration ne doit pas embarquer une montée de Vite.

## Procédure indicative

```bash
npm i react@19 react-dom@19 react-leaflet@5
npm i -D @types/react@19 @types/react-dom@19
npm run lint && npm run typecheck && npm test
npm run build
```

Puis vérifier **sur téléphone réel** : rendu de la carte, clustering, popups,
géolocalisation, `useMapEvents` sur le déplacement de la carte (chargement bbox).
Le risque résiduel est un comportement d'unmount en `StrictMode`, plus strict en
React 19 — typiquement une carte Leaflet initialisée deux fois. C'est exactement
ce que `MapContainer` et le cluster manuel touchent.

## Recommandation de calendrier

Pas pendant l'étape 4. Le projet est au step 4 sur 9, et les étapes 5 à 8
(photos, filtres, PWA) n'aggravent pas cette migration : elles n'ajoutent pas de
surface react-leaflet. La faire **après l'étape 8**, en un seul lot avec
react-leaflet v5, coûte moins cher que de l'insérer dans une étape en cours et
de devoir re-tester la carte sur mobile deux fois.

Gain différé, et assumé comme tel : React 19 n'apporte rien dont l'étape 4 ait
besoin.

## Sources de l'état des lieux

Relevé le 2026-09-11 : `react@19.3.0` et `@types/react@19.3.0` publiés,
`react-leaflet@5.0.0` en `latest`, `@vitejs/plugin-react@6.1.1` en `latest`.
Vérifier ces versions avant d'appliquer la procédure.
