// Vercel Serverless Function
// POST /api/stripe-webhook
// Reçoit les événements Stripe (checkout.session.completed en particulier)
// et crée automatiquement un événement dans le Google Calendar "BK Alpes Motors – Réservations".

const Stripe = require('stripe');
const { google } = require('googleapis');
const { Resend } = require('resend');
const { parisWallclock } = require('./_paris-tz');
const { buildConfirmationEmail } = require('./_email-template');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
});

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// Adresse d'envoi BK Alpes Motors
const FROM_EMAIL = 'BK Alpes Motors - Lavage Véhicule & Co <contact@bkalpesmotors.fr>';
const REPLY_TO = 'contact@bkalpesmotors.fr';

// Destinataires de la notification interne (récap envoyé à chaque résa confirmée).
// Envoi séparé du mail client pour ne jamais apparaître dans ses en-têtes.
const INTERNAL_NOTIFY_TO = [
  'dararahmidas@gmail.com',
  'aymen.cherfi.pro@gmail.com',
  'ayoubchr77@gmail.com',
];

// Durée de l'EVENT Google Calendar = 2h (prestation seule).
// Les 30 min de route/prep entre deux prestas restent VIDES dans le calendrier
// pour que l'admin voie clairement son temps libre.
// Note : SLOT_DURATION_MIN dans availability.js reste à 150 (2h30) pour bloquer
// le créneau complet (presta + route) et empêcher les chevauchements.
const EVENT_DURATION_MIN = 120;

// ⚠️ IMPORTANT : désactiver le body parser pour pouvoir vérifier la signature Stripe
// sur le body brut (sinon req.body est déjà parsé en objet → signature invalide).
module.exports.config = {
  api: { bodyParser: false },
};

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function parseSlot(label) {
  // "9h00" → { hour: 9, minute: 0 } · "14h30" → { hour: 14, minute: 30 }
  const [h, m] = String(label || '').split('h');
  return {
    hour: parseInt(h, 10) || 0,
    minute: parseInt(m || '0', 10) || 0,
  };
}

async function getCalendarClient() {
  const key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  return google.calendar({ version: 'v3', auth });
}

async function createCalendarEventFromSession(session) {
  const md = session.metadata || {};
  const {
    date,
    slot,
    vehicle_label,
    service_label,
    address,
    solde_eur,
    acompte_eur,
    options,
  } = md;
  // La metadata écrite par create-checkout-session utilise total_final_eur (prix après remise)
  // et total_brut_eur (prix avant remise). On affiche le final en priorité, brut en fallback.
  const total_eur = md.total_final_eur || md.total_brut_eur;

  if (!date || !slot) {
    console.warn('[stripe-webhook] date ou slot manquants dans la metadata — skip création event', md);
    return;
  }

  // Parse date "YYYY-MM-DD"
  const [y, mo, d] = String(date).split('-').map(Number);
  if (!y || !mo || !d) {
    console.warn('[stripe-webhook] date invalide dans la metadata:', date);
    return;
  }

  const { hour, minute } = parseSlot(slot);
  const startDate = parisWallclock(y, mo - 1, d, hour, minute);
  const endDate = new Date(startDate.getTime() + EVENT_DURATION_MIN * 60 * 1000);

  const customer = session.customer_details || {};
  const customerName = customer.name || 'Client';
  const customerEmail = customer.email || '';
  const customerPhone = customer.phone || '';

  const title = `BK Alpes Motors · ${vehicle_label || 'Véhicule'} · ${customerName}`;

  let optionsLine = '';
  try {
    const opts = options ? JSON.parse(options) : [];
    if (Array.isArray(opts) && opts.length) {
      optionsLine = opts.map(o => `${o.name}${o.price ? ` (+${o.price}€)` : ''}`).join(', ');
    }
  } catch (_) {
    optionsLine = options || '';
  }

  const descriptionLines = [
    `Formule : ${service_label || '-'}`,
    `Client : ${customerName}`,
    customerEmail ? `Email : ${customerEmail}` : '',
    customerPhone ? `Tél : ${customerPhone}` : '',
    address ? `Adresse : ${address}` : '',
    optionsLine ? `Options : ${optionsLine}` : '',
    '',
    `Total prestation : ${total_eur || '-'}€`,
    `Acompte payé : ${acompte_eur || '-'}€`,
    `Solde à encaisser sur place : ${solde_eur || '-'}€`,
    '',
    `Stripe Session : ${session.id}`,
  ].filter(Boolean).join('\n');

  const calendar = await getCalendarClient();

  const event = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary: title,
      description: descriptionLines,
      location: address || undefined,
      start: { dateTime: startDate.toISOString(), timeZone: 'Europe/Paris' },
      end: { dateTime: endDate.toISOString(), timeZone: 'Europe/Paris' },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 60 },
          { method: 'popup', minutes: 24 * 60 },
        ],
      },
    },
  });

  console.log('[stripe-webhook] event créé :', event.data.id, event.data.htmlLink);
  return event.data;
}

async function sendConfirmationEmail(session) {
  if (!resend) {
    console.warn('[stripe-webhook] Resend non configuré (RESEND_API_KEY manquante), skip email');
    return;
  }

  const customer = session.customer_details || {};
  const to = customer.email;
  if (!to) {
    console.warn('[stripe-webhook] pas de customer_email, skip envoi');
    return;
  }

  const md = session.metadata || {};
  let options = [];
  try { options = md.options ? JSON.parse(md.options) : []; } catch (_) {}

  const emailData = {
    customerName: customer.name || '',
    customerEmail: to,
    vehicleLabel: md.vehicle_label || '',
    serviceLabel: md.service_label || '',
    date: md.date || '',
    slot: md.slot || '',
    address: md.address || '',
    options,
    travelKm: Number(md.travel_km) || 0,
    travelFee: Number(md.travel_fee_eur) || 0,
    total: Number(md.total_final_eur || md.total_brut_eur) || null,
    acompte: Number(md.acompte_eur) || null,
    solde: Number(md.solde_eur) || null,
    sessionId: session.id,
  };

  const { subject, html, text } = buildConfirmationEmail(emailData);

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      reply_to: REPLY_TO,
      subject,
      html,
      text,
    });
    console.log('[stripe-webhook] email envoyé :', result?.data?.id || result?.id, 'to', to);
  } catch (err) {
    console.error('[stripe-webhook] erreur envoi email :', err && err.message ? err.message : err);
    // On ne fait pas échouer le webhook pour ça — l'event calendar est déjà créé
  }
}

function fmtDateFr(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  const days = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  return `${days[date.getDay()]} ${d} ${months[m - 1]}`;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Email interne envoyé à l'équipe BK Alpes Motors à chaque résa confirmée.
// Séparé du mail client (pas de BCC) → le client ne voit jamais ces destinataires.
async function sendInternalNotification(session) {
  if (!resend) return;
  if (!INTERNAL_NOTIFY_TO.length) return;

  const md = session.metadata || {};
  const customer = session.customer_details || {};
  const customerName = customer.name || 'Client';
  const customerEmail = customer.email || '-';
  const customerPhone = customer.phone || '-';

  let optionsText = '-';
  try {
    const opts = md.options ? JSON.parse(md.options) : [];
    if (Array.isArray(opts) && opts.length) {
      optionsText = opts.map(o => `${o.name}${o.price ? ` (+${o.price}€)` : ''}`).join(', ');
    }
  } catch (_) {}

  const whenLabel = [fmtDateFr(md.date), md.slot].filter(Boolean).join(' · ') || '-';
  const total = md.total_final_eur || md.total_brut_eur || '-';
  const acompte = md.acompte_eur || '-';
  const solde = md.solde_eur || '-';
  const promo = md.promo_code ? `${md.promo_code} (-${md.discount_eur || 0}€)` : '-';
  const travel = (md.travel_km && Number(md.travel_km) > 0)
    ? `${md.travel_km} km (+${md.travel_fee_eur || 0}€)`
    : '-';

  const rows = [
    ['Client', customerName],
    ['Email', customerEmail],
    ['Téléphone', customerPhone],
    ['Véhicule', md.vehicle_label || '-'],
    ['Formule', md.service_label || '-'],
    ['Date & créneau', whenLabel],
    ['Adresse', md.address || '-'],
    ['Options', optionsText],
    ['Déplacement', travel],
    ['Code promo', promo],
    ['Total prestation', `${total}€`],
    ['Acompte payé', `${acompte}€`],
    ['Solde sur place', `${solde}€`],
    ['Stripe Session', session.id],
  ];

  const rowsHtml = rows.map(([k, v]) => `
    <tr>
      <td style="padding:6px 12px 6px 0;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:13px;color:#6b7280;white-space:nowrap;vertical-align:top;">${esc(k)}</td>
      <td style="padding:6px 0;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;color:#0b1220;font-weight:500;">${esc(v)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html lang="fr"><body style="margin:0;padding:24px;background:#f5f6f7;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:6px;">
      <tr><td style="padding:24px 28px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#D4AF37;font-weight:700;">BK Alpes Motors · Interne</div>
        <h2 style="margin:6px 0 0;font-size:20px;color:#0b1220;">Nouvelle réservation confirmée</h2>
      </td></tr>
      <tr><td style="padding:20px 28px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
      </td></tr>
    </table>
  </body></html>`;

  const text = [
    'Nouvelle réservation BK Alpes Motors confirmée',
    '----------------------------------------',
    ...rows.map(([k, v]) => `${k.padEnd(18)}: ${v}`),
  ].join('\n');

  const subject = `[BK Alpes Motors] Résa · ${md.vehicle_label || 'Véhicule'} · ${whenLabel} · ${customerName}`;

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: INTERNAL_NOTIFY_TO,
      reply_to: customerEmail !== '-' ? customerEmail : REPLY_TO,
      subject,
      html,
      text,
    });
    console.log('[stripe-webhook] notif interne envoyée :', result?.data?.id || result?.id, 'to', INTERNAL_NOTIFY_TO.join(','));
  } catch (err) {
    console.error('[stripe-webhook] erreur notif interne :', err && err.message ? err.message : err);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    console.error('[stripe-webhook] raw body read error', err);
    return res.status(400).send('Invalid body');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      // On crée l'event + envoi email uniquement si le paiement est bien "paid"
      if (session.payment_status === 'paid') {
        // Parallélisation : les trois sont indépendants
        // La notif interne est envoyée SÉPARÉMENT du mail client (pas de BCC)
        // → les destinataires internes n'apparaissent jamais côté client.
        await Promise.allSettled([
          createCalendarEventFromSession(session),
          sendConfirmationEmail(session),
          sendInternalNotification(session),
        ]);
      } else {
        console.log('[stripe-webhook] session completed but not paid, skip', session.id, session.payment_status);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[stripe-webhook] handler error:', err);
    // On renvoie 500 pour que Stripe réessaye automatiquement
    return res.status(500).send(`Handler error: ${err && err.message ? err.message : err}`);
  }
};
