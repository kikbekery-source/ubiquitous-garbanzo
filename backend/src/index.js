require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./db/init');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
const db = initDatabase();
console.log('Database initialized');

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, '../../frontend/build')));

// API Routes
app.use('/api/accounts', require('./routes/accounts')(db));
app.use('/api/transactions', require('./routes/transactions')(db));
app.use('/api/dashboard', require('./routes/dashboard')(db));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: { database: 'connected' },
  });
});

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  const buildIndex = path.join(__dirname, '../../frontend/build/index.html');
  const publicIndex = path.join(__dirname, 'public/index.html');
  const fs = require('fs');
  res.sendFile(fs.existsSync(buildIndex) ? buildIndex : publicIndex);
});

app.listen(PORT, () => {
  console.log(`Bank Transfer Alert System running on http://localhost:${PORT}`);
  console.log(`API: http://localhost:${PORT}/api/health`);
});
