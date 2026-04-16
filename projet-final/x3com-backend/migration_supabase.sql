-- ============================================================
-- MIGRATION — À exécuter dans Supabase SQL Editor
-- (Settings → SQL Editor → New query → Run)
-- ============================================================

-- Ajoute les colonnes surface et populaire à la table offres
ALTER TABLE offres
  ADD COLUMN IF NOT EXISTS surface   text    DEFAULT '',
  ADD COLUMN IF NOT EXISTS populaire boolean DEFAULT false;

-- ============================================================
-- NOTE IMPORTANTE : noms de colonnes en minuscules
-- ============================================================
-- PostgreSQL convertit TOUJOURS les identifiants en minuscules
-- (sauf s'ils sont entre guillemets doubles).
-- Vos colonnes sont donc stockées ainsi dans la vraie BDD :
--
--   utilisateurs : motdepasse, datecreation
--   commandes    : utilisateurid, offreid, stripesessionid, datecreation
--
-- Le backend (server.js) gère automatiquement cette conversion.
-- Vous n'avez RIEN à changer dans le schéma Supabase.
-- ============================================================

SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('utilisateurs', 'commandes', 'offres')
ORDER BY table_name, ordinal_position;

ALTER TABLE public.commandes
  ADD COLUMN IF NOT EXISTS dateannulation timestamp with time zone;
ALTER TABLE public.commandes
  ADD COLUMN IF NOT EXISTS numero_commande text;
ALTER TABLE public.commandes
  ADD COLUMN IF NOT EXISTS datepaiement timestamp with time zone;

CREATE TABLE IF NOT EXISTS password_resets (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  utilisateur_id bigint REFERENCES public.utilisateurs(id),
  token text UNIQUE NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT password_resets_pkey PRIMARY KEY (id)
);

-- ============================================================
-- TABLE : GLOSSAIRE (Termes techniques fibre optique)
-- ============================================================
CREATE TABLE IF NOT EXISTS glossaire (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  terme text NOT NULL,
  definition text NOT NULL,
  lettre text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT glossaire_pkey PRIMARY KEY (id)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS glossaire_lettre_idx ON glossaire(lettre);
CREATE INDEX IF NOT EXISTS glossaire_terme_idx ON glossaire(terme);

-- Données initiales du glossaire
INSERT INTO glossaire (terme, definition, lettre) VALUES
('ADSL', 'Asymmetric Digital Subscriber Line. Technologie permettant le transfert de données numériques sur une ligne téléphonique.', 'A'),
('Accès Internet', 'Service de connexion fourni par un opérateur pour accéder à Internet.', 'A'),
('Arrêt du cuivre', 'Décision des opérateurs télécom de cesser progressivement le service ADSL et la téléphonie fixe sur le réseau cuivre.', 'A'),
('Bande passante', 'Capacité maximale de transmission de données sur une ligne, mesurée en Mbps (mégabits par seconde).', 'B'),
('Boîtier de raccordement', 'Point de connexion entre le réseau de fibre optique et le réseau d''accès du client.', 'B'),
('Câble de cuivre', 'Ancienne technologie de transmission utilisant des conducteurs en cuivre (ADSL, téléphonie fixe).', 'C'),
('Couverture fibre', 'Zone géographique où le déploiement de la fibre optique est disponible ou en cours.', 'C'),
('Débits', 'Vitesse de transfert de données, généralement mesurée en Mbps (download) et Mbps (upload).', 'D'),
('Dégroupage cuivre', 'Migration des abonnés du réseau cuivre ADSL vers d''autres technologies (fibre, 4G fixe).', 'D'),
('Fibre optique', 'Technologie ultra-rapide de transmission de données via des filaments de verre ultrafins.', 'F'),
('Gigabit', 'Unité de capacité égale à 1 000 Mégabits. Les offres fibre atteignent régulièrement 1 Gbps.', 'G'),
('Haut débit', 'Connexion Internet rapide, généralement définie comme supérieure à 3 Mbps.', 'H'),
('Infrastructure', 'Ensemble des installations physiques (câbles, armoires, etc.) nécessaires au service de télécommunication.', 'I'),
('JAP (Jours d''Alerte Préalable)', 'Délai de préavis avant l''arrêt définitif du service cuivre pour un client.', 'J'),
('Latence', 'Délai de transmission des données à travers le réseau. Faible sur la fibre, élevé sur l''ADSL.', 'L'),
('Mbps', 'Mégabits par seconde. Unité de mesure de la vitesse de transmission de données.', 'M'),
('Migration', 'Passage d''une technologie d''accès à une autre (par exemple, ADSL vers fibre).', 'M'),
('Opérateur', 'Entreprise de télécommunications proposant des services d''accès Internet et de téléphonie.', 'O'),
('POTS (Plain Old Telephone Service)', 'Service téléphonique traditionnel sur réseau de cuivre, en cours d''arrêt progressif.', 'P'),
('Perte de signal', 'Affaiblissement des données pendant la transmission, plus rare sur la fibre que sur le cuivre.', 'P'),
('Raccordement', 'Connexion physique entre le réseau public et le réseau privé du client.', 'R'),
('Réseau cuivre', 'Infrastructure de télécommunication historique utilisant des câbles en cuivre (ADSL, téléphonie fixe).', 'R'),
('Réseau fibre', 'Infrastructure moderne utilisant la fibre optique pour des débits ultra-rapides.', 'R'),
('Résilience', 'Capacité du réseau à continuer de fonctionner en cas de problème ou de baisse de charge.', 'R'),
('Service', 'Offre commerciale fournie par l''opérateur (Internet haut débit, téléphonie, TV, etc.).', 'S'),
('Synchronisation', 'Mise en accord de la vitesse entre l''utilisateur et le réseau pour la transmission fluide des données.', 'S'),
('Technologie cuivre', 'Ensemble des techniques utilisant le cuivre (ADSL, VDSL, téléphonie fixe).', 'T'),
('Technologie fibre', 'Ensemble des techniques utilisant la fibre optique (FTTH, FTTN, etc.).', 'T'),
('THD (Très Haut Débit)', 'Connexion Internet très rapide, généralement supérieure à 30 Mbps selon la définition française.', 'T'),
('Ultra haut débit', 'Débits extrêmement élevés, généralement supérieurs à 100 Mbps, offerts par la fibre optique.', 'U'),
('Upload', 'Vitesse d''envoi de données depuis le poste client vers Internet.', 'U'),
('VoIP', 'Voice over Internet Protocol. Service de téléphonie utilisant Internet au lieu du réseau cuivre.', 'V'),
('Zone blanche', 'Zone géographique non couverte par le haut débit (< 3 Mbps).', 'Z'),
('Zone grise', 'Zone couverte par une seule technologie de haut débit, offrant peu de concurrence.', 'Z')
ON CONFLICT DO NOTHING;

-- ============================================================
-- TABLE : COMMUNES FERMETURE CUIVRE (Communes affectées)
-- ============================================================
CREATE TABLE IF NOT EXISTS communes_fermeture_cuivre (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  commune text NOT NULL,
  code_postal text NOT NULL,
  region text,
  departement text,
  date_fermeture_commerciale timestamp with time zone,
  date_fermeture_technique timestamp with time zone,
  statut text CHECK (statut IN ('programmee', 'effective', 'effectuee')) DEFAULT 'programmee',
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT communes_fermeture_cuivre_pkey PRIMARY KEY (id)
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS communes_commune_idx ON communes_fermeture_cuivre(commune);
CREATE INDEX IF NOT EXISTS communes_code_postal_idx ON communes_fermeture_cuivre(code_postal);

-- Données initiales (exemples de communes en migration)
INSERT INTO communes_fermeture_cuivre (commune, code_postal, region, departement, date_fermeture_commerciale, date_fermeture_technique, statut) VALUES
('Paris', '75000', 'Île-de-France', '75', '2025-06-01'::timestamp with time zone, '2025-12-01'::timestamp with time zone, 'programmee'),
('Lyon', '69000', 'Auvergne-Rhône-Alpes', '69', '2024-09-01'::timestamp with time zone, '2025-03-01'::timestamp with time zone, 'effective'),
('Marseille', '13000', 'Provence-Alpes-Côte d''Azur', '13', '2025-03-01'::timestamp with time zone, '2025-09-01'::timestamp with time zone, 'programmee'),
('Toulouse', '31000', 'Occitanie', '31', '2025-09-01'::timestamp with time zone, '2026-03-01'::timestamp with time zone, 'programmee'),
('Nice', '06000', 'Provence-Alpes-Côte d''Azur', '06', '2026-06-01'::timestamp with time zone, '2027-01-01'::timestamp with time zone, 'programmee'),
('Nantes', '44000', 'Pays-de-la-Loire', '44', '2024-12-01'::timestamp with time zone, '2025-06-01'::timestamp with time zone, 'effective'),
('Strasbourg', '67000', 'Grand-Est', '67', '2025-03-01'::timestamp with time zone, '2025-09-01'::timestamp with time zone, 'programmee'),
('Montpellier', '34000', 'Occitanie', '34', '2025-12-01'::timestamp with time zone, '2026-06-01'::timestamp with time zone, 'programmee'),
('Bordeaux', '33000', 'Nouvelle-Aquitaine', '33', '2024-06-01'::timestamp with time zone, '2024-12-01'::timestamp with time zone, 'effectuee'),
('Lille', '59000', 'Hauts-de-France', '59', '2025-01-01'::timestamp with time zone, '2025-07-01'::timestamp with time zone, 'programmee')
ON CONFLICT DO NOTHING;