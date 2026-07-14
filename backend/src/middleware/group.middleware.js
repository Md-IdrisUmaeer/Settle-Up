const Group = require('../models/Group');

/**
 * Expects requireAuth to have run first (needs req.user).
 * Expects the route to have a :groupId param.
 * Attaches the fetched group to req.group so downstream controllers
 * don't have to re-query it.
 */
async function requireGroupMember(req, res, next) {
  try {
    const { groupId } = req.params;
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: 'Group not found.' });
    }

    const isMember = group.members.some((m) => m.toString() === req.user._id.toString());
    if (!isMember) {
      return res.status(403).json({ message: 'You are not a member of this group.' });
    }

    req.group = group;
    next();
  } catch (err) {
    return res.status(400).json({ message: 'Invalid group id.', error: err.message });
  }
}

module.exports = { requireGroupMember };
