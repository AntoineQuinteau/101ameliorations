# Plan — proxy de tuiles MapTiler derrière le cache edge Cloudflare

> **Abandonné (23/09/2026).** Les CGU MapTiler Cloud (https://www.maptiler.com/terms/cloud/)
> interdisent de stocker ou redistribuer les tuiles depuis un cache côté serveur ; un
> proxy nécessite leur accord préalable et des frais supplémentaires. Ce plan n'est donc
> pas utilisable tel quel pour MapTiler. Le levier retenu à la place est un secours vers
> l'IGN (France + Espagne, licence ouverte, sans quota) — voir
> `src/features/map/tileProviders.ts` et `tileFailover.ts`, et §6.1/§10 de `docs/spec.md`.
> La mécanique décrite ci-dessous (route Worker, validation stricte du chemin, cache
> edge, piège Workbox) redevient utilisable telle quelle avec une source sous licence
> ouverte, si le besoin s'en fait sentir un jour (ex. réduire encore la charge sur les
> serveurs IGN).

## Contexte

Suite directe de la réduction de consommation MapTiler (voir le commit qui a introduit
`VITE_TILE_BASE_URL`, `src/features/map/tileUrls.ts` et `vite-plugins/tileProxy.ts`) :
ce commit a supprimé la consommation CI et dev (qui n'apportait rien) et élargi le
cache client. Ce document couvre le levier restant, celui qui change réellement
l'ordre de grandeur pour l'ouverture au public — **conception seulement, aucun code
n'a été écrit pour ce point**.

Aujourd'hui chaque navigateur va chercher ses tuiles lui-même auprès de MapTiler : 1000
personnes qui ouvrent la carte = ~10 000 requêtes MapTiler (voir la mesure d'ouverture
de carte dans le commit ci-dessus : 8-12 tuiles par ouverture). Derrière un cache edge
Cloudflare, la même tuile n'est demandée à MapTiler qu'une fois par point de présence,
puis servie localement à tout le monde.

Le « working set » est petit, parce que l'app est géographiquement bornée. Nombre de
tuiles couvrant la bbox de la zone de service (`SERVICE_AREA_BBOX`,
`src/config/serviceArea.ts` : 42.7/-2.3 → 45.0/0.5) :

| Zoom | Tuiles à ce niveau | Cumul depuis z8 |
| ---- | ------------------ | --------------- |
| 8-10 | 124                | 124             |
| 11   | 323                | 447             |
| 12   | 1 221              | 1 668           |
| 13   | 4 810              | 6 478           |
| 14   | 18 688             | 25 166          |
| 15   | 74 496             | 99 662          |

Autrement dit : toute la zone de service jusqu'au zoom 13 tient en 6 478 tuiles, et la
vue d'ouverture (z10) en 124. Un cache edge chaud rend l'ouverture de l'app
essentiellement gratuite, quel que soit le nombre d'utilisateurs. Seul le zoom profond
(z16+) reste une longue traîne peu mutualisée entre utilisateurs.

Prérequis déjà en place : le domaine personnalisé est actif sur Cloudflare (le cache
edge est donc réellement exploitable — sur `*.workers.dev` seul, Cloudflare désactive
la mise en cache, ce qui aurait rendu ce plan inopérant).

## Pourquoi ce n'est pas encore implémenté

Ni déploiement ni test possibles depuis une session sans accès aux identifiants
Cloudflare ni à une clé MapTiler de production, et une erreur sur ce chemin retire la
carte à tout le monde d'un coup — c'est le chemin le plus fréquenté de toute
l'application. À faire en session dédiée, avec vérification sur une preview avant
bascule de la production.

## 1. Route

`wrangler.jsonc` → `assets.run_worker_first` est une liste blanche (`["/k/*"]`
aujourd'hui). Sans y ajouter `"/tiles/*"`, le Worker ne serait jamais invoqué pour ces
requêtes et elles tomberaient sur les assets statiques (404).

## 2. Branche dans le Worker

Dans `workers/app/src/index.ts`, une nouvelle branche avant le
`if (!match) return env.ASSETS.fetch(request)` actuel (ligne ~91). Le handler doit
gagner un 3ᵉ paramètre `ctx` (absent aujourd'hui — ni `ctx` ni `waitUntil` ne sont
utilisés ailleurs dans ce fichier) pour pouvoir faire
`ctx.waitUntil(cache.put(request, response.clone()))` sans retarder la réponse.

## 3. Validation stricte du chemin

Réutiliser exactement la regex de `vite-plugins/tileProxy.ts`
(`TILE_PATH_PATTERN`) : seuls `maps/streets-v2/{z}/{x}/{y}{@2x}.png` et
`tiles/satellite-v2/{z}/{x}/{y}.jpg` sont acceptés. Sans cette validation, le Worker
serait un proxy ouvert vers l'ensemble de l'API MapTiler : n'importe qui pourrait
brûler le quota sur n'importe quel endpoint, avec une clé qui ne serait même plus
soumise à restriction de domaine (elle vivrait côté serveur — voir point 5).

## 4. Cache

`caches.default`, avec pour clé l'URL entrante **sans query string** (la clé API est
ajoutée côté Worker, jamais transmise par le client — même principe que
`vite-plugins/tileProxy.ts`) : sans ça, chaque utilisateur constituerait une entrée de
cache différente et le partage entre utilisateurs n'aurait plus lieu.
`Cache-Control: public, max-age=86400, s-maxage=2592000` sur la réponse mise en cache
(un jour côté navigateur, un mois côté edge — cohérent avec le cache Workbox élargi à
30 jours). Ne mettre en cache que les réponses 200.

## 5. Clé

`MAPTILER_KEY` devient le premier vrai secret Worker du dépôt
(`wrangler secret put`, pas un `--var` de CI comme `SUPABASE_URL` /
`SUPABASE_PUBLISHABLE_KEY` aujourd'hui — ceux-là sont délibérément publics, celui-ci ne
doit pas l'être puisqu'il ne serait plus restreint par domaine une fois appelé
serveur à serveur). Le README affirme aujourd'hui qu'il n'y a que deux vrais secrets
(les jetons Cloudflare) : phrase à corriger dans le même changement.

## 6. Client

En production, `VITE_TILE_BASE_URL` passe de « non défini » à un chemin same-origin
(ex. `/tiles`) dans le build CI (`.github/workflows/ci.yml`, jobs `preview` et
`deploy-production`). `buildTileUrlTemplate()` (`src/features/map/tileUrls.ts`)
n'ajoute déjà `?key=` que si une clé est fournie — il suffit de ne plus fournir
`VITE_MAPTILER_KEY` au build de prod une fois ce chemin actif, exactement comme le
proxy de dev aujourd'hui.

## 7. Piège Workbox

`vite.config.ts`, règle `maptiler-tiles` :
`urlPattern: ({ url }) => url.hostname === 'api.maptiler.com'`. Une fois les tuiles
servies en same-origin, cette règle **ne matchera plus** : le cache hors-ligne des
tuiles (exigé par spec §7) mourrait en silence, sans erreur visible. Elle doit devenir
sensible au chemin same-origin (`url.pathname.startsWith('/tiles/')` ou équivalent) en
même temps que le changement du point 6, dans le même commit — jamais l'un sans
l'autre.

## 8. Previews

Les URLs de preview (`.github/workflows/ci.yml`, job `preview`) restent sur
`pr-<N>-101ameliorations.antoine-quinteau.workers.dev`, où le cache edge Cloudflare
est inopérant (voir Contexte). Les previews continueront donc d'appeler MapTiler en
direct — acceptable (volume de tests bien plus faible que la prod), mais à documenter
pour ne pas être découvert en surprise plus tard.

## 9. Tests

Le Worker n'a aujourd'hui aucun test, et `test.include` de `vite.config.ts`
(`src/**/*.{test,spec}.{ts,tsx}`) ne couvre que `src/`. Introduire ce proxy sans
harnais reviendrait à risquer une carte blanche en production sans filet. Ajouter
`@cloudflare/vitest-pool-workers` et un projet Vitest séparé pour `workers/app/`
avant d'écrire la branche du point 2, pas après.

## 10. Abus

Le proxy est accessible à quiconque connaît l'URL de l'app — comme la clé aujourd'hui,
sauf qu'une rotation de clé ne suffira plus à couper un abus (le Worker, lui, ne
change pas). Allowlist `Origin`/`Referer` dans le Worker, limitée aux domaines de
l'app et aux previews.

## Risques

| Risque                                                                      | Mitigation                                                                                                         |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Erreur dans la branche du Worker → carte blanche en prod pour tout le monde | Tests Worker (point 9) avant écriture ; vérification sur une preview avant bascule de `VITE_TILE_BASE_URL` en prod |
| Règle Workbox non mise à jour → cache hors-ligne mort en silence            | Points 6 et 7 dans le même commit, jamais l'un sans l'autre                                                        |
| Proxy ouvert vers l'API MapTiler                                            | Validation stricte du chemin (point 3), allowlist Origin/Referer (point 10)                                        |
| Clé exposée une fois passée côté serveur si le Worker est mal restreint     | `wrangler secret put`, jamais un `--var` (point 5)                                                                 |
