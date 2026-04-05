require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./db/init');
const driveService = require('./services/googleDrive');
const geminiAnalyzer = require('./services/geminiAnalyzer');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
const db = initDatabase();

// Initialize services
(async () => {
  await driveService.init();
  geminiAnalyzer.init();
  console.log('Services initialized');
})();

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, '../../frontend/build')));

// API Routes
app.use('/api/projects', require('./routes/projects')(db));
app.use('/api/clips', require('./routes/clips')(db));
app.use('/api/export', require('./routes/export')(db));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: 'connected',
      googleDrive: driveService.mockMode ? 'mock' : 'connected',
      gemini: geminiAnalyzer.mockMode ? 'mock' : 'connected',
    },
  });
});

// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  const publicIndex = path.join(__dirname, 'public/index.html');
  const buildIndex = path.join(__dirname, '../../frontend/build/index.html');
  const fs = require('fs');
  res.sendFile(fs.existsSync(buildIndex) ? buildIndex : publicIndex);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api/health`);
});
