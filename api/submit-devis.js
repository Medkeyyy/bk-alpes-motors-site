// Vercel Serverless Function
// POST /api/submit-devis
// Reçoit un devis rempli par un visiteur, envoie :
//  1. un email interne à contact@bkalpesmotors.fr avec toutes les infos
//  2. un accusé de réception à l'email du client

const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_EMAIL = 'BK Alpes Motors - Lavage Véhicule & Co <contact@bkalpesmotors.fr>';
const INTERNAL_TO = 'contact@bkalpesmotors.fr';

const TYPE_LABELS = {
  utilitaire: 'Utilitaire',
  'tapis-matelas': 'Tapis / Matelas / Moquette',
  demande: 'Demande spécifique',
  canape: 'Canapé',
};

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim());
}

function buildInternalEmail(data) {
  const { prenom, tel, email, desc, typeLabel } = data;
  const subject = `Nouveau devis · ${typeLabel} · ${prenom}`;

  const html = `<!DOCTYPE html>
<html lang="fr"><body style="margin:0;padding:0;background:#f5f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;color:#0b1220;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f7;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:6px;border:1px solid #e5e7eb;">
      <tr><td style="padding:28px 32px;border-bottom:1px solid #e5e7eb;">
        <div style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#9ca3af;font-weight:700;">Nouveau devis BK Alpes Motors</div>
        <div style="font-size:22px;font-weight:700;margin-top:4px;">${escapeHtml(typeLabel)} · ${escapeHtml(prenom)}</div>
      </td></tr>
      <tr><td style="padding:24px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:10px 0;font-size:11px;color:#9ca3af;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">Prénom</td>
          </tr>
          <tr><td style="padding-bottom:12px;font-size:15px;font-weight:600;color:#0b1220;">${escapeHtml(prenom)}</td></tr>
          <tr>
            <td style="padding:10px 0;font-size:11px;color:#9ca3af;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;border-top:1px solid #f3f4f6;">Téléphone</td>
          </tr>
          <tr><td style="padding-bottom:12px;font-size:15px;font-weight:600;color:#0b1220;">
            <a href="tel:${escapeHtml(tel)}" style="color:#0b1220;text-decoration:none;">${escapeHtml(tel)}</a>
            &nbsp;·&nbsp;
            <a href="https://wa.me/${escapeHtml((tel || '').replace(/[^0-9]/g, ''))}" style="color:#1cc97c;text-decoration:none;font-size:13px;">WhatsApp</a>
          </td></tr>
          <tr>
            <td style="padding:10px 0;font-size:11px;color:#9ca3af;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;border-top:1px solid #f3f4f6;">Email</td>
          </tr>
          <tr><td style="padding-bottom:12px;font-size:15px;font-weight:600;">
            <a href="mailto:${escapeHtml(email)}" style="color:#0b1220;text-decoration:none;">${escapeHtml(email)}</a>
          </td></tr>
          <tr>
            <td style="padding:10px 0;font-size:11px;color:#9ca3af;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;border-top:1px solid #f3f4f6;">Type</td>
          </tr>
          <tr><td style="padding-bottom:12px;font-size:15px;font-weight:600;color:#0b1220;">${escapeHtml(typeLabel)}</td></tr>
          <tr>
            <td style="padding:10px 0;font-size:11px;color:#9ca3af;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;border-top:1px solid #f3f4f6;">Besoin</td>
          </tr>
          <tr><td style="padding-bottom:8px;font-size:15px;color:#0b1220;line-height:1.55;white-space:pre-wrap;">${escapeHtml(desc)}</td></tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <a href="mailto:${escapeHtml(email)}?subject=Votre%20devis%20BK Alpes Motors" style="display:inline-block;background:#0b1220;color:#fff;padding:11px 22px;border-radius:100px;text-decoration:none;font-size:13px;font-weight:600;">Répondre au client</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  const text = [
    `Nouveau devis BK Alpes Motors — ${typeLabel}`,
    '',
    `Prénom : ${prenom}`,
    `Téléphone : ${tel}`,
    `Email : ${email}`,
    `Type : ${typeLabel}`,
    '',
    'Besoin :',
    desc,
  ].join('\n');

  return { subject, html, text };
}

function buildAckEmail(data) {
  const { prenom, typeLabel, desc } = data;
  const subject = `Votre demande de devis est bien reçue`;

  const html = `<!DOCTYPE html>
<html lang="fr"><body style="margin:0;padding:0;background:#f5f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Arial,sans-serif;color:#0b1220;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f7;">
  <tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#fff;border-radius:6px;border:1px solid #e5e7eb;">

      <tr><td align="center" style="padding:36px 32px 12px;border-bottom:1px solid #e5e7eb;">
        <div style="font-weight:800;font-size:18px;letter-spacing:0.18em;color:#D4AF37;text-transform:uppercase;">BK ALPES MOTORS</div>
        <div style="font-size:11px;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;margin-top:6px;">Lavage auto à domicile</div>
      </td></tr>

      <tr><td style="padding:40px 40px 0;">
        <h1 style="margin:0;font-size:26px;font-weight:700;line-height:1.2;letter-spacing:-0.015em;color:#0b1220;">Demande bien reçue<span style="color:#1cc97c;">.</span></h1>
      </td></tr>

      <tr><td style="padding:18px 40px 8px;">
        <p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:#0b1220;">Bonjour ${escapeHtml(prenom)},</p>
        <p style="margin:0;font-size:15px;line-height:1.65;color:#6b7280;">
          Nous avons bien reçu votre demande de devis. Nous vous recontactons sous <strong style="color:#0b1220;">15 minutes</strong> aux horaires d'ouverture (ou le lendemain matin si demande reçue le soir).
        </p>
      </td></tr>

      <tr><td style="padding:24px 40px 12px;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#9ca3af;padding-bottom:8px;border-bottom:1px solid #e5e7eb;">Récapitulatif de votre demande</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
          <tr>
            <td style="padding:10px 0;font-size:11px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;">Type</td>
          </tr>
          <tr><td style="padding:2px 0 8px;font-size:15px;font-weight:500;color:#0b1220;">${escapeHtml(typeLabel)}</td></tr>
          <tr>
            <td style="padding:10px 0;font-size:11px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;">Besoin</td>
          </tr>
          <tr><td style="padding:2px 0 4px;font-size:14px;color:#0b1220;line-height:1.6;white-space:pre-wrap;">${escapeHtml(desc)}</td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:24px 40px 0;">
        <div style="border-top:1px solid #e5e7eb;padding-top:20px;">
          <p style="margin:0 0 4px;font-size:13px;color:#6b7280;line-height:1.5;">Besoin d'ajouter des précisions ? Vous pouvez nous répondre directement à cet email ou nous contacter :</p>
          <p style="margin:0;font-size:14px;color:#0b1220;line-height:1.5;">
            <a href="tel:+33756859026" style="color:#0b1220;text-decoration:none;font-weight:500;">07 56 85 90 26</a>
            &nbsp;·&nbsp;
            <a href="https://wa.me/33756859026" style="color:#0b1220;text-decoration:none;font-weight:500;">WhatsApp</a>
          </p>
        </div>
      </td></tr>

      <tr><td align="center" style="padding:32px 40px 36px;">
        <p style="margin:0;font-size:11px;color:#9ca3af;letter-spacing:0.06em;">BK Alpes Motors · Annecy et alentours</p>
        <p style="margin:6px 0 0;font-size:11px;color:#9ca3af;">
          <a href="https://bkalpesmotors.fr" style="color:#9ca3af;text-decoration:none;">bkalpesmotors.fr</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  const text = [
    `Bonjour ${prenom},`,
    '',
    'Nous avons bien reçu votre demande de devis. Nous vous recontactons sous 15 minutes aux horaires d\'ouverture.',
    '',
    'RÉCAPITULATIF DE VOTRE DEMANDE',
    `Type : ${typeLabel}`,
    `Besoin : ${desc}`,
    '',
    'Une question ?',
    'Tél : 07 56 85 90 26',
    'WhatsApp : https://wa.me/33756859026',
    '',
    'BK Alpes Motors — bkalpesmotors.fr',
  ].join('\n');

  return { subject, html, text };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!resend) {
    console.error('[submit-devis] RESEND_API_KEY manquante');
    return res.status(500).json({ error: 'Config email manquante côté serveur' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const prenom = String(body.prenom || '').trim();
    const tel = String(body.tel || '').trim();
    const email = String(body.email || '').trim();
    const desc = String(body.desc || '').trim();
    const type = String(body.type || 'demande').trim();

    if (!prenom || prenom.length < 2) {
      return res.status(400).json({ error: 'Prénom invalide' });
    }
    if (!tel || tel.length < 6) {
      return res.status(400).json({ error: 'Téléphone invalide' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Email invalide' });
    }
    if (!desc || desc.length < 5) {
      return res.status(400).json({ error: 'Description trop courte' });
    }

    const typeLabel = TYPE_LABELS[type] || 'Demande spécifique';
    const data = { prenom, tel, email, desc, typeLabel };

    const internal = buildInternalEmail(data);
    const ack = buildAckEmail(data);

    // Envoi en parallèle : un seul échec ne bloque pas l'autre
    const [internalResult, ackResult] = await Promise.allSettled([
      resend.emails.send({
        from: FROM_EMAIL,
        to: INTERNAL_TO,
        reply_to: email,
        subject: internal.subject,
        html: internal.html,
        text: internal.text,
      }),
      resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        reply_to: INTERNAL_TO,
        subject: ack.subject,
        html: ack.html,
        text: ack.text,
      }),
    ]);

    if (internalResult.status === 'rejected' && ackResult.status === 'rejected') {
      console.error('[submit-devis] les deux envois ont échoué', internalResult.reason, ackResult.reason);
      return res.status(500).json({ error: 'Envoi email échoué' });
    }

    if (internalResult.status === 'rejected') {
      console.error('[submit-devis] email interne échoué', internalResult.reason);
    }
    if (ackResult.status === 'rejected') {
      console.error('[submit-devis] accusé de réception échoué', ackResult.reason);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[submit-devis] erreur:', err);
    return res.status(500).json({ error: err && err.message ? err.message : 'Erreur serveur' });
  }
};
