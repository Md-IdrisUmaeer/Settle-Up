const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { signToken } = require('../utils/token');
const { isNonEmptyString, isValidEmail } = require('../utils/validate');

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
    if (!user) {
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

async function getMe(req, res) {
  return res.status(200).json({ user: req.user });
}

module.exports = { signup, login, getMe };
