# 📋 Analyse de Vérification des Fonctionnalités

**Date:** 15 Avril 2026  
**Statut:** ⚠️ ÉCARTS DÉTECTÉS entre la documentation et l'implémentation

---

## 📊 Résumé Exécutif

| Catégorie | Documenté | Implémenté | Écart | Priorité |
|-----------|-----------|-----------|-------|----------|
| **Mot de passe oublié** | ✓ Oui | ✗ Non | 🔴 CRITIQUE | 🔴 Haute |
| **Numéro de commande unique** | ✓ Oui | ✗ Partiel | 🟡 MANQUANT | 🟡 Moyenne |
| **Détails commande (clic)** | ✓ Oui | ✓ API OK | 🟡 Frontend manquant | 🟡 Moyenne |
| **Télécharger PDF** | ✓ Oui | ✗ Non | 🔴 CRITIQUE | 🔴 Haute |

---

## 🔧 État des Endpoints API

### ✅ IMPLÉMENTÉS

#### Authentification & Compte
```
POST   /login                          ✓ Existant
POST   /register                       ✓ Existant
GET    /verify-admin/:id               ✓ Existant
PATCH  /utilisateurs/:id/password      ✓ Existant (ancien mot de passe requis)
PATCH  /utilisateurs/:id               ✓ Existant
DELETE /utilisateurs/:id               ✓ Existant
GET    /utilisateurs                   ✓ Existant (ADMIN only)
```

#### Offres & Tarifs
```
GET    /offres                         ✓ Existant
GET    /offres/:id                     ✓ Existant
POST   /offres                         ✓ Existant (ADMIN only)
PATCH  /offres/:id                     ✓ Existant (ADMIN only)
DELETE /offres/:id                     ✓ Existant (ADMIN only)
POST   /offres/reordonner              ✓ Existant (ADMIN only)
```

#### Commandes
```
GET    /commandes                      ✓ Existant (filtre par utilisateur)
GET    /commandes/:id                  ✓ Existant (vérif propriété)
PATCH  /commandes/:id                  ✓ Existant (ADMIN only, champs limités)
DELETE /commandes/:id                  ✓ Existant (ADMIN only)
POST   /commandes/:id/annuler          ✓ Existant + remboursement Stripe
```

#### Paiement
```
POST   /create-checkout-session        ✓ Existant (Stripe)
GET    /session/:sessionId             ✓ Existant
POST   /webhook                        ✓ Existant (Stripe → BDD)
```

#### Contact & Support
```
POST   /contact                        ✓ Existant + Email
GET    /diagnostic                     ✓ Existant (ADMIN only)
GET    /health                         ✓ Existant (monitoring)
```

#### Rendez-vous
```
GET    /rdv/creneaux-pris              ✓ Existant
POST   /rdv/reserve                    ✓ Existant (temp 5 min)
DELETE /rdv/reserve/:sessionId         ✓ Existant
POST   /rdv                            ✓ Existant + Email
```

---

### ✗ MANQUANT À L'API

#### Récupération Mot de Passe (🔴 CRITIQUE)
```
POST   /forgot-password                ✗ MANQUANT
   → Devrait: envoyer email avec token reset
   → Accepter: { email }
   → Répondre: { message, token_expires_in }

POST   /reset-password                 ✗ MANQUANT
   → Devrait: réinitialiser mot de passe
   → Accepter: { token, new_password }
   → Répondre: { ok: true }
```

#### Détails PDF (🔴 CRITIQUE)
```
GET    /commandes/:id/pdf              ✗ MANQUANT
   → Générer PDF facture
```

#### Numéro de Commande Unique (🟡 MANQUANT)
```
Colonne "numero_commande" manquante dans table `commandes`
→ Impact: impossible de générer un numéro unique stable
```

---

## 📱 État du Frontend

### ✅ Pages Implémentées

| Page | Composant | État |
|------|-----------|------|
| Accueil | `home.ts` | ✓ OK |
| Tarifs | `tarifs.ts` | ✓ OK |
| Paiement | `paiement.ts` | ✓ OK |
| Commande (confirmation) | `commande.ts` | ✓ OK |
| **Compte** | `compte.ts` | ⚠️ Partiel |
| Contact | `contact.ts` | ✓ OK |

### ⚠️ Fonctionnalités Manquantes au Frontend

#### 1. **Mot de Passe Oublié** (🔴 CRITIQUE)
   - **Documenté:** Oui (section 3.3)
   - **Implémenté:** Non
   - **Fichier concerné:** `compte.html` / `compte.ts`
   - **Action requise:** 
     - Ajouter lien "Mot de passe oublié?" en bas du login
     - Créer modal/page de récupération
     - Créer page réinitialisation avec formulaire

#### 2. **Numéro Commande Unique** (🟡 PARTIEL)
   - **Documenté:** Oui (section 6 "Numéro de commande unique")
   - **Implémenté:** Partiellement (affiche `c.notes` au lieu d'un numéro)
   - **Fichier concerné:** `compte.html:148`, `commande.html`
   - **État BDD:** Manque colonne `numero_commande`
   - **Action requise:**
     - Ajouter colonne en BDD avec format AUTO-INCREMENTED
     - Afficher le numéro dans la liste et détails

#### 3. **Code Promo** (🔴 CRITIQUE)
   - **Documenté:** Oui (section 7 "Code promotionnel")
   - **Implémenté:** Non
   - **Fichier concerné:** Page paiement manquante
   - **Action requise:**
     - Créer table `promo_codes` en BDD
     - Ajouter champ au formulaire paiement
     - Implémenter calcul réduction

#### 4. **Détails Commande (clic)** (🟡 PARTIEL)
   - **Documenté:** Oui (section 6 "Cliquez sur une commande")
   - **Implémenté:** API OK, Frontend manquant
   - **Fichier concerné:** `compte.html:144-171`
   - **Action requise:**
     - Ajouter `routerLink` sur chaque card
     - Créer page détail commande

#### 5. **Télécharger PDF** (🔴 CRITIQUE)
   - **Documenté:** Oui (FAQ "Peux-je télécharger un reçu?")
   - **Implémenté:** Non
   - **Action requise:**
     - Implémenter génération PDF backend
     - Ajouter bouton téléchargement frontend

#### 6. **Modifier l'adresse** (⚠️ MANQUANT)
   - **Documenté:** Oui (section 5 "Cliquez sur 'Modifier' si nécessaire")
   - **Implémenté:** Partiellement
   - **Fichier concerné:** Page paiement
   - **Action requise:** Vérifier si formulaire existe

---

## 🗄️ État de la Base de Données

### Tables Existantes
```sql
✓ utilisateurs
✓ offres
✓ commandes
✓ rdv
✓ rdv_reservations_temp
```

### Colonnes Manquantes

#### Table `commandes` (🔴 CRITIQUE)
```sql
-- MANQUANT:
ALTER TABLE commandes ADD COLUMN numero_commande VARCHAR(20) UNIQUE;
ALTER TABLE commandes ADD COLUMN total_avant_promo NUMERIC;
ALTER TABLE commandes ADD COLUMN code_promo_applique VARCHAR(50);
ALTER TABLE commandes ADD COLUMN montant_reduction NUMERIC DEFAULT 0;
ALTER TABLE commandes ADD COLUMN montant_final NUMERIC;
ALTER TABLE commandes ADD COLUMN date_paiement TIMESTAMP;
ALTER TABLE commandes ADD COLUMN token_reset_password VARCHAR(255);
ALTER TABLE commandes ADD COLUMN date_annulation TIMESTAMP;

-- En partie existant (à vérifier):
ALTER TABLE commandes ADD COLUMN dateannulation TIMESTAMP;
```

#### Table `promo_codes` (🔴 À CRÉER)
```sql
CREATE TABLE promo_codes (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  code VARCHAR(50) UNIQUE NOT NULL,
  type TEXT CHECK (type IN ('percentage', 'fixed')),
  valeur NUMERIC NOT NULL,
  utilisations_restantes INT,
  date_debut TIMESTAMP,
  date_fin TIMESTAMP,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);
```

#### Table `password_resets` (🔴 À CRÉER)
```sql
CREATE TABLE password_resets (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  utilisateur_id BIGINT REFERENCES utilisateurs(id),
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);
```

---

## 🔐 Sécurité - Points à Vérifier

### JWT & Authentification
- ✓ Token expiration: 7 jours (OK)
- ✓ Hash: bcrypt 12 rounds (OK)
- ✓ Migration auto SHA256 → bcrypt (OK)
- ✓ Rate limiting: /login (10 par min) (OK)

### Champs Sensibles
- ✓ Mot de passe jamais retourné (OK)
- ✓ Vérif propriété commande: `utilisateurId !== req.user.id` (OK)
- ✓ CORS limité à FRONTEND_URL (OK)

### À Améliorer
- ⚠️ Reset password: implémenter validation de token avec expiration
- ⚠️ Promo code: implémenter limite d'utilisation
- ⚠️ PDF: signer les URLs de téléchargement

---

## 📝 Fonctionnalités Documentées mais NON DOCUMENTÉES en Code

### Session Storage Panier
- **Documenté:** Non (mais UI dit "panier sauvegardé")
- **Implémenté:** ✓ `PanierService` + sessionStorage
- **Fichier:** `panier.service.ts`

### Email de Confirmation
- **Documenté:** Oui "Email reçu automatiquement"
- **Implémenté:** ✓ Via Resend + webhook Stripe
- **Fichier:** `server.js:792+`

### Remboursement Automatique
- **Documenté:** Partiellement
- **Implémenté:** ✓ Via Stripe API + webhook
- **Fichier:** `server.js:632+`

---

## 🎯 Plan de Correction par Priorité

### 🔴 CRITIQUE (Impact Utilisateur Élevé)

1. **Mot de passe oublié**
   - Raison: Utilisateur bloqué s'il oublie son mot de passe
   - Effort: Medium (3-4h)
   - Dépendances: API reset password + email

2. **Code Promo**
   - Raison: Documenté mais absent → confusion utilisateur
   - Effort: Medium (2-3h)
   - Dépendances: Table BDD + API validation

3. **Télécharger PDF**
   - Raison: Utilisateur ne peut pas archiver ses factures
   - Effort: Medium (2-3h)
   - Dépendances: Library PDF (pdfkit ou similar)

### 🟡 MOYENNE (Cohérence Documentation)

4. **Numéro Commande Unique**
   - Raison: Documenté mais manquant dans la liste
   - Effort: Low (1h)
   - Dépendances: Migration BDD simple

5. **Cliquer sur Commande → Détails**
   - Raison: Documenté "Cliquez pour voir les détails"
   - Effort: Low (45 min)
   - Dépendances: Page simple, API existante

6. **Modifier l'adresse**
   - Raison: Documenté "Cliquez sur Modifier"
   - Effort: Medium (1-2h)
   - Dépendances: Vérifier formul paiement

---

## 📊 Matrice de Vérification Détaillée

### Section 3: Gestion du Compte
| Item | Documenté | Backend | Frontend | Résultat |
|------|-----------|---------|----------|----------|
| Créer compte | ✓ | ✓ POST /register | ✓ `compte.html` | ✅ OK |
| Se connecter | ✓ | ✓ POST /login | ✓ `compte.html` | ✅ OK |
| **Mot de passe oublié** | ✓ | ✗ | ✗ | ❌ MANQUANT |
| Modifier infos | ✓ | ✓ PATCH /utilisateurs/:id | ✓ `compte.html:94-104` | ✅ OK |
| Changer mot de passe | ✓ | ✓ PATCH /utilisateurs/:id/password | ✓ `compte.html:107-128` | ✅ OK |
| Supprimer compte | ✓ | ✓ DELETE /utilisateurs/:id | ✓ `compte.html:131-133` | ✅ OK |

### Section 5: Passer une Commande
| Item | Documenté | Backend | Frontend | Résultat |
|------|-----------|---------|----------|----------|
| Consulter catalogue | ✓ | ✓ GET /offres | ✓ `tarifs.ts` | ✅ OK |
| Ajouter au panier | ✓ | ✓ PanierService | ✓ `tarifs.html` | ✅ OK |
| **Code promo** | ✓ | ✗ | ✗ | ❌ MANQUANT |
| Vérifier total | ✓ | ✓ Calculé au paiement | ✓ | ✅ OK |

### Section 6: Suivi de Commande
| Item | Documenté | Backend | Frontend | Résultat |
|------|-----------|---------|----------|----------|
| Consulter historique | ✓ | ✓ GET /commandes | ✓ `compte.html:137-176` | ✅ OK |
| **Numéro commande** | ✓ | ✗ (colonne manquante) | ✓ affiche notes | ⚠️ PARTIEL |
| Statuts visibles | ✓ | ✓ (6 statuts DB) | ✓ `compte.html:151-152` | ✅ OK |
| **Cliquer détails** | ✓ | ✓ GET /commandes/:id | ✗ (pas de route) | ⚠️ PARTIEL |
| **Télécharger PDF** | ✓ | ✗ | ✗ | ❌ MANQUANT |

### Section 7: Gestion Panier
| Item | Documenté | Backend | Frontend | Résultat |
|------|-----------|---------|----------|----------|
| Modifier quantité | ✓ | ✓ PanierService | ✓ | ✅ OK |
| Supprimer article | ✓ | ✓ PanierService | ✓ | ✅ OK |
| **Code promo** | ✓ | ✗ | ✗ | ❌ MANQUANT |
| Sauvegarder panier | ✓ | ✓ sessionStorage | ✓ | ✅ OK |

---

## 🚀 Recommandations Immédiates

### Pour l'Utilisateur Final
1. **Avertir** que mot de passe oublié n'est pas encore disponible (ajouter note en page login)
2. **Masquer** la section code promo documentée jusqu'à implémentation
3. **Masquer** le bouton "Télécharger PDF" si absent
4. **Ajouter** détails visibles sur numéro commande au lieu de nom service

### Pour le Développement
1. Clarifier les priorités entre les 3 fonctionnalités critiques
2. Créer des issues GitHub avec cette analyse
3. Planifier sprint selon impact/effort

---

## 📎 Fichiers de Référence

**Frontend:**
- `/projet-final/angular/src/app/pages/compte/compte.html`
- `/projet-final/angular/src/app/pages/compte/compte.ts`
- `/projet-final/angular/src/app/pages/paiement/paiement.ts`

**Backend:**
- `/projet-final/x3com-backend/server.js`
- `/projet-final/x3com-backend/table.sql`

**Documentation:**
- `/DOCUMENT_UTILISATEUR.html`
- `/DOCUMENT_UTILISATEUR.md`

---

**Document généré:** 2026-04-15  
**Statut:** ⚠️ ANALYSE COMPLÈTE - ACTIONS REQUISES
