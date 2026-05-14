// Vercel Serverless Function
// POST /api/create-checkout-session
// Crée une session Stripe Checkout pour l'acompte (15%) d'une réservation BK Alpes Motors.

const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
});

// Labels utilisés pour afficher dans Stripe (description produit + metadata)
const VEHICLE_LABELS = {
  citadine: 'Citadine',
  berline: 'Berline',
  suv: 'SUV / 4x4',
  moto: 'Moto',
  scooter: 'Scooter',
  utilitaire: 'Utilitaire',
  premium: 'Premium / Sport',
  canape: 'Canapé',
  'tapis-matelas': 'Tapis / Matelas / Moquette',
  demande: 'Demande spécifique',
};

const SERVICE_LABELS = {
  confort: 'Pack Confort (80€)',
  concession: 'Pack Prestige (119€)',
  devis: 'Sur devis',
  canape: 'Nettoyage textile',
};

// Valide côté serveur un code promo (copie réduite de validate-promo.js pour éviter tout abus client)
const PROMO_FALLBACK = {
  'BKAM10': { type: 'percent', value: 10 },
  'BKAM15': { type: 'percent', value: 15 },
  'WELCOME20':  { type: 'percent', value: 20 },
  'AMI25':      { type: 'percent', value: 25 },
};

async function resolvePromoServerSide(rawCode, total) {
  if (!rawCode) return null;
  const code = String(rawCode).trim().toUpperCase();
  // 1) Stripe
  try {
    const list = await stripe.promotionCodes.list({ code, active: true, limit: 1 });
    if (list.data && list.data.length > 0) {
      const promo = list.data[0];
      const coupon = promo.coupon;
      if (!coupon.valid) return null;
      let type, value, discount;
      if (coupon.percent_off) {
        type = 'percent';
        value = coupon.percent_off;
        discount = Math.round(total * (coupon.percent_off / 100) * 100) / 100;
      } else if (coupon.amount_off) {
        type = 'amount';
        value = coupon.amount_off / 100;
        discount = Math.min(value, total);
      } else return null;
      return { code, type, value, discount, stripePromotionCodeId: promo.id, source: 'stripe' };
    }
  } catch (e) {
    console.warn('promo Stripe lookup failed (server):', e && e.message);
  }
  // 2) Fallback local
  const local = PROMO_FALLBACK[code];
  if (!local) return null;
  const discount = local.type === 'percent'
    ? Math.round(total * (local.value / 100) * 100) / 100
    : Math.min(local.value, total);
  return { code, type: local.type, value: local.value, discount, stripePromotionCodeId: null, source: 'local' };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

    const {
      type,
      service,
      address,
      date,
      slot,
      options = [],
      total,                 // total brut (avant remise)
      totalAfterDiscount,    // total après remise (base de l'acompte)
      acompte,
      travelFee = 0,
      travelKm = 0,
      promo = null,          // { code, type, value, stripePromotionCodeId } — fourni par le client, re-validé ici
      admin = false,         // mode admin : génère un Payment Link court (buy.stripe.com/...) au lieu d'une Checkout Session
      customLineItems = null, // mode admin demande spécifique : array de { name, type, price }
      paymentMode = 'acompte', // 'acompte' (15%) ou 'total' (100%) — admin peut choisir
    } = body;

    // Validation des montants
    // En mode admin avec customLineItems, total/acompte sont calculés par le serveur depuis les line_items
    const isCustomBasket = admin && Array.isArray(customLineItems) && customLineItems.length > 0;
    const totalInt = Number(total);
    const acompteInt = Number(acompte);
    if (!isCustomBasket) {
      if (!Number.isFinite(totalInt) || !Number.isFinite(acompteInt) || acompteInt <= 0 || acompteInt > totalInt) {
        return res.status(400).json({ error: 'Montants invalides' });
      }
    }

    // Re-validation serveur du code promo (ne jamais faire confiance au client pour la remise)
    let resolvedPromo = null;
    let effectiveTotal = totalInt;
    if (promo && promo.code) {
      resolvedPromo = await resolvePromoServerSide(promo.code, totalInt);
      if (!resolvedPromo) {
        return res.status(400).json({ error: `Code promo "${promo.code}" invalide ou expiré` });
      }
      effectiveTotal = Math.max(0, Math.round((totalInt - resolvedPromo.discount) * 100) / 100);
    }

    // Validation de l'acompte
    if (!admin) {
      // Mode client : uniquement 15%
      const expectedAcompte = Math.ceil(effectiveTotal * 0.15);
      if (Math.abs(acompteInt - expectedAcompte) > 1) {
        return res.status(400).json({
          error: 'Acompte non conforme (attendu ~15% du total après remise)',
          expected: expectedAcompte,
          received: acompteInt,
        });
      }
    }
    // Mode admin : on accepte acompte = 15% ou 100% selon paymentMode

    const origin = req.headers.origin
      || (req.headers.host ? `https://${req.headers.host}` : 'https://bkalpesmotors.fr');

    const vehicleLabel = VEHICLE_LABELS[type] || type || 'Véhicule';
    const serviceLabel = SERVICE_LABELS[service] || service || 'Prestation';

    // Format date lisible pour Stripe
    let whenLabel = '';
    if (date && slot) {
      try {
        const d = new Date(date + 'T00:00:00');
        const jours = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
        const mois = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
        whenLabel = `${jours[d.getDay()]} ${d.getDate()} ${mois[d.getMonth()]} · ${slot}`;
      } catch (_) { whenLabel = `${date} · ${slot}`; }
    }
    const discountNote = resolvedPromo
      ? `\nCode promo ${resolvedPromo.code} : -${resolvedPromo.discount}€`
      : '';
    const soldeSurPlace = paymentMode === 'total' ? 0 : (effectiveTotal - acompteInt);

    // Options texte
    const optionsText = Array.isArray(options) && options.length
      ? '\nOptions : ' + options.map(o => o.name + (o.price ? ` (+${o.price}€)` : '')).join(', ')
      : '';

    const descriptionLines = [
      `${vehicleLabel} · ${serviceLabel}`,
      whenLabel ? `📅 ${whenLabel}` : '',
      address ? `📍 ${address}` : '',
      optionsText,
      discountNote,
      '',
      paymentMode === 'total'
        ? `💰 Total : ${effectiveTotal}€ — Paiement intégral`
        : `💰 Total prestation : ${effectiveTotal}€\n💳 Acompte en ligne : ${acompteInt}€\n🏠 Solde sur place : ${soldeSurPlace}€`,
    ].filter(v => v !== undefined && v !== null);

    const description = descriptionLines.join('\n').trim().slice(0, 500);

    // Metadata commun aux deux modes
    const sharedMetadata = {
      vehicle_type: String(type || '').slice(0, 100),
      vehicle_label: vehicleLabel.slice(0, 100),
      service: String(service || '').slice(0, 100),
      service_label: serviceLabel.slice(0, 100),
      address: String(address || '').slice(0, 500),
      date: String(date || ''),
      slot: String(slot || ''),
      options: JSON.stringify(options || []).slice(0, 500),
      travel_km: String(travelKm || 0),
      travel_fee_eur: String(travelFee || 0),
      total_brut_eur: String(totalInt),
      discount_eur: String(resolvedPromo ? resolvedPromo.discount : 0),
      promo_code: resolvedPromo ? resolvedPromo.code : '',
      total_final_eur: String(effectiveTotal),
      acompte_eur: String(acompteInt),
      solde_eur: String(soldeSurPlace),
      payment_mode: paymentMode === 'total' ? 'total' : 'acompte',
      source: admin ? 'admin' : 'client',
    };

    // ============================================================
    // MODE ADMIN → Stripe Payment Link (URL courte buy.stripe.com)
    // ============================================================
    if (admin) {
      let lineItems = [];

      // Cas 1 : demande spécifique → 1 ligne par prestation du panier
      // (chaque ligne apparaît séparément sur la page Stripe du client)
      if (Array.isArray(customLineItems) && customLineItems.length > 0) {
        const TYPE_LABELS = {
          utilitaire: 'Lavage utilitaire / van',
          tapis: 'Nettoyage tapis',
          matelas: 'Nettoyage matelas',
          moquette: 'Nettoyage moquette',
          canape: 'Nettoyage canapé',
          fauteuil: 'Nettoyage fauteuil',
          option: 'Option / supplément',
          autre: 'Prestation',
        };
        const built = [];
        let computedTotal = 0;
        for (const it of customLineItems) {
          const p = Math.round(Number(it.price) * 100);
          if (!Number.isFinite(p) || p <= 0) continue;
          const baseLabel = TYPE_LABELS[it.type] || 'Prestation';
          const detail = (it.name && it.name !== baseLabel) ? ` · ${String(it.name).slice(0, 80)}` : '';
          const product = await stripe.products.create({
            name: `BK Alpes Motors · ${baseLabel}${detail}`.slice(0, 250),
            metadata: { type: String(it.type || ''), label: String(it.name || '').slice(0, 200) },
          });
          const price = await stripe.prices.create({
            product: product.id,
            currency: 'eur',
            unit_amount: p,
          });
          built.push({ price: price.id, quantity: 1 });
          computedTotal += Number(it.price);
        }
        if (built.length === 0) {
          return res.status(400).json({ error: 'Panier vide ou prix invalides' });
        }
        // L'acompte 15% est appliqué sur la somme du panier (ou prix manuel si surchargé via override)
        // En mode demande spécifique, on facture le TOTAL directement (pas un acompte)
        // car l'admin a fixé chaque prix manuellement → c'est le prix réel à payer
        // Sauf si on veut quand même un acompte. Comportement choisi : facturer le TOTAL des lignes
        // (l'admin peut toujours ajuster les montants ligne par ligne pour faire un "acompte")
        lineItems = built;

        // Override metadata : récap des prestations
        sharedMetadata.line_items_summary = JSON.stringify(
          customLineItems.map(it => ({ t: it.type, n: it.name, p: it.price }))
        ).slice(0, 500);
        sharedMetadata.total_brut_eur = String(computedTotal);
        sharedMetadata.total_final_eur = String(computedTotal);
        sharedMetadata.acompte_eur = String(computedTotal); // total = ce qui est payé
        sharedMetadata.solde_eur = '0';
      } else {
        // Cas 2 : flux classique — 1 seule ligne d'acompte (15%)
        const product = await stripe.products.create({
          name: `BK Alpes Motors · Acompte ${vehicleLabel} · ${whenLabel || 'date à confirmer'}`,
          description: description.slice(0, 350),
          metadata: sharedMetadata,
        });
        const price = await stripe.prices.create({
          product: product.id,
          currency: 'eur',
          unit_amount: Math.round(acompteInt * 100),
        });
        lineItems = [{ price: price.id, quantity: 1 }];
      }

      const paymentLink = await stripe.paymentLinks.create({
        line_items: lineItems,
        // Limite 1 paiement → désactive automatiquement après usage
        restrictions: { completed_sessions: { limit: 1 } },
        after_completion: {
          type: 'redirect',
          redirect: { url: `${origin}/reservation-confirmee?session_id={CHECKOUT_SESSION_ID}` },
        },
        metadata: sharedMetadata,
        phone_number_collection: { enabled: true },
      });

      return res.status(200).json({
        url: paymentLink.url,            // ex: https://buy.stripe.com/abc123
        id: paymentLink.id,
        appliedPromo: resolvedPromo,
        mode: 'payment_link',
        lineItemsCount: lineItems.length,
      });
    }

    // ============================================================
    // MODE CLIENT (par défaut) → Checkout Session classique
    // ============================================================
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: 'fr',
      payment_method_types: ['card', 'link'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'BK Alpes Motors · Acompte réservation (15%)',
              description,
            },
            unit_amount: Math.round(acompteInt * 100),
          },
          quantity: 1,
        },
      ],
      billing_address_collection: 'auto',
      phone_number_collection: { enabled: true },
      success_url: `${origin}/reservation-confirmee?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/reserver`,
      metadata: sharedMetadata,
      payment_intent_data: {
        description: `BK Alpes Motors · ${vehicleLabel} · ${whenLabel}${discountNote}`.slice(0, 1000),
        metadata: {
          date: String(date || ''),
          slot: String(slot || ''),
          total_brut_eur: String(totalInt),
          discount_eur: String(resolvedPromo ? resolvedPromo.discount : 0),
          promo_code: resolvedPromo ? resolvedPromo.code : '',
          total_final_eur: String(effectiveTotal),
          acompte_eur: String(acompteInt),
          solde_eur: String(effectiveTotal - acompteInt),
        },
      },
    });

    return res.status(200).json({ url: session.url, id: session.id, appliedPromo: resolvedPromo });
  } catch (err) {
    console.error('create-checkout-session error:', err);
    return res.status(500).json({
      error: 'Erreur lors de la création de la session de paiement',
      detail: err && err.message ? err.message : String(err),
    });
  }
};
