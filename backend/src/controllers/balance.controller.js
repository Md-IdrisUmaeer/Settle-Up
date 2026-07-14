const { getGroupBalances, getSimplifiedDebts } = require('../services/balance.service');


async function getBalances(req, res) {
  try {
    const balances = await getGroupBalances(req.group._id);
    return res.status(200).json({ balances });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to compute balances.', error: err.message });
  }
}


async function getSimplified(req, res) {
  try {
    const transactions = await getSimplifiedDebts(req.group._id);
    return res.status(200).json({ transactions });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to simplify debts.', error: err.message });
  }
}

module.exports = { getBalances, getSimplified };
