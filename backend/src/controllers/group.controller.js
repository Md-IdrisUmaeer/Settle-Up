const crypto = require('crypto');
const Group = require('../models/Group');
const User = require('../models/User');
const Expense = require('../models/Expense');
const Settlement = require('../models/Settlement');
const { isNonEmptyString, isValidEmail } = require('../utils/validate');
const { getUserBalanceInGroup, getGroupBalances } = require('../services/balance.service');
const { emitToGroup } = require('../socket');

/** POST /api/groups - create a group, creator auto-joins as first member */
async function createGroup(req, res) {
  try {
    const { name } = req.body;
    if (!isNonEmptyString(name, { max: 80 })) {
      return res
        .status(400)
        .json({ message: 'name is required and must be 1-80 characters.' });
    }

    const group = await Group.create({
      name: name.trim(),
      members: [req.user._id],
      createdBy: req.user._id,
      inviteCode: crypto.randomBytes(6).toString('hex'),
    });

    return res.status(201).json({ group });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create group.', error: err.message });
  }
}

/** GET /api/groups - list groups the current user belongs to */
async function listMyGroups(req, res) {
  try {
    const groups = await Group.find({ members: req.user._id }).populate(
      'members',
      'name email avatarUrl'
    );
    return res.status(200).json({ groups });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to list groups.', error: err.message });
  }
}

/** GET /api/groups/:groupId - detail (requires requireGroupMember middleware) */
async function getGroup(req, res) {
  const group = await req.group.populate('members', 'name email avatarUrl');
  return res.status(200).json({ group });
}

/** POST /api/groups/:groupId/invite/email - invite an existing user by email */
async function inviteByEmail(req, res) {
  try {
    const { email } = req.body;
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'A valid email is required.' });
    }

    const invitee = await User.findOne({ email: email.trim().toLowerCase() });
    if (!invitee) {
      return res.status(404).json({
        message: 'No account found with that email. Share the invite link instead.',
      });
    }

    const alreadyMember = req.group.members.some(
      (m) => m.toString() === invitee._id.toString()
    );
    if (alreadyMember) {
      return res.status(409).json({ message: 'That user is already a member.' });
    }

    req.group.members.push(invitee._id);
    await req.group.save();

    return res.status(200).json({ group: req.group });
  } catch (err) {
    return res.status(500).json({ message: 'Invite failed.', error: err.message });
  }
}

/**
 * GET /api/groups/invite/:inviteCode/preview - public (no auth required).
 * Lets an invite-link landing page show "You've been invited to join X"
 * with a member count, without exposing full group/member data to someone
 * who isn't a member yet.
 */
async function previewInvite(req, res) {
  try {
    const { inviteCode } = req.params;
    if (!isNonEmptyString(inviteCode, { max: 64 })) {
      return res.status(404).json({ message: 'Invalid invite link.' });
    }

    const group = await Group.findOne({ inviteCode }).select('name members');
    if (!group) {
      return res.status(404).json({ message: 'This invite link is invalid or has expired.' });
    }

    return res.status(200).json({
      group: { name: group.name, memberCount: group.members.length },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load invite.', error: err.message });
  }
}

/** POST /api/groups/join/:inviteCode - join via shareable link, no prior membership needed */
async function joinByInviteCode(req, res) {
  try {
    const { inviteCode } = req.params;
    if (!isNonEmptyString(inviteCode, { max: 64 })) {
      return res.status(404).json({ message: 'Invalid invite link.' });
    }

    const group = await Group.findOne({ inviteCode });

    if (!group) {
      return res.status(404).json({ message: 'Invalid invite link.' });
    }

    const alreadyMember = group.members.some((m) => m.toString() === req.user._id.toString());
    if (!alreadyMember) {
      group.members.push(req.user._id);
      await group.save();
    }

    return res.status(200).json({ group });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to join group.', error: err.message });
  }
}

/**
 * POST /api/groups/:groupId/invite/regenerate - invalidate the old invite
 * link and issue a new one. Restricted to the group creator so a member
 * can't accidentally lock everyone else out of sharing the "current" link.
 */
async function regenerateInviteCode(req, res) {
  try {
    if (req.group.createdBy.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: 'Only the group creator can regenerate the invite link.' });
    }

    req.group.inviteCode = crypto.randomBytes(6).toString('hex');
    await req.group.save();

    return res.status(200).json({ group: req.group });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to regenerate invite link.', error: err.message });
  }
}

/**
 * DELETE /api/groups/:groupId/members/:userId - owner removes another
 * member. The owner can't remove themself this way (use leaveGroup, which
 * requires transferring ownership first, or deleteGroup). The target must
 * be settled up in this group before they can be removed, so removing
 * someone can never silently erase a debt.
 */
async function removeMember(req, res) {
  try {
    const { userId } = req.params;

    if (req.group.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the group owner can remove members.' });
    }
    if (userId === req.user._id.toString()) {
      return res.status(400).json({
        message: 'The owner can\'t remove themself. Transfer ownership or delete the group instead.',
      });
    }

    const isMember = req.group.members.some((m) => m.toString() === userId);
    if (!isMember) {
      return res.status(404).json({ message: 'That user is not a member of this group.' });
    }

    const balance = await getUserBalanceInGroup(req.group._id.toString(), userId);
    if (Math.abs(balance) > 0.01) {
      return res.status(409).json({
        message: 'This member has an outstanding balance in this group and can\'t be removed until they settle up.',
      });
    }

    req.group.members = req.group.members.filter((m) => m.toString() !== userId);
    await req.group.save();

    emitToGroup(req.group._id.toString(), 'group:memberRemoved', { userId });

    return res.status(200).json({ group: req.group });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to remove member.', error: err.message });
  }
}

/**
 * POST /api/groups/:groupId/leave - a member removes themself.
 * - Owner leaving a group that still has other members must transfer
 *   ownership first (prevents an ownerless group).
 * - Owner leaving a group where they're the only member deletes the whole
 *   group (trivially balance-free, since there's no one to owe).
 * - Anyone else must be settled up in this group first.
 */
async function leaveGroup(req, res) {
  try {
    const isOwner = req.group.createdBy.toString() === req.user._id.toString();

    if (isOwner) {
      if (req.group.members.length > 1) {
        return res.status(409).json({
          message: 'Transfer ownership to another member before leaving this group.',
        });
      }
      await Expense.deleteMany({ group: req.group._id });
      await Settlement.deleteMany({ group: req.group._id });
      await req.group.deleteOne();
      return res.status(200).json({ message: 'Group deleted (you were the only member).' });
    }

    const balance = await getUserBalanceInGroup(req.group._id.toString(), req.user._id.toString());
    if (Math.abs(balance) > 0.01) {
      return res.status(409).json({
        message: 'Settle up before leaving this group.',
      });
    }

    req.group.members = req.group.members.filter(
      (m) => m.toString() !== req.user._id.toString()
    );
    await req.group.save();

    emitToGroup(req.group._id.toString(), 'group:memberLeft', { userId: req.user._id.toString() });

    return res.status(200).json({ message: 'You left the group.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to leave group.', error: err.message });
  }
}

/**
 * POST /api/groups/:groupId/transfer-ownership - hand off the owner role
 * to another existing member. Owner-only.
 */
async function transferOwnership(req, res) {
  try {
    if (req.group.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the group owner can transfer ownership.' });
    }

    const { newOwnerId } = req.body;
    if (!isNonEmptyString(newOwnerId)) {
      return res.status(400).json({ message: 'newOwnerId is required.' });
    }

    const isMember = req.group.members.some((m) => m.toString() === newOwnerId);
    if (!isMember) {
      return res.status(400).json({ message: 'The new owner must already be a member of this group.' });
    }

    req.group.createdBy = newOwnerId;
    await req.group.save();

    emitToGroup(req.group._id.toString(), 'group:ownerChanged', { newOwnerId });

    return res.status(200).json({ group: req.group });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to transfer ownership.', error: err.message });
  }
}

/**
 * DELETE /api/groups/:groupId - permanently delete a group and its
 * expense/settlement history. Owner-only, and only once everyone is
 * settled up (no unresolved balances get silently wiped).
 */
async function deleteGroup(req, res) {
  try {
    if (req.group.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the group owner can delete this group.' });
    }

    const balances = await getGroupBalances(req.group._id.toString());
    if (balances.length > 0) {
      return res.status(409).json({
        message: 'Everyone must be settled up before this group can be deleted.',
        balances,
      });
    }

    const groupId = req.group._id.toString();

    await Expense.deleteMany({ group: req.group._id });
    await Settlement.deleteMany({ group: req.group._id });
    await req.group.deleteOne();

    emitToGroup(groupId, 'group:deleted', { groupId });

    return res.status(200).json({ message: 'Group deleted.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete group.', error: err.message });
  }
}

module.exports = {
  createGroup,
  listMyGroups,
  getGroup,
  inviteByEmail,
  previewInvite,
  joinByInviteCode,
  regenerateInviteCode,
  removeMember,
  leaveGroup,
  transferOwnership,
  deleteGroup,
};
