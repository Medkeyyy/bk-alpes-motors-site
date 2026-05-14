// Vercel Serverless Function
// GET /api/session-summary?id=cs_test_...
// Retourne les infos publiques d'une Checkout Session (pour affichage sur la page de confirmation).
// On expose SEULEMENT ce qui est nécessaire à l'affichage (pas le payment intent complet, etc.).

const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
});

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const id = req.query.id;
    if (!id || typeof id !== 'string' || !id.startsWith('cs_')) {
      return res.status(400).json({ error: 'session_id invalide' });
    }

    const session = await stripe.checkout.sessions.retrieve(id);
    const md = session.metadata || {};

    let options = [];
    try { options = md.options ? JSON.parse(md.options) : []; } catch (_) { options = []; }

    return res.status(200).json({
      paid: session.payment_status === 'paid',
      total_eur: Number(md.total_eur) || null,
      acompte_eur: Number(md.acompte_eur) || null,
      solde_eur: Number(md.solde_eur) || null,
      date: md.date || null,
      slot: md.slot || null,
      vehicle: md.vehicle_label || null,
      service: md.service_label || null,
      address: md.address || null,
      options,
      travel_km: Number(md.travel_km) || 0,
      travel_fee_eur: Number(md.travel_fee_eur) || 0,
      payment_mode: md.payment_mode || 'acompte',
    });
  } catch (err) {
    console.error('session-summary error:', err);
    return res.status(500).json({ error: 'Erreur récupération session', detail: err.message });
  }
};
