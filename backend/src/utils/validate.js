const mongoose = require('mongoose');

/**
 * validate.js
 *
 * Small, dependency-free validation helpers shared across controllers.
 * These exist specifically to protect the balance/debt-simplification
 * pipeline (balance.service.js / debtSimplifier.js) from ever receiving
 * malformed numbers (NaN, Infinity, negative amounts, non-numeric strings,
 * etc.) that would silently corrupt everyone's balances.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidObjectId(id) {
  return typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);
}

function isNonEmptyString(value, { max = 500 } = {}) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}

function isValidEmail(value) {
  return typeof value === 'string' && EMAIL_RE.test(value.trim()) && value.trim().length <= 254;
}

/** A "safe" finite number - rejects NaN, Infinity, strings, null, arrays, etc. */
function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Finite number strictly greater than zero (money amounts, shares, etc.). */
function isPositiveNumber(value) {
  return isFiniteNumber(value) && value > 0;
}

/** Finite number greater than or equal to zero. */
function isNonNegativeNumber(value) {
  return isFiniteNumber(value) && value >= 0;
}

/** Caps absurd amounts so a typo (or attack) can't produce Infinity-adjacent math. */
function isSaneAmount(value, { max = 100_000_000 } = {}) {
  return isPositiveNumber(value) && value <= max;
}

/**
 * Validates a splitInput-style object: { [userId]: number }.
 * Every key must be a valid ObjectId and every value a finite number
 * matching the given predicate (defaults to non-negative).
 */
function isValidNumericMap(obj, predicate = isNonNegativeNumber) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const entries = Object.entries(obj);
  if (entries.length === 0) return false;
  return entries.every(([key, val]) => isValidObjectId(key) && predicate(val));
}

module.exports = {
  isValidObjectId,
  isNonEmptyString,
  isValidEmail,
  isFiniteNumber,
  isPositiveNumber,
  isNonNegativeNumber,
  isSaneAmount,
  isValidNumericMap,
};
