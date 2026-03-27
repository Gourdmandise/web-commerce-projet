# X3COM Backend — Node.js/Express + Stripe

Backend minimal pour gérer les paiements Stripe en toute sécurité.

---

## Structure du projet complet

```
web-commerce-projet/
├── angular/          ← Frontend Angular (port 4200)
├── x3com-bdd/        ← Base de données json-server (port 3000)
└── x3com-backend/    ← Backend Express + Stripe (port 3001)  ← ICI
```

---

## Installation

```bash
cd x3com-backend
npm install
```

---

## Configuration

1. Copiez `.env` et remplissez vos clés Stripe :

```env
STRIPE_SECRET_KEY=sk_test_VOTRE_CLE_SECRETE
STRIPE_WEBHOOK_SECRET=whsec_VOTRE_SECRET_WEBHOOK
FRONTEND_URL=http://localhost:4200
BDD_URL=http://localhost:3000
PORT=3001
```

Récupérez vos clés sur : https://dashboard.stripe.com/apikeys

---

## Démarrage

```bash
# Terminal 1 — BDD
cd x3com-bdd && npm start

# Terminal 2 — Backend Stripe
cd x3com-backend && npm start

# Terminal 3 — Frontend Angular
cd angular && npm start

# Terminal 4 — Webhooks Stripe (mode test)
stripe listen --forward-to localhost:3001/webhook
```

---

## Routes disponibles

| Méthode | Route | Description |
|---|---|---|
| `POST` | `/create-checkout-session` | Crée une session Stripe Checkout |
| `GET`  | `/session/:sessionId` | Vérifie le statut d'un paiement |
| `POST` | `/webhook` | Reçoit les événements Stripe |
| `GET`  | `/health` | Vérifie que le serveur tourne |

---

## Flux de paiement complet

```
Client clique "Payer"
  → Angular appelle POST /create-checkout-session
  → Backend crée la session Stripe
  → Angular redirige vers session.url (page Stripe)
  → Client entre sa carte sur Stripe
  → Stripe redirige vers /commande?session_id=xxx
  → Stripe envoie POST /webhook (checkout.session.completed)
  → Backend enregistre la commande dans json-server
  → Client voit sa commande confirmée
```

---

## Cartes de test Stripe

| Carte | Résultat |
|---|---|
| `4242 4242 4242 4242` | Paiement accepté |
| `4000 0000 0000 0002` | Carte refusée |
| `4000 0025 0000 3155` | Authentification 3D Secure |

Date : n'importe quelle date future · CVV : n'importe quels 3 chiffres
