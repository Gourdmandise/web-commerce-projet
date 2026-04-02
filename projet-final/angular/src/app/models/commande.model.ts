export type StatutCommande =
  | 'en_attente'
  | 'paiement_confirme'
  | 'planification'
  | 'intervention'
  | 'termine'
  | 'annulee';

export interface Commande {
  id?: number;
  utilisateurId: number;
  offreId: number;
  statut: StatutCommande;
  dateCreation?: string;
  prix: number;
  notes?: string;
}