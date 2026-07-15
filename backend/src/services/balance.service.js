const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const Group = require('../models/Group');
const { simplifyDebts, computeNetBalances, EPSILON } = require('./debtSimplifier');
const { emitToGroup } = require('../socket');

/**
 * balance.service.js
 *
 * This is the ONLY place that should touch Mongoose for balance/settlement
 * logic. It fetches raw data, converts ObjectIds to strings (the pure engine
 * doesn't know or care about Mongoose types), and delegates all the actual
 * math to debtSimplifier.js. Keeping the DB access and the algorithm in
 * separate files is what makes the algorithm trivially unit-testable.
 */

/**
 * Computes each member's net balance in a group, accounting for both
 * expenses (who paid, who owes) and completed settlements (payments
 * already made to reduce debt).
 *
 * @param {string} groupId
 * @returns {Promise<Array<{ userId: string, amount: number }>>}
 */
async function getGroupBalances(groupId) {
  const expenses = await Expense.find({ group: groupId })
    .select('paidBy splits')
    .lean();

  // Shape Mongoose docs into the plain objects computeNetBalances expects.
  const plainExpenses = expenses.map((e) => ({
    paidBy: e.paidBy.toString(),
    splits: e.splits.map((s) => ({
      user: s.user.toString(),
      amount: s.amount,
    })),
  }));

  const netFromExpenses = computeNetBalances(plainExpenses);

  // Fold in completed settlements: if from -> to for `amount` was already
  // paid, that reduces what `from` owes and reduces what `to` is owed.
  const completedSettlements = await Settlement.find({
    group: groupId,
    status: 'completed',
  })
    .select('from to amount')
    .lean();

  const net = new Map(netFromExpenses.map((b) => [b.userId, b.amount]));

  for (const s of completedSettlements) {
    const fromId = s.from.toString();
    const toId = s.to.toString();

    net.set(fromId, (net.get(fromId) || 0) + s.amount); // debtor owes less
    net.set(toId, (net.get(toId) || 0) - s.amount); // creditor is owed less
  }

  return Array.from(net.entries())
    .map(([userId, amount]) => ({ userId, amount: Math.round(amount * 100) / 100 }))
    .filter((b) => Math.abs(b.amount) > EPSILON);
}

/**
 * The "Minimize Payments" view: net balances reduced to the smallest set
 * of suggested transactions.
 *
 * @param {string} groupId
 * @returns {Promise<Array<{ from: string, to: string, amount: number }>>}
 */
async function getSimplifiedDebts(groupId) {
  const balances = await getGroupBalances(groupId);
  return simplifyDebts(balances);
}

/**
 * Recomputes balances + simplified debts for a group and pushes them to
 * everyone currently viewing it over Socket.IO. Called by the
 * expense/settlement controllers after any write that could shift balances.
 * Never throws - a broadcast failure shouldn't fail the HTTP request that
 * triggered it, since the REST response already carries the source of truth.
 *
 * @param {string} groupId
 */
async function broadcastBalances(groupId) {
  try {
    const balances = await getGroupBalances(groupId);
    const transactions = simplifyDebts(balances);
    emitToGroup(groupId, 'balances:update', { balances, transactions });
  } catch (err) {
    console.error(`Failed to broadcast balances for group ${groupId}:`, err.message);
  }
}

/**
 * A single member's net balance within one group. 0 if they have no
 * expenses/settlements there, or are already fully settled up.
 * Used to gate "leave group" / "remove member" / "delete group".
 *
 * @param {string} groupId
 * @param {string} userId
 * @returns {Promise<number>}
 */
async function getUserBalanceInGroup(groupId, userId) {
  const balances = await getGroupBalances(groupId);
  const entry = balances.find((b) => b.userId === userId.toString());
  return entry ? entry.amount : 0;
}

/**
 * Every group a user belongs to where they still have a nonzero balance.
 * Used to gate account deletion - a user shouldn't be able to delete their
 * account while they owe money or are owed money in any group.
 *
 * @param {string} userId
 * @returns {Promise<Array<{ groupId: string, groupName: string, amount: number }>>}
 */
async function getUserOutstandingGroups(userId) {
  const groups = await Group.find({ members: userId }).select('name');
  const results = [];

  for (const group of groups) {
    const amount = await getUserBalanceInGroup(group._id.toString(), userId);
    if (Math.abs(amount) > EPSILON) {
      results.push({ groupId: group._id.toString(), groupName: group.name, amount });
    }
  }

  return results;
}

module.exports = {
  getGroupBalances,
  getSimplifiedDebts,
  broadcastBalances,
  getUserBalanceInGroup,
  getUserOutstandingGroups,
};
