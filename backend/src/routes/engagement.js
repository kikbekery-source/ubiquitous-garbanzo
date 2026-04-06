/**
 * Engagement Routes
 * Fetch and analyze engagement data from Facebook & TikTok
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const facebookAds = require('../services/facebookAds');
const tiktokAnalytics = require('../services/tiktokAnalytics');
const aiConsultant = require('../services/aiConsultant');

module.exports = function (db) {
  const router = express.Router();

  // ─── Fetch Facebook Engagement ────────────────────────────

  router.post('/facebook/fetch', async (req, res) => {
    try {
      const { limit = 25, since } = req.body;
      const postsData = await facebookAds.getPagePosts(limit, since);

      // Store in database
      const accountRow = db.prepare(
        "SELECT id FROM social_accounts WHERE platform = 'facebook' LIMIT 1"
      ).get();

      const accountId = accountRow ? accountRow.id : _ensureDefaultAccount(db, 'facebook');

      const stored = [];
      for (const post of postsData.data || []) {
        const id = uuidv4();
        const likes = post.likes?.summary?.total_count || 0;
        const comments = post.comments?.summary?.total_count || 0;
        const shares = post.shares?.count || 0;
        const reach = post.insights?.data?.find(i => i.name === 'post_reach')?.values?.[0]?.value || 0;
        const impressions = post.insights?.data?.find(i => i.name === 'post_impressions')?.values?.[0]?.value || 0;
        const clicks = post.insights?.data?.find(i => i.name === 'post_clicks')?.values?.[0]?.value || 0;
        const totalEng = likes + comments + shares;
        const engRate = reach > 0 ? (totalEng / reach) * 100 : 0;

        db.prepare(`
          INSERT OR REPLACE INTO engagements (
            id, account_id, platform, post_id, post_type, post_url,
            post_content, thumbnail_url, likes, comments, shares,
            reach, impressions, clicks, engagement_rate, post_date, raw_data
          ) VALUES (?, ?, 'facebook', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, accountId, post.id, post.type || 'text',
          post.permalink_url, post.message || '', post.full_picture || '',
          likes, comments, shares, reach, impressions, clicks,
          Math.round(engRate * 100) / 100, post.created_time,
          JSON.stringify(post)
        );

        stored.push({ id, postId: post.id, engagementRate: Math.round(engRate * 100) / 100 });
      }

      res.json({
        success: true,
        platform: 'facebook',
        fetched: stored.length,
        data: stored,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Fetch TikTok Engagement ──────────────────────────────

  router.post('/tiktok/fetch', async (req, res) => {
    try {
      const { maxCount = 20 } = req.body;
      const videosData = await tiktokAnalytics.getVideoList(maxCount);

      const accountRow = db.prepare(
        "SELECT id FROM social_accounts WHERE platform = 'tiktok' LIMIT 1"
      ).get();
      const accountId = accountRow ? accountRow.id : _ensureDefaultAccount(db, 'tiktok');

      const stored = [];
      for (const video of videosData.videos || []) {
        const id = uuidv4();
        const likes = video.likes || 0;
        const comments = video.comments || 0;
        const shares = video.shares || 0;
        const views = video.video_views || 0;
        const reach = video.reach || views;
        const totalEng = likes + comments + shares;
        const engRate = reach > 0 ? (totalEng / reach) * 100 : 0;

        db.prepare(`
          INSERT OR REPLACE INTO engagements (
            id, account_id, platform, post_id, post_type, post_url,
            post_content, thumbnail_url, likes, comments, shares,
            reach, views, engagement_rate, tiktok_plays, tiktok_full_watches,
            tiktok_avg_watch_time, post_date, raw_data
          ) VALUES (?, ?, 'tiktok', ?, 'video', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, accountId, video.item_id,
          video.share_url || '', video.video_description || '',
          video.thumbnail_url || '', likes, comments, shares,
          reach, views, Math.round(engRate * 100) / 100,
          views, Math.round(views * (video.full_video_watched_rate || 0)),
          video.average_time_watched || 0,
          video.create_time ? new Date(video.create_time * 1000).toISOString() : null,
          JSON.stringify(video)
        );

        stored.push({ id, videoId: video.item_id, engagementRate: Math.round(engRate * 100) / 100 });
      }

      res.json({
        success: true,
        platform: 'tiktok',
        fetched: stored.length,
        data: stored,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Get All Engagements ──────────────────────────────────

  router.get('/', (req, res) => {
    const { platform, sort = 'engagement_rate', order = 'DESC', limit = 50, offset = 0 } = req.query;
    const allowedSorts = ['engagement_rate', 'likes', 'comments', 'shares', 'reach', 'views', 'post_date'];
    const sortCol = allowedSorts.includes(sort) ? sort : 'engagement_rate';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    let query = `SELECT * FROM engagements`;
    const params = [];

    if (platform) {
      query += ` WHERE platform = ?`;
      params.push(platform);
    }

    query += ` ORDER BY ${sortCol} ${sortOrder} LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const data = db.prepare(query).all(...params);
    const total = db.prepare(
      `SELECT COUNT(*) as c FROM engagements ${platform ? 'WHERE platform = ?' : ''}`
    ).get(...(platform ? [platform] : []));

    res.json({ data, total: total.c, limit: Number(limit), offset: Number(offset) });
  });

  // ─── Get Top Performing Posts ─────────────────────────────

  router.get('/top', (req, res) => {
    const { platform, limit = 10 } = req.query;

    let query = 'SELECT * FROM engagements';
    const params = [];

    if (platform) {
      query += ' WHERE platform = ?';
      params.push(platform);
    }

    query += ' ORDER BY engagement_rate DESC LIMIT ?';
    params.push(Number(limit));

    const data = db.prepare(query).all(...params);
    res.json({ data });
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
      params.push(limit);

      const engagements = db.prepare(query).all(...params);

      if (engagements.length === 0) {
        return res.json({ message: 'No engagement data to analyze. Fetch data first.' });
      }

      // TikTok analysis helper
      const tiktokResult = tiktokAnalytics.analyzeEngagement(
        engagements.filter(e => e.platform === 'tiktok')
      );

      // AI analysis
      const aiAnalysis = await aiConsultant.analyzeEngagement(engagements, platform || 'all');

      // Save insight to memory
      aiConsultant.saveMemory({
        category: 'insight',
        title: `Engagement analysis - ${platform || 'all platforms'}`,
        content: JSON.stringify(aiAnalysis?.summary || 'Analysis completed'),
        importance: 0.6,
        tags: ['engagement', platform || 'all'],
      });

      res.json({
        engagements: engagements.length,
        tiktokAnalysis: tiktokResult,
        aiAnalysis,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Engagement Dashboard Stats ───────────────────────────

  router.get('/stats', (req, res) => {
    const fbStats = db.prepare(`
      SELECT
        COUNT(*) as total_posts,
        ROUND(AVG(engagement_rate), 2) as avg_engagement_rate,
        SUM(likes) as total_likes,
        SUM(comments) as total_comments,
        SUM(shares) as total_shares,
        SUM(reach) as total_reach,
        MAX(engagement_rate) as best_engagement_rate
      FROM engagements WHERE platform = 'facebook'
    `).get();

    const ttStats = db.prepare(`
      SELECT
        COUNT(*) as total_posts,
        ROUND(AVG(engagement_rate), 2) as avg_engagement_rate,
        SUM(likes) as total_likes,
        SUM(comments) as total_comments,
        SUM(shares) as total_shares,
        SUM(views) as total_views,
        MAX(engagement_rate) as best_engagement_rate
      FROM engagements WHERE platform = 'tiktok'
    `).get();

    res.json({ facebook: fbStats, tiktok: ttStats });
  });

  return router;
};

// Helper to ensure a default account exists
function _ensureDefaultAccount(db, platform) {
  const id = uuidv4();
  db.prepare(`
    INSERT INTO social_accounts (id, platform, account_name, account_id, status)
    VALUES (?, ?, ?, ?, 'active')
  `).run(id, platform, `Default ${platform} Account`, `default_${platform}`);
  return id;
}
