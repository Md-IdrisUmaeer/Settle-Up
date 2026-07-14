const express = require('express');
const {
  createSettlement,
  listSettlements,
  updateSettlementStatus,
  deleteSettlement,
} = require('../controllers/settlement.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireGroupMember } = require('../middleware/group.middleware');

const router = express.Router({ mergeParams: true });

router.use(requireAuth, requireGroupMember);

router.post('/', createSettlement);
router.get('/', listSettlements);
router.patch('/:settlementId', updateSettlementStatus);
router.delete('/:settlementId', deleteSettlement);

module.exports = router;
