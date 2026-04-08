require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const rateLimit  = require('express-rate-limit');
const helmet     = require('helmet');
const { Resend } = require('resend');
const stripe     = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const multer     = require('multer');
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
    utilisateurId:   c.utilisateurid   ?? null,
    offreId:         c.offreid         ?? null,
    statut:          c.statut,
    prix:            c.prix,
    notes:           c.notes,
    stripeSessionId: c.stripesessionid ?? null,
    dateCreation:    c.datecreation    ?? null,
  };
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
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
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
 * FIX : on transmet err à next() pour éviter les doubles réponses.
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
 * À utiliser sur les routes /utilisateurs/:id pour éviter l'IDOR.
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

    // Migration automatique vers bcrypt si ancien hash
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

// PATCH /utilisateurs/:id — PROPRIÉTAIRE UNIQUEMENT (ou admin)
app.patch('/utilisateurs/:id', requireOwnerOrAdmin, async (req, res) => {
  const { motDePasse, motdepasse, dateCreation, datecreation, role, id, ...raw } = req.body;

  const COLONNES_AUTORISEES = ['email', 'prenom', 'nom', 'telephone', 'adresse', 'ville', 'codepostal'];

  // FIX : normalisation des clés en minuscules pour correspondre aux colonnes Supabase
  // Ex: "codePostal" (Angular) → "codepostal" (Supabase)
  const champs = Object.fromEntries(
    Object.entries(raw)
      .filter(([k]) => COLONNES_AUTORISEES.includes(k.toLowerCase()))
      .map(([k, v]) => [k.toLowerCase(), v])
  );

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
    const { error } = await supabase.from('utilisateurs').delete().eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ══════════════════════════════════════════════════════════
// OFFRES — lecture publique, écriture admin uniquement
// FIX : route statique /reordonner déclarée AVANT la route paramétrée /:id
// ══════════════════════════════════════════════════════════
app.get('/offres', async (req, res) => {
  try {
    const { data, error } = await supabase.from('offres').select('*').order('ordre', { ascending: true, nullsFirst: false });
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

// FIX : /reordonner déclaré avant /:id
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

// PATCH /commandes/:id — admin uniquement
app.patch('/commandes/:id', requireAdmin, async (req, res) => {
  const CHAMPS_AUTORISES = ['statut', 'adresselivraison', 'commentaire', 'dateprevue'];

  // FIX : normalisation des clés en minuscules pour correspondre aux colonnes Supabase
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
      const { error } = await supabase.from('commandes').insert({
        utilisateurid:   parseInt(meta.utilisateurId) || null,
        offreid:         parseInt(meta.offreId),
        statut:          'paiement_confirme',
        prix:            parseFloat(meta.prix),
        notes:           meta.nomOffre,
        stripesessionid: session.id,
      });
      if (error) console.error('✗ Supabase commande:', error.message);
      else       console.log('✓ Commande enregistrée');
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
  const il_y_a_2_jours  = new Date(maintenant - 2 * 24 * 60 * 60 * 1000).toISOString();

  // ── 1. Avertissement J-1 : commandes annulées depuis 2 jours (suppression demain) ──
  const { data: aAvertir } = await supabase
    .from('commandes')
    .select('id, notes, prix, utilisateurid, dateannulation')
    .eq('statut', 'annulee')
    .not('dateannulation', 'is', null)
    .lt('dateannulation', il_y_a_2_jours)
    .gte('dateannulation', il_y_a_3_jours);

  for (const commande of aAvertir || []) {
    try {
      const { data: users } = await supabase
        .from('utilisateurs')
        .select('email, prenom')
        .eq('id', commande.utilisateurid)
        .limit(1);
      const user = users?.[0];
      if (!user?.email) continue;

      await sendMail({
        to: user.email,
        subject: `⚠️ Suppression imminente — ${commande.notes || 'votre commande'}`,
        html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
  <div style="background:#c53030;padding:24px;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:22px">⚠️ Suppression imminente — X3COM</h1>
  </div>
  <div style="padding:28px;background:#f8fafc">
    <p style="color:#374151;font-size:15px;margin:0 0 16px">Bonjour${user.prenom ? ' <strong>' + user.prenom + '</strong>' : ''},</p>
    <p style="color:#374151;font-size:15px;margin:0 0 24px">
      Votre commande annulée sera <strong>définitivement supprimée dans 24h</strong> de nos systèmes.
    </p>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:8px 0;color:#64748b;width:160px;font-weight:bold">Commande</td><td style="padding:8px 0"><strong>${commande.notes || '—'}</strong></td></tr>
      <tr style="background:#fff"><td style="padding:8px 0;color:#64748b;font-weight:bold">Montant</td><td style="padding:8px 0">${commande.prix} €</td></tr>
      <tr><td style="padding:8px 0;color:#64748b;font-weight:bold">Annulée le</td><td style="padding:8px 0">${new Date(commande.dateannulation).toLocaleDateString('fr-FR')}</td></tr>
    </table>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
    <p style="color:#374151;font-size:13px;margin:0">Si vous avez des questions, contactez-nous à <a href="mailto:contact@x3com.com">contact@x3com.com</a>.</p>
    <p style="margin-top:24px;font-size:12px;color:#94a3b8;text-align:center">X3COM — ${new Date().toLocaleString('fr-FR')}</p>
  </div>
</div>`,
      });
      console.log(`📧 Avertissement suppression envoyé à ${user.email} (commande #${commande.id})`);
    } catch (e) { console.error('✗ Mail avertissement:', e.message); }
  }

  // ── 2. Suppression : commandes annulées depuis plus de 3 jours ──
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