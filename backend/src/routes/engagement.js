/**
 * Engagement API Routes
 * Fetch and analyze engagement data from Facebook and TikTok
 */

const { v4: uuidv4 } = require('uuid');
const facebookAds = require('../services/facebookAds');
const tiktokAnalytics = require('../services/tiktokAnalytics');
const aiConsultant = require('../services/aiConsultant');

module.exports = function(db) {
  const router = require('express').Router();

  // ─── Fetch Facebook Engagement ────────────────────────────

  router.get('/facebook/posts', async (req, res) => {
    try {
      const { limit = 25, since } = req.query;
      const data = await facebookAds.getPagePosts(parseInt(limit), since);

      // Parse and store engagements
      const engagements = [];
      for (const post of (data.data || [])) {
        const engagement = {
          id: uuidv4(),
          platform: 'facebook',
          post_id: post.id,
          post_type: post.type || 'text',
          post_url: post.permalink_url,
          post_content: post.message,
          thumbnail_url: post.full_picture,
          likes: post.likes?.summary?.total_count || 0,
          comments: post.comments?.summary?.total_count || 0,
          shares: post.shares?.count || 0,
          reach: 0,
          impressions: 0,
          views: 0,
          clicks: 0,
          post_date: post.created_time,
        };

        // Extract insights
        if (post.insights?.data) {
          for (const insight of post.insights.data) {
            const val = insight.values?.[0]?.value || 0;
            switch (insight.name) {
              case 'post_impressions': engagement.impressions = val; break;
              case 'post_reach': engagement.reach = val; break;
              case 'post_engaged_users': engagement.clicks = val; break;
              case 'post_clicks': engagement.clicks = val; break;
            }
          }
        }

        // Calculate engagement rate
        const totalEng = engagement.likes + engagement.comments + engagement.shares;
        engagement.engagement_rate = engagement.reach > 0
          ? Math.round((totalEng / engagement.reach) * 10000) / 100
          : 0;

        engagements.push(engagement);

        // Store in DB
        try {
          db.prepare(`
            INSERT OR REPLACE INTO engagements (
              id, account_id, platform, post_id, post_type, post_url, post_content,
              thumbnail_url, likes, comments, shares, reach, impressions, views,
              clicks, engagement_rate, post_date, raw_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            engagement.id, 'default', engagement.platform, engagement.post_id,
            engagement.post_type, engagement.post_url, engagement.post_content,
            engagement.thumbnail_url, engagement.likes, engagement.comments,
            engagement.shares, engagement.reach, engagement.impressions,
            engagement.views, engagement.clicks, engagement.engagement_rate,
            engagement.post_date, JSON.stringify(post)
          );
        } catch (dbErr) { /* skip duplicate */ }
      }

      res.json({ success: true, count: engagements.length, engagements });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Fetch TikTok Engagement ──────────────────────────────

  router.get('/tiktok/videos', async (req, res) => {
    try {
      const { maxCount = 20 } = req.query;
      const data = await tiktokAnalytics.getVideoList(parseInt(maxCount));

      const engagements = [];
      for (const video of (data.videos || [])) {
        const engagement = {
          id: uuidv4(),
          platform: 'tiktok',
          post_id: video.item_id,
          post_type: 'video',
          post_url: video.share_url,
          post_content: video.video_description,
          thumbnail_url: video.thumbnail_url,
          likes: video.likes || 0,
          comments: video.comments || 0,
          shares: video.shares || 0,
          reach: video.reach || 0,
          impressions: video.impressions || 0,
          views: video.video_views || 0,
          tiktok_plays: video.video_views || 0,
          tiktok_full_watches: Math.round((video.video_views || 0) * (video.full_video_watched_rate || 0)),
          tiktok_avg_watch_time: video.average_time_watched || 0,
          post_date: video.create_time ? new Date(video.create_time * 1000).toISOString() : null,
        };

        const totalEng = engagement.likes + engagement.comments + engagement.shares;
        engagement.engagement_rate = engagement.views > 0
          ? Math.round((totalEng / engagement.views) * 10000) / 100
          : 0;

        engagements.push(engagement);

        try {
          db.prepare(`
            INSERT OR REPLACE INTO engagements (
              id, account_id, platform, post_id, post_type, post_url, post_content,
              thumbnail_url, likes, comments, shares, reach, impressions, views,
              clicks, engagement_rate, tiktok_plays, tiktok_full_watches,
              tiktok_avg_watch_time, post_date, raw_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            engagement.id, 'default', engagement.platform, engagement.post_id,
            engagement.post_type, engagement.post_url, engagement.post_content,
            engagement.thumbnail_url, engagement.likes, engagement.comments,
            engagement.shares, engagement.reach, engagement.impressions,
            engagement.views, 0, engagement.engagement_rate,
            engagement.tiktok_plays, engagement.tiktok_full_watches,
            engagement.tiktok_avg_watch_time, engagement.post_date,
            JSON.stringify(video)
          );
        } catch (dbErr) { /* skip duplicate */ }
      }

      // Analyze with TikTok service
      const analysis = tiktokAnalytics.analyzeEngagement(engagements);

      res.json({ success: true, count: engagements.length, engagements, analysis });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Get All Stored Engagements ───────────────────────────

  router.get('/', (req, res) => {
    try {
      const { platform, sortBy = 'engagement_rate', order = 'DESC', limit = 50 } = req.query;

      const allowedSorts = ['engagement_rate', 'likes', 'comments', 'shares', 'reach', 'impressions', 'views', 'post_date'];
      const sortField = allowedSorts.includes(sortBy) ? sortBy : 'engagement_rate';
      const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      let query = `SELECT * FROM engagements`;
      const params = [];

      if (platform) {
        query += ' WHERE platform = ?';
        params.push(platform);
      }

      query += ` ORDER BY ${sortField} ${sortOrder} LIMIT ?`;
      params.push(parseInt(limit));

      const engagements = db.prepare(query).all(...params);
      res.json({ success: true, count: engagements.length, engagements });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── AI Analysis of Engagement ────────────────────────────

  router.post('/analyze', async (req, res) => {
    try {
      const { platform, limit = 20 } = req.body;

      let query = 'SELECT * FROM engagements';
      const params = [];
      if (platform) {
        query += ' WHERE platform = ?';
        params.push(platform);
      }
      query += ' ORDER BY engagement_rate DESC LIMIT ?';
      params.push(parseInt(limit));

      const engagements = db.prepare(query).all(...params);

      if (engagements.length === 0) {
        return res.json({ success: true, message: 'ไม่มีข้อมูล engagement กรุณา fetch ข้อมูลก่อน' });
      }

      const analysis = await aiConsultant.analyzeEngagementForAds(engagements);
      res.json({ success: true, analysis });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── TikTok Audience Insights ─────────────────────────────

  router.get('/tiktok/audience', async (req, res) => {
    try {
      const data = await tiktokAnalytics.getAudienceInsights();
      res.json({ success: true, audience: data });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
