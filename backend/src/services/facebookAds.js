/**
 * Facebook Marketing API Integration
 * Handles: Campaign creation, Ad management, Budget control, Engagement fetching
 *
 * Required env vars:
 *   FB_APP_ID, FB_APP_SECRET, FB_ACCESS_TOKEN, FB_AD_ACCOUNT_ID, FB_PAGE_ID
 *
 * Uses Facebook Marketing API v21.0
 */

const { v4: uuidv4 } = require('uuid');

const FB_API_BASE = 'https://graph.facebook.com/v21.0';

class FacebookAdsService {
  constructor() {
    this.accessToken = null;
    this.adAccountId = null;
    this.pageId = null;
    this.mockMode = false;
  }

  init() {
    this.accessToken = process.env.FB_ACCESS_TOKEN;
    this.adAccountId = process.env.FB_AD_ACCOUNT_ID;
    this.pageId = process.env.FB_PAGE_ID;

    if (!this.accessToken || this.accessToken === 'your_fb_access_token_here') {
      console.warn('Facebook API not configured. Using mock mode.');
      this.mockMode = true;
      return;
    }

    console.log('Facebook Ads service initialized');
  }

  // ─── HTTP Helper ──────────────────────────────────────────

  async _fbRequest(endpoint, method = 'GET', body = null) {
    if (this.mockMode) throw new Error('Facebook API in mock mode');

    const url = new URL(`${FB_API_BASE}${endpoint}`);
    if (method === 'GET') {
      url.searchParams.set('access_token', this.accessToken);
    }

    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    if (body) {
      if (method === 'GET') {
        Object.entries(body).forEach(([k, v]) =>
          url.searchParams.set(k, typeof v === 'object' ? JSON.stringify(v) : v)
        );
      } else {
        options.body = JSON.stringify({ ...body, access_token: this.accessToken });
      }
    }

    const response = await fetch(url.toString(), options);
    const data = await response.json();

    if (data.error) {
      throw new Error(`Facebook API Error: ${data.error.message} (code: ${data.error.code})`);
    }

    return data;
  }

  // ─── Page Engagement Analytics ────────────────────────────

  async getPagePosts(limit = 25, since = null) {
    if (this.mockMode) return this._mockPagePosts();

    const params = {
      fields: [
        'id', 'message', 'created_time', 'type', 'permalink_url',
        'full_picture', 'attachments',
        'insights.metric(post_impressions,post_reach,post_engaged_users,post_clicks)',
        'likes.summary(true)', 'comments.summary(true)', 'shares'
      ].join(','),
      limit,
    };
    if (since) params.since = since;

    return this._fbRequest(`/${this.pageId}/posts`, 'GET', params);
  }

  async getPostInsights(postId) {
    if (this.mockMode) return this._mockPostInsights(postId);

    return this._fbRequest(`/${postId}/insights`, 'GET', {
      metric: [
        'post_impressions', 'post_impressions_unique',
        'post_engaged_users', 'post_clicks',
        'post_reactions_by_type_total', 'post_video_views'
      ].join(','),
    });
  }

  async getPageInsights(period = 'day', since = null, until = null) {
    if (this.mockMode) return this._mockPageInsights();

    const params = {
      metric: [
        'page_impressions', 'page_engaged_users',
        'page_post_engagements', 'page_fan_adds',
        'page_views_total', 'page_fans'
      ].join(','),
      period,
    };
    if (since) params.since = since;
    if (until) params.until = until;

    return this._fbRequest(`/${this.pageId}/insights`, 'GET', params);
  }

  // ─── Campaign Management ──────────────────────────────────

  async createCampaign({ name, objective, dailyBudget, status = 'PAUSED', specialAdCategories = [] }) {
    if (this.mockMode) return this._mockCreateCampaign(name, objective, dailyBudget);

    return this._fbRequest(`/act_${this.adAccountId}/campaigns`, 'POST', {
      name,
      objective: this._mapObjective(objective),
      status,
      special_ad_categories: specialAdCategories,
      daily_budget: Math.round(dailyBudget * 100), // Convert to cents
    });
  }

  async updateCampaign(campaignId, updates) {
    if (this.mockMode) return this._mockUpdateCampaign(campaignId, updates);

    const params = {};
    if (updates.name) params.name = updates.name;
    if (updates.status) params.status = updates.status;
    if (updates.dailyBudget) params.daily_budget = Math.round(updates.dailyBudget * 100);
    if (updates.lifetimeBudget) params.lifetime_budget = Math.round(updates.lifetimeBudget * 100);

    return this._fbRequest(`/${campaignId}`, 'POST', params);
  }

  async getCampaignInsights(campaignId, datePreset = 'last_7d') {
    if (this.mockMode) return this._mockCampaignInsights(campaignId);

    return this._fbRequest(`/${campaignId}/insights`, 'GET', {
      fields: [
        'campaign_name', 'impressions', 'reach', 'clicks',
        'ctr', 'cpc', 'cpm', 'spend', 'actions',
        'cost_per_action_type', 'frequency', 'video_p25_watched_actions',
        'video_p50_watched_actions', 'video_p75_watched_actions',
        'video_p100_watched_actions'
      ].join(','),
      date_preset: datePreset,
    });
  }

  // ─── Ad Set Management ────────────────────────────────────

  async createAdSet({
    campaignId, name, dailyBudget, targeting, optimizationGoal = 'LINK_CLICKS',
    billingEvent = 'IMPRESSIONS', status = 'PAUSED', startTime = null
  }) {
    if (this.mockMode) return this._mockCreateAdSet(name);

    const params = {
      campaign_id: campaignId,
      name,
      daily_budget: Math.round(dailyBudget * 100),
      optimization_goal: optimizationGoal,
      billing_event: billingEvent,
      status,
      targeting: this._buildTargeting(targeting),
    };
    if (startTime) params.start_time = startTime;

    return this._fbRequest(`/act_${this.adAccountId}/adsets`, 'POST', params);
  }

  async updateAdSet(adsetId, updates) {
    if (this.mockMode) return this._mockUpdateAdSet(adsetId, updates);

    const params = {};
    if (updates.name) params.name = updates.name;
    if (updates.status) params.status = updates.status;
    if (updates.dailyBudget) params.daily_budget = Math.round(updates.dailyBudget * 100);
    if (updates.targeting) params.targeting = this._buildTargeting(updates.targeting);

    return this._fbRequest(`/${adsetId}`, 'POST', params);
  }

  // ─── Ad Creative & Ad Management ─────────────────────────

  async createAdCreative({ name, pageId, headline, body, linkUrl, imageUrl, videoId, callToAction = 'LEARN_MORE' }) {
    if (this.mockMode) return this._mockCreateCreative(name);

    const objectStorySpec = {
      page_id: pageId || this.pageId,
    };

    if (videoId) {
      objectStorySpec.video_data = {
        video_id: videoId,
        title: headline,
        message: body,
        call_to_action: {
          type: callToAction,
          value: { link: linkUrl },
        },
      };
    } else {
      objectStorySpec.link_data = {
        message: body,
        link: linkUrl,
        name: headline,
        call_to_action: { type: callToAction },
      };
      if (imageUrl) objectStorySpec.link_data.picture = imageUrl;
    }

    return this._fbRequest(`/act_${this.adAccountId}/adcreatives`, 'POST', {
      name,
      object_story_spec: objectStorySpec,
    });
  }

  async createAd({ adsetId, name, creativeId, status = 'PAUSED' }) {
    if (this.mockMode) return this._mockCreateAd(name);

    return this._fbRequest(`/act_${this.adAccountId}/ads`, 'POST', {
      name,
      adset_id: adsetId,
      creative: { creative_id: creativeId },
      status,
    });
  }

  async getAdInsights(adId, datePreset = 'last_7d') {
    if (this.mockMode) return this._mockAdInsights(adId);

    return this._fbRequest(`/${adId}/insights`, 'GET', {
      fields: [
        'ad_name', 'impressions', 'reach', 'clicks', 'ctr',
        'cpc', 'cpm', 'spend', 'actions', 'cost_per_action_type',
        'frequency'
      ].join(','),
      date_preset: datePreset,
    });
  }

  // ─── Budget Management ────────────────────────────────────

  async adjustBudget(campaignId, newDailyBudget) {
    return this.updateCampaign(campaignId, {
      dailyBudget: newDailyBudget,
    });
  }

  async pauseCampaign(campaignId) {
    return this.updateCampaign(campaignId, { status: 'PAUSED' });
  }

  async resumeCampaign(campaignId) {
    return this.updateCampaign(campaignId, { status: 'ACTIVE' });
  }

  async getAccountSpend(datePreset = 'last_7d') {
    if (this.mockMode) return this._mockAccountSpend();

    return this._fbRequest(`/act_${this.adAccountId}/insights`, 'GET', {
      fields: 'spend,impressions,clicks,ctr,cpc,cpm,actions',
      date_preset: datePreset,
      level: 'account',
    });
  }

  // ─── Audience Tools ───────────────────────────────────────

  async getCustomAudiences() {
    if (this.mockMode) return this._mockAudiences();

    return this._fbRequest(`/act_${this.adAccountId}/customaudiences`, 'GET', {
      fields: 'id,name,approximate_count,subtype',
    });
  }

  async getTargetingSearch(query, type = 'adinterest') {
    if (this.mockMode) return this._mockTargetingSearch(query);

    return this._fbRequest('/search', 'GET', {
      type,
      q: query,
    });
  }

  // ─── Helper Methods ───────────────────────────────────────

  _mapObjective(objective) {
    const map = {
      'AWARENESS': 'OUTCOME_AWARENESS',
      'TRAFFIC': 'OUTCOME_TRAFFIC',
      'ENGAGEMENT': 'OUTCOME_ENGAGEMENT',
      'LEADS': 'OUTCOME_LEADS',
      'APP_PROMOTION': 'OUTCOME_APP_PROMOTION',
      'SALES': 'OUTCOME_SALES',
      'CONVERSIONS': 'OUTCOME_SALES',
    };
    return map[objective] || objective;
  }

  _buildTargeting(targeting) {
    const spec = {};

    if (targeting.ageMin) spec.age_min = targeting.ageMin;
    if (targeting.ageMax) spec.age_max = targeting.ageMax;
    if (targeting.genders) spec.genders = targeting.genders;
    if (targeting.locations) {
      spec.geo_locations = {
        countries: targeting.locations.countries || [],
        cities: targeting.locations.cities || [],
      };
    }
    if (targeting.interests) {
      spec.flexible_spec = [{
        interests: targeting.interests.map(i =>
          typeof i === 'string' ? { id: i, name: i } : i
        ),
      }];
    }
    if (targeting.customAudiences) {
      spec.custom_audiences = targeting.customAudiences.map(id => ({ id }));
    }
    if (targeting.excludedAudiences) {
      spec.excluded_custom_audiences = targeting.excludedAudiences.map(id => ({ id }));
    }

    return spec;
  }

  // ─── Mock Data ────────────────────────────────────────────

  _mockPagePosts() {
    return {
      data: [
        {
          id: 'mock_post_1',
          message: 'โปรโมชั่นพิเศษ! ลด 50% ทุกเมนู 🔥',
          created_time: new Date(Date.now() - 86400000).toISOString(),
          type: 'photo',
          permalink_url: 'https://facebook.com/mock/post1',
          full_picture: 'https://via.placeholder.com/600x400',
          likes: { summary: { total_count: 1523 } },
          comments: { summary: { total_count: 234 } },
          shares: { count: 89 },
          insights: { data: [
            { name: 'post_impressions', values: [{ value: 45000 }] },
            { name: 'post_reach', values: [{ value: 32000 }] },
            { name: 'post_engaged_users', values: [{ value: 2800 }] },
            { name: 'post_clicks', values: [{ value: 1200 }] },
          ]},
        },
        {
          id: 'mock_post_2',
          message: 'วิธีทำผัดไทยสูตรเด็ด ดูจบแล้วทำเองได้เลย!',
          created_time: new Date(Date.now() - 172800000).toISOString(),
          type: 'video',
          permalink_url: 'https://facebook.com/mock/post2',
          full_picture: 'https://via.placeholder.com/600x400',
          likes: { summary: { total_count: 3200 } },
          comments: { summary: { total_count: 567 } },
          shares: { count: 234 },
          insights: { data: [
            { name: 'post_impressions', values: [{ value: 120000 }] },
            { name: 'post_reach', values: [{ value: 85000 }] },
            { name: 'post_engaged_users', values: [{ value: 8500 }] },
            { name: 'post_clicks', values: [{ value: 4500 }] },
          ]},
        },
        {
          id: 'mock_post_3',
          message: 'ลูกค้ารีวิว: อร่อยมากค่ะ ต้องกลับมาอีก!',
          created_time: new Date(Date.now() - 259200000).toISOString(),
          type: 'photo',
          permalink_url: 'https://facebook.com/mock/post3',
          full_picture: 'https://via.placeholder.com/600x400',
          likes: { summary: { total_count: 890 } },
          comments: { summary: { total_count: 145 } },
          shares: { count: 56 },
          insights: { data: [
            { name: 'post_impressions', values: [{ value: 28000 }] },
            { name: 'post_reach', values: [{ value: 20000 }] },
            { name: 'post_engaged_users', values: [{ value: 1800 }] },
            { name: 'post_clicks', values: [{ value: 650 }] },
          ]},
        },
      ],
    };
  }

  _mockPostInsights(postId) {
    return {
      data: [
        { name: 'post_impressions', values: [{ value: 45000 }] },
        { name: 'post_reach', values: [{ value: 32000 }] },
        { name: 'post_engaged_users', values: [{ value: 2800 }] },
        { name: 'post_clicks', values: [{ value: 1200 }] },
      ],
    };
  }

  _mockPageInsights() {
    return {
      data: [
        { name: 'page_impressions', values: [{ value: 150000 }] },
        { name: 'page_engaged_users', values: [{ value: 12000 }] },
        { name: 'page_post_engagements', values: [{ value: 8500 }] },
        { name: 'page_fan_adds', values: [{ value: 250 }] },
      ],
    };
  }

  _mockCreateCampaign(name, objective, dailyBudget) {
    return { id: `mock_campaign_${uuidv4().slice(0, 8)}`, name, objective, daily_budget: dailyBudget };
  }

  _mockUpdateCampaign(id, updates) {
    return { success: true, id, ...updates };
  }

  _mockCampaignInsights(campaignId) {
    return {
      data: [{
        campaign_name: 'Mock Campaign',
        impressions: '45230',
        reach: '32100',
        clicks: '1850',
        ctr: '4.09',
        cpc: '2.45',
        cpm: '100.22',
        spend: '4535.00',
        frequency: '1.41',
        actions: [
          { action_type: 'link_click', value: '1850' },
          { action_type: 'post_engagement', value: '3200' },
          { action_type: 'page_engagement', value: '3500' },
        ],
      }],
    };
  }

  _mockCreateAdSet(name) {
    return { id: `mock_adset_${uuidv4().slice(0, 8)}`, name };
  }

  _mockUpdateAdSet(id, updates) {
    return { success: true, id, ...updates };
  }

  _mockCreateCreative(name) {
    return { id: `mock_creative_${uuidv4().slice(0, 8)}`, name };
  }

  _mockCreateAd(name) {
    return { id: `mock_ad_${uuidv4().slice(0, 8)}`, name };
  }

  _mockAdInsights(adId) {
    return {
      data: [{
        ad_name: 'Mock Ad',
        impressions: '12500',
        reach: '9800',
        clicks: '520',
        ctr: '4.16',
        cpc: '1.92',
        cpm: '80.00',
        spend: '1000.00',
        frequency: '1.28',
      }],
    };
  }

  _mockAccountSpend() {
    return {
      data: [{
        spend: '15000.00',
        impressions: '450000',
        clicks: '18500',
        ctr: '4.11',
        cpc: '0.81',
        cpm: '33.33',
      }],
    };
  }

  _mockAudiences() {
    return {
      data: [
        { id: 'aud_1', name: 'Website Visitors - 30 days', approximate_count: 15000, subtype: 'WEBSITE' },
        { id: 'aud_2', name: 'Lookalike - Top Customers', approximate_count: 850000, subtype: 'LOOKALIKE' },
        { id: 'aud_3', name: 'Engaged Page Followers', approximate_count: 25000, subtype: 'ENGAGEMENT' },
      ],
    };
  }

  _mockTargetingSearch(query) {
    return {
      data: [
        { id: '6003139266461', name: 'อาหารไทย', audience_size: 12500000, type: 'interests' },
        { id: '6003397425735', name: 'ร้านอาหาร', audience_size: 8900000, type: 'interests' },
        { id: '6003236777235', name: 'ทำอาหาร', audience_size: 5600000, type: 'interests' },
      ],
    };
  }
}

module.exports = new FacebookAdsService();
