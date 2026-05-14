// Vercel Serverless Function
// GET /api/availability?year=2026&month=4
// Retourne les créneaux occupés et les jours pleins pour un mois donné,
// en lisant le Google Calendar "BK Alpes Motors – Réservations".

const { google } = require('googleapis');
const { parisWallclock } = require('./_paris-tz');

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

// 10 créneaux par jour, 2h30 chacun (2h prestation + 30min route/prep/rangement).
// Service 24/24, 7j/7. Les créneaux sont strictement back-to-back :
// 0h → 2h30 → 5h → 7h30 → 10h → 12h30 → 15h → 17h30 → 20h → 22h30 → (minuit).
// Pause repas prise pendant les 30min de route entre deux interventions.
const SLOTS = [
  { label: '0h00',  hour: 0,  minute: 0 },
  { label: '2h30',  hour: 2,  minute: 30 },
  { label: '5h00',  hour: 5,  minute: 0 },
  { label: '7h30',  hour: 7,  minute: 30 },
  { label: '10h00', hour: 10, minute: 0 },
  { label: '12h30', hour: 12, minute: 30 },
  { label: '15h00', hour: 15, minute: 0 },
  { label: '17h30', hour: 17, minute: 30 },
  { label: '20h00', hour: 20, minute: 0 },
  { label: '22h30', hour: 22, minute: 30 },
];
const SLOT_DURATION_MIN = 150;

function pad(n) { return String(n).padStart(2, '0'); }

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const year = parseInt(req.query.year, 10);
    const month = parseInt(req.query.month, 10);
    if (!year || !month || month < 1 || month > 12) {
      return res.status(400).json({ error: 'Paramètres year/month invalides' });
    }

    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !CALENDAR_ID) {
      return res.status(500).json({ error: 'Config Google Calendar manquante côté serveur' });
    }

    const key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const auth = new google.auth.JWT({
      email: key.client_email,
      key: key.private_key,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    });

    const calendar = google.calendar({ version: 'v3', auth });

    const monthIdx = month - 1;
    const lastDay = new Date(year, month, 0).getDate();

    const timeMin = parisWallclock(year, monthIdx, 1, 0, 0).toISOString();
    const timeMax = parisWallclock(year, monthIdx, lastDay, 23, 59).toISOString();

    const fb = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        timeZone: 'Europe/Paris',
        items: [{ id: CALENDAR_ID }],
      },
    });

    const busy = (fb.data.calendars?.[CALENDAR_ID]?.busy || []).map(b => ({
      start: new Date(b.start),
      end: new Date(b.end),
    }));

    // "Maintenant" en heure absolue — on utilise ça pour marquer comme pris
    // les créneaux déjà passés (ex: on est 13h, créneau 8h du jour = passé).
    const now = new Date();

    // Minuit Paris aujourd'hui, pour skipper les jours passés.
    const todayParis = parisWallclock(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate(),
      0, 0
    );

    const busySlots = {};
    const fullDays = [];

    for (let d = 1; d <= lastDay; d++) {
      const dayKey = `${year}-${pad(month)}-${pad(d)}`;
      const dayStart = parisWallclock(year, monthIdx, d, 0, 0);

      // Skip jours passés
      if (dayStart < todayParis) continue;

      // Ouvert 7j/7 — plus de skip dimanche

      const taken = [];
      for (const slot of SLOTS) {
        const slotStart = parisWallclock(year, monthIdx, d, slot.hour, slot.minute);
        const slotEnd = new Date(slotStart.getTime() + SLOT_DURATION_MIN * 60 * 1000);

        // Créneau dans le passé (ou qui commence dans <30min) → pris
        if (slotStart.getTime() - now.getTime() < 30 * 60 * 1000) {
          taken.push(slot.label);
          continue;
        }

        const conflict = busy.some(b => b.start < slotEnd && b.end > slotStart);
        if (conflict) taken.push(slot.label);
      }

      if (taken.length > 0) busySlots[dayKey] = taken;
      if (taken.length >= SLOTS.length) fullDays.push(dayKey);
    }

    // Cache-Control: 2 min côté edge pour éviter de cramer le quota Google API
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=60');
    return res.status(200).json({
      slots: SLOTS.map(s => s.label),
      busySlots,
      fullDays,
    });
  } catch (err) {
    console.error('availability error:', err);
    return res.status(500).json({
      error: 'Erreur lors de la récupération des créneaux',
      detail: err && err.message ? err.message : String(err),
    });
  }
};
