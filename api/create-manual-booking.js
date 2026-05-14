// Vercel Serverless Function
// POST /api/create-manual-booking
// Crée une réservation MANUELLE (hors Stripe) — paiement en espèces sur place.
// Flow : admin remplit le wizard + coordonnées client + choisit "Espèces" → endpoint
// crée l'event Google Calendar + envoie mail client + mail interne (dara/aymen/ayoub).
// Protégé par header x-admin-password (validé contre ADMIN_PWD_HASH env var).

const crypto = require('crypto');
const { google } = require('googleapis');
const { Resend } = require('resend');
const { parisWallclock } = require('./_paris-tz');
const { buildConfirmationEmail } = require('./_email-template');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

const FROM_EMAIL = 'BK Alpes Motors - Lavage Véhicule & Co <contact@bkalpesmotors.fr>';
const REPLY_TO = 'contact@bkalpesmotors.fr';
const INTERNAL_NOTIFY_TO = [
  'dararahmidas@gmail.com',
  'aymen.cherfi.pro@gmail.com',
  'ayoubchr77@gmail.com',
];

const EVENT_DURATION_MIN = 120; // 2h, comme le webhook Stripe

// Labels (doublonnés avec create-checkout-session.js — volontairement pour isoler l'endpoint admin)
const VEHICLE_LABELS = {
  citadine: 'Citadine', berline: 'Berline', suv: 'SUV / 4x4', moto: 'Moto',
  scooter: 'Scooter', utilitaire: 'Utilitaire', premium: 'Premium / Sport',
  canape: 'Canapé', 'tapis-matelas': 'Tapis / Matelas / Moquette', demande: 'Demande spécifique',
};
const SERVICE_LABELS = {
  confort: 'Pack Confort (80€)', concession: 'Pack Prestige (119€)',
  devis: 'Sur devis', canape: 'Nettoyage textile',
};

function parseSlot(label) {
  const [h, m] = String(label || '').split('h');
  return { hour: parseInt(h, 10) || 0, minute: parseInt(m || '0', 10) || 0 };
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

async function getCalendarClient() {
  const key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  return google.calendar({ version: 'v3', auth });
}

async function createCalendarEvent(params) {
  const {
    date, slot, vehicleLabel, serviceLabel, address,
    customerName, customerEmail, customerPhone,
    total, optionsText, manualRef,
  } = params;

  const [y, mo, d] = String(date).split('-').map(Number);
  const { hour, minute } = parseSlot(slot);
  const startDate = parisWallclock(y, mo - 1, d, hour, minute);
  const endDate = new Date(startDate.getTime() + EVENT_DURATION_MIN * 60 * 1000);

  const title = `BK Alpes Motors · ${vehicleLabel || 'Véhicule'} · ${customerName || 'Client'} · ESPÈCES`;

  const descriptionLines = [
    `Formule : ${serviceLabel || '-'}`,
    `Client : ${customerName || '-'}`,
    customerEmail ? `Email : ${customerEmail}` : '',
    customerPhone ? `Tél : ${customerPhone}` : '',
    address ? `Adresse : ${address}` : '',
    optionsText ? `Options : ${optionsText}` : '',
    '',
    `Total prestation : ${total || '-'}€`,
    `Paiement : ESPÈCES sur place`,
    '',
    `Réservation manuelle (hors Stripe) · Réf. ${manualRef}`,
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
  return event.data;
}

async function sendClientEmail(params) {
  if (!resend) return;
  const { customerName, customerEmail, vehicleLabel, serviceLabel, date, slot,
          address, options, travelKm, travelFee, total, manualRef } = params;
  if (!customerEmail) return;

  const { subject, html, text } = buildConfirmationEmail({
    customerName,
    customerEmail,
    vehicleLabel,
    serviceLabel,
    date,
    slot,
    address,
    options,
    travelKm,
    travelFee,
    total,
    acompte: null,
    solde: null,
    paymentMode: 'cash',
    sessionId: manualRef,
  });

  await resend.emails.send({
    from: FROM_EMAIL,
    to: customerEmail,
    reply_to: REPLY_TO,
    subject,
    html,
    text,
  });
}

async function sendInternalEmail(params) {
  if (!resend || !INTERNAL_NOTIFY_TO.length) return;
  const { customerName, customerEmail, customerPhone, vehicleLabel, serviceLabel,
          date, slot, address, options, travelKm, travelFee, total, manualRef } = params;

  const whenLabel = [fmtDateFr(date), slot].filter(Boolean).join(' · ') || '-';
  const optionsText = Array.isArray(options) && options.length
    ? options.map(o => `${o.name}${o.price ? ` (+${o.price}€)` : ''}`).join(', ')
    : '-';
  const travel = (travelKm && Number(travelKm) > 0)
    ? `${travelKm} km (+${travelFee || 0}€)`
    : '-';

  const rows = [
    ['Mode', 'RÉSA MANUELLE · Paiement espèces sur place'],
    ['Client', customerName || '-'],
    ['Email', customerEmail || '-'],
    ['Téléphone', customerPhone || '-'],
    ['Véhicule', vehicleLabel || '-'],
    ['Formule', serviceLabel || '-'],
    ['Date & créneau', whenLabel],
    ['Adresse', address || '-'],
    ['Options', optionsText],
    ['Déplacement', travel],
    ['Total à encaisser', `${total || '-'}€ en espèces`],
    ['Réf.', manualRef],
  ];

  const rowsHtml = rows.map(([k, v]) => `
    <tr>
      <td style="padding:6px 12px 6px 0;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:13px;color:#6b7280;white-space:nowrap;vertical-align:top;">${esc(k)}</td>
      <td style="padding:6px 0;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;color:#0b1220;font-weight:500;">${esc(v)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html lang="fr"><body style="margin:0;padding:24px;background:#f5f6f7;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:6px;">
      <tr><td style="padding:24px 28px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#b45309;font-weight:700;">BK Alpes Motors · Interne · ESPÈCES</div>
        <h2 style="margin:6px 0 0;font-size:20px;color:#0b1220;">Réservation manuelle enregistrée</h2>
      </td></tr>
      <tr><td style="padding:20px 28px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
      </td></tr>
    </table>
  </body></html>`;

  const text = [
    'Nouvelle réservation BK Alpes Motors (manuelle · ESPÈCES)',
    '---------------------------------------------------',
    ...rows.map(([k, v]) => `${k.padEnd(20)}: ${v}`),
  ].join('\n');

  const subject = `[BK Alpes Motors · ESPÈCES] Résa · ${vehicleLabel || 'Véhicule'} · ${whenLabel} · ${customerName || 'Client'}`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: INTERNAL_NOTIFY_TO,
    reply_to: customerEmail || REPLY_TO,
    subject,
    html,
    text,
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth : header x-admin-password comparé au hash env
  const pwd = req.headers['x-admin-password'] || '';
  const expectedHash = process.env.ADMIN_PWD_HASH;
  if (!expectedHash) {
    return res.status(500).json({ error: 'ADMIN_PWD_HASH non configuré côté serveur' });
  }
  const actualHash = crypto.createHash('sha256').update(String(pwd)).digest('hex');
  if (actualHash !== expectedHash) {
    return res.status(401).json({ error: 'Accès refusé' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const {
      type, service, address, date, slot,
      options = [], travelFee = 0, travelKm = 0,
      total,
      customerName = '',
      customerEmail = '',
      customerPhone = '',
    } = body;

    if (!type || !service || !address || !date || !slot) {
      return res.status(400).json({ error: 'Champs obligatoires manquants (véhicule, formule, adresse, date, créneau)' });
    }
    if (!customerName || !customerPhone) {
      return res.status(400).json({ error: 'Nom et téléphone du client obligatoires' });
    }
    const totalInt = Number(total);
    if (!Number.isFinite(totalInt) || totalInt <= 0) {
      return res.status(400).json({ error: 'Total invalide' });
    }

    const vehicleLabel = VEHICLE_LABELS[type] || type || 'Véhicule';
    const serviceLabel = SERVICE_LABELS[service] || service || 'Prestation';
    const manualRef = 'MAN-' + Date.now().toString(36).toUpperCase();

    const optionsText = Array.isArray(options) && options.length
      ? options.map(o => `${o.name}${o.price ? ` (+${o.price}€)` : ''}`).join(', ')
      : '';

    const shared = {
      date, slot, vehicleLabel, serviceLabel, address,
      customerName, customerEmail, customerPhone,
      options, travelKm, travelFee,
      total: totalInt, optionsText, manualRef,
    };

    // Parallélise les 3 actions — si l'une échoue, les autres continuent
    const results = await Promise.allSettled([
      createCalendarEvent(shared),
      sendClientEmail(shared),
      sendInternalEmail(shared),
    ]);

    const errors = results
      .map((r, i) => ({ r, step: ['calendar', 'client_email', 'internal_email'][i] }))
      .filter(({ r }) => r.status === 'rejected')
      .map(({ r, step }) => ({ step, message: r.reason?.message || String(r.reason) }));

    if (errors.length) console.error('[create-manual-booking] partial failures:', errors);

    const calendarEvent = results[0].status === 'fulfilled' ? results[0].value : null;

    return res.status(200).json({
      ok: true,
      manualRef,
      calendarEventId: calendarEvent?.id || null,
      calendarUrl: calendarEvent?.htmlLink || null,
      emailsSent: {
        client: results[1].status === 'fulfilled',
        internal: results[2].status === 'fulfilled',
      },
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    console.error('create-manual-booking error:', err);
    return res.status(500).json({
      error: 'Erreur lors de la création de la réservation',
      detail: err && err.message ? err.message : String(err),
    });
  }
};
