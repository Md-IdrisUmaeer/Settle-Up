const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Group = require('../models/Group');
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const { signToken } = require('../utils/token');
const { isNonEmptyString, isValidEmail } = require('../utils/validate');
const { getUserOutstandingGroups } = require('../services/balance.service');

const SALT_ROUNDS = 10;

async function signup(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!isNonEmptyString(name, { max: 80 })) {
      return res.status(400).json({ message: 'name is required and must be 1-80 characters.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'A valid email is required.' });
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
      return res.status(400).json({ message: 'Password must be 8-200 characters.' });
    }

    const existing = await User.findOne({ email: email.trim().toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'An account with that email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
    });

    const token = signToken(user._id.toString());
    return res.status(201).json({ user, token });
  } catch (err) {
    return res.status(500).json({ message: 'Signup failed.', error: err.message });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!isValidEmail(email) || typeof password !== 'string' || password.length === 0) {
      return res.status(400).json({ message: 'A valid email and password are required.' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || user.isDeleted) {
      // Same generic message either way - don't reveal whether the account
      // exists, was deleted, or the password was just wrong.
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = signToken(user._id.toString());
    return res.status(200).json({ user, token });
  } catch (err) {
    return res.status(500).json({ message: 'Login failed.', error: err.message });
  }
}

/**
 * DELETE /api/auth/me - delete (soft-delete) the current user's account.
 *
 * This is intentionally a soft delete, not a hard delete: past expenses and
 * settlements keep referencing this user's _id so group ledgers stay
 * intact and readable for everyone else ("Deleted User" instead of a
 * dangling reference). The account itself is anonymized and can no longer
 * log in (enforced in login() and requireAuth).
 *
 * Two things must be true before we allow it:
 *  1. The user has no outstanding balance (owed or owes) in any group.
 *  2. The user isn't the sole owner of a group that still has other
 *     members - they must transfer ownership or delete that group first.
 * Groups where the user is the owner AND the only member are auto-deleted
 * along with their (necessarily balance-free) expense/settlement history.
 */
async function deleteMyAccount(req, res) {
  try {
    const userId = req.user._id;

    const outstanding = await getUserOutstandingGroups(userId);
    if (outstanding.length > 0) {
      return res.status(409).json({
        message:
          'You have an outstanding balance in one or more groups. Settle up before deleting your account.',
        groups: outstanding,
      });
    }

    const groups = await Group.find({ members: userId });

    const blockedByOwnership = groups.filter(
      (g) => g.createdBy.toString() === userId.toString() && g.members.length > 1
    );
    if (blockedByOwnership.length > 0) {
      return res.status(409).json({
        message:
          'You own one or more groups with other members. Transfer ownership or delete those groups before deleting your account.',
        groups: blockedByOwnership.map((g) => ({ groupId: g._id, groupName: g.name })),
      });
    }

    const soloOwnedGroups = groups.filter(
      (g) => g.createdBy.toString() === userId.toString() && g.members.length === 1
    );
    const otherGroups = groups.filter(
      (g) => !soloOwnedGroups.some((sg) => sg._id.toString() === g._id.toString())
    );

    for (const group of soloOwnedGroups) {
      await Expense.deleteMany({ group: group._id });
      await Settlement.deleteMany({ group: group._id });
      await group.deleteOne();
    }

    for (const group of otherGroups) {
      group.members = group.members.filter((m) => m.toString() !== userId.toString());
      await group.save();
    }

    const user = await User.findById(userId);
    user.isDeleted = true;
    user.deletedAt = new Date();
    user.name = 'Deleted User';
    user.email = `deleted-${userId}-${crypto.randomBytes(4).toString('hex')}@settleup.invalid`;
    user.passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), SALT_ROUNDS);
    user.avatarUrl = '';
    await user.save();

    return res.status(200).json({ message: 'Account deleted.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete account.', error: err.message });
  }
}

async function getMe(req, res) {
  return res.status(200).json({ user: req.user });
}

module.exports = { signup, login, getMe, deleteMyAccount };
