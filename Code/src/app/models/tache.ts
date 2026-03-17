export enum EtatTache {
  AFAIRE   = "à faire",
  ENCOURS  = "en cours",
  TERMINEE = "terminée",
}

export class Tache {
  constructor(
    public id: number = 0,
    public nom: string = "",
    public etat: EtatTache = EtatTache.AFAIRE,
    public memo: string = ""
  ) {}
}