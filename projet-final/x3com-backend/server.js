require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const bcrypt     = require('bcryptjs');
const rateLimit  = require('express-rate-limit');
const { Resend } = require('resend');
const stripe     = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const app   = express();
const PORT  = process.env.PORT || 3001;
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL || "http://localhost:4200",
  "http://localhost:4200",
].filter(Boolean);

// ══════════════════════════════════════════════════════════
// SUPABASE
// Les clés viennent du dashboard Supabase :
//   Project Settings → API → URL + service_role key
// ══════════════════════════════════════════════════════════
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('\n✗ SUPABASE_URL ou SUPABASE_SERVICE_KEY manquant dans .env');
  console.error('  → Récupérez-les sur : Project Settings → API dans Supabase\n');
}

const supabase = createClient(
  process.env.SUPABASE_URL  || '',
  process.env.SUPABASE_SERVICE_KEY || '',
  { auth: { persistSession: false } }
);

// ══════════════════════════════════════════════════════════
// FONCTIONS DE MAPPING  (colonnes PostgreSQL minuscules ↔ camelCase Angular)
// ══════════════════════════════════════════════════════════
function utilisateurToAngular(u) {
  if (!u) return null;
  return {
    id:           u.id,
    email:        u.email,
    prenom:       u.prenom,
    nom:          u.nom,
    role:         u.role,
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
// MIDDLEWARES
// ══════════════════════════════════════════════════════════
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('CORS: origine non autorisée : ' + origin));
  },
  credentials: true,
}));
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

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
// RESEND
// ══════════════════════════════════════════════════════════
const resend = new Resend(process.env.RESEND_API_KEY);

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g,
    c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])
  );
}

async function sendMail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) { console.warn('⚠  sendMail : RESEND_API_KEY manquant'); return; }
  try {
    const from = process.env.RESEND_FROM || 'X3COM <onboarding@resend.dev>';
    const dest = to || process.env.MAIL_DESTINATAIRE;
    const { data, error } = await resend.emails.send({ from, to: Array.isArray(dest) ? dest : [dest], subject, html });
    if (error) console.error('✗ Resend:', JSON.stringify(error));
    else       console.log(`✉  Mail → ${dest} (${data.id})`);
  } catch (err) { console.error('✗ sendMail:', err.message); }
}


// ══════════════════════════════════════════════════════════
// GET /diagnostic — teste chaque composant et renvoie le résultat
// Ouvrez http://localhost:3001/diagnostic dans votre navigateur
// ══════════════════════════════════════════════════════════
app.get('/diagnostic', async (req, res) => {
  const rapport = { timestamp: new Date().toISOString(), checks: {} };

  // 1. Variables d'environnement
  rapport.checks.env = {
    SUPABASE_URL:         process.env.SUPABASE_URL         ? '✓ présente' : '✗ MANQUANTE',
    SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? `✓ présente (${process.env.SUPABASE_SERVICE_KEY.length} chars)` : '✗ MANQUANTE',
    STRIPE_SECRET_KEY:    process.env.STRIPE_SECRET_KEY    ? '✓ présente' : '✗ MANQUANTE',
    RESEND_API_KEY:       process.env.RESEND_API_KEY       ? '✓ présente' : '✗ MANQUANTE',
    FRONTEND_URL:         process.env.FRONTEND_URL         || '(défaut: http://localhost:4200)',
  };

  // 2. Test SELECT sur offres
  try {
    const { data, error, status } = await supabase.from('offres').select('id, nom').limit(3);
    if (error) {
      rapport.checks.offres = { ok: false, status, message: error.message, code: error.code, details: error.details, hint: error.hint };
    } else {
      rapport.checks.offres = { ok: true, count: data.length, exemples: data.map(o => o.nom) };
    }
  } catch (e) { rapport.checks.offres = { ok: false, exception: e.message }; }

  // 3. Test SELECT sur utilisateurs (sans motdepasse)
  try {
    const { data, error, status } = await supabase.from('utilisateurs').select('id, email').limit(1);
    if (error) {
      rapport.checks.utilisateurs = { ok: false, status, message: error.message, code: error.code, hint: error.hint };
    } else {
      rapport.checks.utilisateurs = { ok: true, count: data.length };
    }
  } catch (e) { rapport.checks.utilisateurs = { ok: false, exception: e.message }; }

  // 4. Test SELECT sur commandes
  try {
    const { data, error, status } = await supabase.from('commandes').select('id').limit(1);
    if (error) {
      rapport.checks.commandes = { ok: false, status, message: error.message, code: error.code, hint: error.hint };
    } else {
      rapport.checks.commandes = { ok: true, count: data.length };
    }
  } catch (e) { rapport.checks.commandes = { ok: false, exception: e.message }; }

  // Résumé
  const toutOk = Object.values(rapport.checks).every(c => c.ok !== false);
  rapport.résumé = toutOk
    ? '✓ Tout fonctionne'
    : '✗ Des erreurs ont été détectées — lisez les détails ci-dessus';

  res.json(rapport);
});


// ══════════════════════════════════════════════════════════
// POST /contact
// ══════════════════════════════════════════════════════════
app.post('/contact', limiterContact, async (req, res) => {
  const { type, nom, email, tel, ville, adresse, besoins, operateur, message } = req.body;
  if (!nom || !email) return res.status(400).json({ error: 'Nom et e-mail sont requis' });

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
  });
  res.json({ ok: true });
});


// ══════════════════════════════════════════════════════════
// POST /login
// ══════════════════════════════════════════════════════════
app.post('/login', limiterAuth, async (req, res) => {
  const { email, motDePasse } = req.body;
  if (!email || !motDePasse) return res.status(400).json({ error: 'Email et mot de passe requis' });

  try {
    const { data: rows, error } = await supabase
      .from('utilisateurs').select('*').eq('email', email).limit(1);

    if (error) {
      console.error('[login] Supabase error:', error.message, '| code:', error.code);
      return res.status(500).json({ error: `Erreur base de données : ${error.message}` });
    }
    if (!rows?.length) return res.status(401).json({ error: 'Identifiants incorrects' });

    const row  = rows[0];
    const hash = row.motdepasse ?? '';   // colonne PostgreSQL = minuscule
    let valide = false;

    if (hash.startsWith('$2'))           valide = await bcrypt.compare(motDePasse, hash);
    else if (hash.startsWith('pbkdf2$')) valide = await verifierPBKDF2(motDePasse, hash);
    else {
      const { createHash } = require('crypto');
      valide = createHash('sha256').update(motDePasse).digest('hex') === hash;
    }

    if (!valide) return res.status(401).json({ error: 'Identifiants incorrects' });

    if (!hash.startsWith('$2')) {
      const h2 = await bcrypt.hash(motDePasse, 12);
      await supabase.from('utilisateurs').update({ motdepasse: h2 }).eq('id', row.id);
    }

    return res.json({ utilisateur: utilisateurToAngular(row) });
  } catch (err) {
    console.error('[login] Exception:', err.message);
    res.status(500).json({ error: `Erreur serveur : ${err.message}` });
  }
});


// ══════════════════════════════════════════════════════════
// POST /register
// ══════════════════════════════════════════════════════════
app.post('/register', limiterAuth, async (req, res) => {
  const { email, motDePasse, prenom, nom } = req.body;
  if (!email || !motDePasse || !prenom)
    return res.status(400).json({ error: 'Email, mot de passe et prénom requis' });

  try {
    // Doublon email
    const { data: existants, error: errSelect } = await supabase
      .from('utilisateurs').select('id').eq('email', email).limit(1);

    if (errSelect) {
      console.error('[register] select error:', errSelect.message, '| code:', errSelect.code);
      return res.status(500).json({ error: `Erreur base de données : ${errSelect.message}` });
    }
    if (existants?.length > 0) return res.status(409).json({ error: 'Cet email est déjà utilisé' });

    const hash = await bcrypt.hash(motDePasse, 12);

    const { data: created, error: errInsert } = await supabase
      .from('utilisateurs')
      .insert({
        email,
        motdepasse: hash,     // ← colonne minuscule dans PostgreSQL
        prenom,
        nom: nom || '',
        role: 'client',
        // datecreation : DEFAULT now() — pas besoin de l'envoyer
      })
      .select()
      .single();

    if (errInsert) {
      console.error('[register] insert error:', errInsert.message, '| code:', errInsert.code, '| details:', errInsert.details);
      return res.status(500).json({ error: `Erreur création compte : ${errInsert.message}` });
    }

    console.log(`✓ Nouveau compte créé : ${email}`);
    return res.status(201).json({ utilisateur: utilisateurToAngular(created) });
  } catch (err) {
    console.error('[register] Exception:', err.message);
    res.status(500).json({ error: `Erreur serveur : ${err.message}` });
  }
});


// ══════════════════════════════════════════════════════════
// GET /verify-admin/:id
// ══════════════════════════════════════════════════════════
app.get('/verify-admin/:id', async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('utilisateurs').select('role').eq('id', req.params.id).single();
    if (error || !user) return res.status(404).json({ error: 'Introuvable' });
    return res.json({ role: user.role || 'client' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ══════════════════════════════════════════════════════════
// PATCH /utilisateurs/:id/password
// ══════════════════════════════════════════════════════════
app.patch('/utilisateurs/:id/password', async (req, res) => {
  const { motDePasse } = req.body;
  if (!motDePasse) return res.status(400).json({ error: 'Mot de passe requis' });
  try {
    const hash = await bcrypt.hash(motDePasse, 12);
    const { error } = await supabase.from('utilisateurs').update({ motdepasse: hash }).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ══════════════════════════════════════════════════════════
// GET /utilisateurs  (admin — jamais motdepasse)
// ══════════════════════════════════════════════════════════
app.get('/utilisateurs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('utilisateurs').select('id, email, prenom, nom, role, datecreation');
    if (error) throw new Error(error.message);
    res.json((data || []).map(utilisateurToAngular));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/utilisateurs/:id', async (req, res) => {
  const { motDePasse, motdepasse, ...champs } = req.body;
  try {
    const { data, error } = await supabase
      .from('utilisateurs').update(champs).eq('id', req.params.id)
      .select('id, email, prenom, nom, role, datecreation').single();
    if (error) throw new Error(error.message);
    res.json(utilisateurToAngular(data));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/utilisateurs/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('utilisateurs').delete().eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ══════════════════════════════════════════════════════════
// OFFRES
// ══════════════════════════════════════════════════════════
app.get('/offres', async (req, res) => {
  try {
    const { data, error } = await supabase.from('offres').select('*');
    if (error) {
      console.error('[offres] GET error:', error.message, '| code:', error.code, '| hint:', error.hint);
      return res.status(500).json({ error: error.message });
    }
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/offres/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('offres').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Offre introuvable' });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/offres', async (req, res) => {
  try {
    const { data, error } = await supabase.from('offres').insert(req.body).select().single();
    if (error) throw new Error(error.message);
    res.status(201).json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/offres/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('offres').update(req.body).eq('id', req.params.id).select().single();
    if (error) throw new Error(error.message);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/offres/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('offres').delete().eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ══════════════════════════════════════════════════════════
// COMMANDES
// ══════════════════════════════════════════════════════════
app.get('/commandes', async (req, res) => {
  try {
    let query = supabase.from('commandes').select('*');
    if (req.query.utilisateurId) {
      query = query.eq('utilisateurid', req.query.utilisateurId);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    res.json((data || []).map(commandeToAngular));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/commandes/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('commandes').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Commande introuvable' });
    res.json(commandeToAngular(data));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/commandes/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('commandes').update(req.body).eq('id', req.params.id).select().single();
    if (error) throw new Error(error.message);
    res.json(commandeToAngular(data));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/commandes/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('commandes').delete().eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.status(204).send();
  } catch (err) { res.status(500).json({ error: err.message });

// ══════════════════════════════════════════════════════════
// POST /commandes/:id/annuler  — annulation + remboursement Stripe
// ══════════════════════════════════════════════════════════
app.post('/commandes/:id/annuler', async (req, res) => {
  try {
    const { data: commande, error: fetchErr } = await supabase
      .from('commandes').select('*').eq('id', req.params.id).single();
    if (fetchErr || !commande) return res.status(404).json({ error: 'Commande introuvable' });

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
        console.error('✗ Stripe refund:', stripeErr.message);
        return res.status(502).json({ error: 'Remboursement Stripe échoué : ' + stripeErr.message });
      }
    }

    const { data: updated, error: updateErr } = await supabase
      .from('commandes').update({ statut: 'annulee' }).eq('id', req.params.id).select().single();
    if (updateErr) throw new Error(updateErr.message);

    const emailClient = req.body.emailClient || null;
    if (emailClient) {
      await sendMail({
        to: emailClient,
        subject: 'Remboursement en cours — ' + (commande.notes || 'votre commande'),
        html: '<p>Votre commande a ete annulee. Remboursement de ' + commande.prix + ' euros sous 5 a 10 jours.' + (refundId ? ' Ref: ' + refundId : '') + '</p>',
      });
    }

    res.json({ ...commandeToAngular(updated), refundId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
 }
});


// ══════════════════════════════════════════════════════════
// POST /create-checkout-session
// ══════════════════════════════════════════════════════════
app.post('/create-checkout-session', async (req, res) => {
  const { offreId, prix, nom, utilisateurId, emailClient } = req.body;
  if (!offreId || !prix || !nom)
    return res.status(400).json({ error: 'offreId, prix et nom sont obligatoires' });
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{ price_data: { currency: 'eur', unit_amount: Math.round(prix * 100), product_data: { name: nom, description: `X3COM — Offre #${offreId}` } }, quantity: 1 }],
      metadata: { offreId: String(offreId), utilisateurId: String(utilisateurId || ''), nomOffre: nom, prix: String(prix), emailClient: emailClient || '' },
      customer_email: emailClient || undefined,
      success_url: `${process.env.FRONTEND_URL || "http://localhost:4200"}/commande?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${process.env.FRONTEND_URL || "http://localhost:4200"}/paiement?annule=1`,
    });
    res.json({ url: session.url, sessionId: session.id });
  } catch (err) { console.error('Stripe:', err.message); res.status(500).json({ error: err.message }); }
});


// ══════════════════════════════════════════════════════════
// GET /session/:sessionId
// ══════════════════════════════════════════════════════════
app.get('/session/:sessionId', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    res.json({ status: session.payment_status, customerEmail: session.customer_details?.email, metadata: session.metadata });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ══════════════════════════════════════════════════════════
// POST /webhook — Stripe
// ══════════════════════════════════════════════════════════
app.post('/webhook', async (req, res) => {
  const sig    = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) { console.error('✗ STRIPE_WEBHOOK_SECRET manquant'); return res.status(400).send('secret manquant'); }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('✗ Webhook signature invalide:', err.message);
    console.error('  → "stripe listen" génère un nouveau whsec_ à chaque lancement.');
    console.error('  → Copiez le dernier whsec_... dans .env STRIPE_WEBHOOK_SECRET');
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`✓ Webhook : ${event.type}`);

  if (event.type === 'checkout.session.completed') {
    const session     = event.data.object;
    const meta        = session.metadata || {};
    const emailClient = session.customer_details?.email || session.metadata?.emailClient || null;

    console.log(`  → ${meta.nomOffre} — ${meta.prix} € — client: ${emailClient || '—'}`);

    try {
      const { error } = await supabase.from('commandes').insert({
        utilisateurid:   parseInt(meta.utilisateurId) || null,
        offreid:         parseInt(meta.offreId),
        statut:          'paiement_confirme',
        prix:            parseFloat(meta.prix),
        notes:           meta.nomOffre,
        stripesessionid: session.id,
        // datecreation : DEFAULT now()
      });
      if (error) console.error('✗ Supabase commande:', error.message);
      else       console.log('✓ Commande enregistrée');
    } catch (err) { console.error('✗ Supabase:', err.message); }

    if (emailClient) {
      await sendMail({
        to: emailClient,
        subject: `✅ Confirmation — ${escHtml(meta.nomOffre)}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
          <div style="background:#1a365d;padding:24px;text-align:center"><h1 style="color:#fff;margin:0;font-size:20px">✅ Paiement confirmé — X3COM</h1></div>
          <div style="padding:28px;background:#f8fafc">
            <p style="color:#374151">Bonjour, votre paiement pour <strong>${escHtml(meta.nomOffre)}</strong> a bien été reçu.</p>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 0;color:#64748b;width:160px;font-weight:bold">Offre</td><td><strong>${escHtml(meta.nomOffre)}</strong></td></tr>
              <tr style="background:#fff"><td style="padding:8px 0;color:#64748b;font-weight:bold">Montant</td><td style="font-size:18px;font-weight:bold;color:#059669">${escHtml(meta.prix)} €</td></tr>
              <tr><td style="padding:8px 0;color:#64748b;font-weight:bold">Référence</td><td style="font-size:11px;color:#94a3b8">${session.id}</td></tr>
            </table>
            <p style="margin-top:20px;color:#374151">Un technicien vous contactera sous <strong>24h</strong>.</p>
            <p style="margin-top:16px;font-size:12px;color:#94a3b8;text-align:center">X3COM — contact@x3com.com</p>
          </div></div>`,
      });
    }

    await sendMail({
      to: process.env.MAIL_DESTINATAIRE,
      subject: `[X3COM Paiement] ${escHtml(meta.nomOffre)} — ${meta.prix} € — ${emailClient || 'inconnu'}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
        <div style="background:#1a365d;padding:24px;text-align:center"><h1 style="color:#fff;margin:0;font-size:20px">💰 Nouveau paiement — X3COM</h1></div>
        <div style="padding:28px;background:#f8fafc">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#64748b;width:160px;font-weight:bold">Offre</td><td><strong>${escHtml(meta.nomOffre)}</strong></td></tr>
            <tr style="background:#fff"><td style="padding:8px 0;color:#64748b;font-weight:bold">Montant</td><td style="font-size:18px;font-weight:bold;color:#059669">${escHtml(meta.prix)} €</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;font-weight:bold">E-mail client</td><td>${emailClient ? `<a href="mailto:${escHtml(emailClient)}">${escHtml(emailClient)}</a>` : '—'}</td></tr>
            <tr style="background:#fff"><td style="padding:8px 0;color:#64748b;font-weight:bold">ID Stripe</td><td style="font-size:11px;color:#94a3b8">${session.id}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b;font-weight:bold">Date</td><td>${new Date().toLocaleString('fr-FR')}</td></tr>
          </table>
        </div></div>`,
    });
  }

  res.json({ received: true });
});


// ══════════════════════════════════════════════════════════
// GET /health
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
// DÉMARRAGE + TEST SUPABASE au boot
// ══════════════════════════════════════════════════════════
app.listen(PORT, async () => {
  console.log(`\n🚀 X3COM Backend — http://localhost:${PORT}`);
  console.log(`   Stripe   : ${process.env.STRIPE_SECRET_KEY?.startsWith('sk_test') ? '✓ TEST' : process.env.STRIPE_SECRET_KEY ? '✓ LIVE' : '⚠ MANQUANT'}`);
  console.log(`   Resend   : ${process.env.RESEND_API_KEY   ? '✓ actif' : '⚠ MANQUANT'}`);
  console.log(`   Supabase : ${process.env.SUPABASE_URL     ? '✓ URL ok' : '⚠ SUPABASE_URL MANQUANT'}`);
  console.log(`   Front    : ${ALLOWED_ORIGINS.join(', ')}`);

  // Test de connexion Supabase au démarrage
  console.log('\n🔍 Test connexion Supabase...');
  try {
    const { data, error } = await supabase.from('offres').select('id').limit(1);
    if (error) {
      console.error(`   ✗ Supabase KO : ${error.message}`);
      console.error(`     code: ${error.code} | hint: ${error.hint || 'aucun'}`);
      console.error(`   → Vérifiez SUPABASE_URL et SUPABASE_SERVICE_KEY dans .env`);
      console.error(`   → Ouvrez http://localhost:${PORT}/diagnostic pour le détail complet`);
    } else {
      console.log(`   ✓ Supabase OK — table offres accessible (${data.length} ligne(s))`);
      if (data.length === 0) {
        console.log(`   ⚠ La table offres est vide — ajoutez des offres dans Supabase`);
      }
    }
  } catch (e) {
    console.error(`   ✗ Exception Supabase : ${e.message}`);
  }

  console.log(`\n💡 Diagnostic complet : http://localhost:${PORT}/diagnostic`);
  console.log(`   stripe listen      : stripe listen --forward-to localhost:${PORT}/webhook\n`);
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