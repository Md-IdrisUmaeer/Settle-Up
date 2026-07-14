const express = require('express');
const {
  createGroup,
  listMyGroups,
  getGroup,
  inviteByEmail,
  previewInvite,
  joinByInviteCode,
  regenerateInviteCode,
} = require('../controllers/group.controller');
const { getBalances, getSimplified } = require('../controllers/balance.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireGroupMember } = require('../middleware/group.middleware');
const expenseRoutes = require('./expense.routes');
const settlementRoutes = require('./settlement.routes');

const router = express.Router();

// Public: lets an invite-link landing page show group name/size before the
// visitor has an account or is logged in.
router.get('/invite/:inviteCode/preview', previewInvite);

router.use(requireAuth); // every route below needs a logged-in user

router.post('/', createGroup);
router.get('/', listMyGroups);
router.post('/join/:inviteCode', joinByInviteCode);

router.get('/:groupId', requireGroupMember, getGroup);
router.post('/:groupId/invite/email', requireGroupMember, inviteByEmail);
router.post('/:groupId/invite/regenerate', requireGroupMember, regenerateInviteCode);

router.get('/:groupId/balances', requireGroupMember, getBalances);
router.get('/:groupId/balances/simplify', requireGroupMember, getSimplified);

// Nested expense routes: /api/groups/:groupId/expenses
router.use('/:groupId/expenses', expenseRoutes);

// Nested settlement routes: /api/groups/:groupId/settlements
router.use('/:groupId/settlements', settlementRoutes);

module.exports = router;
