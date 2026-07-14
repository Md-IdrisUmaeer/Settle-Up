const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const groupRoutes = require('./routes/group.routes');

const app = express();

// Vercel gives every project several live URLs at once - a stable
// "production" alias, a rotating git-branch alias, and a unique hash per
// deployment (plus one per PR preview). A single exact-match origin breaks
// the moment you're not on the one URL it was set to, so CLIENT_ORIGIN can
// be a comma-separated list (e.g. "https://a.vercel.app,https://b.vercel.app"),
// and any *.vercel.app origin is allowed through as a fallback for previews.
const allowedOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // No origin (server-to-server, curl, health checks) - allow.
      if (!origin) return callback(null, true);
      // No CLIENT_ORIGIN configured at all - allow everything (dev default).
      if (allowedOrigins.length === 0) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (/\.vercel\.app$/.test(new URL(origin).hostname)) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by CORS.`));
    },
  })
);
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);

// 404 fallback
app.use((req, res) => res.status(404).json({ message: 'Not found.' }));

// Centralized error handler (catches anything thrown synchronously in routes)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error.' });
});

module.exports = app;
