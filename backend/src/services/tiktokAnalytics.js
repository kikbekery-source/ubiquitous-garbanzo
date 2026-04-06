/**
 * TikTok Business API Integration
 * Handles: Engagement analytics, Video performance, Audience insights
 *
 * Required env vars:
 *   TIKTOK_ACCESS_TOKEN, TIKTOK_ADVERTISER_ID, TIKTOK_BUSINESS_ID
 *
 * Uses TikTok Marketing API v1.3 & Content Publishing API
 */

const { v4: uuidv4 } = require('uuid');

const TIKTOK_API_BASE = 'https://business-api.tiktok.com/open_api/v1.3';

class TikTokAnalyticsService {
  constructor() {
    this.accessToken = null;
    this.advertiserId = null;
    this.businessId = null;
    this.mockMode = false;
  }

  init() {
    this.accessToken = process.env.TIKTOK_ACCESS_TOKEN;
    this.advertiserId = process.env.TIKTOK_ADVERTISER_ID;
    this.businessId = process.env.TIKTOK_BUSINESS_ID;

    if (!this.accessToken || this.accessToken === 'your_tiktok_access_token_here') {
      console.warn('TikTok API not configured. Using mock mode.');
      this.mockMode = true;
      return;
    }

    console.log('TikTok Analytics service initialized');
  }

  // ─── HTTP Helper ──────────────────────────────────────────

  async _ttRequest(endpoint, method = 'GET', body = null) {
    if (this.mockMode) throw new Error('TikTok API in mock mode');

    const url = new URL(`${TIKTOK_API_BASE}${endpoint}`);

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': this.accessToken,
      },
    };

    if (body) {
      if (method === 'GET') {
        Object.entries(body).forEach(([k, v]) =>
          url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : v)
        );
      } else {
        options.body = JSON.stringify(body);
      }
    }

    const response = await fetch(url.toString(), options);
    const data = await response.json();

    if (data.code !== 0) {
      throw new Error(`TikTok API Error: ${data.message} (code: ${data.code})`);
    }

    return data.data;
  }

  // ─── Video & Post Analytics ───────────────────────────────

  async getVideoList(maxCount = 20) {
    if (this.mockMode) return this._mockVideoList();

    return this._ttRequest('/business/video/list/', 'GET', {
      business_id: this.businessId,
      max_count: maxCount,
      fields: JSON.stringify([
        'item_id', 'create_time', 'thumbnail_url', 'share_url',
        'video_description', 'duration', 'video_views',
        'likes', 'comments', 'shares', 'reach',
        'full_video_watched_rate', 'average_time_watched',
        'impressions', 'profile_views'
      ]),
    });
  }

  async getVideoInsights(videoIds) {
    if (this.mockMode) return this._mockVideoInsights(videoIds);

    return this._ttRequest('/business/video/insights/', 'POST', {
      business_id: this.businessId,
      video_ids: videoIds,
      fields: [
        'video_views', 'likes', 'comments', 'shares',
        'reach', 'full_video_watched_rate',
        'total_time_watched', 'average_time_watched',
        'impressions', 'new_followers', 'profile_views'
      ],
    });
  }

  async getAccountAnalytics(startDate, endDate) {
    if (this.mockMode) return this._mockAccountAnalytics();

    return this._ttRequest('/business/account/analytics/', 'GET', {
      business_id: this.businessId,
      start_date: startDate,
      end_date: endDate,
      fields: JSON.stringify([
        'followers_count', 'profile_views', 'likes',
        'comments', 'shares', 'video_views'
      ]),
    });
  }

  // ─── Audience Insights ────────────────────────────────────

  async getAudienceInsights() {
    if (this.mockMode) return this._mockAudienceInsights();

    return this._ttRequest('/business/account/audience/', 'GET', {
      business_id: this.businessId,
      fields: JSON.stringify([
        'audience_countries', 'audience_genders',
        'audience_age_distribution', 'audience_activity'
      ]),
    });
  }

  // ─── Ad Campaign Data (TikTok Ads Manager) ───────────────

  async getAdCampaigns() {
    if (this.mockMode) return this._mockAdCampaigns();

    return this._ttRequest('/campaign/get/', 'GET', {
      advertiser_id: this.advertiserId,
      fields: JSON.stringify([
        'campaign_id', 'campaign_name', 'objective_type',
        'budget', 'budget_mode', 'status', 'create_time'
      ]),
    });
  }

  async getAdPerformance(campaignIds, startDate, endDate) {
    if (this.mockMode) return this._mockAdPerformance();

    return this._ttRequest('/report/integrated/get/', 'GET', {
      advertiser_id: this.advertiserId,
      report_type: 'BASIC',
      dimensions: JSON.stringify(['campaign_id']),
      metrics: JSON.stringify([
        'spend', 'impressions', 'clicks', 'ctr', 'cpc',
        'cpm', 'reach', 'frequency', 'video_play_actions',
        'video_watched_2s', 'video_watched_6s',
        'average_video_play', 'conversion', 'cost_per_conversion'
      ]),
      data_level: 'AUCTION_CAMPAIGN',
      start_date: startDate,
      end_date: endDate,
      filtering: JSON.stringify([{
        field_name: 'campaign_ids',
        filter_type: 'IN',
        filter_value: JSON.stringify(campaignIds),
      }]),
    });
  }

  // ─── Engagement Analysis Helper ───────────────────────────

  analyzeEngagement(posts) {
    if (!posts || posts.length === 0) return null;

    const analyzed = posts.map(post => {
      const totalEngagement = (post.likes || 0) + (post.comments || 0) +
        (post.shares || 0) + (post.saves || 0);
      const reach = post.reach || post.views || 1;
      const engagementRate = (totalEngagement / reach) * 100;

      return {
        ...post,
        totalEngagement,
        engagementRate: Math.round(engagementRate * 100) / 100,
        viralityScore: this._calculateViralityScore(post),
        adPotentialScore: this._calculateAdPotential(post),
      };
    });

    // Sort by ad potential
    analyzed.sort((a, b) => b.adPotentialScore - a.adPotentialScore);

    return {
      posts: analyzed,
      summary: {
        totalPosts: analyzed.length,
        avgEngagementRate: Math.round(
          analyzed.reduce((sum, p) => sum + p.engagementRate, 0) / analyzed.length * 100
        ) / 100,
        topPerformer: analyzed[0],
        totalReach: analyzed.reduce((sum, p) => sum + (p.reach || p.views || 0), 0),
        totalEngagement: analyzed.reduce((sum, p) => sum + p.totalEngagement, 0),
        recommendedForAds: analyzed.filter(p => p.adPotentialScore >= 70),
      },
    };
  }

  _calculateViralityScore(post) {
    const shares = post.shares || 0;
    const views = post.views || post.reach || 1;
    const comments = post.comments || 0;

    // Shares are weighted heavily for virality
    const shareRate = (shares / views) * 100;
    const commentRate = (comments / views) * 100;

    let score = 0;
    score += Math.min(shareRate * 20, 40); // Max 40 points from shares
    score += Math.min(commentRate * 10, 30); // Max 30 points from comments
    score += Math.min((post.engagementRate || 0) * 3, 30); // Max 30 points from engagement

    return Math.round(Math.min(score, 100));
  }

  _calculateAdPotential(post) {
    let score = 0;

    // High engagement rate = good ad potential
    const engRate = post.engagementRate || 0;
    if (engRate > 10) score += 30;
    else if (engRate > 5) score += 20;
    else if (engRate > 2) score += 10;

    // High views = proven reach
    const views = post.views || post.reach || 0;
    if (views > 100000) score += 25;
    else if (views > 50000) score += 20;
    else if (views > 10000) score += 15;
    else if (views > 1000) score += 5;

    // Video content performs better as ads
    if (post.type === 'video' || post.tiktok_plays > 0) score += 15;

    // Strong comment engagement = resonating content
    const commentRatio = (post.comments || 0) / Math.max(post.likes || 1, 1);
    if (commentRatio > 0.1) score += 15;
    else if (commentRatio > 0.05) score += 10;

    // Shares indicate trusted content
    if ((post.shares || 0) > 50) score += 15;
    else if ((post.shares || 0) > 10) score += 10;

    return Math.min(score, 100);
  }

  // ─── Mock Data ────────────────────────────────────────────

  _mockVideoList() {
    return {
      videos: [
        {
          item_id: 'tt_video_1',
          video_description: 'ผัดไทยกุ้งสด สูตรลับร้านเรา 🍜 #อาหารไทย #ผัดไทย',
          create_time: Math.floor(Date.now() / 1000) - 86400,
          thumbnail_url: 'https://via.placeholder.com/300x400',
          share_url: 'https://tiktok.com/@mock/video/1',
          duration: 45,
          video_views: 1250000,
          likes: 85000,
          comments: 3200,
          shares: 12000,
          reach: 980000,
          full_video_watched_rate: 0.42,
          average_time_watched: 28.5,
        },
        {
          item_id: 'tt_video_2',
          video_description: 'วิธีทำส้มตำปูปลาร้า แบบเผ็ดจัดจ้าน 🔥',
          create_time: Math.floor(Date.now() / 1000) - 172800,
          thumbnail_url: 'https://via.placeholder.com/300x400',
          share_url: 'https://tiktok.com/@mock/video/2',
          duration: 60,
          video_views: 3500000,
          likes: 245000,
          comments: 8900,
          shares: 34000,
          reach: 2800000,
          full_video_watched_rate: 0.55,
          average_time_watched: 42.0,
        },
        {
          item_id: 'tt_video_3',
          video_description: 'ลูกค้ารีวิวอาหารร้านเรา จะร้องไห้ ดีใจมาก 😭',
          create_time: Math.floor(Date.now() / 1000) - 259200,
          thumbnail_url: 'https://via.placeholder.com/300x400',
          share_url: 'https://tiktok.com/@mock/video/3',
          duration: 30,
          video_views: 780000,
          likes: 52000,
          comments: 4500,
          shares: 8900,
          reach: 650000,
          full_video_watched_rate: 0.38,
          average_time_watched: 18.2,
        },
      ],
    };
  }

  _mockVideoInsights(videoIds) {
    return {
      videos: videoIds.map((id, i) => ({
        item_id: id,
        video_views: 1000000 + i * 500000,
        likes: 50000 + i * 30000,
        comments: 2000 + i * 1000,
        shares: 5000 + i * 3000,
        reach: 800000 + i * 400000,
        full_video_watched_rate: 0.35 + i * 0.1,
        average_time_watched: 20 + i * 10,
        new_followers: 500 + i * 200,
      })),
    };
  }

  _mockAccountAnalytics() {
    return {
      followers_count: 125000,
      profile_views: 45000,
      video_views: 8500000,
      likes: 620000,
      comments: 28000,
      shares: 15000,
    };
  }

  _mockAudienceInsights() {
    return {
      audience_countries: [
        { country: 'TH', percentage: 0.75 },
        { country: 'US', percentage: 0.08 },
        { country: 'MY', percentage: 0.05 },
      ],
      audience_genders: [
        { gender: 'female', percentage: 0.62 },
        { gender: 'male', percentage: 0.38 },
      ],
      audience_age_distribution: [
        { age_range: '18-24', percentage: 0.35 },
        { age_range: '25-34', percentage: 0.40 },
        { age_range: '35-44', percentage: 0.15 },
        { age_range: '45+', percentage: 0.10 },
      ],
    };
  }

  _mockAdCampaigns() {
    return {
      list: [
        { campaign_id: 'tt_camp_1', campaign_name: 'โปรโมทเมนูใหม่', objective_type: 'TRAFFIC', budget: 5000, status: 'CAMPAIGN_STATUS_ENABLE' },
        { campaign_id: 'tt_camp_2', campaign_name: 'เพิ่มยอดฟอลโลว์', objective_type: 'REACH', budget: 3000, status: 'CAMPAIGN_STATUS_ENABLE' },
      ],
    };
  }

  _mockAdPerformance() {
    return {
      list: [
        {
          dimensions: { campaign_id: 'tt_camp_1' },
          metrics: {
            spend: '4500.00',
            impressions: '250000',
            clicks: '12500',
            ctr: '5.00',
            cpc: '0.36',
            cpm: '18.00',
            reach: '180000',
            video_play_actions: '200000',
            conversion: '350',
            cost_per_conversion: '12.86',
          },
        },
      ],
    };
  }
}

module.exports = new TikTokAnalyticsService();
