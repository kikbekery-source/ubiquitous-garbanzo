const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

module.exports = function (db) {
  // List transactions for an account
  router.get('/account/:accountId', (req, res) => {
    const { type, startDate, endDate, limit = 50, offset = 0 } = req.query;
    let query = 'SELECT * FROM transactions WHERE account_id = ?';
    const params = [req.params.accountId];

    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    if (startDate) {
      query += ' AND transaction_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND transaction_date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY transaction_date DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const transactions = db.prepare(query).all(...params);
    const total = db.prepare(
      'SELECT COUNT(*) as count FROM transactions WHERE account_id = ?'
    ).get(req.params.accountId);

    res.json({ transactions, total: total.count });
  });

  // Add single transaction
  router.post('/', (req, res) => {
    const { accountId, type, amount, description, transactionDate } = req.body;

    if (!accountId || !type || !amount || !transactionDate) {
      return res.status(400).json({ error: 'accountId, type, amount, and transactionDate are required' });
    }
    if (!['deposit', 'withdrawal'].includes(type)) {
      return res.status(400).json({ error: 'type must be deposit or withdrawal' });
    }

    const account = db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(accountId);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const id = uuidv4();
    db.prepare(`
      INSERT INTO transactions (id, account_id, type, amount, description, transaction_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, accountId, type, parseFloat(amount), description || null, transactionDate);

    // Update daily summary
    updateDailySummary(db, accountId, transactionDate);

    // Check tax thresholds and create alerts if needed
    checkAndCreateAlerts(db, accountId);

    const transaction = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    res.status(201).json(transaction);
  });

  // Batch add transactions
  router.post('/batch', (req, res) => {
    const { transactions: txns } = req.body;
    if (!Array.isArray(txns) || txns.length === 0) {
      return res.status(400).json({ error: 'transactions array is required' });
    }

    const insertTx = db.prepare(`
      INSERT INTO transactions (id, account_id, type, amount, description, transaction_date, source_email)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((items) => {
      const results = [];
      const affectedAccounts = new Set();
      const affectedDates = new Map();

      for (const tx of items) {
        if (!tx.accountId || !tx.type || !tx.amount || !tx.transactionDate) continue;
        if (!['deposit', 'withdrawal'].includes(tx.type)) continue;

        const id = uuidv4();
        insertTx.run(id, tx.accountId, tx.type, parseFloat(tx.amount),
          tx.description || null, tx.transactionDate, tx.sourceEmail || null);
        results.push(id);
        affectedAccounts.add(tx.accountId);

        const key = `${tx.accountId}:${tx.transactionDate}`;
        if (!affectedDates.has(key)) {
          affectedDates.set(key, { accountId: tx.accountId, date: tx.transactionDate });
        }
      }

      // Update daily summaries
      for (const { accountId, date } of affectedDates.values()) {
        updateDailySummary(db, accountId, date);
      }

      // Check alerts for all affected accounts
      for (const accountId of affectedAccounts) {
        checkAndCreateAlerts(db, accountId);
      }

      return results;
    });

    const ids = insertMany(txns);
    res.status(201).json({ message: `Added ${ids.length} transactions`, count: ids.length });
  });

  // Delete transaction
  router.delete('/:id', (req, res) => {
    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });

    db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
    updateDailySummary(db, tx.account_id, tx.transaction_date);
    checkAndCreateAlerts(db, tx.account_id);

    res.json({ message: 'Transaction deleted' });
  });

  // Get daily summary for an account
  router.get('/summary/:accountId', (req, res) => {
    const { startDate, endDate } = req.query;
    const year = new Date().getFullYear().toString();
    const start = startDate || `${year}-01-01`;
    const end = endDate || `${year}-12-31`;

    const summaries = db.prepare(`
      SELECT * FROM daily_summaries
      WHERE account_id = ? AND summary_date BETWEEN ? AND ?
      ORDER BY summary_date DESC
    `).all(req.params.accountId, start, end);

    res.json(summaries);
  });

  return router;
};

function updateDailySummary(db, accountId, date) {
  const stats = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'deposit' THEN 1 ELSE 0 END), 0) as deposit_count,
      COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0) as deposit_total,
      COALESCE(SUM(CASE WHEN type = 'withdrawal' THEN 1 ELSE 0 END), 0) as withdrawal_count,
      COALESCE(SUM(CASE WHEN type = 'withdrawal' THEN amount ELSE 0 END), 0) as withdrawal_total
    FROM transactions
    WHERE account_id = ? AND transaction_date = ?
  `).get(accountId, date);

  const { v4: uuidv4 } = require('uuid');

  db.prepare(`
    INSERT INTO daily_summaries (id, account_id, summary_date, deposit_count, deposit_total, withdrawal_count, withdrawal_total)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(account_id, summary_date) DO UPDATE SET
      deposit_count = excluded.deposit_count,
      deposit_total = excluded.deposit_total,
      withdrawal_count = excluded.withdrawal_count,
      withdrawal_total = excluded.withdrawal_total
  `).run(uuidv4(), accountId, date, stats.deposit_count, stats.deposit_total,
    stats.withdrawal_count, stats.withdrawal_total);
}

function checkAndCreateAlerts(db, accountId) {
  const year = new Date().getFullYear().toString();
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const settings = db.prepare('SELECT * FROM tax_settings WHERE id = ?').get('default');

  const stats = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'deposit' THEN 1 ELSE 0 END), 0) as deposit_count,
      COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0) as deposit_total
    FROM transactions
    WHERE account_id = ? AND transaction_date BETWEEN ? AND ?
  `).get(accountId, startDate, endDate);

  const { v4: uuidv4 } = require('uuid');

  const rule1_percent = (stats.deposit_count / settings.transaction_limit_primary) * 100;
  const rule2_active = stats.deposit_count >= settings.transaction_limit_secondary;
  const rule2_amount_percent = (stats.deposit_total / settings.amount_limit_secondary) * 100;

  // Rule 1: 3000 transactions
  if (rule1_percent >= 90 && rule1_percent < 100) {
    const existing = db.prepare(`
      SELECT id FROM alerts WHERE account_id = ? AND alert_type = 'rule1_warning_90'
      AND created_at >= date('now', '-1 day')
    `).get(accountId);
    if (!existing) {
      db.prepare('INSERT INTO alerts (id, account_id, alert_type, message, severity) VALUES (?, ?, ?, ?, ?)')
        .run(uuidv4(), accountId, 'rule1_warning_90',
          `บัญชีนี้มีการรับโอนเข้า ${stats.deposit_count} ครั้ง (เหลืออีก ${settings.transaction_limit_primary - stats.deposit_count} ครั้งถึงเกณฑ์ 3,000 ครั้ง)`,
          'danger');
    }
  } else if (rule1_percent >= 70) {
    const existing = db.prepare(`
      SELECT id FROM alerts WHERE account_id = ? AND alert_type = 'rule1_warning_70'
      AND created_at >= date('now', '-7 day')
    `).get(accountId);
    if (!existing) {
      db.prepare('INSERT INTO alerts (id, account_id, alert_type, message, severity) VALUES (?, ?, ?, ?, ?)')
        .run(uuidv4(), accountId, 'rule1_warning_70',
          `บัญชีนี้มีการรับโอนเข้า ${stats.deposit_count} ครั้ง (${rule1_percent.toFixed(0)}% ของเกณฑ์ 3,000 ครั้ง)`,
          'warning');
    }
  }

  // Rule 1 exceeded
  if (stats.deposit_count >= settings.transaction_limit_primary) {
    const existing = db.prepare(`
      SELECT id FROM alerts WHERE account_id = ? AND alert_type = 'rule1_exceeded'
      AND created_at >= date('now', '-1 day')
    `).get(accountId);
    if (!existing) {
      db.prepare('INSERT INTO alerts (id, account_id, alert_type, message, severity) VALUES (?, ?, ?, ?, ?)')
        .run(uuidv4(), accountId, 'rule1_exceeded',
          `บัญชีนี้ถึงเกณฑ์ 3,000 ครั้งแล้ว! ธนาคารจะรายงานข้อมูลให้สรรพากร`,
          'danger');

      // Auto-deactivate account
      db.prepare('UPDATE bank_accounts SET is_active = 0, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
        .run(accountId);
    }
  }

  // Rule 2: 400 transactions + 2M baht
  if (rule2_active && rule2_amount_percent >= 90 && rule2_amount_percent < 100) {
    const existing = db.prepare(`
      SELECT id FROM alerts WHERE account_id = ? AND alert_type = 'rule2_warning_90'
      AND created_at >= date('now', '-1 day')
    `).get(accountId);
    if (!existing) {
      db.prepare('INSERT INTO alerts (id, account_id, alert_type, message, severity) VALUES (?, ?, ?, ?, ?)')
        .run(uuidv4(), accountId, 'rule2_warning_90',
          `บัญชีนี้มี ${stats.deposit_count} ครั้ง + ยอดรวม ${stats.deposit_total.toLocaleString()} บาท (ใกล้เกณฑ์ 400 ครั้ง + 2 ล้านบาท)`,
          'danger');
    }
  }

  if (rule2_active && stats.deposit_total >= settings.amount_limit_secondary) {
    const existing = db.prepare(`
      SELECT id FROM alerts WHERE account_id = ? AND alert_type = 'rule2_exceeded'
      AND created_at >= date('now', '-1 day')
    `).get(accountId);
    if (!existing) {
      db.prepare('INSERT INTO alerts (id, account_id, alert_type, message, severity) VALUES (?, ?, ?, ?, ?)')
        .run(uuidv4(), accountId, 'rule2_exceeded',
          `บัญชีนี้ถึงเกณฑ์ 400 ครั้ง + 2 ล้านบาทแล้ว! ธนาคารจะรายงานข้อมูลให้สรรพากร`,
          'danger');

      db.prepare('UPDATE bank_accounts SET is_active = 0, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?')
        .run(accountId);
    }
  }
}
