export type StatutCommande =
  | 'en_attente'
  | 'paiement_confirme'
  | 'planification'
  | 'intervention'
  | 'termine'
  | 'annulee';

export interface Commande {
  id?: number;
  numeroCommande?: string;
  utilisateurId: number;
  offreId: number;
  statut: StatutCommande;
  dateCreation?: string;
  datePaiement?: string;
  dateAnnulation?: string;
  prix: number;
  notes?: string;
}