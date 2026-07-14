const Expense = require('../models/Expense');
const { broadcastBalances } = require('../services/balance.service');
const {
  isNonEmptyString,
  isSaneAmount,
  isValidObjectId,
  isNonNegativeNumber,
} = require('../utils/validate');

const SPLIT_TYPES = ['equal', 'percentage', 'exact', 'shares'];

/**
 * Given the raw request body, compute the `splits` array based on splitType.
 * @param {number} amount - total expense amount
 * @param {string} splitType - 'equal' | 'percentage' | 'exact' | 'shares'
 * @param {Array<string>} participantIds - group members involved in the split
 * @param {Object} splitInput - shape depends on splitType, see below
 */
function computeSplits(amount, splitType, participantIds, splitInput) {
  // For 'equal', participants come from participantIds directly.
  // For the other three types, they're implicit in splitInput's keys -
  // don't require participantIds to also be passed for those.
  const effectiveIds =
    splitType === 'equal' ? participantIds : Object.keys(splitInput || {});

  if (!effectiveIds || effectiveIds.length === 0) {
    throw new Error('At least one participant is required.');
  }

  switch (splitType) {
    case 'equal': {
      // Divide evenly, giving any leftover cent(s) to the first participant
      // so the split always sums exactly to `amount`.
      const base = Math.floor((amount / participantIds.length) * 100) / 100;
      const splits = participantIds.map((user) => ({ user, amount: base }));
      const remainder =
        Math.round((amount - base * participantIds.length) * 100) / 100;
      splits[0].amount = Math.round((splits[0].amount + remainder) * 100) / 100;
      return splits;
    }

    case 'percentage': {
      // splitInput: { [userId]: percentage }
      const entries = Object.entries(splitInput);
      const totalPct = entries.reduce((acc, [, pct]) => acc + pct, 0);
      if (Math.abs(totalPct - 100) > 0.01) {
        throw new Error(`Percentages must sum to 100 (got ${totalPct}).`);
      }
      const splits = entries.map(([user, pct]) => ({
        user,
        amount: Math.round(amount * (pct / 100) * 100) / 100,
      }));
      // Per-entry rounding can drift the sum off by a cent or two; correct
      // by assigning the remainder to the first entry, same as 'equal'/'shares'.
      const sum = splits.reduce((acc, s) => acc + s.amount, 0);
      const remainder = Math.round((amount - sum) * 100) / 100;
      splits[0].amount = Math.round((splits[0].amount + remainder) * 100) / 100;
      return splits;
    }

    case 'exact': {
      // splitInput: { [userId]: exactAmount }
      const entries = Object.entries(splitInput);
      const sum = entries.reduce((acc, [, amt]) => acc + amt, 0);
      if (Math.abs(sum - amount) > 0.01) {
        throw new Error(`Exact amounts must sum to the total (${amount}), got ${sum}.`);
      }
      return entries.map(([user, amt]) => ({ user, amount: amt }));
    }

    case 'shares': {
      // splitInput: { [userId]: shareCount }  e.g. { alice: 2, bob: 1 } -> alice pays 2x bob's share
      const entries = Object.entries(splitInput);
      const totalShares = entries.reduce((acc, [, shares]) => acc + shares, 0);
      if (totalShares <= 0) {
        throw new Error('Total shares must be greater than zero.');
      }
      const perShare = amount / totalShares;
      const splits = entries.map(([user, shares]) => ({
        user,
        amount: Math.round(shares * perShare * 100) / 100,
      }));
      // Assign rounding remainder to the first entry, same trick as 'equal'.
      const sum = splits.reduce((acc, s) => acc + s.amount, 0);
      const remainder = Math.round((amount - sum) * 100) / 100;
      splits[0].amount = Math.round((splits[0].amount + remainder) * 100) / 100;
      return splits;
    }

    default:
      throw new Error(`Unknown splitType: ${splitType}`);
  }
}

/**
 * Validates the raw request body BEFORE it ever reaches computeSplits/the
 * DB, so malformed numbers (NaN, Infinity, negative, non-numeric strings)
 * can never corrupt the balance-computation pipeline downstream.
 * Returns an error message string, or null if the body is well-formed.
 */
function validateExpenseInput({ description, amount, paidBy, splitType, participantIds, splitInput }) {
  if (!isNonEmptyString(description, { max: 200 })) {
    return 'description is required and must be 1-200 characters.';
  }
  if (!isSaneAmount(amount)) {
    return 'amount must be a positive number.';
  }
  if (!isValidObjectId(paidBy)) {
    return 'paidBy must be a valid member id.';
  }
  if (!SPLIT_TYPES.includes(splitType)) {
    return `splitType must be one of: ${SPLIT_TYPES.join(', ')}.`;
  }

  if (splitType === 'equal') {
    if (participantIds !== undefined) {
      if (!Array.isArray(participantIds) || participantIds.length === 0) {
        return 'participantIds must be a non-empty array.';
      }
      if (!participantIds.every(isValidObjectId)) {
        return 'participantIds contains an invalid member id.';
      }
    }
  } else {
    if (
      !splitInput ||
      typeof splitInput !== 'object' ||
      Array.isArray(splitInput) ||
      Object.keys(splitInput).length === 0
    ) {
      return 'splitInput is required for this split type.';
    }
    const entries = Object.entries(splitInput);
    if (!entries.every(([id]) => isValidObjectId(id))) {
      return 'splitInput contains an invalid member id.';
    }
    const valuePredicate = splitType === 'shares' ? isNonNegativeNumber : isNonNegativeNumber;
    if (!entries.every(([, v]) => valuePredicate(v))) {
      return 'splitInput values must be finite, non-negative numbers.';
    }
  }

  return null;
}

/** POST /api/groups/:groupId/expenses */
async function createExpense(req, res) {
  try {
    const { description, amount, category, paidBy, date, splitType, participantIds, splitInput } =
      req.body;

    const validationError = validateExpenseInput({
      description,
      amount,
      paidBy,
      splitType,
      participantIds,
      splitInput,
    });
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    // paidBy and all participants must actually be group members.
    const memberIds = req.group.members.map((m) => m.toString());
    if (!memberIds.includes(paidBy)) {
      return res.status(400).json({ message: 'paidBy must be a member of the group.' });
    }

    const ids = splitType === 'equal' ? participantIds || memberIds : Object.keys(splitInput || {});
    const invalid = ids.filter((id) => !memberIds.includes(id));
    if (invalid.length > 0) {
      return res.status(400).json({ message: `Not group members: ${invalid.join(', ')}` });
    }

    let splits;
    try {
      splits = computeSplits(amount, splitType, ids, splitInput);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }

    const expense = await Expense.create({
      group: req.group._id,
      description: description.trim(),
      amount,
      category: isNonEmptyString(category, { max: 40 }) ? category.trim() : 'General',
      paidBy,
      date,
      splitType,
      splits,
    });

    broadcastBalances(req.group._id.toString());

    return res.status(201).json({ expense });
  } catch (err) {
    return res.status(400).json({ message: 'Failed to create expense.', error: err.message });
  }
}

/** GET /api/groups/:groupId/expenses */
async function listExpenses(req, res) {
  try {
    const expenses = await Expense.find({ group: req.group._id })
      .sort({ date: -1 })
      .populate('paidBy', 'name email avatarUrl')
      .populate('splits.user', 'name email avatarUrl');

    return res.status(200).json({ expenses });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to list expenses.', error: err.message });
  }
}

/** DELETE /api/groups/:groupId/expenses/:expenseId */
async function deleteExpense(req, res) {
  try {
    const { expenseId } = req.params;
    if (!isValidObjectId(expenseId)) {
      return res.status(400).json({ message: 'Invalid expense id.' });
    }

    const expense = await Expense.findOneAndDelete({
      _id: expenseId,
      group: req.group._id, // scoped to this group so you can't delete cross-group by id guessing
    });

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found in this group.' });
    }

    broadcastBalances(req.group._id.toString());

    return res.status(200).json({ message: 'Expense deleted.' });
  } catch (err) {
    return res.status(400).json({ message: 'Failed to delete expense.', error: err.message });
  }
}

module.exports = { createExpense, listExpenses, deleteExpense, computeSplits };
