const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/footage.db');

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function initDatabase(dbPath = DB_PATH) {
  ensureDir(dbPath);
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      drive_folder_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clips (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      drive_file_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      mime_type TEXT,
      duration_seconds REAL,
      thumbnail_url TEXT,
      drive_web_view_link TEXT,
      drive_download_link TEXT,
      file_size INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY,
      clip_id TEXT NOT NULL UNIQUE,
      menu_name TEXT,
      scene_type TEXT CHECK(scene_type IN ('production', 'preparation', 'conversation', 'other')),
      confidence_score REAL,
      ai_raw_response TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'analyzing', 'completed', 'failed')),
      error_message TEXT,
      analyzed_at DATETIME,
      FOREIGN KEY (clip_id) REFERENCES clips(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      clip_id TEXT NOT NULL UNIQUE,
      decision TEXT CHECK(decision IN ('approved', 'edited', 'discarded')),
      final_menu_name TEXT,
      final_scene_type TEXT,
      notes TEXT,
      reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (clip_id) REFERENCES clips(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_clips_project ON clips(project_id);
    CREATE INDEX IF NOT EXISTS idx_analyses_clip ON analyses(clip_id);
    CREATE INDEX IF NOT EXISTS idx_analyses_status ON analyses(status);
    CREATE INDEX IF NOT EXISTS idx_reviews_clip ON reviews(clip_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_decision ON reviews(decision);
  `);

  return db;
}

if (require.main === module) {
  const db = initDatabase();
  console.log('Database initialized at:', DB_PATH);
  db.close();
}

module.exports = { initDatabase };
