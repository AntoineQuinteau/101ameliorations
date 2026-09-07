# Klash — Spécification v1

Application web (PWA) de signalement de problèmes sur les voies cyclables du Pays basque et du sud des Landes (CAPB + sud Landes). Les usagers signalent des « klashs » géolocalisés ; une association les modère ; l'agglomération les traite.

Convention : toute la spec est en français, **tout le code, le schéma, les identifiants et les commentaires sont en anglais**.

---

## 1. Objectifs et principes

- Signaler un klash en moins de 60 secondes depuis un téléphone, sans mot de passe.
- Données publiques en lecture, fiables en écriture (email vérifié).
- Éviter les doublons plutôt que les subir : proposer la confirmation d'un klash existant.
- Cycle de vie explicite (nouveau → traité), avec traçabilité de qui a changé quoi.
- Zéro serveur applicatif : Supabase (Postgres/PostGIS, Auth, Storage, RLS) + front statique sur Cloudflare Pages.
- Export des données pour le plaidoyer auprès des collectivités.

## 2. Rôles et permissions

Un utilisateur = un email vérifié. Pas de mot de passe (OTP par email). Les rôles sont stockés dans `profiles.role` et attribués par un admin. Pas de compte partagé : chaque membre de l'asso a son propre compte, un admin lui donne le rôle `moderator`. C'est plus simple qu'un compte partagé (rien à partager puisqu'il n'y a pas de mot de passe) et traçable.

| Action | anonyme | `user` | `moderator` (asso) | `authority` (agglo) | `admin` |
|---|---|---|---|---|---|
| Voir carte, klashs, photos, commentaires | ✓ | ✓ | ✓ | ✓ | ✓ |
| Créer un klash, ajouter des photos | | ✓ | ✓ | ✓ | ✓ |
| Confirmer (+1) un klash | | ✓ | ✓ | ✓ | ✓ |
| Commenter | | ✓ | ✓ | ✓ | ✓ |
| Modifier / supprimer **son** klash, ses photos, ses commentaires | | ✓ | ✓ | ✓ | ✓ |
| Modifier / supprimer / masquer **n'importe quel** klash, photo, commentaire | | | ✓ | | ✓ |
| Statuts de tri : `rejected`, `duplicate`, retour à `new` | | | ✓ | | ✓ |
| Statuts de traitement : `acknowledged`, `in_progress`, `resolved` | | | | ✓ | ✓ |
| Voir l'email de l'auteur d'un klash (pour le recontacter) | | | ✓ | ✓ | ✓ |
| Export CSV / GeoJSON | ✓ (public) | ✓ | ✓ | ✓ | ✓ |
| Gérer les rôles | | | | | ✓ |

Règles :
- Un `user` ne peut plus modifier catégorie/position/description de son klash une fois qu'il n'est plus en statut `new` (la collectivité a commencé à traiter). Il peut toujours commenter.
- Les emails ne sont jamais exposés publiquement. On affiche `display_name` (pseudo choisi, sinon « Usager »). Pour `authority`, on affiche `organization` (ex. « CAPB »). Les rôles `moderator`, `authority` et `admin` peuvent consulter l'email de l'auteur d'un klash depuis la page détail (RPC `get_klash_author_contact(klash_id)`, security definer, journalisée). Cette consultation est mentionnée dans la politique de confidentialité.
- Tout changement de statut est historisé avec l'auteur et une note optionnelle.

## 3. Cycle de vie d'un klash

```
new ──(moderator)──> rejected | duplicate
new ──(authority)──> acknowledged ──> in_progress ──> resolved
resolved ──(authority)──> in_progress   (réouverture)
rejected | duplicate ──(moderator)──> new   (erreur de tri)
```

Un klash `duplicate` référence l'original (`duplicate_of`) ; l'app affiche « voir le signalement original ».

## 4. Modèle de données (Supabase / Postgres + PostGIS)

Migrations versionnées dans `supabase/migrations/`. Schéma cible :

```sql
create extension if not exists postgis;

create type user_role as enum ('user', 'moderator', 'authority', 'admin');

-- Placeholder categories: real ones will be defined with the association.
-- Labels and icons live in the i18n messages file, so renaming them later
-- only requires a migration (enum rename) and a label change.
create type klash_category as enum (
  'category_1', 'category_2', 'category_3', 'category_4', 'category_5'
);

create type klash_urgency as enum ('low', 'medium', 'high');

create type klash_status as enum (
  'new', 'acknowledged', 'in_progress', 'resolved', 'rejected', 'duplicate'
);

-- One row per auth user, created by trigger on auth.users insert.
create table profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text check (char_length(display_name) between 2 and 40),
  role          user_role not null default 'user',
  organization  text,                      -- shown publicly for 'authority' accounts
  created_at    timestamptz not null default now()
);

create table klashes (
  id                  uuid primary key default gen_random_uuid(),
  author_id           uuid not null references profiles (id),
  location            geography(point, 4326) not null,
  category            klash_category not null,
  urgency             klash_urgency not null default 'medium',
  status              klash_status not null default 'new',
  title               text not null check (char_length(title) between 5 and 120),
  description         text check (char_length(description) <= 2000),
  duplicate_of        uuid references klashes (id),
  confirmations_count integer not null default 0,
  comments_count      integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  resolved_at         timestamptz
);
create index klashes_location_idx on klashes using gist (location);
create index klashes_created_at_idx on klashes (created_at desc);
create index klashes_status_idx on klashes (status);

create table klash_photos (
  id            uuid primary key default gen_random_uuid(),
  klash_id      uuid not null references klashes (id) on delete cascade,
  author_id     uuid not null references profiles (id),
  storage_path  text not null,             -- 'klash-photos/{klash_id}/{uuid}.jpg'
  width         integer,
  height        integer,
  created_at    timestamptz not null default now()
);

create table comments (
  id          uuid primary key default gen_random_uuid(),
  klash_id    uuid not null references klashes (id) on delete cascade,
  author_id   uuid not null references profiles (id),
  body        text not null check (char_length(body) between 1 and 1000),
  hidden      boolean not null default false,   -- soft-moderation by moderator/admin
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table confirmations (
  klash_id    uuid not null references klashes (id) on delete cascade,
  user_id     uuid not null references profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (klash_id, user_id)
);

create table status_changes (
  id          uuid primary key default gen_random_uuid(),
  klash_id    uuid not null references klashes (id) on delete cascade,
  changed_by  uuid not null references profiles (id),
  from_status klash_status not null,
  to_status   klash_status not null,
  note        text check (char_length(note) <= 500),
  created_at  timestamptz not null default now()
);
```

Triggers et fonctions :
- `handle_new_user()` : crée la ligne `profiles` à l'inscription.
- `set_updated_at()` sur `klashes` et `comments`.
- Compteurs `confirmations_count` / `comments_count` maintenus par trigger (les commentaires `hidden` ne comptent pas).
- `enforce_service_area()` : rejette un klash hors zone (bbox lat 43.25–43.80, lon -1.80 à -0.90, stockée en table `settings` pour être ajustable sans migration).
- `enforce_status_transition()` : vérifie que la transition est autorisée pour le rôle courant, insère la ligne dans `status_changes`, renseigne `resolved_at`.
- `enforce_rate_limit()` : max 10 klashs / 24 h et 50 commentaires / 24 h par utilisateur.
- `enforce_photo_limit()` : max 3 photos par klash.
- Vue publique `klashes_public` exposant `author_display_name` sans jamais joindre l'email.
- RPC `klashes_nearby(lat, lng, radius_m)` : klashs actifs (hors `rejected`/`duplicate`/`resolved` depuis > 30 j) dans un rayon, pour la détection de doublons.
- RPC `klashes_in_bbox(min_lat, min_lng, max_lat, max_lng, filters)` pour la carte.

## 5. Sécurité (RLS)

RLS activé sur toutes les tables. Fonction helper `current_user_role()` (security definer, stable) qui lit `profiles.role` de `auth.uid()`.

Résumé des policies :
- `profiles` : select public limité (id, display_name, role, organization via la vue) ; update de sa propre ligne sauf `role` ; `role` modifiable par `admin` uniquement.
- `klashes` : select public ; insert si `auth.uid() = author_id` ; update par auteur si `status = 'new'`, par `moderator`/`admin` sans restriction, par `authority` uniquement sur `status` (contrôlé par trigger) ; delete par auteur ou `moderator`/`admin`.
- `klash_photos` : select public ; insert par auteur du klash ; delete par auteur, `moderator`, `admin`.
- `comments` : select public où `hidden = false` (ou rôle ≥ moderator) ; insert authentifié ; update/delete par auteur, `moderator`, `admin`.
- `confirmations` : select public ; insert/delete par `user_id = auth.uid()`. Un auteur ne peut pas confirmer son propre klash.
- `status_changes` : select public ; insert uniquement via trigger.
- Storage bucket `klash-photos` : lecture publique, upload authentifié limité à `image/jpeg|png|webp` et 2 Mo, chemin préfixé par un `klash_id` dont l'utilisateur est l'auteur.

Anti-abus :
- Cloudflare Turnstile sur la demande d'OTP (vérification côté Supabase Edge Function ou via hook Auth).
- Rate limits en base (voir triggers) + rate limit Supabase Auth sur les envois d'OTP.
- Détection de doublons côté UX (voir §6.3), pas de blocage dur.

## 6. Parcours et écrans

Une seule application responsive. Routes :

| Route | Contenu |
|---|---|
| `/` | Carte plein écran + liste (panneau latéral sur desktop, feuille glissante sur mobile) |
| `/k/:id` | Détail d'un klash |
| `/new` | Création (feuille/modale par-dessus la carte) |
| `/login` | Saisie email → saisie du code OTP |
| `/me` | Mes klashs, mon pseudo |
| `/admin` | Modération et traitement (rôles ≥ moderator) |

### 6.1 Carte (`/`)

- Leaflet (react-leaflet), tuiles MapTiler (style « Streets » ou « Outdoor », clé restreinte aux domaines de l'app). Vue initiale : centre Bayonne (43.49, -1.47), zoom 10, contrainte aux bounds de la zone de service.
- Marqueurs colorés par urgence, icône par catégorie, style atténué pour `resolved`. Clustering (`leaflet.markercluster`) au-delà de ~50 marqueurs visibles.
- Chargement des klashs par bbox à chaque déplacement (debounce 300 ms), via `klashes_in_bbox`.
- Filtres (panneau latéral desktop / feuille mobile) : catégorie (multi), urgence (multi), statut (multi, par défaut tout sauf `rejected`/`duplicate`, et `resolved` masqués après 90 jours — toujours présents dans l'export), période. Tri : plus récent, plus confirmé. Case « uniquement la zone visible ». Filtres reflétés dans l'URL (partageables).
- Mobile : bouton flottant **« Signaler ici »** (utilise la géoloc) + tap long sur la carte pour signaler à un point précis. Desktop : clic sur la carte → pin → « Signaler ici ».
- Bouton « Ma position » (géoloc, mobile seulement).

### 6.2 Création (`/new`)

Étapes dans une feuille glissante, la carte reste visible derrière avec le pin déplaçable :

1. **Position** : pin déplaçable, adresse approximative affichée (reverse geocoding Nominatim, facultatif, avec cache). Précision GPS affichée si < 50 m sinon avertissement « affinez la position ».
2. **Doublons** : appel `klashes_nearby(50 m)`. S'il y a des résultats : liste avec « C'est le même problème → je confirme » (crée une `confirmation` et termine) ou « Non, c'est un autre problème → continuer ».
3. **Formulaire** : catégorie (grille d'icônes), urgence (3 boutons), titre, description, photos (jusqu'à 3 : caméra ou fichier ; compression côté client à 1600 px max / qualité 0.8 avec `browser-image-compression` ; EXIF supprimé sauf lecture préalable du GPS pour proposer « utiliser la position de la photo ? »).
4. **Envoi** : si non connecté, étape login inline (email → code), le brouillon est conservé en mémoire pendant l'auth. Insert du klash puis upload des photos puis insert `klash_photos`. Écran de confirmation avec lien de partage.

Hors zone de service : message clair et blocage avant le formulaire.

### 6.3 Détail (`/k/:id`)

- Carte réduite, photos (galerie), catégorie, urgence, statut avec date, auteur (pseudo), compteur de confirmations, bouton « Je confirme » (toggle, désactivé pour l'auteur).
- Historique des statuts avec notes (ex. « CAPB — intervention programmée semaine 38 »).
- Commentaires chronologiques, formulaire pour les connectés. Édition/suppression de ses propres commentaires.
- Actions contextuelles selon rôle : Modifier / Supprimer (auteur si `new`, moderator, admin) ; Changer le statut (authority, moderator selon §3) avec note ; Masquer un commentaire (moderator, admin).
- Bouton de partage (Web Share API, fallback copie de lien). Balises Open Graph pour l'aperçu.

### 6.4 Connexion (`/login`)

- Email → Turnstile invisible → `signInWithOtp` → saisie du code à 6 chiffres (autofill SMS/mail géré par `autocomplete="one-time-code"`).
- Première connexion : choix d'un pseudo (facultatif, sinon « Usager »).
- Session persistante (localStorage). Déconnexion dans `/me`.

### 6.5 Mon espace (`/me`)

Liste de mes klashs avec statut, mes confirmations, modification du pseudo, suppression de compte (RGPD : anonymise les klashs — `author_id` vers un profil « compte supprimé » — plutôt que les supprimer, pour préserver la donnée collective ; l'utilisateur en est informé).

### 6.6 Administration (`/admin`, rôles ≥ moderator)

- Table paginée de tous les klashs avec filtres (statut, catégorie, période, zone), tri, recherche texte.
- Actions par lot : changer le statut, marquer doublon (sélection de l'original), supprimer.
- File « à trier » : klashs `new` de plus de 7 jours.
- `admin` uniquement : gestion des rôles (rechercher un profil par email via RPC security definer, changer le rôle, renseigner `organization`).
- Statistiques simples : klashs par statut, par catégorie, par mois, délai moyen de résolution.

### 6.7 Export

Page ou lien `/export` : CSV et GeoJSON (klashs + statut + compteurs, sans données personnelles), générés côté client depuis une RPC paginée, ou via une Edge Function si le volume l'exige. Public.

## 7. PWA

- `vite-plugin-pwa` : manifest (nom, icônes, `display: standalone`, thème), service worker en `autoUpdate`.
- Cache : coquille applicative + tuiles récentes (`CacheFirst`, limite 500 entrées, 7 jours). Données Supabase en `NetworkFirst`.
- Bandeau « Installer l'application » discret (événement `beforeinstallprompt`) ; instructions manuelles pour iOS.
- Hors v1 : file d'attente hors-ligne des signalements (Background Sync).

## 8. Stack et outillage

- **Front** : React 18, Vite, TypeScript strict, Tailwind, react-router, react-leaflet + leaflet.markercluster, `@supabase/supabase-js`, TanStack Query, zod (validation des formulaires), `browser-image-compression`, `exifr`.
- **Back** : Supabase (projet région EU). Supabase CLI, migrations versionnées, `supabase db reset` pour un environnement local. Types TypeScript générés (`supabase gen types`).
- **Auth** : email OTP. Templates d'email en français. Nom d'expéditeur = nom de l'asso.
- **Hébergement** : Cloudflare Pages connecté au repo GitHub (`main` → prod, branches → preview). Variables : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_MAP_TILES_URL`, `VITE_TURNSTILE_SITE_KEY`, `VITE_SERVICE_AREA_BBOX`.
- **Qualité** : ESLint + Prettier, tests unitaires (Vitest) sur les utilitaires (bbox, compression, transitions de statut), tests RLS en SQL (`supabase test db`), Playwright sur le parcours de création.
- **i18n** : textes UI en français, isolés dans un fichier de messages (une seconde langue — basque — n'est pas prévue en v1 mais ne doit pas demander de refonte).
- **Monitoring** : Sentry (front) gratuit, alertes Supabase sur quota.

## 9. Plan de construction (pour Claude Code)

Chaque étape se termine par un déploiement preview testé sur téléphone réel.

1. **Socle** — Repo, Vite/React/TS/Tailwind, Supabase CLI, migration initiale (types, tables, triggers, RLS), génération des types, Cloudflare Pages branché. *Critère : `supabase db reset` passe, page vide déployée en HTTPS.*
2. **Carte + lecture** — Carte Leaflet, chargement par bbox, marqueurs, clustering, page détail en lecture seule. Données de test insérées par seed. *Critère : navigation fluide sur mobile avec 500 klashs seedés.*
3. **Auth OTP** — Login, profil, pseudo, `/me`. *Critère : parcours email → code → session persistante.*
4. **Création** — Feuille de création en 4 étapes, géoloc, pin, détection de doublons, confirmation +1, validation zod, rate limits. Sans photos. *Critère : klash créé en < 60 s depuis un téléphone.*
5. **Photos** — Compression, EXIF GPS, upload Storage, galerie. *Critère : 3 photos de 4 Mo uploadées en < 10 s en 4G.*
6. **Commentaires + filtres + tri + URL partageable.**
7. **Cycle de vie** — Transitions de statut, historique, notes, rôles `moderator`/`authority`, `/admin`. *Critère : tests SQL des transitions interdites.*
8. **PWA + export + OG + Sentry.**
9. **Durcissement** — Turnstile, revue RLS, suppression de compte, Playwright, mentions légales / politique de confidentialité.

## 10. Hors périmètre v1 (candidats v2)

- Signalement hors-ligne avec synchronisation différée.
- Notifications email à l'auteur lors d'un changement de statut (simple à ajouter via webhook Supabase → Resend).
- Abonnement à une zone (« me prévenir des nouveaux klashs sur mon trajet »).
- Import/export vers les outils de la collectivité (API dédiée).
- Version basque de l'interface.
- Tracés linéaires (un klash sur un tronçon plutôt qu'un point).

## 11. Décisions prises (07/09/2026)

1. **Catégories** : `category_1` à `category_5`, libellés « Catégorie 1 » à « Catégorie 5 » en attendant la liste de l'asso. Paramétrage par le rôle `moderator` : v2.
2. **Nom** : « 101améliorations ». Domaine initial `101ameliorations.pages.dev` (gratuit Cloudflare), domaine personnalisé plus tard sans impact sur le code. Expéditeur des emails : « 101améliorations ».
3. **Tuiles** : MapTiler.
4. **Conservation** : klashs `resolved` masqués de la carte par défaut après 90 jours, conservés en base et dans l'export.
5. **Contact auteur** : `authority`, `moderator` et `admin` peuvent consulter l'email de l'auteur d'un klash (v1). Notifications automatiques : v2.