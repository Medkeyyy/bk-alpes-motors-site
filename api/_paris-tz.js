// Helpers timezone Europe/Paris (partagés entre availability.js et stripe-webhook.js)

/**
 * Retourne le décalage (en heures) entre UTC et Europe/Paris à une date donnée.
 * Règle EU : DST du dernier dimanche de mars 01:00 UTC au dernier dimanche d'octobre 01:00 UTC.
 * Hiver = UTC+1, Été = UTC+2.
 */
function parisOffsetHours(date) {
  const year = date.getUTCFullYear();

  const marchLastSunday = new Date(Date.UTC(year, 2, 31));
  while (marchLastSunday.getUTCDay() !== 0) {
    marchLastSunday.setUTCDate(marchLastSunday.getUTCDate() - 1);
  }
  marchLastSunday.setUTCHours(1, 0, 0, 0);

  const octoberLastSunday = new Date(Date.UTC(year, 9, 31));
  while (octoberLastSunday.getUTCDay() !== 0) {
    octoberLastSunday.setUTCDate(octoberLastSunday.getUTCDate() - 1);
  }
  octoberLastSunday.setUTCHours(1, 0, 0, 0);

  return (date >= marchLastSunday && date < octoberLastSunday) ? 2 : 1;
}

/**
 * Construit un objet Date correspondant à l'heure WALL-CLOCK donnée en Europe/Paris.
 * Ex: parisWallclock(2026, 3, 15, 9, 0) → Date correspondant au 15 avril 2026 09:00 heure de Paris.
 */
function parisWallclock(year, monthIdx, day, hour, minute = 0) {
  const probe = new Date(Date.UTC(year, monthIdx, day, hour, minute));
  const offset = parisOffsetHours(probe);
  return new Date(Date.UTC(year, monthIdx, day, hour - offset, minute));
}

module.exports = { parisOffsetHours, parisWallclock };
