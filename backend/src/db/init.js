const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/bank_alerts.db');

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
    CREATE TABLE IF NOT EXISTS bank_accounts (
      id TEXT PRIMARY KEY,
      account_number TEXT NOT NULL,
      bank_name TEXT NOT NULL,
      account_name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS linked_emails (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      email TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('deposit', 'withdrawal')),
      amount REAL NOT NULL,
      description TEXT,
      transaction_date TEXT NOT NULL,
      source_email TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS daily_summaries (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      summary_date TEXT NOT NULL,
      deposit_count INTEGER DEFAULT 0,
      deposit_total REAL DEFAULT 0,
      withdrawal_count INTEGER DEFAULT 0,
      withdrawal_total REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE,
      UNIQUE(account_id, summary_date)
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('info', 'warning', 'danger')),
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tax_settings (
      id TEXT PRIMARY KEY DEFAULT 'default',
      transaction_limit_primary INTEGER DEFAULT 3000,
      transaction_limit_secondary INTEGER DEFAULT 400,
      amount_limit_secondary REAL DEFAULT 2000000,
      fiscal_year TEXT DEFAULT '2026',
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    INSERT OR IGNORE INTO tax_settings (id) VALUES ('default');

    CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_daily_summaries_account ON daily_summaries(account_id);
    CREATE INDEX IF NOT EXISTS idx_daily_summaries_date ON daily_summaries(summary_date);
    CREATE INDEX IF NOT EXISTS idx_linked_emails_account ON linked_emails(account_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_account ON alerts(account_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(is_read);
  `);

  return db;
}

if (require.main === module) {
  const db = initDatabase();
  console.log('Database initialized at:', DB_PATH);
  db.close();
}

module.exports = { initDatabase };
