const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const groupRoutes = require('./routes/group.routes');

const app = express();

app.use(
  cors({
    // Same env var socket.js uses. Falls back to '*' so local dev (where
    // CLIENT_ORIGIN usually isn't set beyond the .env default) still works.
    origin: process.env.CLIENT_ORIGIN || '*',
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
