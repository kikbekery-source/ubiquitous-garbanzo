/**
 * AI Consultant Chat & Memory API Routes
 */

const { v4: uuidv4 } = require('uuid');
const aiConsultant = require('../services/aiConsultant');

module.exports = function(db) {
  const router = require('express').Router();

  // ─── Chat with AI Consultant ──────────────────────────────

  router.post('/chat', async (req, res) => {
    try {
      const { sessionId = uuidv4(), message, contextData } = req.body;
      if (!message) return res.status(400).json({ error: 'message is required' });

      const response = await aiConsultant.chat(sessionId, message, contextData);
      res.json({ success: true, ...response });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Get Chat History ─────────────────────────────────────

  router.get('/chat/:sessionId', (req, res) => {
    try {
      const history = db.prepare(
        'SELECT * FROM ai_conversations WHERE session_id = ? ORDER BY created_at'
      ).all(req.params.sessionId);
      res.json({ success: true, history });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Analyze Engagement for Ads ───────────────────────────

  router.post('/analyze/engagement', async (req, res) => {
    try {
      const { platform, limit = 20 } = req.body;
      let query = 'SELECT * FROM engagements';
      const params = [];
      if (platform) { query += ' WHERE platform = ?'; params.push(platform); }
      query += ' ORDER BY engagement_rate DESC LIMIT ?';
      params.push(parseInt(limit));

      const engagements = db.prepare(query).all(...params);
      const analysis = await aiConsultant.analyzeEngagementForAds(engagements);
      res.json({ success: true, analysis });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Analyze Campaign Performance ─────────────────────────

  router.post('/analyze/campaign', async (req, res) => {
    try {
      const { campaignId } = req.body;
      let campaigns, performance;

      if (campaignId) {
        campaigns = [db.prepare('SELECT * FROM ad_campaigns WHERE id = ?').get(campaignId)];
        performance = db.prepare(
          'SELECT * FROM ad_performance WHERE campaign_id = ? ORDER BY date DESC LIMIT 30'
        ).all(campaignId);
      } else {
        campaigns = db.prepare('SELECT * FROM ad_campaigns ORDER BY created_at DESC').all();
        performance = db.prepare(
          "SELECT * FROM ad_performance WHERE date >= date('now', '-7 days') ORDER BY date DESC"
        ).all();
      }

      const analysis = await aiConsultant.analyzeCampaignPerformance({ campaigns, performance });
      res.json({ success: true, analysis });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Generate Ad Copy ─────────────────────────────────────

  router.post('/generate/ad-copy', async (req, res) => {
    try {
      const { product, targetAudience, tone, platform, objective } = req.body;
      if (!product || !targetAudience) {
        return res.status(400).json({ error: 'product and targetAudience are required' });
      }
      const result = await aiConsultant.generateAdCopy({ product, targetAudience, tone, platform, objective });
      res.json({ success: true, adCopy: result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Memory Management ────────────────────────────────────

  router.get('/memory', (req, res) => {
    try {
      const { category, limit = 20, minImportance = 0, search } = req.query;
      const memories = aiConsultant.getMemories({
        category, limit: parseInt(limit),
        minImportance: parseFloat(minImportance), search,
      });
      res.json({ success: true, count: memories.length, memories });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/memory', (req, res) => {
    try {
      const { category, title, content, importance = 0.5, tags = [] } = req.body;
      if (!category || !title || !content) {
        return res.status(400).json({ error: 'category, title, and content are required' });
      }
      const id = aiConsultant.saveMemory({ category, title, content, importance, tags });
      res.json({ success: true, id });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.delete('/memory/:id', (req, res) => {
    try {
      aiConsultant.deleteMemory(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Recommendations ──────────────────────────────────────

  router.get('/recommendations', (req, res) => {
    try {
      const { campaignId, status, limit = 20 } = req.query;
      const recs = aiConsultant.getRecommendations({ campaignId, status, limit: parseInt(limit) });
      res.json({ success: true, recommendations: recs });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.put('/recommendations/:id', (req, res) => {
    try {
      const { status, resultSummary } = req.body;
      aiConsultant.updateRecommendationStatus(req.params.id, status, resultSummary);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
