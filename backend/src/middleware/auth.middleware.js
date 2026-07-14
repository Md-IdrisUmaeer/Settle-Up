const { verifyToken } = require('../utils/token');
const User = require('../models/User');

/**
 * Expects: Authorization: Bearer <token>
 * On success, attaches the authenticated user's Mongo doc to req.user
 * (minus passwordHash, thanks to the User model's toJSON override... though
 * here we use the raw doc, so we explicitly deselect it below).
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Missing or malformed Authorization header.' });
  }

  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub).select('-passwordHash');

    if (!user) {
      return res.status(401).json({ message: 'User no longer exists.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

module.exports = { requireAuth };
