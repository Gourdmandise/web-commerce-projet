type OffreMock = {
  id: number;
  nom: string;
  prix: number;
  description: string;
  surface: string;
  populaire: boolean;
  features: string[];
  options: string[];
};

type CommandeMock = {
  id: number;
  numeroCommande: string;
  utilisateurId: number;
  offreId: number;
  statut: 'en_attente' | 'paiement_confirme' | 'planification' | 'intervention' | 'termine' | 'annulee';
  dateCreation: string;
  datePaiement?: string;
  prix: number;
  notes: string;
};

const offres: OffreMock[] = [
  {
    id: 1,
    nom: 'Essentielle',
    prix: 89,
    description: 'Diagnostic rapide avec restitution claire.',
    surface: 'Particuliers',
    populaire: false,
    features: ['Diagnostic initial', 'Compte-rendu rapide', 'Support e-mail'],
    options: ['Intervention sous 48h'],
  },
  {
    id: 2,
    nom: 'Standard',
    prix: 129,
    description: 'Le meilleur équilibre entre délai et accompagnement.',
    surface: 'Particuliers et pros',
    populaire: true,
    features: ['Analyse complète', 'Suivi prioritaire', 'Rapport détaillé'],
    options: ['Intervention sous 24h'],
  },
  {
    id: 3,
    nom: 'Premium',
    prix: 189,
    description: 'Accompagnement avancé pour les besoins complexes.',
    surface: 'Professionnels',
    populaire: false,
    features: ['Expertise avancée', 'Visite sur site', 'Compte-rendu enrichi'],
    options: ['Support téléphonique', 'Priorité haute'],
  },
];

const commandeDetail: CommandeMock = {
  id: 42,
  numeroCommande: 'COM-2026-0042',
  utilisateurId: 7,
  offreId: 2,
  statut: 'planification',
  dateCreation: '2026-04-21T08:30:00.000Z',
  datePaiement: '2026-04-21T09:00:00.000Z',
  prix: 129,
  notes: 'Raccordement fibre pour maison individuelle à Toulouse.',
};

const clientConnecte = {
  id: 7,
  email: 'client@example.com',
  nom: 'Martin',
  prenom: 'Alice',
  telephone: '0601020304',
  role: 'client' as const,
};

const apiBase = 'http://localhost:3001';

function visitApp(path = '/') {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.clear();
      win.sessionStorage.clear();
    },
  });
}

function visitAsClient(path = '/') {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.clear();
      win.sessionStorage.clear();
      win.localStorage.setItem('x3com_utilisateur', JSON.stringify(clientConnecte));
      win.localStorage.setItem('x3com_token', 'test-token');
    },
  });
}

describe('X3COM - parcours critiques', () => {
  it('ouvre les offres depuis l’accueil et navigue vers les services', () => {
    cy.intercept('GET', `${apiBase}/offres`, { body: offres }).as('getOffres');

    visitApp('/');

    cy.wait('@getOffres');
    cy.contains('h1', 'Nous détectons votre').should('be.visible');

    cy.contains('.dc-particuliers', 'Particuliers').click();
    cy.contains('.offres-preview', 'Essentielle').should('be.visible');
    cy.contains('.offres-preview', 'Standard').should('be.visible');

    cy.contains('a.btn-x1', '↓ Découvrir nos services').click();
    cy.url().should('include', '/nos-services');
    cy.contains('Formules Détection Télécom').should('be.visible');
  });

  it('envoie le formulaire de contact et réinitialise le champ principal', () => {
    cy.intercept('POST', `${apiBase}/contact`, {
      statusCode: 200,
      body: { ok: true },
    }).as('sendContact');

    visitApp('/contact');

    cy.get('input[name="nom"]').type('Alice Martin');
    cy.get('input[name="email"]').type('alice@example.com');
    cy.get('input[name="tel"]').type('0601020304');
    cy.get('input[name="ville"]').type('Toulouse');
    cy.get('input[name="adresse"]').type('12 rue du Test');
    cy.contains('label.cbli', 'Préfibrage').click();
    cy.get('select').select('Orange');
    cy.get('textarea[name="message"]').type('Besoin de raccordement pour mon domicile.');

    cy.contains('button', 'Envoyer le message').click();

    cy.wait('@sendContact');
    cy.contains('.notif p', 'Message envoyé !').should('be.visible');
    cy.get('input[name="nom"]').should('have.value', '');
  });

  it('redirige vers le compte si l’utilisateur n’est pas connecté', () => {
    cy.intercept('GET', `${apiBase}/offres`, { body: offres }).as('getOffres');

    visitApp('/tarifs');

    cy.wait('@getOffres');
    cy.contains('.pc', 'Standard').within(() => {
      cy.contains('button', 'Choisir cette offre').click();
    });

    cy.url().should('include', '/compte');
    cy.contains('h1', 'Mon Compte').should('be.visible');
  });

  it('affiche la confirmation de commande depuis le retour Stripe', () => {
    cy.intercept('GET', `${apiBase}/session/cs_test_123`, {
      body: {
        status: 'paid',
        customerEmail: clientConnecte.email,
        metadata: {
          offreId: '2',
          nomOffre: 'Standard',
          prix: '129',
        },
      },
    }).as('stripeSession');

    visitAsClient('/commande?session_id=cs_test_123');

    cy.wait('@stripeSession');
    cy.contains('strong', 'Paiement confirmé par Stripe').should('be.visible');
    cy.contains('Commande enregistrée avec succès').should('be.visible');
  });

  it('affiche le détail d’une commande et déclenche le téléchargement du PDF', () => {
    cy.intercept('GET', `${apiBase}/commandes/42`, { body: commandeDetail }).as('getCommande');
    cy.intercept('GET', `${apiBase}/commandes/42/pdf`, {
      statusCode: 200,
      headers: { 'content-type': 'application/pdf' },
      body: new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10]),
    }).as('getPdf');

    visitAsClient('/commandes/42');

    cy.wait('@getCommande');
    cy.contains('h3', 'COM-2026-0042').should('be.visible');
    cy.contains('.bdg-active', 'Planification').should('be.visible');

    cy.window().then((win) => {
      cy.stub(win.URL, 'createObjectURL').returns('blob:test').as('createObjectURL');
      cy.stub(win.URL, 'revokeObjectURL').as('revokeObjectURL');
      cy.stub(win.HTMLAnchorElement.prototype, 'click').as('anchorClick');
    });

    cy.contains('button', 'Télécharger la facture PDF').click();

    cy.wait('@getPdf');
    cy.get('@anchorClick').should('have.been.called');
  });
});