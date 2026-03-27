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