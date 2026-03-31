-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.commandes (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  utilisateurId bigint,
  offreId bigint,
  statut text DEFAULT 'en_attente'::text,
  prix numeric,
  notes text,
  stripeSessionId text,
  dateCreation timestamp with time zone DEFAULT now(),
  CONSTRAINT commandes_pkey PRIMARY KEY (id),
  CONSTRAINT commandes_utilisateurId_fkey FOREIGN KEY (utilisateurId) REFERENCES public.utilisateurs(id),
  CONSTRAINT commandes_offreId_fkey FOREIGN KEY (offreId) REFERENCES public.offres(id)
);
CREATE TABLE public.offres (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  nom text,
  prix numeric,
  description text,
  features jsonb,
  options jsonb,
  CONSTRAINT offres_pkey PRIMARY KEY (id)
);
CREATE TABLE public.utilisateurs (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  email text NOT NULL UNIQUE,
  motDePasse text NOT NULL,
  prenom text,
  nom text,
  role text DEFAULT 'client'::text,
  dateCreation timestamp with time zone DEFAULT now(),
  CONSTRAINT utilisateurs_pkey PRIMARY KEY (id)
);

ALTER TABLE offres ADD COLUMN IF NOT EXISTS ordre integer DEFAULT 0;

-- ============================================================
-- MIGRATION — Ajouter les colonnes de profil utilisateur
-- À exécuter dans : Supabase → SQL Editor → New query → Run
-- ============================================================

ALTER TABLE utilisateurs
  ADD COLUMN IF NOT EXISTS telephone  text DEFAULT '',
  ADD COLUMN IF NOT EXISTS adresse    text DEFAULT '',
  ADD COLUMN IF NOT EXISTS ville      text DEFAULT '',
  ADD COLUMN IF NOT EXISTS codepostal text DEFAULT '';
  
-- ============================================================
-- OFFRES X3COM — Mise à jour basée sur les tarifs du marché
-- et le dispositif d'aide État ASP (décret 2025-674 / 2026-144)
-- À exécuter dans : Supabase → SQL Editor → New query → Run
-- ============================================================

-- Supprimer les anciennes offres si besoin (décommenter si nécessaire)
-- DELETE FROM offres;

INSERT INTO offres (nom, prix, description, features, options, surface, populaire) VALUES

(
  'Diagnostic Fibre',
  220,
  'Avant tout travaux, un diagnostic précis pour identifier le ou les points bloquants sur votre propriété. Aiguillage, sonde de traçage, marquage au sol, et remise d''un devis travaux sur place. Étape obligatoire pour constituer votre dossier ASP.',
  '["Aiguillage partie privative", "Contre-aiguillage en partie publique", "Aiguillage avec sonde de traçage", "Identification du ou des point(s) bloquant(s)", "Marquage au sol (emplacement + profondeur)", "Remise du devis travaux sur place", "Aide État non applicable sur le diagnostic"]',
  '["Compte rendu photos", "Rapport d''intervention"]',
  'Diagnostic',
  false
),

(
  'Travaux Sol Souple',
  530,
  'Intervention sur terrain en terre uniquement. Débouchage de fourreau, réparation de gaine, terrassement de regard enterré jusqu''à 1 m de profondeur. Aide État de 400 € ou 800 € déduite directement sur votre facture selon la complexité validée par l''ASP.',
  '["Travaux sur terre uniquement", "Débouchage ou réparation de fourreau / gaine télécom", "Terrassement de regard enterré (1 m inclus)", "Passage d''une ficelle de tirage", "Aide État 400 € ou 800 € déduite sur facture", "Dossier ASP pris en charge par X3COM"]',
  '["Compte rendu photos avant/après", "Attestation intervention remise au client", "Remboursement ASP géré par X3COM"]',
  'Sol meuble',
  true
),

(
  'Travaux Sol Dur',
  710,
  'Intervention sur revêtement difficile : goudron, béton, enrobé, carrelage, pavés. Découpe de sol, débouchage de fourreau ou terrassement de regard enterré jusqu''à 1 m. Aide État de 800 € ou 1 200 € déduite directement sur votre facture.',
  '["Travaux sur goudron, béton, enrobé, carrelage, pavés", "Découpe et remise en état du revêtement", "Débouchage de fourreau ou terrassement regard", "Terrassement regard enterré (1 m inclus)", "Passage d''une ficelle de tirage", "Aide État 800 € ou 1 200 € déduite sur facture", "Dossier ASP pris en charge par X3COM"]',
  '["Compte rendu photos avant/après", "Attestation intervention remise au client", "Remboursement ASP géré par X3COM"]',
  'Sol dur',
  false
),

(
  'Tranchée & Adduction',
  0,
  'Pour les chantiers complexes nécessitant une tranchée longue, la création d''une adduction au domaine public, ou la réparation d''un câble ADSL/réseau/fibre coupé. Devis sur mesure après diagnostic. Aide État de 1 200 € déduite directement sur facture.',
  '["Tranchée avec ou sans pose de fourreau", "Création d''adduction au domaine public", "Réparation câble ADSL, réseau ou fibre optique", "Géoréférencement du tracé inclus", "Aide État 1 200 € déduite sur facture", "Dossier ASP pris en charge par X3COM", "Déclaration DT/DICT incluse"]',
  '["Rapport technique complet", "Plan géoréférencé du tracé", "Photos avant/après", "Attestation et pièces justificatives ASP"]',
  'Sur devis',
  false
);