const { Server } = require('socket.io');
const { verifyToken } = require('./utils/token');
const User = require('./models/User');
const Group = require('./models/Group');

/**
 * socket.js
 *
 * Real-time layer for balances/activity. Kept intentionally separate from
 * the controllers: controllers stay responsible for the write + the HTTP
 * response, and just call `emitToGroup(groupId, event, payload)` afterwards
 * so a client watching that group's room sees the update immediately.
 *
 * Auth model: the same JWT used for REST calls is passed on the socket
 * handshake (`auth.token`). We verify it once on connection and attach the
 * user to the socket. Joining a specific group's room additionally checks
 * group membership, so someone can't snoop on a group's live balance feed
 * just by guessing an id.
 */

let io = null;

function initSocket(httpServer) {
  // Same reasoning as backend/src/app.js: Vercel serves your frontend from
  // several URLs at once, so allow a comma-separated CLIENT_ORIGIN list plus
  // any *.vercel.app origin as a fallback for preview/branch deployments.
  const allowedOrigins = (process.env.CLIENT_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.length === 0) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        if (/\.vercel\.app$/.test(new URL(origin).hostname)) return callback(null, true);
        return callback(new Error(`Origin ${origin} not allowed by CORS.`));
      },
      methods: ['GET', 'POST'],
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Missing auth token.'));

      const payload = verifyToken(token);
      const user = await User.findById(payload.sub).select('-passwordHash');
      if (!user) return next(new Error('User no longer exists.'));

      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid or expired token.'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('group:join', async (groupId, ack) => {
      try {
        if (typeof groupId !== 'string') throw new Error('Invalid group id.');
        const group = await Group.findById(groupId).select('members');
        if (!group) throw new Error('Group not found.');

        const isMember = group.members.some((m) => m.toString() === socket.user._id.toString());
        if (!isMember) throw new Error('Not a member of this group.');

        socket.join(roomFor(groupId));
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, message: err.message });
      }
    });

    socket.on('group:leave', (groupId) => {
      if (typeof groupId === 'string') socket.leave(roomFor(groupId));
    });
  });

  return io;
}

function roomFor(groupId) {
  return `group:${groupId}`;
}

/** Fire-and-forget: emit an event to everyone currently viewing this group. */
function emitToGroup(groupId, event, payload) {
  if (!io) return; // socket layer not initialized (e.g. in tests) - no-op
  io.to(roomFor(groupId)).emit(event, payload);
}

module.exports = { initSocket, emitToGroup };
