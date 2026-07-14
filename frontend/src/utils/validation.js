/**
 * validation.js
 *
 * Small client-side validators mirroring the backend's rules in
 * backend/src/utils/validate.js. These exist to give people instant
 * feedback in the UI - the backend remains the source of truth and
 * re-validates everything independently.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value) {
  return typeof value === 'string' && EMAIL_RE.test(value.trim()) && value.trim().length <= 254;
}

export function isNonEmptyString(value, { max = 500 } = {}) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}

export function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isPositiveNumber(value) {
  return isFiniteNumber(value) && value > 0;
}

export function isSaneAmount(value, { max = 100_000_000 } = {}) {
  return isPositiveNumber(value) && value <= max;
}

/** Parses a form's raw string amount input into a number, or null if invalid. */
export function parseAmount(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const n = Number(raw);
  return isSaneAmount(n) ? n : null;
}
