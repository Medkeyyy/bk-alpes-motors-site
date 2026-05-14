// Template HTML pour l'email de confirmation de réservation BK Alpes Motors.
// Style sobre, professionnel, email-safe (tables pour layout, styles inline).
// Aucun emoji, typographie système propre, hiérarchie nette.

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  const days = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  return `${days[date.getDay()]} ${d} ${months[m - 1]}`;
}

// ---- Styles partagés (ton sobre, typo système premium) ----
const FONT_BODY = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif`;
const FONT_DISPLAY = FONT_BODY; // cohérence
const COLOR_TEXT = '#0b1220';
const COLOR_MUTED = '#6b7280';
const COLOR_FAINT = '#9ca3af';
const COLOR_ACCENT = '#D4AF37';   // or BK Alpes Motors brand
const COLOR_ACCENT_SOFT = '#1cc97c';
const COLOR_BORDER = '#e5e7eb';
const COLOR_BG = '#ffffff';

function detailRow(label, value) {
  if (value == null || value === '') return '';
  return `
    <tr>
      <td style="padding:14px 0 0;font-family:${FONT_BODY};font-size:11px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:${COLOR_FAINT};line-height:1.4;">${escapeHtml(label)}</td>
    </tr>
    <tr>
      <td style="padding:2px 0 4px;font-family:${FONT_BODY};font-size:15px;font-weight:500;color:${COLOR_TEXT};line-height:1.5;">${value}</td>
    </tr>
  `;
}

function totalRow(label, value, strong = false) {
  return `
    <tr>
      <td style="padding:8px 0;font-family:${FONT_BODY};font-size:13px;color:${COLOR_MUTED};font-weight:${strong ? 600 : 400};line-height:1.4;">${escapeHtml(label)}</td>
      <td align="right" style="padding:8px 0;font-family:${FONT_BODY};font-size:${strong ? 16 : 14}px;color:${COLOR_TEXT};font-weight:${strong ? 700 : 500};line-height:1.4;white-space:nowrap;">${escapeHtml(value)}</td>
    </tr>
  `;
}

/**
 * @param {object} data
 *   - customerName, customerEmail
 *   - vehicleLabel, serviceLabel, date, slot, address
 *   - options: [{name, price}]
 *   - travelKm, travelFee
 *   - total, acompte, solde
 *   - paymentMode: 'stripe' (défaut, acompte déjà payé) | 'cash' (tout réglé sur place en espèces)
 *   - sessionId
 */
function buildConfirmationEmail(data) {
  const paymentMode = data.paymentMode || 'stripe';
  const isCash = paymentMode === 'cash';
  const firstName = data.customerName ? data.customerName.split(' ')[0] : '';
  const greeting = firstName ? `Bonjour ${escapeHtml(firstName)},` : 'Bonjour,';
  const when = [fmtDate(data.date), data.slot].filter(Boolean).join(' · ');

  let optionsText = '';
  if (Array.isArray(data.options) && data.options.length) {
    optionsText = data.options.map(o => `${o.name}${o.price ? ` (+${o.price}€)` : ''}`).join(', ');
  }

  const travelText = data.travelFee && data.travelKm
    ? `+${data.travelFee}€ - ${data.travelKm} km hors zone`
    : '';

  const detailsRows = [
    detailRow('Véhicule', escapeHtml(data.vehicleLabel)),
    detailRow('Formule', escapeHtml(data.serviceLabel)),
    detailRow('Date', escapeHtml(when)),
    detailRow('Adresse', escapeHtml(data.address)),
    optionsText ? detailRow('Options', escapeHtml(optionsText)) : '',
    travelText ? detailRow('Déplacement', escapeHtml(travelText)) : '',
  ].join('');

  // En mode "cash" (espèces sur place), pas d'acompte à afficher — le total entier se règle sur place
  const totalsRows = isCash ? [
    data.total != null ? totalRow('Total prestation', `${data.total}€`) : '',
    data.total != null ? totalRow('À régler sur place', `${data.total}€ en espèces`, true) : '',
  ].join('') : [
    data.total != null ? totalRow('Total prestation', `${data.total}€`) : '',
    data.acompte != null ? totalRow('Acompte payé', `-${data.acompte}€`) : '',
    data.solde != null ? totalRow('Solde sur place', `${data.solde}€`, true) : '',
  ].join('');

  const introLine = isCash
    ? `Votre réservation est confirmée - ci-dessous le récapitulatif de votre prestation. Le règlement se fait <span style="color:${COLOR_TEXT};font-weight:600;">en espèces le jour de l'intervention</span>.`
    : `Votre acompte de <span style="color:${COLOR_TEXT};font-weight:600;">15&nbsp;%</span> a bien été reçu. Votre créneau est sécurisé - ci-dessous le récapitulatif de votre prestation.`;

  const preheaderLine = isCash
    ? (when ? `Réservation confirmée · ${escapeHtml(when)} · paiement espèces sur place.` : 'Réservation confirmée · paiement espèces sur place.')
    : (when ? 'Acompte reçu. Créneau du ' + escapeHtml(when) + '.' : 'Acompte reçu. Votre créneau est sécurisé.');

  const soldeNote = isCash
    ? (data.total != null
        ? `Le jour de l'intervention, vous réglez <span style="color:${COLOR_TEXT};font-weight:600;">${escapeHtml(data.total)}€ en espèces</span> à la fin de la prestation.`
        : '')
    : (data.solde != null
        ? `Le jour de l'intervention, vous réglez le solde de <span style="color:${COLOR_TEXT};font-weight:600;">${escapeHtml(data.solde)}€</span> en espèces, virement ou carte (Apple Pay accepté).`
        : '');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>Réservation confirmée · BK Alpes Motors</title>
</head>
<body style="margin:0;padding:0;background:#f5f6f7;font-family:${FONT_BODY};color:${COLOR_TEXT};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
  <!-- Preheader (texte invisible en aperçu inbox) -->
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#f5f6f7;opacity:0;">
    ${preheaderLine}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f6f7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;background:${COLOR_BG};border-radius:6px;border:1px solid ${COLOR_BORDER};">

          <!-- Logo / header -->
          <tr>
            <td align="center" style="padding:36px 32px 12px;border-bottom:1px solid ${COLOR_BORDER};">
              <div style="font-family:${FONT_DISPLAY};font-weight:800;font-size:18px;letter-spacing:0.18em;color:${COLOR_ACCENT};text-transform:uppercase;">BK ALPES MOTORS</div>
              <div style="font-family:${FONT_BODY};font-size:11px;letter-spacing:0.1em;color:${COLOR_FAINT};text-transform:uppercase;margin-top:6px;">Lavage auto à domicile</div>
            </td>
          </tr>

          <!-- Titre -->
          <tr>
            <td style="padding:40px 40px 0;">
              <h1 style="margin:0;font-family:${FONT_DISPLAY};font-size:28px;font-weight:700;line-height:1.2;letter-spacing:-0.015em;color:${COLOR_TEXT};">Réservation confirmée<span style="color:${COLOR_ACCENT_SOFT};">.</span></h1>
            </td>
          </tr>

          <!-- Texte d'introduction -->
          <tr>
            <td style="padding:18px 40px 8px;">
              <p style="margin:0 0 12px;font-family:${FONT_BODY};font-size:15px;line-height:1.65;color:${COLOR_TEXT};">${greeting}</p>
              <p style="margin:0;font-family:${FONT_BODY};font-size:15px;line-height:1.65;color:${COLOR_MUTED};">
                ${introLine}
              </p>
            </td>
          </tr>

          <!-- Details -->
          <tr>
            <td style="padding:24px 40px 12px;">
              <div style="font-family:${FONT_BODY};font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${COLOR_FAINT};padding-bottom:8px;border-bottom:1px solid ${COLOR_BORDER};">Détails de la réservation</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${detailsRows}
              </table>
            </td>
          </tr>

          <!-- Totals -->
          <tr>
            <td style="padding:20px 40px 12px;">
              <div style="font-family:${FONT_BODY};font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${COLOR_FAINT};padding-bottom:4px;border-bottom:1px solid ${COLOR_BORDER};margin-bottom:4px;">Montants</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:4px;">
                ${totalsRows}
              </table>
            </td>
          </tr>

          ${soldeNote ? `
          <!-- Note solde / règlement -->
          <tr>
            <td style="padding:16px 40px 0;">
              <p style="margin:0;font-family:${FONT_BODY};font-size:13px;color:${COLOR_MUTED};line-height:1.6;">
                ${soldeNote}
              </p>
            </td>
          </tr>` : ''}

          <!-- Contact -->
          <tr>
            <td style="padding:32px 40px 0;">
              <div style="border-top:1px solid ${COLOR_BORDER};padding-top:20px;">
                <p style="margin:0 0 4px;font-family:${FONT_BODY};font-size:13px;color:${COLOR_MUTED};line-height:1.5;">Une question ou un changement ?</p>
                <p style="margin:0;font-family:${FONT_BODY};font-size:14px;color:${COLOR_TEXT};line-height:1.5;">
                  <a href="tel:+33756859026" style="color:${COLOR_TEXT};text-decoration:none;font-weight:500;">07 56 85 90 26</a>
                  &nbsp;·&nbsp;
                  <a href="mailto:contact@bkalpesmotors.fr" style="color:${COLOR_TEXT};text-decoration:none;font-weight:500;">contact@bkalpesmotors.fr</a>
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:32px 40px 36px;">
              <p style="margin:0;font-family:${FONT_BODY};font-size:11px;color:${COLOR_FAINT};letter-spacing:0.06em;">
                BK Alpes Motors · Annecy et alentours
              </p>
              <p style="margin:6px 0 0;font-family:${FONT_BODY};font-size:11px;color:${COLOR_FAINT};">
                <a href="https://bkalpesmotors.fr" style="color:${COLOR_FAINT};text-decoration:none;">bkalpesmotors.fr</a>
              </p>
              ${data.sessionId ? `<p style="margin:20px 0 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10px;color:#d1d5db;letter-spacing:0.04em;">Réf. ${escapeHtml(data.sessionId)}</p>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const subject = `Réservation confirmée${when ? ' - ' + when : ''}`;

  // Plain text fallback (pour clients mail qui n'affichent pas HTML)
  const textIntro = isCash
    ? `Votre réservation est confirmée. Règlement en espèces sur place.`
    : `Votre acompte de 15% a bien été reçu. Votre créneau est sécurisé.`;
  const textMontants = isCash
    ? [
        `Total prestation   : ${data.total ?? '-'}€`,
        `À régler sur place : ${data.total ?? '-'}€ en espèces`,
      ]
    : [
        `Total prestation : ${data.total ?? '-'}€`,
        `Acompte payé     : -${data.acompte ?? '-'}€`,
        `Solde sur place  : ${data.solde ?? '-'}€`,
      ];
  const textNoteSolde = isCash
    ? `Le jour de l'intervention, vous réglez ${data.total ?? '-'}€ en espèces.`
    : `Le jour de l'intervention, vous réglez le solde en espèces, virement ou carte (Apple Pay accepté).`;

  const textLines = [
    `${greeting.replace(/&#39;/g, "'")}`,
    '',
    textIntro,
    '',
    'DÉTAILS DE LA RÉSERVATION',
    '----------------------------',
    `Véhicule   : ${data.vehicleLabel || '-'}`,
    `Formule    : ${data.serviceLabel || '-'}`,
    `Date       : ${when || '-'}`,
    `Adresse    : ${data.address || '-'}`,
    optionsText ? `Options    : ${optionsText}` : '',
    travelText ? `Déplacement: ${travelText}` : '',
    '',
    'MONTANTS',
    '----------------------------',
    ...textMontants,
    '',
    textNoteSolde,
    '',
    'Une question ?',
    'Tél : 07 56 85 90 26',
    'Email : contact@bkalpesmotors.fr',
    '',
    'BK Alpes Motors - bkalpesmotors.fr',
    data.sessionId ? `Réf. ${data.sessionId}` : '',
  ].filter(Boolean).join('\n');

  return { subject, html, text: textLines };
}

module.exports = { buildConfirmationEmail };
