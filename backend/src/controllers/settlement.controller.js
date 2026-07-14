const Settlement = require('../models/Settlement');
const { broadcastBalances } = require('../services/balance.service');
const { isValidObjectId, isSaneAmount } = require('../utils/validate');

/** POST /api/groups/:groupId/settlements - record a payment between two members */
async function createSettlement(req, res) {
  try {
    const { from, to, amount, status } = req.body;

    if (!isValidObjectId(from) || !isValidObjectId(to)) {
      return res.status(400).json({ message: 'from and to must be valid member ids.' });
    }
    if (from === to) {
      return res.status(400).json({ message: 'from and to must be different members.' });
    }
    if (!isSaneAmount(amount)) {
      return res.status(400).json({ message: 'amount must be a positive number.' });
    }

    const memberIds = req.group.members.map((m) => m.toString());
    if (!memberIds.includes(from) || !memberIds.includes(to)) {
      return res.status(400).json({ message: 'Both from and to must be group members.' });
    }

    const settlement = await Settlement.create({
      group: req.group._id,
      from,
      to,
      amount,
      // Defaults to 'pending' unless the caller explicitly marks it completed
      // (e.g. a "mark as paid" checkbox at creation time).
      status: status === 'completed' ? 'completed' : 'pending',
    });

    if (settlement.status === 'completed') {
      broadcastBalances(req.group._id.toString());
    }

    return res.status(201).json({ settlement });
  } catch (err) {
    return res.status(400).json({ message: 'Failed to create settlement.', error: err.message });
  }
}

/** GET /api/groups/:groupId/settlements - list all settlements for the group */
async function listSettlements(req, res) {
  try {
    const settlements = await Settlement.find({ group: req.group._id })
      .sort({ date: -1 })
      .populate('from', 'name email avatarUrl')
      .populate('to', 'name email avatarUrl');

    return res.status(200).json({ settlements });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to list settlements.', error: err.message });
  }
}

/**
 * PATCH /api/groups/:groupId/settlements/:settlementId
 * The main use case: flipping a pending settlement to completed once the
 * payment has actually happened (this is what moves the needle on balances,
 * since balance.service.js only counts status: 'completed').
 */
async function updateSettlementStatus(req, res) {
  try {
    const { settlementId } = req.params;
    const { status } = req.body;

    if (!isValidObjectId(settlementId)) {
      return res.status(400).json({ message: 'Invalid settlement id.' });
    }
    if (!['pending', 'completed'].includes(status)) {
      return res.status(400).json({ message: "status must be 'pending' or 'completed'." });
    }

    const settlement = await Settlement.findOneAndUpdate(
      { _id: settlementId, group: req.group._id },
      { status },
      { new: true }
    );

    if (!settlement) {
      return res.status(404).json({ message: 'Settlement not found in this group.' });
    }

    broadcastBalances(req.group._id.toString());

    return res.status(200).json({ settlement });
  } catch (err) {
    return res.status(400).json({ message: 'Failed to update settlement.', error: err.message });
  }
}

/** DELETE /api/groups/:groupId/settlements/:settlementId */
async function deleteSettlement(req, res) {
  try {
    const { settlementId } = req.params;
    if (!isValidObjectId(settlementId)) {
      return res.status(400).json({ message: 'Invalid settlement id.' });
    }

    const settlement = await Settlement.findOneAndDelete({
      _id: settlementId,
      group: req.group._id,
    });

    if (!settlement) {
      return res.status(404).json({ message: 'Settlement not found in this group.' });
    }

    if (settlement.status === 'completed') {
      broadcastBalances(req.group._id.toString());
    }

    return res.status(200).json({ message: 'Settlement deleted.' });
  } catch (err) {
    return res.status(400).json({ message: 'Failed to delete settlement.', error: err.message });
  }
}

module.exports = {
  createSettlement,
  listSettlements,
  updateSettlementStatus,
  deleteSettlement,
};
