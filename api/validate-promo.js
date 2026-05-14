// POST /api/validate-promo
// Body: { code: "BKAM25", total: 149 }
// Returns: { valid: true, code, type: "percent"|"amount", value, discount, newTotal }
//          OR { valid: false, error }
//
// Codes pilotés par Stripe Dashboard (Promotion codes).
// Si un code n'existe pas dans Stripe, on tombe back sur une liste locale (PROMO_FALLBACK)
// qui te permet de créer/tester des codes sans dashboard.

const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
});

// Codes locaux de secours (dev/test/promos rapides sans passer par Stripe Dashboard)
// Format : { code: { type: 'percent'|'amount', value: number } }
// - percent : value entre 1 et 100
// - amount : valeur en € (sera convertie en centimes pour Stripe)
const PROMO_FALLBACK = {
  'BKAM10': { type: 'percent', value: 10 },
  'BKAM15': { type: 'percent', value: 15 },
  'WELCOME20':  { type: 'percent', value: 20 },
  'AMI25':      { type: 'percent', value: 25 },
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ valid: false, error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const rawCode = String(body.code || '').trim().toUpperCase();
    const total = Number(body.total);

    if (!rawCode || rawCode.length < 3 || rawCode.length > 40) {
      return res.status(400).json({ valid: false, error: 'Code vide ou invalide' });
    }
    if (!Number.isFinite(total) || total <= 0) {
      return res.status(400).json({ valid: false, error: 'Montant total invalide' });
    }

    // 1) Essaie d'abord côté Stripe (source de vérité)
    try {
      const list = await stripe.promotionCodes.list({ code: rawCode, active: true, limit: 1 });
      if (list.data && list.data.length > 0) {
        const promo = list.data[0];
        const coupon = promo.coupon;
        if (!coupon.valid) {
          return res.status(200).json({ valid: false, error: 'Code expiré' });
        }
        let type, value, discount;
        if (coupon.percent_off) {
          type = 'percent';
          value = coupon.percent_off;
          discount = Math.round(total * (coupon.percent_off / 100) * 100) / 100;
        } else if (coupon.amount_off) {
          type = 'amount';
          value = coupon.amount_off / 100; // stripe stocke en centimes
          discount = Math.min(value, total);
        } else {
          return res.status(200).json({ valid: false, error: 'Coupon mal configuré' });
        }
        const newTotal = Math.max(0, Math.round((total - discount) * 100) / 100);
        return res.status(200).json({
          valid: true,
          code: rawCode,
          stripePromotionCodeId: promo.id, // utilisé lors du checkout pour lier la promo dans Stripe
          type,
          value,
          discount,
          newTotal,
          source: 'stripe',
        });
      }
    } catch (e) {
      // Stripe peut renvoyer une erreur temporaire : on retombe sur la liste locale
      console.warn('Stripe promotionCodes lookup failed, falling back to local list:', e && e.message);
    }

    // 2) Fallback liste locale
    const local = PROMO_FALLBACK[rawCode];
    if (!local) {
      return res.status(200).json({ valid: false, error: 'Code promo inconnu' });
    }
    let discount;
    if (local.type === 'percent') {
      discount = Math.round(total * (local.value / 100) * 100) / 100;
    } else {
      discount = Math.min(local.value, total);
    }
    const newTotal = Math.max(0, Math.round((total - discount) * 100) / 100);
    return res.status(200).json({
      valid: true,
      code: rawCode,
      stripePromotionCodeId: null,
      type: local.type,
      value: local.value,
      discount,
      newTotal,
      source: 'local',
    });
  } catch (err) {
    console.error('validate-promo error:', err);
    return res.status(500).json({ valid: false, error: 'Erreur serveur' });
  }
};
