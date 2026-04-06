/**
 * Campaign Management API Routes
 * Create, manage, and monitor ad campaigns on Facebook
 */

const { v4: uuidv4 } = require('uuid');
const facebookAds = require('../services/facebookAds');
const autoOptimizer = require('../services/autoOptimizer');

module.exports = function(db) {
  const router = require('express').Router();

  // ─── Create Campaign ──────────────────────────────────────

  router.post('/', async (req, res) => {
    try {
      const {
        name, objective, dailyBudget, lifetimeBudget,
        startDate, endDate, targetAudience, bidStrategy = 'LOWEST_COST',
      } = req.body;

      if (!name || !objective) {
        return res.status(400).json({ error: 'name and objective are required' });
      }

      // Create on Facebook
      let fbResult = null;
      try {
        fbResult = await facebookAds.createCampaign({
          name, objective, dailyBudget: dailyBudget || 500,
        });
      } catch (err) {
        // Continue even if FB fails (save locally)
      }

      const id = uuidv4();
      db.prepare(`
        INSERT INTO ad_campaigns (
          id, fb_campaign_id, account_id, name, objective, status,
          daily_budget, lifetime_budget, start_date, end_date,
          target_audience, bid_strategy
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, fbResult?.id || null, 'default', name, objective, 'DRAFT',
        dailyBudget || 0, lifetimeBudget || 0, startDate || null,
        endDate || null, targetAudience ? JSON.stringify(targetAudience) : null,
        bidStrategy
      );

      res.json({ success: true, campaign: { id, fbId: fbResult?.id, name, objective } });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── List Campaigns ───────────────────────────────────────

  router.get('/', (req, res) => {
    try {
      const { status } = req.query;
      let query = 'SELECT * FROM ad_campaigns';
      const params = [];
      if (status) {
        query += ' WHERE status = ?';
        params.push(status);
      }
      query += ' ORDER BY created_at DESC';

      const campaigns = db.prepare(query).all(...params);
      res.json({ success: true, campaigns });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Get Campaign Details ─────────────────────────────────

  router.get('/:id', async (req, res) => {
    try {
      const campaign = db.prepare('SELECT * FROM ad_campaigns WHERE id = ?').get(req.params.id);
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

      // Get ad sets
      const adSets = db.prepare('SELECT * FROM ad_sets WHERE campaign_id = ?').all(campaign.id);

      // Get ads
      const ads = db.prepare(`
        SELECT a.* FROM ads a
        JOIN ad_sets s ON a.adset_id = s.id
        WHERE s.campaign_id = ?
      `).all(campaign.id);

      // Get performance
      const performance = db.prepare(`
        SELECT * FROM ad_performance WHERE campaign_id = ?
        ORDER BY date DESC LIMIT 30
      `).all(campaign.id);

      // Get budget history
      const budgetHistory = db.prepare(`
        SELECT * FROM budget_history WHERE campaign_id = ?
        ORDER BY created_at DESC LIMIT 20
      `).all(campaign.id);

      // Get FB insights if available
      let fbInsights = null;
      if (campaign.fb_campaign_id) {
        try {
          fbInsights = await facebookAds.getCampaignInsights(campaign.fb_campaign_id);
        } catch (err) { /* skip */ }
      }

      res.json({
        success: true,
        campaign,
        adSets,
        ads,
        performance,
        budgetHistory,
        fbInsights: fbInsights?.data?.[0] || null,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Update Campaign ──────────────────────────────────────

  router.put('/:id', async (req, res) => {
    try {
      const campaign = db.prepare('SELECT * FROM ad_campaigns WHERE id = ?').get(req.params.id);
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

      const { name, status, dailyBudget, bidStrategy } = req.body;

      // Update on Facebook
      if (campaign.fb_campaign_id) {
        try {
          await facebookAds.updateCampaign(campaign.fb_campaign_id, { name, status, dailyBudget });
        } catch (err) { /* continue with local update */ }
      }

      const updates = [];
      const params = [];
      if (name) { updates.push('name = ?'); params.push(name); }
      if (status) { updates.push('status = ?'); params.push(status); }
      if (dailyBudget !== undefined) { updates.push('daily_budget = ?'); params.push(dailyBudget); }
      if (bidStrategy) { updates.push('bid_strategy = ?'); params.push(bidStrategy); }
      updates.push('updated_at = CURRENT_TIMESTAMP');

      if (updates.length > 1) {
        params.push(req.params.id);
        db.prepare(`UPDATE ad_campaigns SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      }

      res.json({ success: true, message: 'Campaign updated' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Adjust Budget ────────────────────────────────────────

  router.post('/:id/budget', async (req, res) => {
    try {
      const campaign = db.prepare('SELECT * FROM ad_campaigns WHERE id = ?').get(req.params.id);
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

      const { action, amount, reason } = req.body;
      const oldBudget = campaign.daily_budget;
      let newBudget;

      switch (action) {
        case 'set': newBudget = amount; break;
        case 'increase': newBudget = oldBudget + amount; break;
        case 'decrease': newBudget = Math.max(0, oldBudget - amount); break;
        case 'increase_percent': newBudget = oldBudget * (1 + amount / 100); break;
        case 'decrease_percent': newBudget = oldBudget * (1 - amount / 100); break;
        default: return res.status(400).json({ error: 'Invalid action' });
      }

      newBudget = Math.round(newBudget * 100) / 100;

      // Update FB
      if (campaign.fb_campaign_id) {
        try {
          await facebookAds.adjustBudget(campaign.fb_campaign_id, newBudget);
        } catch (err) { /* continue locally */ }
      }

      // Update local DB
      db.prepare('UPDATE ad_campaigns SET daily_budget = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(newBudget, campaign.id);

      // Log budget change
      db.prepare(`
        INSERT INTO budget_history (id, campaign_id, action, old_budget, new_budget, reason, triggered_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), campaign.id, action, oldBudget, newBudget, reason || 'Manual adjustment', 'manual');

      res.json({ success: true, oldBudget, newBudget, change: newBudget - oldBudget });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Create Ad Set ────────────────────────────────────────

  router.post('/:id/adsets', async (req, res) => {
    try {
      const campaign = db.prepare('SELECT * FROM ad_campaigns WHERE id = ?').get(req.params.id);
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

      const {
        name, dailyBudget, targeting = {}, optimizationGoal = 'LINK_CLICKS',
        billingEvent = 'IMPRESSIONS',
      } = req.body;

      let fbResult = null;
      if (campaign.fb_campaign_id) {
        try {
          fbResult = await facebookAds.createAdSet({
            campaignId: campaign.fb_campaign_id,
            name, dailyBudget: dailyBudget || 300,
            targeting, optimizationGoal, billingEvent,
          });
        } catch (err) { /* continue locally */ }
      }

      const id = uuidv4();
      db.prepare(`
        INSERT INTO ad_sets (
          id, fb_adset_id, campaign_id, name, daily_budget, targeting_spec,
          age_min, age_max, genders, locations, interests,
          optimization_goal, billing_event
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, fbResult?.id || null, campaign.id, name, dailyBudget || 0,
        JSON.stringify(targeting), targeting.ageMin || 18, targeting.ageMax || 65,
        targeting.genders ? JSON.stringify(targeting.genders) : null,
        targeting.locations ? JSON.stringify(targeting.locations) : null,
        targeting.interests ? JSON.stringify(targeting.interests) : null,
        optimizationGoal, billingEvent
      );

      res.json({ success: true, adSet: { id, fbId: fbResult?.id, name } });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Create Ad ────────────────────────────────────────────

  router.post('/:campaignId/adsets/:adsetId/ads', async (req, res) => {
    try {
      const adSet = db.prepare('SELECT * FROM ad_sets WHERE id = ?').get(req.params.adsetId);
      if (!adSet) return res.status(404).json({ error: 'Ad set not found' });

      const {
        name, headline, bodyText, callToAction = 'LEARN_MORE',
        linkUrl, imageUrl, videoUrl, creativeType = 'image', sourcePostId,
      } = req.body;

      let fbAdId = null;
      if (adSet.fb_adset_id) {
        try {
          const creative = await facebookAds.createAdCreative({
            name: `Creative: ${name}`, headline, body: bodyText,
            linkUrl, imageUrl, callToAction,
          });
          const ad = await facebookAds.createAd({
            adsetId: adSet.fb_adset_id, name, creativeId: creative.id,
          });
          fbAdId = ad.id;
        } catch (err) { /* continue locally */ }
      }

      const id = uuidv4();
      db.prepare(`
        INSERT INTO ads (
          id, fb_ad_id, adset_id, name, creative_type, headline,
          body_text, call_to_action, link_url, image_url, video_url, source_post_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, fbAdId, adSet.id, name, creativeType, headline,
        bodyText, callToAction, linkUrl, imageUrl, videoUrl, sourcePostId
      );

      res.json({ success: true, ad: { id, fbId: fbAdId, name } });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Budget History ───────────────────────────────────────

  router.get('/:id/budget-history', (req, res) => {
    try {
      const history = autoOptimizer.getBudgetHistory(req.params.id);
      res.json({ success: true, history });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
