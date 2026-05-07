require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const rateLimit  = require('express-rate-limit');
const helmet     = require('helmet');
const { Resend } = require('resend');
const PDFDocument = require('pdfkit');
const stripe     = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const multer     = require('multer');
const crypto     = require('crypto');
const upload     = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const app   = express();
const PORT  = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('\n✗ JWT_SECRET manquant dans .env — le serveur ne peut pas démarrer en sécurité.');
  process.exit(1);
}

// Déduplique ALLOWED_ORIGINS si FRONTEND_URL est absent
const ALLOWED_ORIGINS = [
  ...new Set([
    process.env.FRONTEND_URL || 'http://localhost:4200',
    'http://localhost:4200',
  ])
].filter(Boolean);

// Derriere Render/proxy, express-rate-limit a besoin de trust proxy
// pour lire correctement X-Forwarded-For et identifier les clients.
const isBehindProxy = Boolean(
  process.env.RENDER ||
  process.env.RENDER_EXTERNAL_URL ||
  process.env.NODE_ENV === 'production'
);
app.set('trust proxy', isBehindProxy ? 1 : false);

// ══════════════════════════════════════════════════════════
// SUPABASE
// ══════════════════════════════════════════════════════════
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('\n✗ SUPABASE_URL ou SUPABASE_SERVICE_KEY manquant dans .env');
}

const supabase = createClient(
  process.env.SUPABASE_URL  || '',
  process.env.SUPABASE_SERVICE_KEY || '',
  { auth: { persistSession: false } }
);

// ══════════════════════════════════════════════════════════
// FONCTIONS UTILITAIRES
// ══════════════════════════════════════════════════════════
/**
 * Valide le format d'une adresse email.
 */
function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(String(email).toLowerCase());
}

// ══════════════════════════════════════════════════════════
// FONCTIONS DE MAPPING
// ══════════════════════════════════════════════════════════
function utilisateurToAngular(u) {
  if (!u) return null;
  return {
    id:           u.id,
    email:        u.email,
    prenom:       u.prenom,
    nom:          u.nom,
    role:         u.role,
    telephone:    u.telephone    ?? '',
    adresse:      u.adresse      ?? '',
    ville:        u.ville        ?? '',
    codePostal:   u.codepostal   ?? '',
    dateCreation: u.datecreation ?? null,
    // motdepasse n'est JAMAIS renvoyé
  };
}

function commandeToAngular(c) {
  if (!c) return null;
  return {
    id:              c.id,
    numeroCommande:  c.numero_commande ?? null,
    utilisateurId:   c.utilisateurid   ?? null,
    offreId:         c.offreid         ?? null,
    statut:          c.statut,
    prix:            c.prix,
    notes:           c.notes,
    stripeSessionId: c.stripesessionid ?? null,
    dateCreation:    c.datecreation    ?? null,
    datePaiement:    c.datepaiement    ?? null,
    dateAnnulation:  c.dateannulation  ?? null,
  };
}

function creerNumeroCommande(id, dateValue = new Date()) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  const dateValide = Number.isNaN(date.getTime()) ? new Date() : date;
  const annee = dateValide.getFullYear();
  const mois = String(dateValide.getMonth() + 1).padStart(2, '0');
  const identifiant = String(id).padStart(6, '0');
  return `X3-${annee}${mois}-${identifiant}`;
}

function creerNumeroFacture(id) {
  const identifiant = String(id).padStart(7, '0');
  return `FA${identifiant}`;
}

function formaterDateFR(dateValue) {
  if (!dateValue) return '—';
  return new Date(dateValue).toLocaleString('fr-FR');
}

// ══════════════════════════════════════════════════════════
// MIDDLEWARES GLOBAUX
// ══════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
// HEADERS DE SÉCURITÉ
// ══════════════════════════════════════════════════════════
app.use(helmet({
  // ── Content-Security-Policy ────────────────────────────
  // Le backend (API JSON) ne sert pas de HTML — la CSP ici
  // protège les rares réponses texte/HTML d'erreur Express.
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'none'"],   // API pure : rien par défaut
      scriptSrc:      ["'none'"],
      objectSrc:      ["'none'"],
      frameAncestors: ["'none'"],   // Personne ne peut encadrer l'API
      baseUri:        ["'self'"],
    },
  },

  // ── X-Frame-Options ────────────────────────────────────
  frameguard: { action: 'sameorigin' },

  // ── X-Content-Type-Options: nosniff ────────────────────
  // Activé par défaut par Helmet — pas besoin de déclaration

  // ── Referrer-Policy ────────────────────────────────────
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

  // ── HSTS — Render force déjà HTTPS, on l'indique aux navigateurs
  hsts: {
    maxAge:            31536000,  // 1 an
    includeSubDomains: true,
    preload:           true,
  },
}));

// ── Permissions-Policy (absent de Helmet v8 — ajout manuel) ──
app.use((_req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'usb=()',
      'fullscreen=(self)',
      'payment=(self)',
    ].join(', ')
  );
  next();
});

app.use(cors({
  origin: (origin, cb) => {
    // Sans origin (requête locale ou same-origin) → OK
    if (!origin) return cb(null, true);

    // Origines explicitement autorisées
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);

    // Accepter toutes les URLs Vercel
    if (origin.includes('.vercel.app')) return cb(null, true);

    cb(new Error('CORS: origine non autorisée : ' + origin));
  },
  credentials: true,
}));

app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// ══════════════════════════════════════════════════════════
// RATE LIMITERS
// ══════════════════════════════════════════════════════════
const limiterAuth = rateLimit({
  windowMs: 60_000, max: 10,
  message: { error: 'Trop de tentatives, réessayez dans 1 minute.' },
  standardHeaders: true, legacyHeaders: false,
});
const limiterContact = rateLimit({
  windowMs: 60_000, max: 5,
  message: { error: 'Trop de messages envoyés, réessayez dans 1 minute.' },
});

// ══════════════════════════════════════════════════════════
// MIDDLEWARES JWT
// ══════════════════════════════════════════════════════════
/**
 * Vérifie le token Bearer dans Authorization.
 * Injecte req.user = { id, role } si valide.
 */
function requireAuth(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant — authentification requise.' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide ou expiré. Reconnectez-vous.' });
  }
}

/**
 * requireAuth + role admin obligatoire.
 * err est transmis à next() et non géré ici pour éviter une double réponse HTTP.
 */
function requireAdmin(req, res, next) {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé — droits administrateur requis.' });
    }
    next();
  });
}

/**
 * Vérifie que req.user.id === parseInt(req.params.id), ou que c'est un admin.
 * Empêche l'IDOR : un client ne peut pas accéder/modifier le compte d'un autre.
 */
function requireOwnerOrAdmin(req, res, next) {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    const targetId = parseInt(req.params.id);
    if (req.user?.role === 'admin' || req.user?.id === targetId) {
      return next();
    }
    return res.status(403).json({ error: 'Accès refusé — vous ne pouvez modifier que votre propre compte.' });
  });
}

// ══════════════════════════════════════════════════════════
// RESEND
// ══════════════════════════════════════════════════════════
const resend = new Resend(process.env.RESEND_API_KEY);

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g,
    c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
  );
}

async function sendMail({ to, subject, html, attachments = [] }) {
  if (!process.env.RESEND_API_KEY) { console.warn('⚠  sendMail : RESEND_API_KEY manquant'); return; }
  try {
    const from = process.env.RESEND_FROM || 'X3COM <onboarding@resend.dev>';
    const dest = to || process.env.MAIL_DESTINATAIRE;
    const { data, error } = await resend.emails.send({ from, to: Array.isArray(dest) ? dest : [dest], subject, html, attachments });
    if (error) console.error('✗ Resend:', JSON.stringify(error));
    else       console.log(`✉  Mail → ${dest} (${data.id})`);
  } catch (err) { console.error('✗ sendMail:', err.message); }
}

// ══════════════════════════════════════════════════════════
// GET /stats — ADMIN UNIQUEMENT : tableau de bord statistiques
// ══════════════════════════════════════════════════════════
app.get('/stats', requireAdmin, async (req, res) => {
  try {
    const stats = {};

    const { data: commandes, error: errCmd } = await supabase
      .from('commandes')
      .select('statut, prix');
    if (!errCmd) {
      stats.commandes = {
        total: commandes.length,
        par_statut: {
          confirmee: commandes.filter(c => c.statut === 'confirmee').length,
          en_attente: commandes.filter(c => c.statut === 'en_attente').length,
          annulee: commandes.filter(c => c.statut === 'annulee').length,
          remboursee: commandes.filter(c => c.statut === 'remboursee').length,
        },
        revenus_total: commandes
          .filter(c => c.statut === 'confirmee')
          .reduce((sum, c) => sum + (c.prix || 0), 0),
      };
    }

    const { data: rdvs, error: errRdv } = await supabase
      .from('rdv')
      .select('statut');
    if (!errRdv) {
      stats.rdv = {
        total: rdvs.length,
        par_statut: {
          en_attente: rdvs.filter(r => r.statut === 'en_attente').length,
          confirme: rdvs.filter(r => r.statut === 'confirme').length,
          annule: rdvs.filter(r => r.statut === 'annule').length,
        },
      };
    }

    const { data: users, error: errUsers } = await supabase
      .from('utilisateurs')
      .select('id, role');
    if (!errUsers) {
      stats.utilisateurs = {
        total: users.length,
        admins: users.filter(u => u.role === 'admin').length,
        clients: users.filter(u => u.role === 'client').length,
      };
    }

    const { data: offres, error: errOffres } = await supabase
      .from('offres')
      .select('id, nom, populaire')
      .eq('populaire', true);
    if (!errOffres) {
      stats.offres_populaires = offres.length;
    }

    stats.timestamp = new Date().toISOString();
    res.json(stats);
  } catch (err) {
    console.error('Erreur stats :', err);
    res.status(500).json({ error: 'Erreur serveur stats.' });
  }
});

// ══════════════════════════════════════════════════════════
// GET /diagnostic — ADMIN UNIQUEMENT
// ══════════════════════════════════════════════════════════
app.get('/diagnostic', requireAdmin, async (req, res) => {
  const rapport = { timestamp: new Date().toISOString(), checks: {} };

  rapport.checks.env = {
    SUPABASE_URL:         process.env.SUPABASE_URL         ? '✓ présente' : '✗ MANQUANTE',
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? `✓ présente (${process.env.SUPABASE_SERVICE_KEY.length} chars)` : '✗ MANQUANTE',
    STRIPE_SECRET_KEY:    process.env.STRIPE_SECRET_KEY    ? '✓ présente' : '✗ MANQUANTE',
    RESEND_API_KEY:       process.env.RESEND_API_KEY       ? '✓ présente' : '✗ MANQUANTE',
    JWT_SECRET:           process.env.JWT_SECRET           ? '✓ présente' : '✗ MANQUANTE',
    FRONTEND_URL:         process.env.FRONTEND_URL         || '(défaut: http://localhost:4200)',
  };

  try {
    const { data, error, status } = await supabase.from('offres').select('id, nom').limit(3);
    rapport.checks.offres = error
      ? { ok: false, status, message: error.message }
      : { ok: true, count: data.length, exemples: data.map(o => o.nom) };
  } catch (e) { rapport.checks.offres = { ok: false, exception: e.message }; }

  try {
    const { data, error, status } = await supabase.from('utilisateurs').select('id, email').limit(1);
    rapport.checks.utilisateurs = error
      ? { ok: false, status, message: error.message }
      : { ok: true, count: data.length };
  } catch (e) { rapport.checks.utilisateurs = { ok: false, exception: e.message }; }

  try {
    const { data, error, status } = await supabase.from('commandes').select('id').limit(1);
    rapport.checks.commandes = error
      ? { ok: false, status, message: error.message }
      : { ok: true, count: data.length };
  } catch (e) { rapport.checks.commandes = { ok: false, exception: e.message }; }

  const toutOk = Object.values(rapport.checks).every(c => c.ok !== false);
  rapport.résumé = toutOk ? '✓ Tout fonctionne' : '✗ Des erreurs ont été détectées';

  res.json(rapport);
});


// ══════════════════════════════════════════════════════════
// POST /contact — PUBLIC (page de présentation)
// ══════════════════════════════════════════════════════════
app.post('/contact', limiterContact, upload.single('fichier'), async (req, res) => {
  const { type, nom, email, tel, ville, adresse, besoins: besoinsRaw, operateur, message } = req.body;
  if (!nom || !email) return res.status(400).json({ error: 'Nom et e-mail sont requis' });

  const besoins = typeof besoinsRaw === 'string'
    ? (() => { try { return JSON.parse(besoinsRaw); } catch { return []; } })()
    : (besoinsRaw || []);

  const s = {
    type: escHtml(type), nom: escHtml(nom), email: escHtml(email),
    tel: escHtml(tel), ville: escHtml(ville), adresse: escHtml(adresse),
    operateur: escHtml(operateur), message: escHtml(message),
  };
  const besoinsHtml = Array.isArray(besoins) && besoins.length
    ? `<ul>${besoins.map(b => `<li>${escHtml(b)}</li>`).join('')}</ul>`
    : '<p><em>Aucun besoin sélectionné</em></p>';

  await sendMail({
    subject: `[X3COM Contact] ${s.nom} — ${s.type || 'client'}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <div style="background:#1a365d;padding:24px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:22px">📩 Nouveau message — X3COM</h1>
        </div>
        <div style="padding:28px;background:#f8fafc">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#64748b;width:140px;font-weight:bold">Type</td><td style="padding:8px 0">${s.type||'—'}</td></tr>
            <tr style="background:#fff"><td style="padding:8px 0;color:#64748b;font-weight:bold">Nom</td><td style="padding:8px 0"><strong>${s.nom}</strong></td></tr>
            <tr><td style="padding:8px 0;color:#64748b;font-weight:bold">E-mail</td><td style="padding:8px 0"><a href="mailto:${s.email}">${s.email}</a></td></tr>
            <tr style="background:#fff"><td style="padding:8px 0;color:#64748b;font-weight:bold">Téléphone</td><td style="padding:8px 0">${s.tel||'—'}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;font-weight:bold">Ville</td><td style="padding:8px 0">${s.ville||'—'}</td></tr>
            <tr style="background:#fff"><td style="padding:8px 0;color:#64748b;font-weight:bold">Adresse</td><td style="padding:8px 0">${s.adresse||'—'}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;font-weight:bold">Opérateur</td><td style="padding:8px 0">${s.operateur||'—'}</td></tr>
          </table>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
          <h3 style="color:#1a365d;margin:0 0 8px">🔧 Besoins</h3>
          ${besoinsHtml}
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
          <h3 style="color:#1a365d;margin:0 0 8px">💬 Message</h3>
          <div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:16px;color:#374151;white-space:pre-wrap">${s.message||'(aucun message)'}</div>
          <p style="margin-top:24px;font-size:12px;color:#94a3b8;text-align:center">Reçu le ${new Date().toLocaleString('fr-FR')}</p>
        </div>
      </div>`,
    attachments: req.file ? [{ filename: req.file.originalname, content: req.file.buffer }] : [],
  });
  res.json({ ok: true });
});


// ══════════════════════════════════════════════════════════
// POST /login — PUBLIC
// ══════════════════════════════════════════════════════════
app.post('/login', limiterAuth, async (req, res) => {
  const { email, motDePasse } = req.body;
  if (!email || !motDePasse) return res.status(400).json({ error: 'Email et mot de passe requis' });

  try {
    const { data: rows, error } = await supabase
      .from('utilisateurs').select('*').eq('email', email).limit(1);

    if (error) return res.status(500).json({ error: `Erreur base de données : ${error.message}` });
    if (!rows?.length) return res.status(401).json({ error: 'Identifiants incorrects' });

    const row  = rows[0];
    const hash = row.motdepasse ?? '';
    let valide = false;

    if (hash.startsWith('$2'))           valide = await bcrypt.compare(motDePasse, hash);
    else if (hash.startsWith('pbkdf2$')) valide = await verifierPBKDF2(motDePasse, hash);
    else {
      const { createHash } = require('crypto');
      valide = createHash('sha256').update(motDePasse).digest('hex') === hash;
    }

    if (!valide) return res.status(401).json({ error: 'Identifiants incorrects' });

    // Migration transparente : les comptes importés avec SHA-256 ou PBKDF2 passent à bcrypt à la prochaine connexion
    if (!hash.startsWith('$2')) {
      const h2 = await bcrypt.hash(motDePasse, 12);
      await supabase.from('utilisateurs').update({ motdepasse: h2 }).eq('id', row.id);
    }

    const token = jwt.sign(
      { id: row.id, role: row.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({ utilisateur: utilisateurToAngular(row), token });
  } catch (err) {
    res.status(500).json({ error: `Erreur serveur : ${err.message}` });
  }
});


// ══════════════════════════════════════════════════════════
// POST /register — PUBLIC
// ══════════════════════════════════════════════════════════
app.post('/register', limiterAuth, async (req, res) => {
  const { email, motDePasse, prenom, nom } = req.body;
  if (!email || !motDePasse || !prenom)
    return res.status(400).json({ error: 'Email, mot de passe et prénom requis' });
  if (!isValidEmail(email))
    return res.status(400).json({ error: 'Adresse email invalide' });
  if (String(motDePasse).length < 8)
    return res.status(400).json({ error: 'Mot de passe trop court (8 caractères minimum)' });

  try {
    const { data: existants, error: errSelect } = await supabase
      .from('utilisateurs').select('id').eq('email', email).limit(1);

    if (errSelect) return res.status(500).json({ error: `Erreur base de données : ${errSelect.message}` });
    if (existants?.length > 0) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

    const hash = await bcrypt.hash(motDePasse, 12);

    const { data: created, error: errInsert } = await supabase
      .from('utilisateurs')
      .insert({ email, motdepasse: hash, prenom, nom: nom || '', role: 'client' })
      .select().single();

    if (errInsert) return res.status(500).json({ error: `Erreur création compte : ${errInsert.message}` });

    const token = jwt.sign(
      { id: created.id, role: created.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`✓ Nouveau compte créé : ${email}`);
    return res.status(201).json({ utilisateur: utilisateurToAngular(created), token });
  } catch (err) {
    res.status(500).json({ error: `Erreur serveur : ${err.message}` });
  }
});

// POST /refresh-token — PUBLIC : renouveler un token JWT expiré
app.post('/refresh-token', limiterAuth, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token requis' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });

    if (!decoded?.id) {
      return res.status(401).json({ error: 'Token invalide' });
    }

    const { data: user, error: userError } = await supabase
      .from('utilisateurs')
      .select('id, role')
      .eq('id', decoded.id)
      .single();

    if (userError || !user) {
      return res.status(401).json({ error: 'Utilisateur non trouvé' });
    }

    const newToken = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token: newToken });
  } catch (err) {
    res.status(401).json({ error: 'Token invalide ou expiré, reconnectez-vous.' });
  }
});

// ══════════════════════════════════════════════════════════
// POST /forgot-password — PUBLIC
// ══════════════════════════════════════════════════════════
app.post('/forgot-password', limiterAuth, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email requis' });
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Adresse email invalide' });

  try {
    const { data: users, error: userError } = await supabase
      .from('utilisateurs')
      .select('id, email, prenom')
      .eq('email', email)
      .limit(1);

    if (userError) return res.status(500).json({ error: userError.message });

    const utilisateur = users?.[0];
    const tokenExpiresIn = 60;

    if (utilisateur?.id) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + tokenExpiresIn * 60 * 1000).toISOString();

      await supabase.from('password_resets').delete().eq('utilisateur_id', utilisateur.id).is('used_at', null);
      const { error: insertError } = await supabase.from('password_resets').insert({
        utilisateur_id: utilisateur.id,
        token,
        expires_at: expiresAt,
      });

      if (insertError) return res.status(500).json({ error: insertError.message });

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
      const resetUrl = `${frontendUrl}/mot-de-passe-oublie?token=${encodeURIComponent(token)}`;

      await sendMail({
        to: utilisateur.email,
        subject: 'Réinitialisation de votre mot de passe X3COM',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
            <div style="background:#1a365d;padding:24px;text-align:center">
              <h1 style="color:#fff;margin:0;font-size:22px">Réinitialisation du mot de passe</h1>
            </div>
            <div style="padding:28px;background:#f8fafc">
              <p style="color:#374151;font-size:15px;margin:0 0 16px">Bonjour${utilisateur.prenom ? ' <strong>' + escHtml(utilisateur.prenom) + '</strong>' : ''},</p>
              <p style="color:#374151;font-size:15px;margin:0 0 24px">Cliquez sur le lien ci-dessous pour définir un nouveau mot de passe. Ce lien expire dans 60 minutes.</p>
              <p style="margin:0 0 24px"><a href="${resetUrl}" style="display:inline-block;background:#00B4D8;color:#fff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:bold">Réinitialiser mon mot de passe</a></p>
              <p style="font-size:12px;color:#64748b;word-break:break-all">${resetUrl}</p>
            </div>
          </div>`,
      });
    }

    return res.json({
      message: 'Si un compte existe avec cet e-mail, un lien de réinitialisation a été envoyé.',
      token_expires_in: tokenExpiresIn,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});


// ══════════════════════════════════════════════════════════
// POST /reset-password — PUBLIC
// ══════════════════════════════════════════════════════════
app.post('/reset-password', limiterAuth, async (req, res) => {
  const { token, new_password, newPassword } = req.body;
  const motDePasse = new_password || newPassword;

  if (!token || !motDePasse) {
    return res.status(400).json({ error: 'Token et nouveau mot de passe requis' });
  }
  if (motDePasse.length < 8) {
    return res.status(400).json({ error: 'Mot de passe trop court (8 caractères minimum)' });
  }

  try {
    const { data: resets, error: resetError } = await supabase
      .from('password_resets')
      .select('id, utilisateur_id, expires_at, used_at')
      .eq('token', token)
      .limit(1);

    if (resetError) return res.status(500).json({ error: resetError.message });

    const reset = resets?.[0];
    if (!reset) return res.status(400).json({ error: 'Lien de réinitialisation invalide' });
    if (reset.used_at) return res.status(400).json({ error: 'Ce lien a déjà été utilisé' });
    if (new Date(reset.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'Le lien de réinitialisation a expiré' });
    }

    const hash = await bcrypt.hash(motDePasse, 12);
    const { error: updateUserError } = await supabase
      .from('utilisateurs')
      .update({ motdepasse: hash })
      .eq('id', reset.utilisateur_id);

    if (updateUserError) return res.status(500).json({ error: updateUserError.message });

    const { error: usedError } = await supabase
      .from('password_resets')
      .update({ used_at: new Date().toISOString() })
      .eq('id', reset.id);

    if (usedError) return res.status(500).json({ error: usedError.message });

    await supabase.from('password_resets').delete().eq('utilisateur_id', reset.utilisateur_id).is('used_at', null);

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});


// ══════════════════════════════════════════════════════════
// GET /verify-admin/:id — AUTHENTIFIÉ
// ══════════════════════════════════════════════════════════
app.get('/verify-admin/:id', requireAuth, async (req, res) => {
  if (req.user.id !== parseInt(req.params.id)) {
    return res.status(403).json({ error: 'Non autorisé' });
  }
  try {
    const { data: user, error } = await supabase
      .from('utilisateurs').select('role').eq('id', req.params.id).single();
    if (error || !user) return res.status(404).json({ error: 'Introuvable' });
    return res.json({ role: user.role || 'client' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ══════════════════════════════════════════════════════════
// PATCH /utilisateurs/:id/password — PROPRIÉTAIRE UNIQUEMENT
// ══════════════════════════════════════════════════════════
app.patch('/utilisateurs/:id/password', requireOwnerOrAdmin, async (req, res) => {
  const { motDePasse } = req.body;
  if (!motDePasse) return res.status(400).json({ error: 'Mot de passe requis' });
  if (motDePasse.length < 8) return res.status(400).json({ error: 'Mot de passe trop court (8 caractères minimum)' });
  try {
    const hash = await bcrypt.hash(motDePasse, 12);
    const { error } = await supabase.from('utilisateurs').update({ motdepasse: hash }).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ══════════════════════════════════════════════════════════
// GET /utilisateurs — ADMIN UNIQUEMENT
// ══════════════════════════════════════════════════════════
app.get('/utilisateurs', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('utilisateurs').select('id, email, prenom, nom, role, datecreation, telephone, adresse, ville, codepostal');
    if (error) throw new Error(error.message);
    res.json((data || []).map(utilisateurToAngular));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /utilisateurs/:id — propriétaire ou admin peuvent voir le profil
app.get('/utilisateurs/:id', requireOwnerOrAdmin, async (req, res) => {
  const userId = parseInt(req.params.id);
  try {
    const { data, error } = await supabase
      .from('utilisateurs')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ error: 'Utilisateur non trouvé' });
      return res.status(500).json({ error: error.message });
    }
    res.json(utilisateurToAngular(data));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /utilisateurs/recherche?q=... — admin : rechercher des utilisateurs par nom/email
app.get('/utilisateurs/recherche', requireAdmin, async (req, res) => {
  const q = req.query.q ? String(req.query.q).trim().toLowerCase() : '';
  
  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'Minimum 2 caractères pour la recherche' });
  }

  try {
    const { data, error } = await supabase
      .from('utilisateurs')
      .select('*')
      .or(`email.ilike.%${q}%,prenom.ilike.%${q}%,nom.ilike.%${q}%`)
      .limit(20);

    if (error) throw new Error(error.message);
    res.json((data || []).map(utilisateurToAngular));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /utilisateurs/:id — PROPRIÉTAIRE UNIQUEMENT (ou admin)
app.patch('/utilisateurs/:id', requireOwnerOrAdmin, async (req, res) => {
  const { motDePasse, motdepasse, dateCreation, datecreation, role, id, ...raw } = req.body;

  const COLONNES_AUTORISEES = ['email', 'prenom', 'nom', 'telephone', 'adresse', 'ville', 'codepostal'];

  // Angular envoie les clés en camelCase ("codePostal") mais Supabase attend des colonnes en minuscules
  const champs = Object.fromEntries(
    Object.entries(raw)
      .filter(([k]) => COLONNES_AUTORISEES.includes(k.toLowerCase()))
      .map(([k, v]) => [k.toLowerCase(), v])
  );

  // Seul un admin peut changer le rôle
  if (role && req.user?.role === 'admin' && ['client', 'admin'].includes(role)) {
    champs.role = role;
  }

  if (Object.keys(champs).length === 0)
    return res.status(400).json({ error: 'Aucun champ modifiable fourni.' });

  try {
    const { data, error } = await supabase
      .from('utilisateurs').update(champs).eq('id', req.params.id)
      .select('id, email, prenom, nom, role, datecreation, telephone, adresse, ville, codepostal').single();
    if (error) throw new Error(error.message);
    res.json(utilisateurToAngular(data));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /utilisateurs/:id — PROPRIÉTAIRE UNIQUEMENT (ou admin)
app.delete('/utilisateurs/:id', requireOwnerOrAdmin, async (req, res) => {
  try {
    // Pas de ON DELETE CASCADE sur la FK commandes.utilisateurid — suppression manuelle obligatoire
    const { error: errorCommandes } = await supabase
      .from('commandes')
      .delete()
      .eq('utilisateurid', req.params.id);

    if (errorCommandes) throw new Error(errorCommandes.message);

    const { error } = await supabase.from('utilisateurs').delete().eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ══════════════════════════════════════════════════════════
// OFFRES — lecture publique, écriture admin uniquement
// /reordonner est déclaré avant /:id : Express matche les routes dans l'ordre de déclaration
// ══════════════════════════════════════════════════════════
app.get('/offres', async (req, res) => {
  try {
    let query = supabase.from('offres').select('*').order('ordre', { ascending: true, nullsFirst: false });
    if (req.query.profil) query = query.contains('profil', [req.query.profil]);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/offres', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase.from('offres').insert(req.body).select().single();
    if (error) throw new Error(error.message);
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/offres/reordonner', requireAdmin, async (req, res) => {
  try {
    const { ordre } = req.body;
    if (!Array.isArray(ordre)) return res.status(400).json({ error: 'ordre doit être un tableau' });
    const updates = ordre.map(({ id, ordre: o }) =>
      supabase.from('offres').update({ ordre: o }).eq('id', id)
    );
    await Promise.all(updates);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/offres/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('offres').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Offre introuvable' });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/offres/:id', requireAdmin, async (req, res) => {
  try {
    const { id, ...champs } = req.body;
    const { data, error } = await supabase.from('offres').update(champs).eq('id', req.params.id).select().single();
    if (error) throw new Error(error.message);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/offres/:id', requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase.from('offres').delete().eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ══════════════════════════════════════════════════════════
// COMMANDES
// ══════════════════════════════════════════════════════════

app.get('/commandes', requireAuth, async (req, res) => {
  try {
    let query = supabase.from('commandes').select('*');

    if (req.user.role === 'admin') {
      if (req.query.utilisateurId) {
        query = query.eq('utilisateurid', req.query.utilisateurId);
      }
    } else {
      query = query.eq('utilisateurid', req.user.id);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    res.json((data || []).map(commandeToAngular));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/commandes/:id', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('commandes').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Commande introuvable' });

    if (req.user.role !== 'admin' && data.utilisateurid !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    res.json(commandeToAngular(data));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/commandes/:id/pdf', requireAuth, async (req, res) => {
  try {
    const { data: commande, error } = await supabase.from('commandes').select('*').eq('id', req.params.id).single();
    if (error || !commande) return res.status(404).json({ error: 'Commande introuvable' });

    if (req.user.role !== 'admin' && commande.utilisateurid !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    const [{ data: utilisateur }, { data: offre }] = await Promise.all([
      supabase.from('utilisateurs').select('prenom, nom, email, adresse, ville, codepostal').eq('id', commande.utilisateurid).single(),
      supabase.from('offres').select('nom, description').eq('id', commande.offreid).single(),
    ]);

    const numeroFacture = creerNumeroFacture(commande.id);
    const montantTTC = parseFloat(commande.prix) || 0;

    if (!isFinite(montantTTC)) {
      console.error(`✗ Prix invalide pour commande ${commande.id}: ${commande.prix}`);
      return res.status(400).json({ error: `Prix invalide: ${commande.prix}` });
    }

    const montantHT = parseFloat((montantTTC / 1.20).toFixed(2));
    const montantTVA = parseFloat((montantTTC - montantHT).toFixed(2));

    // Extraire le nombre de logements des notes
    const notesMatch = commande.notes?.match(/(\d+)\s+logement/i);
    const nombreLogements = notesMatch ? parseInt(notesMatch[1]) : 1;

    const doc = new PDFDocument({ size: 'A4', margin: 40 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="facture-${numeroFacture}.pdf"`);
    doc.pipe(res);

    // ═══════════════════════════════════════════════════════
    // EN-TÊTE — ENTREPRISE ET CLIENT
    // ═══════════════════════════════════════════════════════

    // Infos entreprise (gauche)
    doc.fontSize(11).fillColor('#111827').text('SASU X3COM', 40, 40);
    doc.fontSize(9).fillColor('#6b7280')
      .text('5 IMPASSE DE LA COLOMBETTE, 31000 TOULOUSE', undefined)
      .text('Tél : 0621631141 | Email : ossama.bendriss@gmail.com', undefined);

    // Infos client (droite)
    doc.fontSize(11).fillColor('#111827').text(`${utilisateur?.prenom || ''} ${utilisateur?.nom || ''}`.trim() || '—', 360, 40);
    doc.fontSize(9).fillColor('#6b7280')
      .text(utilisateur?.adresse || '—', 360)
      .text([utilisateur?.codepostal, utilisateur?.ville].filter(Boolean).join(' ') || '—', undefined)
      .text(utilisateur?.email || '—', undefined);

    doc.moveDown(2);

    // Ligne séparatrice
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#e5e7eb');
    doc.moveDown(1);

    // ═══════════════════════════════════════════════════════
    // FACTURE
    // ═══════════════════════════════════════════════════════

    doc.fontSize(24).fillColor('#1a365d').text('Facture', 40);
    doc.moveDown(1);

    // Infos facture
    const infosY = doc.y;
    doc.fontSize(9).fillColor('#6b7280')
      .text('Numéro', 40, infosY)
      .text('N° Commande', 300, infosY)
      .text('Date', 40, infosY + 18);

    doc.fontSize(9).fillColor('#111827')
      .text(numeroFacture, 130, infosY)
      .text(commande.numero_commande || creerNumeroCommande(commande.id, commande.datepaiement || commande.datecreation || new Date()), 390, infosY)
      .text(formaterDateFR(commande.datepaiement || commande.datecreation), 130, infosY + 18);

    doc.moveDown(2);

    // ═══════════════════════════════════════════════════════
    // TABLEAU DÉTAILS
    // ═══════════════════════════════════════════════════════

    const tableTop = doc.y;
    const cols = { desc: 40, lgt: 335, pu: 378, ht: 430, tva: 492 };
    const colWidths = { desc: 293, lgt: 41, pu: 50, ht: 60, tva: 69 };

    // En-tête du tableau
    doc.fontSize(9).fillColor('#ffffff').fillAndStroke('#1a365d');
    doc.rect(40, tableTop, 525, 20).fill();

    doc.fillColor('#ffffff')
      .text('Description', cols.desc + 2, tableTop + 4, { width: colWidths.desc, lineBreak: false })
      .text('Lgt', cols.lgt + 2, tableTop + 4, { width: colWidths.lgt, align: 'center', lineBreak: false })
      .text('P.U. HT', cols.pu + 2, tableTop + 4, { width: colWidths.pu, align: 'right', lineBreak: false })
      .text('Montant HT', cols.ht + 2, tableTop + 4, { width: colWidths.ht, align: 'right', lineBreak: false })
      .text('TVA', cols.tva + 2, tableTop + 4, { width: colWidths.tva, align: 'right', lineBreak: false });

    // Ligne produit
    let rowY = tableTop + 22;
    const lineHeight = 24;

    doc.fontSize(9).fillColor('#111827').fillAndStroke('#e5e7eb');
    doc.rect(40, rowY, 525, lineHeight).stroke();

    const descriptionArticle = offre?.nom || 'Prestation';
    const prixUnitaire = parseFloat((montantTTC / nombreLogements).toFixed(2));

    doc.fillColor('#111827')
      .text(descriptionArticle, cols.desc + 2, rowY + 7, { width: colWidths.desc, lineBreak: false })
      .text(String(nombreLogements), cols.lgt + 2, rowY + 7, { width: colWidths.lgt, align: 'center', lineBreak: false })
      .text(`${prixUnitaire.toFixed(2)} €`, cols.pu + 2, rowY + 7, { width: colWidths.pu, align: 'right', lineBreak: false })
      .text(`${montantHT.toFixed(2)} €`, cols.ht + 2, rowY + 7, { width: colWidths.ht, align: 'right', lineBreak: false })
      .text(`${montantTVA.toFixed(2)} €`, cols.tva + 2, rowY + 7, { width: colWidths.tva, align: 'right', lineBreak: false });

    rowY += lineHeight + 2;

    // Ligne DOE
    doc.fontSize(9).fillColor('#111827').fillAndStroke('#f3f4f6');
    doc.rect(40, rowY, 525, 20).stroke();

    doc.fillColor('#111827')
      .text('Partie DOE —  Remise des documents pour l\'exploitation du Réseau', cols.desc + 2, rowY + 4, { width: colWidths.desc, lineBreak: false })
      .text('—', cols.lgt + 2, rowY + 4, { width: colWidths.lgt, align: 'center', lineBreak: false })
      .text('—', cols.pu + 2, rowY + 4, { width: colWidths.pu, align: 'right', lineBreak: false })
      .text('0,00 €', cols.ht + 2, rowY + 4, { width: colWidths.ht, align: 'right', lineBreak: false })
      .text('0,00 €', cols.tva + 2, rowY + 4, { width: colWidths.tva, align: 'right', lineBreak: false });

    doc.moveDown(2);

    // ═══════════════════════════════════════════════════════
    // TOTAUX — GROUPÉS
    // ═══════════════════════════════════════════════════════

    const totalsBoxY = doc.y;

    // Draw background box
    doc.fillColor('#1a365d').rect(360, totalsBoxY, 205, 75).fill();

    // Draw content - using fixed x positions
    doc.fontSize(9).fillColor('#ffffff');

    // Total HT
    doc.text('Total HT', 370, totalsBoxY + 8);
    doc.text(`${montantHT.toFixed(2)} €`, 470, totalsBoxY + 8);

    // Total TVA
    doc.text('Total TVA', 370, totalsBoxY + 26);
    doc.text(`${montantTVA.toFixed(2)} €`, 470, totalsBoxY + 26);

    // Total TTC
    doc.fontSize(9).fillColor('#ffffff');
    doc.text('Total TTC', 370, totalsBoxY + 44);
    doc.fontSize(12).fillColor('#00B4D8');
    doc.text(`${montantTTC.toFixed(2)} €`, 470, totalsBoxY + 44);

    // Move cursor below the box
    doc.y = totalsBoxY + 80;

    doc.moveDown(4);

    // Net à payer
    doc.fontSize(10).fillColor('#111827')
      .text(`Net à payer : ${montantTTC.toFixed(2)} €`, 360);

    doc.moveDown(1.5);

    // ═══════════════════════════════════════════════════════
    // MENTIONS LÉGALES
    // ═══════════════════════════════════════════════════════

    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke('#e5e7eb');
    doc.moveDown(1);

    doc.fontSize(8).fillColor('#6b7280')
      .text('En cas de retard de paiement une pénalité égale à 3 fois le taux d\'intérêt légal sera exigible (Décret 2009-138). Pour les professionnels, une indemnité minimum forfaitaire de 40 euros pour frais de recouvrement sera exigible (Décret 2012-1115).', 40, doc.y, { width: 515 });

    doc.moveDown(0.6);
    doc.fontSize(8).fillColor('#6b7280').text('Siren : 909959843 - APE : 7112B - N°TVA : FR05909959843', 40, doc.y, { width: 515, align: 'center' });

    doc.end();
  } catch (err) {
    console.error('✗ Erreur PDF:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/commandes/:id', requireAdmin, async (req, res) => {
  const CHAMPS_AUTORISES = ['statut', 'adresselivraison', 'commentaire', 'dateprevue'];

  // Angular envoie les clés en camelCase — normalisation en minuscules pour Supabase
  const champs = Object.fromEntries(
    Object.entries(req.body)
      .filter(([k]) => CHAMPS_AUTORISES.includes(k.toLowerCase()))
      .map(([k, v]) => [k.toLowerCase(), v])
  );

  if (Object.keys(champs).length === 0)
    return res.status(400).json({ error: 'Aucun champ modifiable fourni.' });
  try {
    const { data, error } = await supabase
      .from('commandes').update(champs).eq('id', req.params.id).select().single();
    if (error) throw new Error(error.message);
    res.json(commandeToAngular(data));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/commandes/:id', requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase.from('commandes').delete().eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/commandes/:id/annuler', requireAuth, async (req, res) => {
  try {
    const { data: commande, error: fetchErr } = await supabase
      .from('commandes').select('*').eq('id', req.params.id).single();
    if (fetchErr || !commande) return res.status(404).json({ error: 'Commande introuvable' });

    if (req.user.role !== 'admin' && commande.utilisateurid !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé — ce n\'est pas votre commande.' });
    }

    const annulables = ['en_attente', 'paiement_confirme'];
    if (!annulables.includes(commande.statut))
      return res.status(400).json({ error: `Statut "${commande.statut}" non annulable` });

    let refundId = null;
    if (commande.stripesessionid) {
      try {
        const session = await stripe.checkout.sessions.retrieve(commande.stripesessionid);
        if (session.payment_intent) {
          const refund = await stripe.refunds.create({ payment_intent: session.payment_intent });
          refundId = refund.id;
          console.log('✓ Remboursement Stripe : ' + refundId);
        }
      } catch (stripeErr) {
        const alreadyRefunded = stripeErr.message?.includes('already been refunded');
        if (alreadyRefunded) {
          console.log('⚠ Déjà remboursé, on continue l\'annulation en base.');
        } else {
          console.error('✗ Stripe refund:', stripeErr.message);
          return res.status(502).json({ error: 'Une erreur est survenue.' });
        }
      }
    }

    const { data: updated, error: updateErr } = await supabase
      .from('commandes').update({ statut: 'annulee', dateannulation: new Date().toISOString() })
      .eq('id', req.params.id).select().single();
    if (updateErr) throw new Error(updateErr.message);

    const emailClient = req.body.emailClient || null;
    if (emailClient) {
      await sendMail({
        to: emailClient,
        subject: `🔄 Annulation confirmée — ${escHtml(commande.notes || 'votre commande')}`,
        html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
  <div style="background:#1a365d;padding:24px;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:22px">🔄 Annulation confirmée — X3COM</h1>
  </div>
  <div style="padding:28px;background:#f8fafc">
    <p style="color:#374151;font-size:15px;margin:0 0 16px">Votre commande <strong>${escHtml(commande.notes || '')}</strong> a bien été annulée.</p>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px 0;color:#64748b;width:160px;font-weight:bold">Commande</td><td style="padding:8px 0"><strong>${escHtml(commande.notes || '—')}</strong></td></tr>
      <tr style="background:#fff"><td style="padding:8px 0;color:#64748b;font-weight:bold">Montant remboursé</td><td style="padding:8px 0"><strong style="color:#1a365d">${commande.prix} €</strong></td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-weight:bold">Délai</td><td style="padding:8px 0">5-10 jours ouvrés</td></tr>
    </table>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
    <p style="color:#374151;font-size:14px;margin:0">Pour toute question, contactez-nous à <a href="mailto:contact@x3com.com">contact@x3com.com</a>.</p>
    <p style="margin-top:24px;font-size:12px;color:#94a3b8;text-align:center">Reçu le ${new Date().toLocaleString('fr-FR')}</p>
  </div>
</div>`,
      });
    }

    res.json({ ...commandeToAngular(updated), refundId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════════════════════════
// POST /create-checkout-session — AUTHENTIFIÉ
// ══════════════════════════════════════════════════════════
app.post('/create-checkout-session', requireAuth, async (req, res) => {
  const { offreId, prix, nom, emailClient, prenom, nomClient, telephone } = req.body;
  if (!offreId || !prix || !nom)
    return res.status(400).json({ error: 'offreId, prix et nom sont obligatoires' });

  const utilisateurId = req.user.id;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{ price_data: { currency: 'eur', unit_amount: Math.round(prix * 100), product_data: { name: nom, description: `X3COM — Offre #${offreId}` } }, quantity: 1 }],
      metadata: {
        offreId:       String(offreId),
        utilisateurId: String(utilisateurId),
        nomOffre:      nom,
        prix:          String(prix),
        emailClient:   emailClient || '',
        prenom:        prenom      || '',
        nomClient:     nomClient   || '',
        telephone:     telephone   || '',
      },
      customer_email: emailClient || undefined,
      success_url: `${process.env.FRONTEND_URL || 'http://localhost:4200'}/commande?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.FRONTEND_URL || 'http://localhost:4200'}/paiement?annule=1`,
    });
    res.json({ url: session.url, sessionId: session.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ══════════════════════════════════════════════════════════
// GET /session/:sessionId — AUTHENTIFIÉ
// ══════════════════════════════════════════════════════════
app.get('/session/:sessionId', requireAuth, async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);

    const sessionUserId = parseInt(session.metadata?.utilisateurId);
    if (req.user.role !== 'admin' && sessionUserId !== req.user.id) {
      return res.status(403).json({ error: 'Accès refusé' });
    }

    res.json({ status: session.payment_status, customerEmail: session.customer_details?.email, metadata: session.metadata });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ══════════════════════════════════════════════════════════
// POST /webhook — Stripe (PUBLIC — vérifié par signature)
// ══════════════════════════════════════════════════════════
app.post('/webhook', async (req, res) => {
  const sig    = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(400).send('STRIPE_WEBHOOK_SECRET manquant');

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('✗ Webhook signature invalide:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`✓ Webhook : ${event.type}`);

  if (event.type === 'checkout.session.completed') {
    const session     = event.data.object;
    const meta        = session.metadata || {};
    const emailClient = session.customer_details?.email || meta.emailClient || null;

    try {
      const datePaiement = new Date().toISOString();
      const { data: created, error } = await supabase.from('commandes').insert({
        utilisateurid:   parseInt(meta.utilisateurId) || null,
        offreid:         parseInt(meta.offreId),
        statut:          'paiement_confirme',
        prix:            parseFloat(meta.prix),
        notes:           meta.nomOffre,
        stripesessionid: session.id,
        datepaiement:    datePaiement,
      }).select('id').single();
      if (error) console.error('✗ Supabase commande:', error.message);
      else {
        const numeroCommande = creerNumeroCommande(created.id, datePaiement);
        const { error: numeroError } = await supabase
          .from('commandes')
          .update({ numero_commande: numeroCommande })
          .eq('id', created.id);
        if (numeroError) console.error('✗ Numéro commande:', numeroError.message);
        else console.log(`✓ Commande enregistrée (${numeroCommande})`);
      }
    } catch (err) { console.error('✗ Supabase:', err.message); }

    const prenomClient = meta.prenom    || '';
    const nomClient    = meta.nomClient || '';
    const telClient    = meta.telephone || '—';
    const nomComplet   = [prenomClient, nomClient].filter(Boolean).join(' ') || '—';

    if (emailClient) {
      await sendMail({
        to: emailClient,
        subject: `✅ Confirmation — ${escHtml(meta.nomOffre)}`,
        html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
  <div style="background:#1a365d;padding:24px;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:22px">✅ Paiement confirmé — X3COM</h1>
  </div>
  <div style="padding:28px;background:#f8fafc">
    <p style="color:#374151;font-size:15px;margin:0 0 24px">Bonjour${prenomClient ? ' <strong>' + escHtml(prenomClient) + '</strong>' : ''},</p>
    <p style="color:#374151;font-size:15px;margin:0 0 24px">Nous avons bien reçu votre paiement. Voici le récapitulatif de votre commande :</p>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px 0;color:#64748b;width:160px;font-weight:bold">Prestation</td><td style="padding:8px 0"><strong>${escHtml(meta.nomOffre)}</strong></td></tr>
      <tr style="background:#fff"><td style="padding:8px 0;color:#64748b;font-weight:bold">Montant</td><td style="padding:8px 0"><strong style="color:#1a365d">${escHtml(meta.prix)} €</strong></td></tr>
    </table>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
    <p style="color:#374151;font-size:14px;margin:0">Notre équipe prendra contact avec vous prochainement pour planifier l'intervention.</p>
    <p style="margin-top:24px;font-size:12px;color:#94a3b8;text-align:center">Reçu le ${new Date().toLocaleString('fr-FR')}</p>
  </div>
</div>`,
      });
    }

    await sendMail({
      to: process.env.MAIL_DESTINATAIRE,
      subject: `[X3COM Paiement] ${escHtml(meta.nomOffre)} — ${meta.prix} € — ${nomComplet}`,
      html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
  <div style="background:#1a365d;padding:24px;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:22px">💳 Nouveau paiement — X3COM</h1>
  </div>
  <div style="padding:28px;background:#f8fafc">
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px 0;color:#64748b;width:160px;font-weight:bold">Prestation</td><td style="padding:8px 0"><strong>${escHtml(meta.nomOffre)}</strong></td></tr>
      <tr style="background:#fff"><td style="padding:8px 0;color:#64748b;font-weight:bold">Montant</td><td style="padding:8px 0"><strong style="color:#1a365d">${escHtml(meta.prix)} €</strong></td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-weight:bold">Client</td><td style="padding:8px 0">${escHtml(nomComplet)}</td></tr>
      <tr style="background:#fff"><td style="padding:8px 0;color:#64748b;font-weight:bold">E-mail</td><td style="padding:8px 0"><a href="mailto:${emailClient || ''}">${emailClient || '—'}</a></td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-weight:bold">Téléphone</td><td style="padding:8px 0">${escHtml(telClient)}</td></tr>
    </table>
    <p style="margin-top:24px;font-size:12px;color:#94a3b8;text-align:center">Reçu le ${new Date().toLocaleString('fr-FR')}</p>
  </div>
</div>`,
    });
  }

  res.json({ received: true });
});


// ══════════════════════════════════════════════════════════
// GET /health — PUBLIC (monitoring)
// ══════════════════════════════════════════════════════════
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    stripe:   !!process.env.STRIPE_SECRET_KEY,
    resend:   !!process.env.RESEND_API_KEY,
    webhook:  !!process.env.STRIPE_WEBHOOK_SECRET,
    supabase: !!process.env.SUPABASE_URL,
  });
});

// ══════════════════════════════════════════════════════════
// NETTOYAGE AUTO — commandes annulées > 3 jours
// ══════════════════════════════════════════════════════════
async function nettoyerCommandesAnnulees() {
  const maintenant      = Date.now();
  const il_y_a_3_jours  = new Date(maintenant - 3 * 24 * 60 * 60 * 1000).toISOString();

  // Suppression : commandes annulées depuis plus de 3 jours
  const { data, error } = await supabase
    .from('commandes').delete()
    .eq('statut', 'annulee')
    .not('dateannulation', 'is', null)
    .lt('dateannulation', il_y_a_3_jours)
    .select('id');
  if (error) { console.error('✗ Nettoyage commandes annulées:', error.message); return; }
  if (data?.length > 0) console.log(`🗑 ${data.length} commande(s) annulée(s) supprimée(s)`);
}
nettoyerCommandesAnnulees();
setInterval(nettoyerCommandesAnnulees, 24 * 60 * 60 * 1000);


// ══════════════════════════════════════════════════════════
// RENDEZ-VOUS (RDV)
// ══════════════════════════════════════════════════════════

// GET /rdv/creneaux-pris — public : créneaux déjà réservés pour une date donnée
app.get('/rdv/creneaux-pris', async (req, res) => {
  const { date } = req.query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Paramètre date invalide (attendu : YYYY-MM-DD).' });
  }
  try {
    const { data: rdvs, error: errRdv } = await supabase
      .from('rdv')
      .select('heure')
      .eq('date', date)
      .neq('statut', 'annule');
    if (errRdv) throw errRdv;

    const heures = [...new Set(rdvs.map(r => r.heure))];
    res.json(heures);
  } catch (err) {
    console.error('Erreur creneaux-pris :', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// GET /rdv/creneaux-disponibles — public : retourne uniquement les créneaux libres pour une date
app.get('/rdv/creneaux-disponibles', async (req, res) => {
  const { date } = req.query;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Paramètre date invalide (attendu : YYYY-MM-DD).' });
  }

  // Rejeter les weekends côté serveur
  const [y, mo, d] = date.split('-').map(Number);
  const jourSemaine = new Date(y, mo - 1, d).getDay();
  if (jourSemaine === 0 || jourSemaine === 6) {
    return res.status(400).json({ error: 'Les rendez-vous ne sont pas disponibles le week-end.' });
  }

  try {
    const { data: rdvs, error: errRdv } = await supabase
      .from('rdv')
      .select('heure')
      .eq('date', date)
      .neq('statut', 'annule');
    if (errRdv) throw errRdv;

    const prises = new Set(rdvs.map(r => r.heure));

    // Créneaux de travail : 9h–18h, pas de 30 min
    const tousCreneaux = [];
    for (let h = 9; h < 18; h++) {
      tousCreneaux.push(`${String(h).padStart(2, '0')}:00`);
      tousCreneaux.push(`${String(h).padStart(2, '0')}:30`);
    }

    const disponibles = tousCreneaux.filter(c => !prises.has(c));
    res.json(disponibles);
  } catch (err) {
    console.error('Erreur creneaux-disponibles :', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// POST /rdv/reserve — conservé pour compatibilité, mais la réservation temporaire est désactivée
app.post('/rdv/reserve', async (req, res) => {
  const { date, heure, sessionId } = req.body;
  if (!date || !heure || !sessionId) {
    return res.status(400).json({ error: 'Paramètres requis : date, heure, sessionId.' });
  }

  res.status(410).json({ error: 'La réservation temporaire est désactivée. Le créneau est bloqué à la création du rendez-vous.' });
});

// DELETE /rdv/reserve/:sessionId — compatibilité : aucune réservation temporaire à annuler
app.delete('/rdv/reserve/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  if (!sessionId) {
    return res.status(400).json({ error: 'Paramètre sessionId requis.' });
  }

  res.json({ message: 'Aucune réservation temporaire n’est utilisée.' });
});

// POST /rdv — public : créer un RDV
app.post('/rdv', async (req, res) => {
  const { nom, email, telephone, adresse, date, heure, service, rubrique, notes } = req.body;
  if (!nom || !email || !telephone || !date || !heure) {
    return res.status(400).json({ error: 'Champs obligatoires manquants.' });
  }

  // new Date("2025-06-15") est interprété comme UTC minuit, ce qui décale d'un jour en UTC+2.
  // On extrait les parties YYYY-MM-DD manuellement pour rester en heure locale.
  const dateNormalisee = (() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    const d = new Date(date);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const j = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${j}`;
  })();

  // Validation côté serveur — le front peut être contourné
  const [y, mo, d2] = dateNormalisee.split('-').map(Number);
  const jourSemaine = new Date(y, mo - 1, d2).getDay();
  if (jourSemaine === 0 || jourSemaine === 6) {
    return res.status(400).json({ error: 'Les rendez-vous ne sont pas disponibles le week-end.' });
  }

  try {
    const { data, error } = await supabase.from('rdv').insert([{
      nom: nom.trim(),
      email: email.trim().toLowerCase(),
      telephone: telephone.trim(),
      adresse: adresse?.trim() || '',
      date: dateNormalisee,
      heure,
      service: service || 'diagnostic',
      rubrique: rubrique || '',
      notes: notes?.trim() || '',
      statut: 'en_attente',
    }]).select().single();
    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    console.error('Erreur création RDV :', err);
    res.status(500).json({ error: 'Erreur serveur RDV.' });
  }
});

// GET /rdv — admin : liste tous les RDV
app.get('/rdv', requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('rdv')
      .select('*')
      .order('date', { ascending: true })
      .order('heure', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Erreur liste RDV :', err);
    res.status(500).json({ error: 'Erreur serveur RDV.' });
  }
});

// GET /rdv/:id — utilisateur peut voir son propre RDV ou admin peut voir n'importe quel
app.get('/rdv/:id', requireAuth, async (req, res) => {
  const rdvId = parseInt(req.params.id);
  try {
    const { data: rdv, error: errRdv } = await supabase
      .from('rdv')
      .select('*')
      .eq('id', rdvId)
      .single();
    
    if (errRdv) {
      if (errRdv.code === 'PGRST116') return res.status(404).json({ error: 'RDV non trouvé' });
      return res.status(500).json({ error: errRdv.message });
    }

    // Ownership basé sur l'email : les RDV sont créés sans utilisateur_id (formulaire public)
    if (req.user?.role !== 'admin' && rdv.email !== req.user?.email) {
      return res.status(403).json({ error: 'Accès refusé — vous ne pouvez voir que votre propre RDV.' });
    }

    res.json(rdv);
  } catch (err) {
    console.error('Erreur GET RDV :', err);
    res.status(500).json({ error: 'Erreur serveur RDV.' });
  }
});

// PATCH /rdv/:id/statut — admin : confirmer ou annuler
app.patch('/rdv/:id/statut', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { statut } = req.body;
  if (!['confirme', 'en_attente', 'annule'].includes(statut)) {
    return res.status(400).json({ error: 'Statut invalide.' });
  }
  try {
    const { data, error } = await supabase
      .from('rdv')
      .update({ statut })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;

    if (statut === 'confirme' && data.email) {
      const [y, mo, d] = data.date.split('-').map(Number);
      const dateLabel = new Date(y, mo - 1, d).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      });
      await sendMail({
        to: data.email,
        subject: `✅ Votre rendez-vous X3COM est confirmé — ${dateLabel} à ${data.heure}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
            <div style="background:#1a365d;padding:24px;text-align:center">
              <h1 style="color:#fff;margin:0;font-size:22px">✅ Rendez-vous confirmé — X3COM</h1>
            </div>
            <div style="padding:28px;background:#f8fafc">
              <p style="color:#374151;font-size:15px;margin:0 0 20px">Bonjour <strong>${escHtml(data.nom)}</strong>,</p>
              <p style="color:#374151;font-size:15px;margin:0 0 24px">Votre rendez-vous a bien été <strong style="color:#16a34a">confirmé</strong> par notre équipe. Voici le récapitulatif :</p>
              <table style="width:100%;border-collapse:collapse">
                <tr style="background:#fff"><td style="padding:10px 0;color:#64748b;width:140px;font-weight:bold">📅 Date</td><td style="padding:10px 0"><strong>${dateLabel}</strong></td></tr>
                <tr><td style="padding:10px 0;color:#64748b;font-weight:bold">🕐 Heure</td><td style="padding:10px 0"><strong>${data.heure}</strong></td></tr>
                <tr style="background:#fff"><td style="padding:10px 0;color:#64748b;font-weight:bold">👤 Nom</td><td style="padding:10px 0">${escHtml(data.nom)}</td></tr>
                <tr><td style="padding:10px 0;color:#64748b;font-weight:bold">📞 Téléphone</td><td style="padding:10px 0">${escHtml(data.telephone)}</td></tr>
                ${data.adresse ? `<tr style="background:#fff"><td style="padding:10px 0;color:#64748b;font-weight:bold">📍 Adresse</td><td style="padding:10px 0">${escHtml(data.adresse)}</td></tr>` : ''}
              </table>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">
              <p style="color:#374151;font-size:14px;margin:0">Notre technicien vous appellera à l'heure indiquée. En cas de question, répondez à cet e-mail ou contactez-nous directement.</p>
              <p style="margin-top:24px;font-size:12px;color:#94a3b8;text-align:center">X3COM — ${new Date().toLocaleString('fr-FR')}</p>
            </div>
          </div>`,
      });
    }

    res.json(data);
  } catch (err) {
    console.error('Erreur mise à jour RDV :', err);
    res.status(500).json({ error: 'Erreur serveur RDV.' });
  }
});

// DELETE /rdv/:id — admin : supprimer un RDV
app.delete('/rdv/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const { data, error } = await supabase
      .from('rdv')
      .delete()
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ error: 'RDV non trouvé' });
      throw error;
    }
    
    console.log(`✓ RDV supprimé : ${data.nom} (${data.date} ${data.heure})`);
    res.json({ message: 'RDV supprimé avec succès', data });
  } catch (err) {
    console.error('Erreur suppression RDV :', err);
    res.status(500).json({ error: 'Erreur serveur RDV.' });
  }
});

// ══════════════════════════════════════════════════════════
// DÉMARRAGE
// ══════════════════════════════════════════════════════════
app.listen(PORT, async () => {
  console.log(`\n🚀 X3COM Backend — http://localhost:${PORT}`);
  console.log(`   Stripe   : ${process.env.STRIPE_SECRET_KEY?.startsWith('sk_test') ? '✓ TEST' : process.env.STRIPE_SECRET_KEY ? '✓ LIVE' : '⚠ MANQUANT'}`);
  console.log(`   Resend   : ${process.env.RESEND_API_KEY   ? '✓ actif' : '⚠ MANQUANT'}`);
  console.log(`   Supabase : ${process.env.SUPABASE_URL     ? '✓ URL ok' : '⚠ SUPABASE_URL MANQUANT'}`);
  console.log(`   JWT      : ✓ actif`);
  console.log(`   Helmet   : ✓ actif`);
  console.log(`   Front    : ${ALLOWED_ORIGINS.join(', ')}`);
});

// ══════════════════════════════════════════════════════════
// Helpers legacy
// ══════════════════════════════════════════════════════════
async function verifierPBKDF2(motDePasse, hashStocke) {
  const p = hashStocke.split('$');
  if (p.length !== 3) return false;
  const { webcrypto } = require('crypto');
  const subtle = webcrypto.subtle, enc = new TextEncoder();
  const sel = hexToBuf(p[1]), ref = hexToBuf(p[2]);
  try {
    const key  = await subtle.importKey('raw', enc.encode(motDePasse), 'PBKDF2', false, ['deriveBits']);
    const bits = await subtle.deriveBits({ name:'PBKDF2', hash:'SHA-256', salt:sel, iterations:200_000 }, key, 256);
    const h    = new Uint8Array(bits);
    if (h.length !== ref.length) return false;
    let d = 0; for (let i = 0; i < h.length; i++) d |= h[i] ^ ref[i];
    return d === 0;
  } catch { return false; }
}
function hexToBuf(hex) {
  const a = new Uint8Array(hex.length / 2);
  for (let i = 0; i < a.length; i++) a[i] = parseInt(hex.slice(i*2, i*2+2), 16);
  return a;
}

// ── GLOSSAIRE ──────────────────────────────────────────────
app.get('/glossaire', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('glossaire')
      .select('id, terme, definition, lettre')
      .order('lettre', { ascending: true })
      .order('terme',  { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Erreur glossaire :', err);
    res.status(500).json({ message: 'Erreur serveur glossaire' });
  }
});

// ── COMMUNES FERMETURE CUIVRE ──────────────────────────────
app.get('/communes/recherche', async (req, res) => {
  const q = req.query.q ? String(req.query.q).trim().toLowerCase() : '';

  if (!q || q.length < 2) {
    return res.status(400).json({ error: 'Minumum 2 caractères' });
  }

  try {
    const { data, error } = await supabase
      .from('communes_fermeture_cuivre')
      .select('*')
      .or(`commune.ilike.%${q}%,code_postal.ilike.%${q}%`)
      .limit(5);

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Erreur recherche communes :', err);
    res.status(500).json({ error: err.message });
  }
});