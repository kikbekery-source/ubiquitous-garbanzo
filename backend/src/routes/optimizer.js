/**
 * Optimizer & AI Consultant Routes
 * Auto-optimization rules, AI chat, memory, recommendations
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const autoOptimizer = require('../services/autoOptimizer');
const aiConsultant = require('../services/aiConsultant');

module.exports = function (db) {
  const router = express.Router();

  // ═══════════════════════════════════════════════════════════
  // OPTIMIZATION RULES
  // ═══════════════════════════════════════════════════════════

  router.get('/rules', (req, res) => {
    const rules = autoOptimizer.getRules(req.query.activeOnly !== 'false');
    res.json({ data: rules });
  });

  router.post('/rules', (req, res) => {
    try {
      const id = autoOptimizer.createRule(req.body);
      res.json({ success: true, id });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/rules/defaults', (req, res) => {
    const rules = autoOptimizer.createDefaultRules();
    res.json({ success: true, rules });
  });

  router.put('/rules/:id', (req, res) => {
    autoOptimizer.updateRule(req.params.id, req.body);
    res.json({ success: true });
  });

  router.delete('/rules/:id', (req, res) => {
    autoOptimizer.deleteRule(req.params.id);
    res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════
  // OPTIMIZATION ENGINE
  // ═══════════════════════════════════════════════════════════

  router.post('/run', async (req, res) => {
    try {
      const result = await autoOptimizer.runOptimizationCycle();
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/schedule/start', (req, res) => {
    const { intervalMinutes = 60 } = req.body;
    const result = autoOptimizer.startScheduledOptimization(intervalMinutes);
    res.json(result);
  });

  router.post('/schedule/stop', (req, res) => {
    const result = autoOptimizer.stopScheduledOptimization();
    res.json(result);
  });

  router.get('/stats', (req, res) => {
    const stats = autoOptimizer.getOptimizationStats();
    res.json(stats);
  });

  // ═══════════════════════════════════════════════════════════
  // AI CONSULTANT (Chat)
  // ═══════════════════════════════════════════════════════════

  router.post('/ai/chat', async (req, res) => {
    try {
      const { message, sessionId = uuidv4() } = req.body;
      if (!message) return res.status(400).json({ error: 'Message required' });

      const result = await aiConsultant.chat(sessionId, message);
      res.json({ sessionId, ...result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/ai/conversations/:sessionId', (req, res) => {
    const history = aiConsultant.getConversationHistory(req.params.sessionId, 50);
    res.json({ data: history });
  });

  // ═══════════════════════════════════════════════════════════
  // AI MEMORY
  // ═══════════════════════════════════════════════════════════

  router.get('/ai/memory', (req, res) => {
    const { category, search, minImportance = 0, limit = 20 } = req.query;
    const memories = aiConsultant.getMemories({
      category, search,
      minImportance: Number(minImportance),
      limit: Number(limit),
    });
    res.json({ data: memories });
  });

  router.post('/ai/memory', (req, res) => {
    const id = aiConsultant.saveMemory(req.body);
    res.json({ success: true, id });
  });

  router.delete('/ai/memory/:id', (req, res) => {
    db.prepare('DELETE FROM ai_memory WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════
  // AI RECOMMENDATIONS
  // ═══════════════════════════════════════════════════════════

  router.get('/ai/recommendations', (req, res) => {
    const { campaignId, status, limit = 20 } = req.query;
    const recs = aiConsultant.getRecommendations({
      campaignId, status, limit: Number(limit),
    });
    res.json({ data: recs });
  });

  router.put('/ai/recommendations/:id', (req, res) => {
    const { status, resultSummary } = req.body;
    aiConsultant.updateRecommendationStatus(req.params.id, status, resultSummary);
    res.json({ success: true });
  });

  // ═══════════════════════════════════════════════════════════
  // BUDGET ANALYSIS
  // ═══════════════════════════════════════════════════════════

  router.post('/ai/budget-analysis', async (req, res) => {
    try {
      const campaigns = db.prepare(`
        SELECT c.*,
          (SELECT json_group_array(json_object(
            'date', p.date, 'impressions', p.impressions, 'clicks', p.clicks,
            'ctr', p.ctr, 'cpc', p.cpc, 'spend', p.spend,
            'roas', p.roas, 'frequency', p.frequency
          )) FROM ad_performance p WHERE p.campaign_id = c.id
          ORDER BY p.date DESC LIMIT 7
        ) as recent_performance
        FROM ad_campaigns c WHERE c.status IN ('ACTIVE', 'PAUSED')
      `).all();

      if (campaigns.length === 0) {
        return res.json({ message: 'No campaigns to analyze' });
      }

      const analysis = await aiConsultant.suggestBudgetAdjustment(
        campaigns.map(c => ({
          id: c.id,
          name: c.name,
          dailyBudget: c.daily_budget,
          status: c.status,
          performance: c.recent_performance,
        }))
      );

      res.json(analysis);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
