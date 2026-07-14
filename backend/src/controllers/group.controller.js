const crypto = require('crypto');
const Group = require('../models/Group');
const User = require('../models/User');
const { isNonEmptyString, isValidEmail } = require('../utils/validate');

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

module.exports = {
  createGroup,
  listMyGroups,
  getGroup,
  inviteByEmail,
  previewInvite,
  joinByInviteCode,
  regenerateInviteCode,
};
