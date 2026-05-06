export type ProfilOffre = 'particulier' | 'collectivite' | 'entreprise';

export interface Offre {
  id?: number;
  nom: string;
  prix: number;
  description: string;
  surface?: string;
  populaire: boolean;
  features: string[];
  options: string[];
  ordre?: number;
  profil?: ProfilOffre;
}