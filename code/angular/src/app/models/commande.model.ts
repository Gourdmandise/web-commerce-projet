export type StatutCommande =
  | 'en_attente'
  | 'paiement_confirme'
  | 'planification'
  | 'intervention'
  | 'termine';

export interface Commande {
  id?: number;
  utilisateurId: number;
  offreId: number;
  statut: StatutCommande;
  dateCreation?: string;
  prix: number;
  adresseIntervention?: string;
  operateur?: string;
  notes?: string;
}
