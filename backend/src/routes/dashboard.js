const express = require('express');
const router = express.Router();

module.exports = function (db) {
  // Main dashboard data
  router.get('/', (req, res) => {
    const year = req.query.year || new Date().getFullYear().toString();
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    const today = new Date().toISOString().split('T')[0];

    const settings = db.prepare('SELECT * FROM tax_settings WHERE id = ?').get('default');

    // Get all accounts with yearly stats
    const accounts = db.prepare(`
      SELECT a.*,
        COALESCE(d.deposit_count, 0) as yearly_deposit_count,
        COALESCE(d.deposit_total, 0) as yearly_deposit_total,
        COALESCE(w.withdrawal_count, 0) as yearly_withdrawal_count,
        COALESCE(w.withdrawal_total, 0) as yearly_withdrawal_total,
        COALESCE(td.today_deposit_count, 0) as today_deposit_count,
        COALESCE(td.today_deposit_total, 0) as today_deposit_total,
        COALESCE(tw.today_withdrawal_count, 0) as today_withdrawal_count,
        COALESCE(tw.today_withdrawal_total, 0) as today_withdrawal_total,
        (SELECT COUNT(*) FROM linked_emails e WHERE e.account_id = a.id) as email_count
      FROM bank_accounts a
      LEFT JOIN (
        SELECT account_id, COUNT(*) as deposit_count, SUM(amount) as deposit_total
        FROM transactions WHERE type = 'deposit' AND transaction_date BETWEEN ? AND ?
        GROUP BY account_id
      ) d ON d.account_id = a.id
      LEFT JOIN (
        SELECT account_id, COUNT(*) as withdrawal_count, SUM(amount) as withdrawal_total
        FROM transactions WHERE type = 'withdrawal' AND transaction_date BETWEEN ? AND ?
        GROUP BY account_id
      ) w ON w.account_id = a.id
      LEFT JOIN (
        SELECT account_id, COUNT(*) as today_deposit_count, SUM(amount) as today_deposit_total
        FROM transactions WHERE type = 'deposit' AND transaction_date = ?
        GROUP BY account_id
      ) td ON td.account_id = a.id
      LEFT JOIN (
        SELECT account_id, COUNT(*) as today_withdrawal_count, SUM(amount) as today_withdrawal_total
        FROM transactions WHERE type = 'withdrawal' AND transaction_date = ?
        GROUP BY account_id
      ) tw ON tw.account_id = a.id
      ORDER BY a.is_active DESC, a.created_at DESC
    `).all(startDate, endDate, startDate, endDate, today, today);

    // Calculate tax risk for each account
    const accountsWithRisk = accounts.map(acc => {
      const rule1_percent = (acc.yearly_deposit_count / settings.transaction_limit_primary) * 100;
      const rule2_count_met = acc.yearly_deposit_count >= settings.transaction_limit_secondary;
      const rule2_amount_percent = (acc.yearly_deposit_total / settings.amount_limit_secondary) * 100;

      // The effective risk is the highest applicable threshold
      let tax_risk_percent;
      if (rule2_count_met) {
        // If 400+ transactions, the amount threshold becomes relevant too
        tax_risk_percent = Math.max(rule1_percent, rule2_amount_percent);
      } else {
        tax_risk_percent = rule1_percent;
      }
      tax_risk_percent = Math.min(tax_risk_percent, 100);

      const rule1_triggered = acc.yearly_deposit_count >= settings.transaction_limit_primary;
      const rule2_triggered = rule2_count_met && acc.yearly_deposit_total >= settings.amount_limit_secondary;

      let tax_risk_level = 'safe';
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
      };
    });

    // Find recommended account (most room left, is_active)
    const activeAccounts = accountsWithRisk.filter(a => a.is_active && !a.rule1_triggered && !a.rule2_triggered);
    const recommended = activeAccounts.sort((a, b) => a.tax_risk_percent - b.tax_risk_percent)[0] || null;

    // Unread alerts
    const unreadAlerts = db.prepare(`
      SELECT al.*, ba.account_number, ba.bank_name, ba.account_name
      FROM alerts al
      JOIN bank_accounts ba ON ba.id = al.account_id
      WHERE al.is_read = 0
      ORDER BY al.created_at DESC
      LIMIT 20
    `).all();

    // Overall totals
    const totals = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0) as total_deposits,
        COALESCE(SUM(CASE WHEN type = 'withdrawal' THEN amount ELSE 0 END), 0) as total_withdrawals,
        COALESCE(SUM(CASE WHEN type = 'deposit' THEN 1 ELSE 0 END), 0) as total_deposit_count,
        COALESCE(SUM(CASE WHEN type = 'withdrawal' THEN 1 ELSE 0 END), 0) as total_withdrawal_count
      FROM transactions
      WHERE transaction_date BETWEEN ? AND ?
    `).get(startDate, endDate);

    // Today's totals
    const todayTotals = db.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0) as today_deposits,
        COALESCE(SUM(CASE WHEN type = 'withdrawal' THEN amount ELSE 0 END), 0) as today_withdrawals,
        COALESCE(SUM(CASE WHEN type = 'deposit' THEN 1 ELSE 0 END), 0) as today_deposit_count,
        COALESCE(SUM(CASE WHEN type = 'withdrawal' THEN 1 ELSE 0 END), 0) as today_withdrawal_count
      FROM transactions WHERE transaction_date = ?
    `).get(today);

    res.json({
      accounts: accountsWithRisk,
      recommended_account: recommended ? {
        id: recommended.id,
        account_number: recommended.account_number,
        bank_name: recommended.bank_name,
        account_name: recommended.account_name,
        tax_risk_percent: recommended.tax_risk_percent,
        rule1_remaining: recommended.rule1_remaining,
      } : null,
      alerts: unreadAlerts,
      totals: {
        ...totals,
        ...todayTotals,
      },
      tax_settings: settings,
      year,
    });
  });

  // Get alerts
  router.get('/alerts', (req, res) => {
    const { unreadOnly } = req.query;
    let query = `
      SELECT al.*, ba.account_number, ba.bank_name, ba.account_name
      FROM alerts al
      JOIN bank_accounts ba ON ba.id = al.account_id
    `;
    if (unreadOnly === 'true') query += ' WHERE al.is_read = 0';
    query += ' ORDER BY al.created_at DESC LIMIT 50';

    const alerts = db.prepare(query).all();
    res.json(alerts);
  });

  // Mark alert as read
  router.put('/alerts/:id/read', (req, res) => {
    db.prepare('UPDATE alerts SET is_read = 1 WHERE id = ?').run(req.params.id);
    res.json({ message: 'Alert marked as read' });
  });

  // Mark all alerts as read
  router.put('/alerts/read-all', (req, res) => {
    db.prepare('UPDATE alerts SET is_read = 1 WHERE is_read = 0').run();
    res.json({ message: 'All alerts marked as read' });
  });

  // Get tax settings
  router.get('/tax-settings', (req, res) => {
    const settings = db.prepare('SELECT * FROM tax_settings WHERE id = ?').get('default');
    res.json(settings);
  });

  // Update tax settings
  router.put('/tax-settings', (req, res) => {
    const { transactionLimitPrimary, transactionLimitSecondary, amountLimitSecondary } = req.body;

    db.prepare(`
      UPDATE tax_settings SET
        transaction_limit_primary = COALESCE(?, transaction_limit_primary),
        transaction_limit_secondary = COALESCE(?, transaction_limit_secondary),
        amount_limit_secondary = COALESCE(?, amount_limit_secondary),
        updated_at = datetime('now', 'localtime')
      WHERE id = 'default'
    `).run(
      transactionLimitPrimary || null,
      transactionLimitSecondary || null,
      amountLimitSecondary || null
    );

    const settings = db.prepare('SELECT * FROM tax_settings WHERE id = ?').get('default');
    res.json(settings);
  });

  return router;
};
