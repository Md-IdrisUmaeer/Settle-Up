/**
 * debtSimplifier.js
 *
 * Pure logic module — intentionally has ZERO dependency on Express, Mongoose,
 * or the DB. This is what makes it trivially unit-testable and reusable
 * (e.g. could run client-side for an instant preview before hitting the API).
 *
 * The general "minimum transactions to settle debts" problem is NP-hard
 * (it's equivalent to partitioning balances into zero-sum subsets). This is
 * a greedy heuristic — match biggest creditor with biggest debtor each round.
 * It's not provably optimal in every case, but it performs very well in
 * practice and is the same approach real apps (Splitwise included) use.
 */

const EPSILON = 0.005; // treat amounts within half a cent as zero (float rounding)

/**
 * @param {Array<{ userId: string, amount: number }>} balances
 *   amount > 0  -> this user is owed money (creditor)
 *   amount < 0  -> this user owes money (debtor)
 *   amount == 0 -> already settled, ignored
 *
 * @returns {Array<{ from: string, to: string, amount: number }>}
 *   The minimal-ish set of payments that zero out every balance.
 */
function simplifyDebts(balances) {
  if (!Array.isArray(balances)) {
    throw new TypeError('simplifyDebts expects an array of { userId, amount }.');
  }

  // Defensive copy + round to cents so we don't accumulate float drift
  // across many subtractions in the while loop below.
  const cleaned = balances
    .map((b) => ({ userId: b.userId, amount: Math.round(b.amount * 100) / 100 }))
    .filter((b) => Math.abs(b.amount) > EPSILON);

  const totalSum = cleaned.reduce((acc, b) => acc + b.amount, 0);
  if (Math.abs(totalSum) > EPSILON) {
    throw new Error(
      `Balances must sum to zero (a debt-settlement invariant). Got ${totalSum}.`
    );
  }

  const creditors = cleaned
    .filter((b) => b.amount > 0)
    .sort((a, b) => b.amount - a.amount); // descending: biggest creditor first

  const debtors = cleaned
    .filter((b) => b.amount < 0)
    .sort((a, b) => a.amount - b.amount); // ascending: most negative (biggest debtor) first

  const transactions = [];
  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];

    const amount = Math.round(Math.min(creditor.amount, -debtor.amount) * 100) / 100;

    if (amount > EPSILON) {
      transactions.push({ from: debtor.userId, to: creditor.userId, amount });
    }

    creditor.amount = Math.round((creditor.amount - amount) * 100) / 100;
    debtor.amount = Math.round((debtor.amount + amount) * 100) / 100;

    if (Math.abs(creditor.amount) <= EPSILON) i++;
    if (Math.abs(debtor.amount) <= EPSILON) j++;
  }

  return transactions;
}

/**
 * Helper: turn raw group data (expenses + who-paid-what splits) into the
 * net balance array that simplifyDebts() expects. Lives here rather than
 * in balance.service.js so the whole "expenses -> balances -> settlements"
 * pipeline can be tested without touching Mongoose.
 *
 * @param {Array<{ paidBy: string, splits: Array<{ user: string, amount: number }> }>} expenses
 * @returns {Array<{ userId: string, amount: number }>}
 */
function computeNetBalances(expenses) {
  const net = new Map(); // userId -> running balance

  for (const expense of expenses) {
    const total = expense.splits.reduce((acc, s) => acc + s.amount, 0);

    // whoever paid is owed the full amount...
    net.set(expense.paidBy, (net.get(expense.paidBy) || 0) + total);

    // ...minus their own share of it (paying for yourself isn't a debt)
    for (const split of expense.splits) {
      net.set(split.user, (net.get(split.user) || 0) - split.amount);
    }
  }

  return Array.from(net.entries())
    .map(([userId, amount]) => ({ userId, amount: Math.round(amount * 100) / 100 }))
    .filter((b) => Math.abs(b.amount) > EPSILON);
}

module.exports = { simplifyDebts, computeNetBalances, EPSILON };
