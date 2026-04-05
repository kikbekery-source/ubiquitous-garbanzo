const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

module.exports = function (db) {
  // List all accounts with yearly stats
  router.get('/', (req, res) => {
    const year = req.query.year || new Date().getFullYear().toString();
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const accounts = db.prepare(`
      SELECT a.*,
        COALESCE(deposit_stats.deposit_count, 0) as yearly_deposit_count,
        COALESCE(deposit_stats.deposit_total, 0) as yearly_deposit_total,
        COALESCE(withdrawal_stats.withdrawal_count, 0) as yearly_withdrawal_count,
        COALESCE(withdrawal_stats.withdrawal_total, 0) as yearly_withdrawal_total,
        (SELECT COUNT(*) FROM linked_emails e WHERE e.account_id = a.id) as email_count
      FROM bank_accounts a
      LEFT JOIN (
        SELECT account_id,
          COUNT(*) as deposit_count,
          SUM(amount) as deposit_total
        FROM transactions
        WHERE type = 'deposit' AND transaction_date BETWEEN ? AND ?
        GROUP BY account_id
      ) deposit_stats ON deposit_stats.account_id = a.id
      LEFT JOIN (
        SELECT account_id,
          COUNT(*) as withdrawal_count,
          SUM(amount) as withdrawal_total
        FROM transactions
        WHERE type = 'withdrawal' AND transaction_date BETWEEN ? AND ?
        GROUP BY account_id
      ) withdrawal_stats ON withdrawal_stats.account_id = a.id
      ORDER BY a.created_at DESC
    `).all(startDate, endDate, startDate, endDate);

    // Get tax settings
    const settings = db.prepare('SELECT * FROM tax_settings WHERE id = ?').get('default');

    const accountsWithTax = accounts.map(acc => {
      const rule1_percent = (acc.yearly_deposit_count / settings.transaction_limit_primary) * 100;
      const rule2_count_percent = (acc.yearly_deposit_count / settings.transaction_limit_secondary) * 100;
      const rule2_amount_percent = (acc.yearly_deposit_total / settings.amount_limit_secondary) * 100;

      const rule1_triggered = acc.yearly_deposit_count >= settings.transaction_limit_primary;
      const rule2_triggered = acc.yearly_deposit_count >= settings.transaction_limit_secondary
        && acc.yearly_deposit_total >= settings.amount_limit_secondary;

      let tax_risk_level = 'safe';
      let tax_risk_percent = Math.max(rule1_percent, Math.min(rule2_count_percent, rule2_amount_percent));
      tax_risk_percent = Math.min(tax_risk_percent, 100);

      if (rule1_triggered || rule2_triggered) {
        tax_risk_level = 'exceeded';
      } else if (tax_risk_percent >= 80) {
        tax_risk_level = 'danger';
      } else if (tax_risk_percent >= 60) {
        tax_risk_level = 'warning';
      } else if (tax_risk_percent >= 40) {
        tax_risk_level = 'caution';
      }

      return {
        ...acc,
        tax_risk_level,
        tax_risk_percent: Math.round(tax_risk_percent * 100) / 100,
        rule1_remaining: Math.max(0, settings.transaction_limit_primary - acc.yearly_deposit_count),
        rule2_count_remaining: Math.max(0, settings.transaction_limit_secondary - acc.yearly_deposit_count),
        rule2_amount_remaining: Math.max(0, settings.amount_limit_secondary - acc.yearly_deposit_total),
        rule1_triggered,
        rule2_triggered,
        tax_settings: settings,
      };
    });

    res.json(accountsWithTax);
  });

  // Create account
  router.post('/', (req, res) => {
    const { accountNumber, bankName, accountName } = req.body;
    if (!accountNumber || !bankName || !accountName) {
      return res.status(400).json({ error: 'accountNumber, bankName, and accountName are required' });
    }

    const id = uuidv4();
    db.prepare('INSERT INTO bank_accounts (id, account_number, bank_name, account_name) VALUES (?, ?, ?, ?)')
      .run(id, accountNumber, bankName, accountName);

    const account = db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(id);
    res.status(201).json(account);
  });

  // Get account detail
  router.get('/:id', (req, res) => {
    const account = db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const emails = db.prepare('SELECT * FROM linked_emails WHERE account_id = ? ORDER BY created_at DESC')
      .all(req.params.id);

    res.json({ ...account, emails });
  });

  // Update account
  router.put('/:id', (req, res) => {
    const { accountName, bankName, isActive } = req.body;
    const account = db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    db.prepare(`
      UPDATE bank_accounts
      SET account_name = COALESCE(?, account_name),
          bank_name = COALESCE(?, bank_name),
          is_active = COALESCE(?, is_active),
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(accountName || null, bankName || null, isActive !== undefined ? (isActive ? 1 : 0) : null, req.params.id);

    const updated = db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(req.params.id);
    res.json(updated);
  });

  // Delete account
  router.delete('/:id', (req, res) => {
    const result = db.prepare('DELETE FROM bank_accounts WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Account not found' });
    res.json({ message: 'Account deleted' });
  });

  // --- Email management ---

  // Add email to account
  router.post('/:id/emails', (req, res) => {
    const { email, description } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });

    const account = db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const id = uuidv4();
    db.prepare('INSERT INTO linked_emails (id, account_id, email, description) VALUES (?, ?, ?, ?)')
      .run(id, req.params.id, email, description || null);

    const emails = db.prepare('SELECT * FROM linked_emails WHERE account_id = ? ORDER BY created_at DESC')
      .all(req.params.id);
    res.status(201).json(emails);
  });

  // Remove email from account
  router.delete('/:id/emails/:emailId', (req, res) => {
    const result = db.prepare('DELETE FROM linked_emails WHERE id = ? AND account_id = ?')
      .run(req.params.emailId, req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Email not found' });

    const emails = db.prepare('SELECT * FROM linked_emails WHERE account_id = ? ORDER BY created_at DESC')
      .all(req.params.id);
    res.json(emails);
  });

  return router;
};
