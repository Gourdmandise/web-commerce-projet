# Pipeline de prospection fibre (OSM Nominatim + Overpass + PostgreSQL)

Ce module collecte des prospects depuis deux sources complementaires :
- OpenStreetMap Nominatim (sans cle API)
- Photon (index public OSM, sans cle API)
- OpenStreetMap Overpass (annuaire public OSM, sans cle API)

Les donnees sont fusionnees par cle de deduplication, scorees pour la pertinence fibre et stockees dans PostgreSQL (`lead_prospects`).

Note email: les emails ne sont pas fournis par Nominatim/Photon. Ils peuvent etre recuperes via Overpass si les tags OSM `email` ou `contact:email` existent, et via un enrichissement gratuit sur les sites publics quand un site web est disponible.

## 1) Installation

Depuis `x3com-backend`:

```bash
npm install
```

## 2) Variables d'environnement

```env
DATABASE_URL=postgres://user:password@host:5432/dbname
SEARCH_LOCATION=Lyon
SEARCH_QUERIES=fibre optique,raccordement fibre,terrassement telecom,genie civil telecom,syndic copropriete
SEARCH_OSM_MAX_RESULTS=25
SEARCH_PHOTON_MAX_RESULTS=25
SEARCH_OVERPASS_MAX_RESULTS=50
SEARCH_OVERPASS_RADIUS_METERS=25000
SEARCH_OVERPASS_TIMEOUT_MS=25000
ENABLE_OVERPASS=true
OSM_FALLBACK_QUERIES=telecommunications,genie civil,syndic,travaux publics
OSM_REQUEST_INTERVAL_MS=1200
OSM_TIMEOUT_MS=30000
PHOTON_TIMEOUT_MS=20000
TARGET_SEGMENTS=b2b_syndic,b2b_entreprise,particulier
TARGET_DEPARTMENTS=31,81
MIN_FIBER_SCORE=60
DEDUPE_WINDOW_DAYS=90
CAMPAIGN_TAG=
CACHE_TTL_DAYS=30
```

Notes:
- `SEARCH_QUERIES` est optionnel (liste par defaut integree).
- `SEARCH_OSM_MAX_RESULTS` est optionnel (25 par defaut).
- `SEARCH_PHOTON_MAX_RESULTS` limite les resultats remontés par Photon.
- `SEARCH_OVERPASS_MAX_RESULTS` limite les resultats remontés par Overpass.
- `SEARCH_OVERPASS_RADIUS_METERS` fixe le rayon de recherche autour de la ville cible.
- `SEARCH_OVERPASS_TIMEOUT_MS` ajuste le timeout de chaque endpoint Overpass.
- `ENABLE_OVERPASS` permet de desactiver Overpass (`false`) si l'endpoint est lent ou indisponible.
- `OSM_FALLBACK_QUERIES` lance des requetes OSM de secours si la requete principale ne renvoie rien.
- `OSM_REQUEST_INTERVAL_MS` espace les appels Nominatim pour limiter les erreurs 429.
- `OSM_TIMEOUT_MS` ajuste le timeout des appels Nominatim.
- `PHOTON_TIMEOUT_MS` ajuste le timeout des appels Photon.
- `TARGET_SEGMENTS` filtre les profils cibles.
- `TARGET_DEPARTMENTS` filtre les leads par departement (ex: `31,81`).
- Le pipeline rejette les leads dont le departement est introuvable pour eviter les adresses hors zone.
- Photon est post-filtre sur le pays `FR` quand `countrycode` est disponible.
- `MIN_FIBER_SCORE` fixe le seuil de qualification commerciale.
- `DEDUPE_WINDOW_DAYS` evite les relances sur doublons recents (30/90 jours selon ta strategie).
- `CAMPAIGN_TAG` marque la campagne active pour le suivi CRM. Si vide, le scraper genere automatiquement `campagne_YYYY_MM`.
- `CACHE_TTL_DAYS` garde les reponses deja recuperees pendant la duree indiquee.

## 3) Preparation schema

Le script cree automatiquement la table si elle n'existe pas.
Tu peux aussi l'appliquer manuellement :

```bash
psql "$DATABASE_URL" -f scraper/schema.sql
```

## 4) Lancer la collecte

```bash
npm run scrape:prospects
```

## 5) Requete utile

```sql
SELECT id, name, city, phone, website, fiber_relevance_score, source_refs, updated_at
FROM lead_prospects
ORDER BY fiber_relevance_score DESC, updated_at DESC
LIMIT 100;
```

## 6) Conformite (important)

- Verifie les CGU des plateformes et la reglementation locale (RGPD, droit des bases de donnees, prospection B2B).
- Conserve uniquement les donnees strictement necessaires a la qualification commerciale.
- Mets en place une politique de retention/suppression et une procedure d'opposition.
