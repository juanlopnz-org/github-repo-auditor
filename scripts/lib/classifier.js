/**
 * Lógica de clasificación pura — sin I/O, sin llamadas a red.
 * Fácil de unit-testear.
 */

const INACTIVITY_DAYS = parseInt(process.env.INACTIVITY_DAYS ?? "30", 10);
const RISK_DAYS = INACTIVITY_DAYS * 2;

const REPO_STALE_DAYS = 30;
const REPO_ABANDONED_DAYS = 90;

/**
 * @param {string|null} dateString - ISO 8601 date string
 * @returns {number} días desde la fecha, o Infinity si es null/inválido
 */
export function daysSince(dateString) {
  if (!dateString) return Infinity;
  const past = new Date(dateString);
  if (isNaN(past.getTime())) return Infinity;
  const now = new Date();
  return Math.floor((now - past) / (1000 * 60 * 60 * 24));
}

/**
 * Clasifica una rama según sus días de inactividad.
 * ACTIVE  → < INACTIVITY_DAYS
 * RISK    → < RISK_DAYS (= INACTIVITY_DAYS × 2)
 * INACTIVE → cualquier otra cosa
 *
 * @param {number} days
 * @returns {"ACTIVE"|"RISK"|"INACTIVE"}
 */
export function branchStatus(days) {
  if (days < INACTIVITY_DAYS) return "ACTIVE";
  if (days < RISK_DAYS) return "RISK";
  return "INACTIVE";
}

/**
 * Clasifica un repositorio por actividad basada en pushed_at.
 * ACTIVE    → < 30 días
 * STALE     → < 90 días
 * ABANDONED → 90+ días
 *
 * @param {number} days
 * @returns {"ACTIVE"|"STALE"|"ABANDONED"}
 */
export function repoStatus(days) {
  if (days < REPO_STALE_DAYS) return "ACTIVE";
  if (days < REPO_ABANDONED_DAYS) return "STALE";
  return "ABANDONED";
}
