/**
 * NSE cash market session (IST): Mon–Fri 09:15–15:30.
 * Pre-open not modeled; holidays not modeled (paper trading).
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function toIstParts(d) {
  const utc = d.getTime();
  const ist = new Date(utc + IST_OFFSET_MS);
  const dow = ist.getUTCDay();
  const h = ist.getUTCHours();
  const m = ist.getUTCMinutes();
  const mins = h * 60 + m;
  return { dow, mins };
}

export function isNseCashSessionOpen(date = new Date()) {
  const { dow, mins } = toIstParts(date);
  if (dow === 0 || dow === 6) return false;
  const openM = 9 * 60 + 15;
  const closeM = 15 * 60 + 30;
  return mins >= openM && mins <= closeM;
}

export function getNseStatus(date = new Date()) {
  const open = isNseCashSessionOpen(date);
  return {
    open,
    exchange: 'NSE',
    timezone: 'Asia/Kolkata',
    session: open ? 'open' : 'closed',
    message: open ? 'NSE cash market is open (IST).' : 'NSE cash market is closed (IST).',
  };
}
