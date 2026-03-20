export interface Utilisateur {
  id?: number;
  email: string;
  motDePasse?: string;
  nom: string;
  prenom: string;
  telephone?: string;
  adresse?: string;
  ville?: string;
  codePostal?: string;
  role: 'client' | 'admin';
  dateCreation?: string;
}
