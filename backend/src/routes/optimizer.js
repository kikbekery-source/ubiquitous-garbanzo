/**
 * Auto-Optimizer API Routes
 * Manage optimization rules, run optimization cycles, view budget history
 */

const autoOptimizer = require('../services/autoOptimizer');

module.exports = function(db) {
  const router = require('express').Router();

  // ─── Rules Management ─────────────────────────────────────

  router.get('/rules', (req, res) => {
    try {
      const { campaignId } = req.query;
      const rules = autoOptimizer.getRules(campaignId);
      res.json({ success: true, rules });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/rules', (req, res) => {
    try {
      const rule = autoOptimizer.createRule(req.body);
      res.json({ success: true, rule });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/rules/setup-defaults', (req, res) => {
    try {
      const rules = autoOptimizer.setupDefaultRules();
      res.json({ success: true, message: 'Default rules created', rules });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.put('/rules/:id', (req, res) => {
    try {
      autoOptimizer.updateRule(req.params.id, req.body);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.delete('/rules/:id', (req, res) => {
    try {
      autoOptimizer.deleteRule(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Campaign Evaluation ──────────────────────────────────

  router.post('/evaluate/:campaignId', async (req, res) => {
    try {
      const result = await autoOptimizer.evaluateCampaign(req.params.campaignId);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Execute Actions ──────────────────────────────────────

  router.post('/execute/:campaignId', async (req, res) => {
    try {
      const { actions, autoApply = false } = req.body;
      const results = await autoOptimizer.executeActions(req.params.campaignId, actions, autoApply);
      res.json({ success: true, results });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Run Full Optimization Cycle ──────────────────────────

  router.post('/run', async (req, res) => {
    try {
      const result = await autoOptimizer.runOptimizationCycle();
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Scheduled Optimization ───────────────────────────────

  router.post('/scheduler/start', (req, res) => {
    try {
      const { intervalMinutes = 60 } = req.body;
      const result = autoOptimizer.startScheduledOptimization(intervalMinutes);
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/scheduler/stop', (req, res) => {
    try {
      const result = autoOptimizer.stopScheduledOptimization();
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Budget Overview ──────────────────────────────────────

  router.get('/budget/summary', (req, res) => {
    try {
      const summary = autoOptimizer.getBudgetSummary();
      res.json({ success: true, summary });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/budget/history', (req, res) => {
    try {
      const { campaignId, limit = 50 } = req.query;
      const history = autoOptimizer.getBudgetHistory(campaignId, parseInt(limit));
      res.json({ success: true, history });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
