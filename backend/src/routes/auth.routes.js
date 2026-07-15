const express = require('express');
const { signup, login, getMe, deleteMyAccount } = require('../controllers/auth.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/me', requireAuth, getMe);
router.delete('/me', requireAuth, deleteMyAccount);

module.exports = router;
