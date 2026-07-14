const express = require('express');
const { createExpense, listExpenses, deleteExpense } = require('../controllers/expense.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { requireGroupMember } = require('../middleware/group.middleware');

// mergeParams so this router can read :groupId from the parent router
const router = express.Router({ mergeParams: true });

router.use(requireAuth, requireGroupMember);

router.post('/', createExpense);
router.get('/', listExpenses);
router.delete('/:expenseId', deleteExpense);

module.exports = router;
