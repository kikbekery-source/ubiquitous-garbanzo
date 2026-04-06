/**
 * Campaign Management Routes
 * Create, manage, and monitor Facebook ad campaigns
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const facebookAds = require('../services/facebookAds');
const aiConsultant = require('../services/aiConsultant');

module.exports = function (db) {
  const router = express.Router();

  // ─── List Campaigns ───────────────────────────────────────

  router.get('/', (req, res) => {
    const { status, limit = 50 } = req.query;
    let query = 'SELECT * FROM ad_campaigns';
    const params = [];
    if (status) { query += ' WHERE status = ?'; params.push(status); }
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(Number(limit));
    res.json({ data: db.prepare(query).all(...params) });
  });

  // ─── Get Campaign Details ─────────────────────────────────

  router.get('/:id', (req, res) => {
    const campaign = db.prepare('SELECT * FROM ad_campaigns WHERE id = ?').get(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const adSets = db.prepare('SELECT * FROM ad_sets WHERE campaign_id = ?').all(req.params.id);
    const ads = db.prepare(`
      SELECT a.* FROM ads a
      JOIN ad_sets s ON a.adset_id = s.id
      WHERE s.campaign_id = ?
    `).all(req.params.id);
    const performance = db.prepare(
      'SELECT * FROM ad_performance WHERE campaign_id = ? ORDER BY date DESC LIMIT 30'
    ).all(req.params.id);
    const budgetHistory = db.prepare(
      'SELECT * FROM budget_history WHERE campaign_id = ? ORDER BY created_at DESC LIMIT 20'
    ).all(req.params.id);

    res.json({ campaign, adSets, ads, performance, budgetHistory });
  });

  // ─── Create Campaign (with AI recommendation) ────────────

  router.post('/', async (req, res) => {
    try {
      const {
        name, objective, dailyBudget, lifetimeBudget,
        targeting, bidStrategy = 'LOWEST_COST',
        startDate, endDate, autoCreate = false,
      } = req.body;

      // Get account
      const account = db.prepare(
        "SELECT id FROM social_accounts WHERE platform = 'facebook' LIMIT 1"
      ).get();
      if (!account) return res.status(400).json({ error: 'No Facebook account configured' });

      const campaignId = uuidv4();

      // Create on Facebook if not in mock mode
      let fbCampaignId = null;
      if (autoCreate) {
        try {
          const fbResult = await facebookAds.createCampaign({
            name, objective, dailyBudget, status: 'PAUSED',
          });
          fbCampaignId = fbResult.id;
        } catch (err) {
          // Continue with local-only creation
          console.warn('Could not create on Facebook:', err.message);
        }
      }

      // Store locally
      db.prepare(`
        INSERT INTO ad_campaigns (
          id, fb_campaign_id, account_id, name, objective, status,
          daily_budget, lifetime_budget, start_date, end_date,
          target_audience, bid_strategy
        ) VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?)
      `).run(
        campaignId, fbCampaignId, account.id, name, objective,
        dailyBudget || null, lifetimeBudget || null,
        startDate || null, endDate || null,
        targeting ? JSON.stringify(targeting) : null,
        bidStrategy
      );

      res.json({
        success: true,
        campaign: { id: campaignId, fbCampaignId, name, objective, dailyBudget, status: 'DRAFT' },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── AI-Powered Campaign Creation ────────────────────────

  router.post('/ai-create', async (req, res) => {
    try {
      const { budget, objective = 'TRAFFIC', platform = 'facebook' } = req.body;

      // Get top performing posts
      const topPosts = db.prepare(`
        SELECT * FROM engagements
        WHERE platform = ?
        ORDER BY engagement_rate DESC LIMIT 5
      `).all(platform === 'all' ? 'facebook' : platform);

      if (topPosts.length === 0) {
        return res.status(400).json({ error: 'No engagement data. Fetch posts first.' });
      }

      // Ask AI for recommendations
      const recommendations = await aiConsultant.recommendAdCreation(topPosts, budget, objective);

      // Auto-create recommended campaigns
      const created = [];
      if (recommendations?.campaigns) {
        const account = db.prepare(
          "SELECT id FROM social_accounts WHERE platform = 'facebook' LIMIT 1"
        ).get();

        for (const camp of recommendations.campaigns) {
          const campaignId = uuidv4();
          db.prepare(`
            INSERT INTO ad_campaigns (
              id, account_id, name, objective, status, daily_budget,
              target_audience, bid_strategy
            ) VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, 'LOWEST_COST')
          `).run(
            campaignId,
            account?.id || 'default',
            camp.name,
            camp.objective || objective,
            camp.dailyBudget,
            JSON.stringify(camp.targeting)
          );

          // Create ad set
          const adsetId = uuidv4();
          db.prepare(`
            INSERT INTO ad_sets (
              id, campaign_id, name, daily_budget, targeting_spec,
              age_min, age_max, locations, interests, optimization_goal
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            adsetId, campaignId,
            `${camp.name} - Ad Set`,
            camp.dailyBudget,
            JSON.stringify(camp.targeting),
            camp.targeting?.ageMin || 18,
            camp.targeting?.ageMax || 65,
            JSON.stringify(camp.targeting?.locations || {}),
            JSON.stringify(camp.targeting?.interests || []),
            objective === 'CONVERSIONS' ? 'OFFSITE_CONVERSIONS' : 'LINK_CLICKS'
          );

          // Create ad
          if (camp.adCopy) {
            const adId = uuidv4();
            db.prepare(`
              INSERT INTO ads (
                id, adset_id, name, status, headline, body_text,
                call_to_action, source_post_id
              ) VALUES (?, ?, ?, 'DRAFT', ?, ?, ?, ?)
            `).run(
              adId, adsetId,
              `${camp.name} - Ad`,
              camp.adCopy.headline,
              camp.adCopy.body,
              camp.adCopy.callToAction || 'LEARN_MORE',
              camp.sourcePostId || null
            );
          }

          created.push({ campaignId, name: camp.name, dailyBudget: camp.dailyBudget });
        }
      }

      res.json({
        success: true,
        recommendations,
        created,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Update Campaign ──────────────────────────────────────

  router.put('/:id', async (req, res) => {
    try {
      const { name, status, dailyBudget, lifetimeBudget, targeting, bidStrategy } = req.body;
      const campaign = db.prepare('SELECT * FROM ad_campaigns WHERE id = ?').get(req.params.id);
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

      const updates = [];
      const params = [];

      if (name) { updates.push('name = ?'); params.push(name); }
      if (status) { updates.push('status = ?'); params.push(status); }
      if (dailyBudget !== undefined) { updates.push('daily_budget = ?'); params.push(dailyBudget); }
      if (lifetimeBudget !== undefined) { updates.push('lifetime_budget = ?'); params.push(lifetimeBudget); }
      if (targeting) { updates.push('target_audience = ?'); params.push(JSON.stringify(targeting)); }
      if (bidStrategy) { updates.push('bid_strategy = ?'); params.push(bidStrategy); }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(req.params.id);

      db.prepare(`UPDATE ad_campaigns SET ${updates.join(', ')} WHERE id = ?`).run(...params);

      // Sync to Facebook if connected
      if (campaign.fb_campaign_id && (status || dailyBudget)) {
        try {
          await facebookAds.updateCampaign(campaign.fb_campaign_id, { status, dailyBudget });
        } catch (err) {
          console.warn('Could not sync to Facebook:', err.message);
        }
      }

      // Log budget change
      if (dailyBudget !== undefined && dailyBudget !== campaign.daily_budget) {
        db.prepare(`
          INSERT INTO budget_history (id, campaign_id, action, old_budget, new_budget, reason, triggered_by)
          VALUES (?, ?, ?, ?, ?, 'Manual adjustment', 'manual')
        `).run(
          uuidv4(), req.params.id,
          dailyBudget > campaign.daily_budget ? 'increase' : 'decrease',
          campaign.daily_budget, dailyBudget
        );
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Budget Adjustment ────────────────────────────────────

  router.post('/:id/budget', async (req, res) => {
    try {
      const { amount, action = 'set' } = req.body;
      const campaign = db.prepare('SELECT * FROM ad_campaigns WHERE id = ?').get(req.params.id);
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

      let newBudget;
      switch (action) {
        case 'increase':
          newBudget = campaign.daily_budget + amount;
          break;
        case 'decrease':
          newBudget = Math.max(100, campaign.daily_budget - amount);
          break;
        case 'set':
        default:
          newBudget = amount;
      }

      db.prepare('UPDATE ad_campaigns SET daily_budget = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(newBudget, req.params.id);

      // Sync to Facebook
      if (campaign.fb_campaign_id) {
        try {
          await facebookAds.adjustBudget(campaign.fb_campaign_id, newBudget);
        } catch (err) {
          console.warn('Could not sync budget to Facebook:', err.message);
        }
      }

      // Log
      db.prepare(`
        INSERT INTO budget_history (id, campaign_id, action, old_budget, new_budget, reason, triggered_by)
        VALUES (?, ?, ?, ?, ?, ?, 'manual')
      `).run(uuidv4(), req.params.id, action, campaign.daily_budget, newBudget, `Manual ${action}`);

      res.json({
        success: true,
        oldBudget: campaign.daily_budget,
        newBudget,
        action,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Campaign Performance Analysis ───────────────────────

  router.get('/:id/analyze', async (req, res) => {
    try {
      const campaign = db.prepare('SELECT * FROM ad_campaigns WHERE id = ?').get(req.params.id);
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

      const performance = db.prepare(
        'SELECT * FROM ad_performance WHERE campaign_id = ? ORDER BY date DESC LIMIT 7'
      ).all(req.params.id);

      // Get Facebook insights if connected
      let fbInsights = null;
      if (campaign.fb_campaign_id) {
        try {
          fbInsights = await facebookAds.getCampaignInsights(campaign.fb_campaign_id);
        } catch (err) {
          console.warn('Could not fetch FB insights:', err.message);
        }
      }

      const analysisData = {
        campaign,
        localPerformance: performance,
        fbInsights: fbInsights?.data?.[0] || null,
      };

      const aiAnalysis = await aiConsultant.analyzeCampaignPerformance(analysisData);

      res.json({
        campaign: campaign.name,
        performance,
        fbInsights: fbInsights?.data?.[0],
        aiAnalysis,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Launch Campaign (activate on Facebook) ──────────────

  router.post('/:id/launch', async (req, res) => {
    try {
      const campaign = db.prepare('SELECT * FROM ad_campaigns WHERE id = ?').get(req.params.id);
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

      // Create on Facebook if not yet created
      if (!campaign.fb_campaign_id) {
        const fbResult = await facebookAds.createCampaign({
          name: campaign.name,
          objective: campaign.objective,
          dailyBudget: campaign.daily_budget,
          status: 'PAUSED',
        });

        db.prepare('UPDATE ad_campaigns SET fb_campaign_id = ? WHERE id = ?')
          .run(fbResult.id, req.params.id);

        campaign.fb_campaign_id = fbResult.id;
      }

      // Create ad sets on Facebook
      const adSets = db.prepare('SELECT * FROM ad_sets WHERE campaign_id = ?').all(req.params.id);
      for (const adset of adSets) {
        if (!adset.fb_adset_id) {
          const fbAdset = await facebookAds.createAdSet({
            campaignId: campaign.fb_campaign_id,
            name: adset.name,
            dailyBudget: adset.daily_budget || campaign.daily_budget,
            targeting: JSON.parse(adset.targeting_spec || '{}'),
            optimizationGoal: adset.optimization_goal,
          });
          db.prepare('UPDATE ad_sets SET fb_adset_id = ? WHERE id = ?').run(fbAdset.id, adset.id);
        }
      }

      // Activate
      await facebookAds.resumeCampaign(campaign.fb_campaign_id);
      db.prepare("UPDATE ad_campaigns SET status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(req.params.id);

      res.json({ success: true, status: 'ACTIVE', fbCampaignId: campaign.fb_campaign_id });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Delete Campaign ──────────────────────────────────────

  router.delete('/:id', (req, res) => {
    const result = db.prepare("UPDATE ad_campaigns SET status = 'DELETED', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(req.params.id);
    res.json({ success: result.changes > 0 });
  });

  return router;
};
